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
  /** false = solo persistir (el llamador envía un resumen consolidado). */
  telegram?: boolean;
};

/**
 * Persiste la alerta y la envía por Telegram. Nunca lanza: las alertas son
 * efectos secundarios y no deben tumbar el flujo principal.
 * `nueva` es false si ya existía una alerta pendiente con la misma dedupeKey.
 */
export async function registrarAlerta({ tipo, mensaje, dedupeKey, metadata, telegram = true }: NuevaAlerta) {
  try {
    if (dedupeKey) {
      const existente = await prisma.alerta.findUnique({ where: { dedupeKey } });
      if (existente) return { alerta: existente, nueva: false };
    }

    const alerta = await prisma.alerta.create({ data: { tipo, mensaje, dedupeKey, metadata } });
    if (telegram && (await sendTelegramAlert(mensaje))) {
      await prisma.alerta.update({ where: { id: alerta.id }, data: { enviadaTelegram: true } });
    }
    return { alerta, nueva: true };
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

/**
 * Revisa el stock vigente (sin lotes vencidos) y alerta si cae bajo el mínimo; si se
 * repuso, resuelve la alerta. Sin argumentos revisa todos los inventarios.
 * Devuelve cuántas alertas nuevas se crearon.
 */
export async function verificarStockBajo(inventarioIds?: string[]): Promise<number> {
  if (inventarioIds?.length === 0) return 0;
  let nuevas = 0;
  try {
    const hoy = fechaEcuador();
    const inventarios = await prisma.inventario.findMany({
      where: inventarioIds ? { id: { in: inventarioIds } } : undefined,
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

      if (stock >= inv.stockMinimo) {
        await resolverAlerta(dedupeKey);
        continue;
      }
      const r = await registrarAlerta({
        tipo: TipoAlerta.STOCK_BAJO,
        dedupeKey,
        mensaje:
          `📉 STOCK BAJO: ${inv.epp.nombre} en ${inv.estacion.nombre} (${inv.estacion.codigo}). ` +
          `Quedan ${stock} u. (mínimo ${inv.stockMinimo}). Reponer compartimento #${inv.slotMotor}.`,
        metadata: { inventarioId: inv.id, stock, stockMinimo: inv.stockMinimo },
      });
      if (r?.nueva) nuevas++;
    }
  } catch (error) {
    console.error("[alertas] Error verificando stock bajo:", error);
  }
  return nuevas;
}

/**
 * Resolución manual desde el dashboard (atendida por un supervisor).
 * - STOCK_BAJO libera su dedupeKey: si nadie repone, el cron debe volver a avisar.
 * - El resto (por lote, por entrega) la conserva: el supervisor ya la atendió y el cron no
 *   debe repetir la misma alerta cada hora.
 */
export async function resolverAlertaPorId(id: string): Promise<boolean> {
  try {
    const alerta = await prisma.alerta.findUnique({ where: { id }, select: { estado: true, tipo: true } });
    if (!alerta || alerta.estado !== EstadoAlerta.PENDIENTE) return false;

    const { count } = await prisma.alerta.updateMany({
      where: { id, estado: EstadoAlerta.PENDIENTE },
      data: {
        estado: EstadoAlerta.RESUELTA,
        resueltaAt: new Date(),
        ...(alerta.tipo === TipoAlerta.STOCK_BAJO && { dedupeKey: null }),
      },
    });
    return count === 1;
  } catch (error) {
    console.error("[alertas] No se pudo resolver la alerta:", error);
    return false;
  }
}

/** El operario retiró de nuevo esos EPP: sus avisos de "vida útil cumplida" ya están atendidos. */
export async function resolverAlertasVidaUtil(operarioId: string, eppIds: string[]) {
  if (eppIds.length === 0) return;
  try {
    await prisma.alerta.updateMany({
      where: {
        tipo: TipoAlerta.VIDA_UTIL_VENCIDA,
        estado: EstadoAlerta.PENDIENTE,
        AND: [
          { metadata: { path: ["operarioId"], equals: operarioId } },
          { OR: eppIds.map((eppId) => ({ metadata: { path: ["eppId"], equals: eppId } })) },
        ],
      },
      data: { estado: EstadoAlerta.RESUELTA, resueltaAt: new Date(), dedupeKey: null },
    });
  } catch (error) {
    console.error("[alertas] No se pudieron resolver alertas de vida útil:", error);
  }
}
