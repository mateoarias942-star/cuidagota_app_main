import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // 👈 Agregamos esta importación

const firebaseConfig = {
  apiKey: "AIzaSyD3GB3InbcRxH5bt6IohVKy-ia0dtRd6c8",
  authDomain: "cuidagota.firebaseapp.com",
  databaseURL: "https://cuidagota-default-rtdb.firebaseio.com",
  projectId: "cuidagota",
  storageBucket: "cuidagota.firebasestorage.app",
  messagingSenderId: "130938190941",
  appId: "1:130938190941:web:468a79a5425e42fe1861b4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 👈 Y agregamos esta línea final para exportar la base de datos
export const database = getDatabase(app);