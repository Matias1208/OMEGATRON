import { prisma } from "@/lib/prisma";
import { enTurno, fechaEcuador, horaEcuador } from "@/lib/fechas";
import type { AsignacionVigente, EppRequerido } from "./types";

const DIAS_TAREA_HABITUAL = 30;

/**
 * Turno/tarea que rige la dispensación de ahora:
 *  1. TURNO_ACTUAL: la asignación de hoy cuyo turno contiene la hora actual, la nocturna de
 *     ayer que aún no termina, o la primera de hoy (si llegó temprano).
 *  2. TAREA_HABITUAL: si no hay asignación para hoy, la tarea de su última asignación
 *     (últimos 30 días). Así un día sin planificación no deja al operario sin el EPP de su tarea.
 */
export async function obtenerAsignacionActual(operarioId: string): Promise<AsignacionVigente | null> {
  const ahora = new Date();
  const hora = horaEcuador(ahora);
  const [hoy, ayer] = [fechaEcuador(0, ahora), fechaEcuador(-1, ahora)];

  const asignaciones = await prisma.asignacionTurno.findMany({
    where: { operarioId, fecha: { in: [hoy, ayer] } },
    include: { turno: true, tarea: true },
    orderBy: { turno: { horaInicio: "asc" } },
  });

  const deHoy = asignaciones.filter((a) => a.fecha.getTime() === hoy.getTime());
  const nocturnaDeAyer = asignaciones.find(
    (a) =>
      a.fecha.getTime() === ayer.getTime() &&
      a.turno.horaInicio > a.turno.horaFin && // cruza medianoche
      hora < a.turno.horaFin,
  );
  const actual = deHoy.find((a) => enTurno(hora, a.turno.horaInicio, a.turno.horaFin)) ?? nocturnaDeAyer ?? deHoy[0];
  if (actual) {
    return { asignacionId: actual.id, tarea: actual.tarea, turno: actual.turno.nombre, origen: "TURNO_ACTUAL" };
  }

  const habitual = await prisma.asignacionTurno.findFirst({
    where: { operarioId, fecha: { gte: fechaEcuador(-DIAS_TAREA_HABITUAL, ahora), lt: hoy } },
    orderBy: { fecha: "desc" },
    include: { tarea: true, turno: true },
  });
  return habitual
    ? { asignacionId: null, tarea: habitual.tarea, turno: habitual.turno.nombre, origen: "TAREA_HABITUAL" }
    : null;
}

/** EPP requerido = reglas del cargo ∪ reglas de la tarea (si coinciden, gana la mayor cantidad). */
export async function obtenerEppRequerido(cargoId: string, tareaId: string | null): Promise<EppRequerido[]> {
  const [reglasCargo, reglasTarea] = await Promise.all([
    prisma.cargoEPP.findMany({ where: { cargoId, epp: { activo: true } }, include: { epp: true } }),
    tareaId
      ? prisma.tareaEPP.findMany({ where: { tareaId, epp: { activo: true } }, include: { epp: true } })
      : Promise.resolve([]),
  ]);

  const requeridos = new Map<string, EppRequerido>();
  for (const [reglas, origen] of [
    [reglasCargo, "CARGO"],
    [reglasTarea, "TAREA"],
  ] as const) {
    for (const { epp, cantidad } of reglas) {
      const previo = requeridos.get(epp.id);
      requeridos.set(epp.id, {
        eppId: epp.id,
        codigo: epp.codigo,
        nombre: epp.nombre,
        tipo: epp.tipo,
        costoUnitario: Number(epp.costoUnitario),
        vidaUtilDias: epp.vidaUtilDias,
        cantidad: Math.max(cantidad, previo?.cantidad ?? 0),
        origen: previo ? "CARGO+TAREA" : origen,
      });
    }
  }
  return [...requeridos.values()];
}

/** Datos para el panel de kiosco: estaciones activas y credenciales registradas. */
export async function getDatosKiosco() {
  const [estaciones, operarios] = await Promise.all([
    prisma.estacion.findMany({
      where: { activa: true },
      orderBy: { codigo: "asc" },
      select: { codigo: true, nombre: true, area: { select: { nombre: true } } },
    }),
    prisma.operario.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      select: { nombre: true, rfid: true, activo: true, cargo: { select: { nombre: true } } },
    }),
  ]);
  return {
    estaciones: estaciones.map((e) => ({ codigo: e.codigo, nombre: e.nombre, area: e.area?.nombre ?? null })),
    operarios: operarios.map((o) => ({ nombre: o.nombre, rfid: o.rfid, activo: o.activo, cargo: o.cargo.nombre })),
  };
}

export type DatosKiosco = Awaited<ReturnType<typeof getDatosKiosco>>;
