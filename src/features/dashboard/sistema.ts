import { EstadoAlerta, EstadoEntrega } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaEcuador } from "@/lib/fechas";
import { ESTADOS_EN_USO } from "@/features/dispensa/estados";
import type { ResultadoQuery } from "./types";

// Una estación que no reporta en este lapso se considera desconectada.
const ESTACION_ONLINE_MS = 10 * 60 * 1000;

export type EstadoSistema = {
  operariosActivos: number;
  entregasHoy: number;
  pendientesCamara: number;
  alertasPendientes: number;
  alertasCriticas: number; // stock bajo + incumplimientos EHS + fallas de hardware
  estaciones: {
    id: string;
    codigo: string;
    nombre: string;
    area: string | null;
    compartimentos: number;
    ultimoPing: string | null;
    enLinea: boolean;
  }[];
  integraciones: { firebase: boolean; telegram: boolean; hardwareSimulado: boolean };
};

/** Foto rápida del sistema para la portada (centro de control). */
export async function getEstadoSistema(): Promise<ResultadoQuery<EstadoSistema>> {
  try {
    // Inicio del día en Ecuador como instante (medianoche local = 05:00 UTC).
    const inicioHoy = new Date(fechaEcuador().getTime() + 5 * 60 * 60 * 1000);

    const [operariosActivos, entregasHoy, pendientesCamara, alertas, estaciones] = await Promise.all([
      prisma.operario.count({ where: { activo: true } }),
      prisma.entrega.count({ where: { fecha: { gte: inicioHoy }, estado: { in: ESTADOS_EN_USO } } }),
      prisma.entrega.count({ where: { estado: EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA } }),
      prisma.alerta.groupBy({ by: ["tipo"], where: { estado: EstadoAlerta.PENDIENTE }, _count: { _all: true } }),
      prisma.estacion.findMany({
        where: { activa: true },
        orderBy: { codigo: "asc" },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          ultimoPing: true,
          area: { select: { nombre: true } },
          _count: { select: { inventarios: true } },
        },
      }),
    ]);

    const criticas = new Set(["STOCK_BAJO", "INCUMPLIMIENTO_EHS", "FALLA_HARDWARE"]);
    const ahora = Date.now();

    return {
      ok: true,
      data: {
        operariosActivos,
        entregasHoy,
        pendientesCamara,
        alertasPendientes: alertas.reduce((acc, a) => acc + a._count._all, 0),
        alertasCriticas: alertas.filter((a) => criticas.has(a.tipo)).reduce((acc, a) => acc + a._count._all, 0),
        estaciones: estaciones.map((e) => ({
          id: e.id,
          codigo: e.codigo,
          nombre: e.nombre,
          area: e.area?.nombre ?? null,
          compartimentos: e._count.inventarios,
          ultimoPing: e.ultimoPing?.toISOString() ?? null,
          enLinea: !!e.ultimoPing && ahora - e.ultimoPing.getTime() < ESTACION_ONLINE_MS,
        })),
        // Solo se informa si están configuradas, nunca sus valores.
        integraciones: {
          firebase: !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_DATABASE_URL),
          telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
          hardwareSimulado: process.env.HARDWARE_SIMULADO === "true",
        },
      },
    };
  } catch (error) {
    console.error("[dashboard] Error en getEstadoSistema:", error);
    return { ok: false, error: "No se pudo consultar la base de datos." };
  }
}
