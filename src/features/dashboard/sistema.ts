import { EstadoAlerta, ResultadoLectura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaEcuador } from "@/lib/fechas";
import { ESTADOS_EN_USO } from "@/features/dispensa/estados";
import type { ResultadoQuery } from "./types";

// Una estación que no reporta en este lapso se considera desconectada.
const ESTACION_ONLINE_MS = 10 * 60 * 1000;

export type LecturaReciente = {
  id: string;
  fecha: string;
  rfid: string;
  operario: string;
  estacion: string;
  resultado: ResultadoLectura;
  motivo: string | null;
  entregas: number;
};

export type EstadoSistema = {
  operariosActivos: number;
  entregasHoy: number;
  /** Entregas de ayer hasta la misma hora (comparación justa con "hoy"). */
  entregasAyerMismaHora: number;
  operariosAtendidosHoy: number;
  ultimasLecturas: LecturaReciente[];
  alertasPendientes: number;
  alertasCriticas: number;
  estaciones: {
    id: string;
    codigo: string;
    nombre: string;
    area: string | null;
    compartimentos: number;
    ultimoPing: string | null;
    enLinea: boolean;
  }[];
  integraciones: { telegram: boolean; modoPruebas: boolean };
};

/** Foto rápida del sistema para la portada (centro de control). */
export async function getEstadoSistema(): Promise<ResultadoQuery<EstadoSistema>> {
  try {
    // Inicio del día en Ecuador como instante (medianoche local = 05:00 UTC).
    const inicioHoy = new Date(fechaEcuador().getTime() + 5 * 60 * 60 * 1000);
    const DIA = 24 * 60 * 60 * 1000;
    const enUso = { in: ESTADOS_EN_USO };

    const [
      operariosActivos,
      entregasHoy,
      entregasAyerMismaHora,
      atendidosHoy,
      lecturas,
      alertas,
      estaciones,
    ] = await Promise.all([
      prisma.operario.count({ where: { activo: true } }),
      prisma.entrega.count({ where: { fecha: { gte: inicioHoy }, estado: enUso } }),
      prisma.entrega.count({
        where: { fecha: { gte: new Date(inicioHoy.getTime() - DIA), lt: new Date(Date.now() - DIA) }, estado: enUso },
      }),
      prisma.entrega.groupBy({ by: ["operarioId"], where: { fecha: { gte: inicioHoy }, estado: enUso } }),
      prisma.lectura.findMany({
        orderBy: { fecha: "desc" },
        take: 8,
        select: {
          id: true,
          fecha: true,
          rfid: true,
          resultado: true,
          motivo: true,
          entregas: true,
          operario: { select: { nombre: true, rfid: true } },
          estacion: { select: { codigo: true } },
        },
      }),
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

    const criticas = new Set(["STOCK_BAJO", "FALLA_HARDWARE"]);
    const ahora = Date.now();

    return {
      ok: true,
      data: {
        operariosActivos,
        entregasHoy,
        entregasAyerMismaHora,
        operariosAtendidosHoy: atendidosHoy.length,
        ultimasLecturas: lecturas.map((l) => ({
          id: l.id,
          fecha: l.fecha.toISOString(),
          rfid: l.operario?.rfid ?? l.rfid,
          operario: l.operario?.nombre ?? "No identificado",
          estacion: l.estacion?.codigo ?? "—",
          resultado: l.resultado,
          motivo: l.motivo,
          entregas: l.entregas,
        })),
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
          telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
          modoPruebas: process.env.MODO_PRUEBAS === "true",
        },
      },
    };
  } catch (error) {
    console.error("[dashboard] Error en getEstadoSistema:", error);
    return { ok: false, error: "No se pudo consultar la base de datos." };
  }
}
