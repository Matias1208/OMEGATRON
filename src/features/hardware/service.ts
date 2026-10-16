import { TipoEPP } from "@prisma/client";
import { getRtdb } from "@/lib/firebase";
import type { EntregaCreada } from "@/features/dispensa/types";
import type { ComandoMotor } from "./schemas";

// Prototipo del hackathon: la máquina física tiene un solo motor (dispensador de guantes).
// El backend sigue registrando todo el EPP requerido; solo el comando físico se simplifica.
export const MOTOR_DEMO = 1;
const FIREBASE_TIMEOUT_MS = 3500;

/** EPP que sale por el motor único: guantes si están entre las entregas, si no la primera. */
export function elegirEntregaParaMotor(entregas: EntregaCreada[]): EntregaCreada {
  return entregas.find((e) => e.tipo === TipoEPP.GUANTES) ?? entregas[0];
}

/** Escribe el comando en /estaciones/{estacionId}/comando; la ESP32 está suscrita a ese nodo. */
export async function enviarComandoMotor(estacionId: string, entrega: EntregaCreada): Promise<ComandoMotor> {
  const comando: ComandoMotor = {
    motor: MOTOR_DEMO,
    epp_id: entrega.eppId,
    entrega_id: entrega.entregaId,
    timestamp: Date.now(),
    trigger: Math.random(),
  };

  // Modo simulado: permite probar el flujo completo sin Firebase ni ESP32 conectados.
  if (process.env.HARDWARE_SIMULADO === "true") {
    console.log(`[hardware simulado] /estaciones/${estacionId}/comando ←`, comando);
    return comando;
  }

  // El HTTPClient de la ESP32 corta a los 5 s por defecto: hay que responder antes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getRtdb().ref(`estaciones/${estacionId}/comando`).set(comando),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timeout escribiendo en Firebase")), FIREBASE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }

  return comando;
}
