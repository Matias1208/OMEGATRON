import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

const APP_NAME = "omegatron";

/**
 * Singleton del Admin SDK. firebase-admin guarda sus apps en un registro global del
 * paquete, así que getApps() sobrevive al hot-reload de Next.js y no se reinicializa.
 */
function getFirebaseApp(): App {
  const existente = getApps().find((app) => app.name === APP_NAME);
  if (existente) return existente;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL } = process.env;
  const faltantes = Object.entries({ FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL })
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);
  if (faltantes.length) {
    throw new Error(`[firebase] Faltan variables de entorno: ${faltantes.join(", ")}`);
  }

  try {
    return initializeApp(
      {
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          // En .env la clave viene en una sola línea con "\n" literales.
          privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        }),
        databaseURL: FIREBASE_DATABASE_URL,
      },
      APP_NAME,
    );
  } catch (error) {
    // Carrera entre dos peticiones en frío: la otra ya la creó.
    if (getApps().some((app) => app.name === APP_NAME)) return getApp(APP_NAME);
    throw error;
  }
}

/**
 * Realtime Database. Se inicializa en el primer uso (no al importar el módulo), así
 * `next build` y las rutas que no usan Firebase funcionan aunque falten las variables.
 */
export function getRtdb(): Database {
  return getDatabase(getFirebaseApp());
}
