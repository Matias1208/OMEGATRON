import { after } from "next/server";
import { TipoAlerta, TipoEPP } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRtdb } from "@/lib/firebase";
import { ejecutarDispensacion } from "@/features/dispensa/service";
import type { EntregaCreada, ResultadoDispensacion } from "@/features/dispensa/types";
import { revertirEntregas } from "@/features/inventario/stock";
import { registrarAlerta } from "@/features/alertas/service";
import type { ComandoMotor } from "./schemas";

// Prototipo del hackathon: la máquina física tiene un solo motor (dispensador de guantes).
// El backend sigue registrando todo el EPP requerido; solo el comando físico se simplifica.
export const MOTOR_DEMO = 1;
const FIREBASE_TIMEOUT_MS = 3500;

const esSimulado = () => process.env.HARDWARE_SIMULADO === "true";

/** EPP que sale por el motor único: guantes si están entre las entregas, si no la primera. */
export function elegirEntregaParaMotor(entregas: EntregaCreada[]): EntregaCreada {
  return entregas.find((e) => e.tipo === TipoEPP.GUANTES) ?? entregas[0];
}

/** Escribe el comando en /estaciones/{codigo}/comando; la ESP32 está suscrita a ese nodo. */
export async function enviarComandoMotor(estacionCodigo: string, entrega: EntregaCreada): Promise<ComandoMotor> {
  const comando: ComandoMotor = {
    motor: MOTOR_DEMO,
    epp_id: entrega.eppId,
    entrega_id: entrega.entregaId,
    timestamp: Date.now(),
    trigger: Math.random(),
  };

  // Modo simulado: permite probar el flujo completo sin Firebase ni ESP32 conectados.
  if (esSimulado()) {
    console.log(`[hardware simulado] /estaciones/${estacionCodigo}/comando ←`, comando);
    return comando;
  }

  // El HTTPClient de la ESP32 corta a los 5 s por defecto: hay que responder antes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getRtdb().ref(`estaciones/${estacionCodigo}/comando`).set(comando),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timeout escribiendo en Firebase")), FIREBASE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return comando;
}

/** Estación activa por id o por código ("EST-01"). */
export function buscarEstacion(ref: string) {
  return prisma.estacion.findFirst({
    where: { activa: true, OR: [{ id: ref }, { codigo: ref }] },
    select: { id: true, codigo: true, areaId: true },
  });
}

/**
 * Flujo completo en una estación física: reglas de negocio → orden al motor.
 * Lo usan el endpoint de la ESP32 y el kiosco, para que ambos se comporten igual.
 * Si la orden no llega al motor, las entregas se anulan y el stock vuelve al lote.
 */
export async function dispensarEnEstacion(rfid: string, estacionRef: string): Promise<ResultadoDispensacion> {
  const estacion = await buscarEstacion(estacionRef);
  if (!estacion) {
    return { ok: false, codigo: "ESTACION_NO_ENCONTRADA", mensaje: "Estación no registrada o inactiva." };
  }
  if (!estacion.areaId) {
    return { ok: false, codigo: "ESTACION_SIN_AREA", mensaje: "La estación no tiene un área asignada." };
  }

  const resultado = await ejecutarDispensacion({ rfid, areaId: estacion.areaId, estacionId: estacion.id });
  if (!resultado.ok) return resultado;

  const entregaMotor = elegirEntregaParaMotor(resultado.entregas);
  try {
    const comando = await enviarComandoMotor(estacion.codigo, entregaMotor);
    return {
      ...resultado,
      comandoMotor: { motor: comando.motor, entregaId: entregaMotor.entregaId, epp: entregaMotor.nombre, simulado: esSimulado() },
    };
  } catch (error) {
    console.error("[hardware] Falló la orden al motor:", error);
    const ids = resultado.entregas.map((e) => e.entregaId);
    await revertirEntregas(ids, "No se pudo enviar el comando al motor (Firebase)");
    after(() =>
      registrarAlerta({
        tipo: TipoAlerta.FALLA_HARDWARE,
        mensaje: `🔌 FALLA HARDWARE: no se pudo enviar la orden de dispensación a la estación ${estacion.codigo}. Revisar conexión con Firebase.`,
        metadata: { estacionId: estacion.id, entregaIds: ids },
      }),
    );
    return {
      ok: false,
      codigo: "HARDWARE_NO_DISPONIBLE",
      mensaje: "No se pudo comunicar con el dispensador. Intente de nuevo.",
    };
  }
}
