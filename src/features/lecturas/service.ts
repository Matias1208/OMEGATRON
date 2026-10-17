import type { ResultadoLectura } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NuevaLectura = {
  rfid: string;
  operarioId: string | null;
  estacionId: string | null;
  areaId: string | null;
  resultado: ResultadoLectura;
  motivo: string | null;
  entregas: number;
};

/** Registra auditoría de una credencial sin interrumpir el flujo de dispensación. */
export async function registrarLectura(lectura: NuevaLectura): Promise<void> {
  try {
    await prisma.lectura.create({ data: lectura });
  } catch (error) {
    console.error("[lecturas] No se pudo registrar la lectura RFID:", error);
  }
}
