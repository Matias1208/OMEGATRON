"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dispensarEnEstacion } from "@/features/hardware/service";
import { registrarVeredictoCamara, type ResultadoVeredicto } from "./verificacion";
import { veredictoCamaraSchema } from "./schemas";
import type { ResultadoDispensacion } from "./types";

// Nota: toda Server Action es invocable desde el navegador. Las acciones de este archivo
// equivalen a pasar una credencial frente a la estación, por eso no exigen API key; las que
// sustituyen al hardware (cámara) solo se habilitan en modo simulado.

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

/** Simula el veredicto de la cámara (demo sin el script de visión). Solo con HARDWARE_SIMULADO=true. */
export async function simularVeredictoCamara(entregaId: string, eppDetectado: boolean): Promise<ResultadoVeredicto> {
  if (process.env.HARDWARE_SIMULADO !== "true") {
    return { ok: false, status: 409, error: "La simulación de cámara solo está disponible con HARDWARE_SIMULADO=true." };
  }
  const input = veredictoCamaraSchema.safeParse({ entrega_id: entregaId, epp_detectado: eppDetectado });
  if (!input.success) return { ok: false, status: 404, error: "Entrega inválida." };

  try {
    const resultado = await registrarVeredictoCamara(input.data);
    revalidatePath("/");
    return resultado;
  } catch (error) {
    console.error("[dispensa] Error simulando veredicto:", error);
    return { ok: false, status: 409, error: "No se pudo registrar el veredicto." };
  }
}
