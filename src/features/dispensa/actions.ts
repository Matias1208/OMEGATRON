"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dispensarEnEstacion } from "@/features/hardware/service";
import type { ResultadoDispensacion } from "./types";

// Nota: toda Server Action es invocable desde el navegador. Las acciones de este archivo
// equivalen a pasar una credencial frente a la estación, por eso no exigen API key.

/**
 * Dispensación desde el kiosco (pantalla junto a la estación o lector RFID USB).
 * Mismo flujo que la ESP32: reglas EHS + orden al motor + reversión si el motor no responde.
 */
export async function dispensarEnKiosco(rfid: string, estacionCodigo: string): Promise<ResultadoDispensacion> {
  const resultado = await dispensarEnEstacion(rfid, estacionCodigo);
  revalidatePath("/");
  return resultado;
}

/**
 * Server Action original (Fase 3): dispensa en la primera estación activa del área.
 * @param rfid UID leído por el lector
 * @param estacion_area_id Área física donde está la estación (trazabilidad de ubicación)
 */
export async function procesarDispensacion(
  rfid: string,
  estacion_area_id: string,
): Promise<ResultadoDispensacion> {
  const estacion = await prisma.estacion.findFirst({
    where: { areaId: estacion_area_id, activa: true },
    orderBy: { codigo: "asc" },
    select: { id: true },
  });
  if (!estacion) {
    return { ok: false, codigo: "ESTACION_NO_ENCONTRADA", mensaje: "No hay estación activa en esa área." };
  }
  return dispensarEnKiosco(rfid, estacion.id);
}
