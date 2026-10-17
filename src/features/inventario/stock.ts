import { EstadoEntrega, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaEcuador } from "@/lib/fechas";

/**
 * Marca como FALLIDAS entregas que nunca salieron físicamente (p.ej. no se pudo enviar
 * el comando al motor) y devuelve su stock al lote. Idempotente: solo toca entregas recién creadas.
 */
export async function revertirEntregas(entregaIds: string[], motivo: string) {
  return prisma.$transaction(async (tx) => {
    const entregas = await tx.entrega.findMany({
      where: { id: { in: entregaIds }, estado: EstadoEntrega.ENTREGADA },
      select: { id: true, loteId: true, cantidad: true },
    });
    for (const e of entregas) {
      await tx.entrega.update({ where: { id: e.id }, data: { estado: EstadoEntrega.FALLIDA, observacion: motivo } });
      await tx.lote.update({ where: { id: e.loteId }, data: { stockActual: { increment: e.cantidad } } });
    }
    return entregas.length;
  });
}

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
