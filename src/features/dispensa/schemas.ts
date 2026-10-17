import { z } from "zod";

/** Normaliza el UID tal como lo envían distintos lectores: "a1:b2 c3-d4" → "A1B2C3D4". */
export const rfidSchema = z
  .string()
  .transform((v) => v.replace(/[\s:-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[0-9A-F]{4,32}$/, "UID RFID inválido"));

export const dispensacionSchema = z.object({
  rfid: rfidSchema,
  areaId: z.string().trim().min(1, "Área requerida"),
});
