# CuidaGota 💧

App para monitorear el consumo de agua de un caudalímetro (ESP32 → Firebase Realtime Database).

## Cómo correrla

```bash
npm install
npx expo start
```

## Estructura del front end

- `constants/theme.ts`: paleta (azul noche + ámbar), espaciados, radios y tipografías. Cambiá los colores acá.
- `constants/app-config.ts`: tarifa por litro.
- `app/(tabs)/index.tsx`: pantalla de consumo.
- `app/(tabs)/info.tsx`: pantalla de información.
- `components/`: gráfica de barras, indicador en vivo, esqueletos de carga.
