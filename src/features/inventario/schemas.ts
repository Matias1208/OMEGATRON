import { z } from "zod";

export const ingresoLoteSchema = z.object({
  inventarioId: z.string().trim().min(1, "Selecciona el EPP a reponer"),
  codigo: z
    .string()
    .trim()
    .min(1, "Código de lote requerido")
    .max(40)
    .transform((v) => v.toUpperCase()),
  cantidad: z.coerce.number().int("Cantidad entera").min(1, "Mínimo 1 unidad").max(10_000, "Máximo 10.000 unidades"),
  // "YYYY-MM-DD" desde <input type="date">; vacío = sin vencimiento.
  fechaVencimiento: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida")
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null)),
});

// Explícito: z.coerce tipa la entrada como number, pero desde un formulario llega string.
export type IngresoLote = { inventarioId: string; codigo: string; cantidad: number | string; fechaVencimiento?: string };
