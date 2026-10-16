import { prisma } from "@/lib/prisma";
import { enTurno, fechaEcuador, horaEcuador } from "@/lib/fechas";
import type { EppRequerido } from "./types";

/**
 * Asignación vigente del operario: la del turno de hoy que contiene la hora actual,
 * o la de ayer si es un turno nocturno que aún no termina. Si ninguna calza con la
 * hora (llegó temprano), usa la primera de hoy.
 */
export async function obtenerAsignacionActual(operarioId: string) {
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

  return (
    deHoy.find((a) => enTurno(hora, a.turno.horaInicio, a.turno.horaFin)) ??
    nocturnaDeAyer ??
    deHoy[0] ??
    null
  );
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
