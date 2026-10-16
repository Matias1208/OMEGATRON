"use server";

import { ejecutarDispensacion } from "./service";
import type { ResultadoDispensacion } from "./types";

/**
 * Server Action del kiosco.
 * @param rfid UID leído por el lector
 * @param estacion_area_id Área física donde está la estación (trazabilidad de ubicación)
 */
export async function procesarDispensacion(
  rfid: string,
  estacion_area_id: string,
): Promise<ResultadoDispensacion> {
  return ejecutarDispensacion({ rfid, areaId: estacion_area_id });
}
