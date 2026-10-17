import { z } from "zod";
import { rfidSchema } from "@/features/dispensa/schemas";

export const rfidRequestSchema = z.object({
  rfid: rfidSchema,
  // Código de la estación ("EST-01"): solo caracteres seguros.
  estacion_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "estacion_id inválido (use letras, números, - o _)"),
});
