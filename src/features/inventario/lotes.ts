import { prisma } from "@/lib/prisma";
import { fechaEcuador } from "@/lib/fechas";
import { verificarStockBajo } from "@/features/alertas/service";
import { ingresoLoteSchema, type IngresoLote } from "./schemas";

export type ResultadoIngreso =
  | { ok: true; mensaje: string; stockTotal: number }
  | { ok: false; error: string };

/** Stock utilizable de un inventario: suma de lotes no vencidos. */
export async function stockVigente(inventarioId: string): Promise<number> {
  const { _sum } = await prisma.lote.aggregate({
    where: { inventarioId, OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: fechaEcuador() } }] },
    _sum: { stockActual: true },
  });
  return _sum.stockActual ?? 0;
}

/**
 * Ingreso de mercadería a un compartimento de la estación.
 * Si el lote ya existe en ese compartimento se suma (re-ingreso del mismo lote); si no, se crea.
 * Al terminar re-evalúa el stock: si vuelve sobre el mínimo, la alerta STOCK_BAJO se resuelve sola.
 */
export async function registrarIngresoLote(input: IngresoLote): Promise<ResultadoIngreso> {
  const parsed = ingresoLoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const { inventarioId, codigo, cantidad, fechaVencimiento } = parsed.data;

  if (fechaVencimiento && fechaVencimiento < fechaEcuador()) {
    return { ok: false, error: "El lote ya está vencido: no puede ingresar al dispensador." };
  }

  try {
    const inventario = await prisma.inventario.findUnique({
      where: { id: inventarioId },
      select: { epp: { select: { nombre: true } }, estacion: { select: { codigo: true } } },
    });
    if (!inventario) return { ok: false, error: "Compartimento de inventario no encontrado." };

    const existente = await prisma.lote.findUnique({ where: { inventarioId_codigo: { inventarioId, codigo } } });
    if (existente && fechaVencimiento && existente.fechaVencimiento?.getTime() !== fechaVencimiento.getTime()) {
      return { ok: false, error: `El lote ${codigo} ya existe con otra fecha de vencimiento.` };
    }

    if (existente) {
      await prisma.lote.update({
        where: { id: existente.id },
        data: { cantidadInicial: { increment: cantidad }, stockActual: { increment: cantidad } },
      });
    } else {
      await prisma.lote.create({
        data: { inventarioId, codigo, cantidadInicial: cantidad, stockActual: cantidad, fechaVencimiento },
      });
    }

    await verificarStockBajo([inventarioId]);
    const stockTotal = await stockVigente(inventarioId);
    return {
      ok: true,
      mensaje: `Ingresaron ${cantidad} u. de ${inventario.epp.nombre} (lote ${codigo}) en ${inventario.estacion.codigo}.`,
      stockTotal,
    };
  } catch (error) {
    console.error("[inventario] Error registrando ingreso:", error);
    return { ok: false, error: "No se pudo registrar el ingreso." };
  }
}

/** Compartimentos para el formulario de reposición, con su stock vigente. */
export async function getCompartimentos() {
  const inventarios = await prisma.inventario.findMany({
    orderBy: [{ estacion: { codigo: "asc" } }, { slotMotor: "asc" }],
    select: {
      id: true,
      slotMotor: true,
      stockMinimo: true,
      epp: { select: { codigo: true, nombre: true } },
      estacion: { select: { codigo: true } },
    },
  });
  return inventarios.map((i) => ({
    inventarioId: i.id,
    etiqueta: `${i.estacion.codigo} · #${i.slotMotor} · ${i.epp.nombre}`,
    codigoEpp: i.epp.codigo,
  }));
}

export type Compartimento = Awaited<ReturnType<typeof getCompartimentos>>[number];
