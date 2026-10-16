import { Prisma, TipoAlerta, EstadoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramAlert } from "@/lib/telegram";
import { fechaEcuador } from "@/lib/fechas";

type NuevaAlerta = {
  tipo: TipoAlerta;
  mensaje: string;
  /** Si se indica, no se crea (ni se reenvía) otra alerta PENDIENTE con la misma clave. */
  dedupeKey?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Persiste la alerta y la envía por Telegram. Nunca lanza: las alertas son
 * efectos secundarios y no deben tumbar el flujo principal.
 */
export async function registrarAlerta({ tipo, mensaje, dedupeKey, metadata }: NuevaAlerta) {
  try {
    if (dedupeKey) {
      const existente = await prisma.alerta.findUnique({ where: { dedupeKey } });
      if (existente) return existente;
    }

    const alerta = await prisma.alerta.create({ data: { tipo, mensaje, dedupeKey, metadata } });
    const enviada = await sendTelegramAlert(mensaje);
    if (enviada) {
      await prisma.alerta.update({ where: { id: alerta.id }, data: { enviadaTelegram: true } });
    }
    return alerta;
  } catch (error) {
    // P2002: otra petición concurrente creó la misma alerta deduplicada; no es un error real.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    console.error("[alertas] No se pudo registrar la alerta:", error);
    return null;
  }
}

/** Marca como resuelta una alerta deduplicada y libera su clave para que pueda volver a dispararse. */
export async function resolverAlerta(dedupeKey: string) {
  try {
    await prisma.alerta.updateMany({
      where: { dedupeKey, estado: EstadoAlerta.PENDIENTE },
      data: { estado: EstadoAlerta.RESUELTA, resueltaAt: new Date(), dedupeKey: null },
    });
  } catch (error) {
    console.error("[alertas] No se pudo resolver la alerta:", error);
  }
}

/** Revisa el stock vigente (sin lotes vencidos) de los inventarios indicados y alerta si cae bajo el mínimo. */
export async function verificarStockBajo(inventarioIds: string[]) {
  if (inventarioIds.length === 0) return;
  try {
    const hoy = fechaEcuador();
    const inventarios = await prisma.inventario.findMany({
      where: { id: { in: inventarioIds } },
      include: {
        epp: { select: { nombre: true } },
        estacion: { select: { codigo: true, nombre: true } },
        lotes: {
          where: { OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: hoy } }] },
          select: { stockActual: true },
        },
      },
    });

    for (const inv of inventarios) {
      const stock = inv.lotes.reduce((acc, l) => acc + l.stockActual, 0);
      const dedupeKey = `STOCK_BAJO:${inv.id}`;

      if (stock < inv.stockMinimo) {
        await registrarAlerta({
          tipo: TipoAlerta.STOCK_BAJO,
          dedupeKey,
          mensaje:
            `📉 STOCK BAJO: ${inv.epp.nombre} en ${inv.estacion.nombre} (${inv.estacion.codigo}). ` +
            `Quedan ${stock} u. (mínimo ${inv.stockMinimo}). Reponer compartimento #${inv.slotMotor}.`,
          metadata: { inventarioId: inv.id, stock, stockMinimo: inv.stockMinimo },
        });
      }
    }
  } catch (error) {
    console.error("[alertas] Error verificando stock bajo:", error);
  }
}
