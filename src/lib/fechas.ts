// Ecuador continental es UTC-5 todo el año (sin horario de verano).
const OFFSET_ECUADOR_MS = -5 * 60 * 60 * 1000;
export const DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha de calendario en Ecuador como Date a medianoche UTC (formato que usa Prisma para @db.Date). */
export function fechaEcuador(offsetDias = 0, base = new Date()): Date {
  const ec = new Date(base.getTime() + OFFSET_ECUADOR_MS + offsetDias * DIA_MS);
  return new Date(Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate()));
}

/** Hora local de Ecuador en formato "HH:MM" (comparable como string con Turno.horaInicio/horaFin). */
export function horaEcuador(base = new Date()): string {
  return new Date(base.getTime() + OFFSET_ECUADOR_MS).toISOString().slice(11, 16);
}

/** ¿La hora "HH:MM" cae dentro del turno? Soporta turnos que cruzan medianoche (22:00-06:00). */
export function enTurno(hora: string, inicio: string, fin: string): boolean {
  return inicio <= fin ? hora >= inicio && hora < fin : hora >= inicio || hora < fin;
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

// Margen para que un EPP de 1 día se pueda renovar al día siguiente aunque el operario
// pase la tarjeta un poco más temprano que la víspera.
export const TOLERANCIA_RENOVACION_MS = 2 * 60 * 60 * 1000;

/** Momento a partir del cual el operario puede volver a retirar el mismo EPP. */
export function calcularVenceUso(entrega: Date, vidaUtilDias: number): Date {
  return new Date(entrega.getTime() + vidaUtilDias * DIA_MS - TOLERANCIA_RENOVACION_MS);
}
