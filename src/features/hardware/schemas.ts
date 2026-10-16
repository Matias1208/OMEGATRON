import { z } from "zod";
import { rfidSchema } from "@/features/dispensa/schemas";

export const rfidRequestSchema = z.object({
  rfid: rfidSchema,
  // Se usa como clave en Firebase: solo caracteres seguros para un path de RTDB.
  estacion_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "estacion_id inválido (use letras, números, - o _)"),
});

/** Lo que escucha la ESP32 en /estaciones/{codigo de la estación}/comando */
export type ComandoMotor = {
  motor: number;
  epp_id: string;
  entrega_id: string; // para que el script de visión sepa qué entrega validar
  timestamp: number;
  trigger: number; // valor aleatorio: fuerza un cambio aunque se repita el mismo motor
};
