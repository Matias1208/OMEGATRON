import { after } from "next/server";
import { TipoAlerta, TipoEPP } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRtdb } from "@/lib/firebase";
import { ejecutarDispensacion } from "@/features/dispensa/service";
import { rfidSchema } from "@/features/dispensa/schemas";
import type { CodigoRechazo, EntregaCreada, ResultadoDispensacion } from "@/features/dispensa/types";
import { revertirEntregas } from "@/features/inventario/stock";
import { registrarAlerta } from "@/features/alertas/service";
import { registrarLectura } from "@/features/lecturas/service";
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

const CODIGOS_ERROR: CodigoRechazo[] = [
  "HARDWARE_NO_DISPONIBLE",
  "ERROR_INTERNO",
  "ESTACION_NO_ENCONTRADA",
  "ESTACION_SIN_AREA",
  "AREA_NO_ENCONTRADA",
];

async function registrarResultadoLectura(
  rfid: string,
  estacionId: string | null,
  areaId: string | null,
  resultado: ResultadoDispensacion,
) {
  const uid = rfidSchema.safeParse(rfid);
  let operarioId: string | null = resultado.ok ? resultado.operario.id : null;

  if (!resultado.ok && uid.success) {
    try {
      const operario = await prisma.operario.findUnique({
        where: { rfid: uid.data },
        select: { id: true, areaId: true },
      });
      operarioId = operario?.id ?? null;
      areaId ??= operario?.areaId ?? null;
    } catch (error) {
      console.error("[lecturas] No se pudo asociar la lectura con el operario:", error);
    }
  }

  await registrarLectura({
    rfid: uid.success ? uid.data : rfid,
    operarioId,
    estacionId: resultado.ok ? resultado.estacion.id : estacionId,
    areaId: resultado.ok ? resultado.area.id : areaId,
    resultado: resultado.ok ? "CONCEDIDO" : CODIGOS_ERROR.includes(resultado.codigo) ? "ERROR" : "DENEGADO",
    motivo: resultado.ok ? null : resultado.codigo,
    entregas: resultado.ok ? resultado.entregas.length : 0,
  });
}

/**
 * Flujo completo en una estación física: reglas de negocio → orden al motor.
 * Lo usan el endpoint de la ESP32 y el kiosco, para que ambos se comporten igual.
 * Si la orden no llega al motor, las entregas se anulan y el stock vuelve al lote.
 */
export async function dispensarEnEstacion(rfid: string, estacionRef: string): Promise<ResultadoDispensacion> {
  let estacionId: string | null = null;
  let areaId: string | null = null;
  try {
    const estacion = await buscarEstacion(estacionRef);
    if (!estacion) {
      const resultado: ResultadoDispensacion = {
        ok: false,
        codigo: "ESTACION_NO_ENCONTRADA",
        mensaje: "Estación no registrada o inactiva.",
      };
      await registrarResultadoLectura(rfid, null, null, resultado);
      return resultado;
    }
    estacionId = estacion.id;
    areaId = estacion.areaId;
    if (!estacion.areaId) {
      const resultado: ResultadoDispensacion = {
        ok: false,
        codigo: "ESTACION_SIN_AREA",
        mensaje: "La estación no tiene un área asignada.",
      };
      await registrarResultadoLectura(rfid, estacionId, areaId, resultado);
      return resultado;
    }

    const dispensacion = await ejecutarDispensacion({ rfid, areaId: estacion.areaId, estacionId: estacion.id });
    if (!dispensacion.ok) {
      await registrarResultadoLectura(rfid, estacionId, areaId, dispensacion);
      return dispensacion;
    }

    const entregaMotor = elegirEntregaParaMotor(dispensacion.entregas);
    try {
      const comando = await enviarComandoMotor(estacion.codigo, entregaMotor);
      const resultado: ResultadoDispensacion = {
        ...dispensacion,
        comandoMotor: { motor: comando.motor, entregaId: entregaMotor.entregaId, epp: entregaMotor.nombre, simulado: esSimulado() },
      };
      await registrarResultadoLectura(rfid, estacionId, areaId, resultado);
      return resultado;
    } catch (error) {
      console.error("[hardware] Falló la orden al motor:", error);
      const ids = dispensacion.entregas.map((e) => e.entregaId);
      await revertirEntregas(ids, "No se pudo enviar el comando al motor (Firebase)");
      after(() =>
        registrarAlerta({
          tipo: TipoAlerta.FALLA_HARDWARE,
          mensaje: `🔌 FALLA HARDWARE: no se pudo enviar la orden de dispensación a la estación ${estacion.codigo}. Revisar conexión con Firebase.`,
          metadata: { estacionId: estacion.id, entregaIds: ids },
        }),
      );
      const resultado: ResultadoDispensacion = {
        ok: false,
        codigo: "HARDWARE_NO_DISPONIBLE",
        mensaje: "No se pudo comunicar con el dispensador. Intente de nuevo.",
      };
      await registrarResultadoLectura(rfid, estacionId, areaId, resultado);
      return resultado;
    }
  } catch (error) {
    console.error("[hardware] Error procesando la lectura RFID:", error);
    const resultado: ResultadoDispensacion = {
      ok: false,
      codigo: "ERROR_INTERNO",
      mensaje: "Error interno al procesar la dispensación. Intenta de nuevo.",
    };
    await registrarResultadoLectura(rfid, estacionId, areaId, resultado);
    return resultado;
  }
}
