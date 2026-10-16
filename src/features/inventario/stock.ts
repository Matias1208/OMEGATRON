import type { Prisma } from "@prisma/client";
import { fechaEcuador } from "@/lib/fechas";

/**
 * Descuenta `cantidad` del lote vigente que vence primero (FEFO) dentro de una transacción.
 * El decremento es condicional (stockActual >= cantidad), así dos dispensaciones simultáneas
 * nunca dejan un lote en negativo. Devuelve el lote usado o null si no hay stock suficiente.
 */
export async function descontarStockFEFO(
  tx: Prisma.TransactionClient,
  inventarioId: string,
  cantidad: number,
) {
  const lotes = await tx.lote.findMany({
    where: {
      inventarioId,
      stockActual: { gte: cantidad },
      OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: fechaEcuador() } }],
    },
    orderBy: [{ fechaVencimiento: { sort: "asc", nulls: "last" } }, { fechaIngreso: "asc" }],
    select: { id: true, codigo: true },
  });

  for (const lote of lotes) {
    const { count } = await tx.lote.updateMany({
      where: { id: lote.id, stockActual: { gte: cantidad } },
      data: { stockActual: { decrement: cantidad } },
    });
    if (count === 1) return lote;
  }
  return null;
}
