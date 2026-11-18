#include <WiFi.h>
#include <WiFiMulti.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <Preferences.h>
#include <Firebase_ESP_Client.h>

// Librerías auxiliares requeridas por Firebase
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// --- Credenciales de Firebase (¡Reemplazar con las tuyas!) ---
#define API_KEY "AIzaSyD3GB3InbcRxH5bt6IohVKy-ia0dtRd6c8"
#define DATABASE_URL "https://cuidagota-default-rtdb.firebaseio.com"

// --- Objetos de Firebase ---
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// --- Configuración de Redes Wi-Fi ---
WiFiMulti wifiMulti;

// --- Memoria Flash (Persistencia) ---
Preferences preferences;

// --- Configuración del Sensor YF-S201 ---
const int SENSOR_PIN = 4;        // Pin del cable amarillo
volatile int pulsos = 0;         // Contador en interrupción
float factor_conversion = 7.5;   // Factor estándar YF-S201
float volumenTotal = 0.0;        // Totalizador histórico

// --- Temporizadores Anti-Delay ---
unsigned long tiempoAnterior = 0;
const long intervaloMedicion = 1000; // Mide caudal cada 1 segundo (1000 ms)
unsigned long tiempoUltimoEnvio = 0;
const long intervaloEnvioFirebase = 4000; // Envía a la nube cada 4 seg (solo si hay agua)

// Función de interrupción súper rápida
void IRAM_ATTR contarPulsos() {
  pulsos++;
}

void setup() {
  Serial.begin(9600);
  delay(1000); // Pausa de estabilización
  Serial.println("\n--- Iniciando ESP32: Medidor Inteligente ---");

  // 1. Configurar Sensor e Interrupción
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), contarPulsos, RISING);

  // 2. Recuperar el histórico de la memoria Flash
  preferences.begin("mediciones", false);
  volumenTotal = preferences.getFloat("totalLitros", 0.0);
  Serial.print("Volumen histórico recuperado de memoria: ");
  Serial.print(volumenTotal);
  Serial.println(" Litros.");

  // 3. Configurar Wi-Fi Multi con Timeout de seguridad
  WiFi.mode(WIFI_STA);
  wifiMulti.addAP("Informatica2043", "Info20432025+");
  wifiMulti.addAP("BRRR BRRR PATAPIM", "12345678");
  wifiMulti.addAP("Ale Schatten", "agarazaza");

  Serial.print("Buscando redes y conectando...");
  
  int intentos = 0;
  while (wifiMulti.run() != WL_CONNECTED && intentos < 30) { // Máximo 15 segundos
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n¡Wi-Fi Conectado con éxito!");
    Serial.print("IP local: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ No se pudo conectar a ninguna red. Reintentando en el próximo ciclo...");
  }

  // 4. Configurar e Inicializar Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Registro anónimo para escribir en la base de datos
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Autenticación en Firebase exitosa.");
    signupOK = true;
  } else {
    Serial.printf("Error en Firebase: %s\n", config.signer.signupError.message.c_str());
  }
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true); // Reconexión automática si se cae el Wi-Fi

  // 5. Configurar Sistema OTA
  ArduinoOTA.setHostname("esp32-medidor-agua");
  ArduinoOTA.begin();
  Serial.println("Sistema OTA listo y escuchando.");
}

void loop() {
  // Mantener OTA activo y Wi-Fi conectado
  if (wifiMulti.run() == WL_CONNECTED) {
    ArduinoOTA.handle();
  }

  // --- LÓGICA PRINCIPAL (Basada en millis) ---
  unsigned long tiempoActual = millis();

  // Se ejecuta cada 1 segundo exacto
  if (tiempoActual - tiempoAnterior >= intervaloMedicion) {
    tiempoAnterior = tiempoActual;

    // Pausar interrupciones para copiar y resetear los pulsos de forma segura
    noInterrupts();
    int pulsosMomento = pulsos;
    pulsos = 0;
    interrupts();

    // Calcular Caudal (L/min)
    float caudalLmin = (pulsosMomento / factor_conversion);

    // FILTRO ANTI-RUIDO: Ignora flujos menores a 0.15 L/min
    if (caudalLmin < 0.15) {
      caudalLmin = 0.0;
    }

    // Si hay agua fluyendo, procesamos
    if (caudalLmin > 0.0) {
      // Calculamos qué fracción de litro pasó en este último segundo
      float litrosEnEsteSegundo = (caudalLmin / 60.0);
      volumenTotal += litrosEnEsteSegundo;

      // Guardar el nuevo total en la memoria Flash (Protección contra cortes)
      preferences.putFloat("totalLitros", volumenTotal);

      // Mostrar por consola (útil si la tienes por cable)
      Serial.print("💧 Caudal: "); Serial.print(caudalLmin); Serial.print(" L/min | ");
      Serial.print("Total: "); Serial.print(volumenTotal); Serial.println(" Litros");

      // --- LÓGICA DE ENVÍO A FIREBASE (Cada 4 segundos mientras pase agua) ---
      if (signupOK && Firebase.ready() && (tiempoActual - tiempoUltimoEnvio >= intervaloEnvioFirebase)) {
        tiempoUltimoEnvio = tiempoActual;

        // Construimos el JSON (Opción A: Histórico)
        FirebaseJson json;
        json.set("caudal", caudalLmin);
        json.set("volumenTotal", volumenTotal);
        json.set("timestamp/.sv", "timestamp"); // Firebase asignará la hora exacta

        // Enviamos el JSON creando un nodo nuevo (Push) en la ruta /lecturas
        if (Firebase.RTDB.pushJSON(&fbdo, "/lecturas", &json)) {
          Serial.println("✅ Dato histórico enviado a Firebase correctamente.");
        } else {
          Serial.println("❌ Error enviando a Firebase: " + fbdo.errorReason());
        }
      }
    }
  }
}
