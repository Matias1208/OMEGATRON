import { EstadoAlerta, TipoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramAlert } from "@/lib/telegram";
import { DIA_MS, fechaEcuador } from "@/lib/fechas";
import { ESTADOS_EN_USO } from "@/features/dispensa/estados";
import { registrarAlerta, resolverAlerta, verificarStockBajo } from "./service";

// Los EPP desechables (vida útil corta) se renuevan solos en cada turno: no ameritan aviso.
const VIDA_UTIL_MINIMA_AVISO_DIAS = 7;
// Solo se avisan vencimientos recientes, para no inundar Telegram con historial antiguo.
const VENTANA_VENCIDOS_DIAS = 7;
const DIAS_AVISO_LOTE = 7;

/**
 * EPP durables cuya vida útil ya se cumplió y que el operario aún no ha reemplazado.
 * Crea una alerta por entrega (deduplicada), avisa al operario en su chat personal si
 * lo tiene, y envía un único resumen consolidado al chat de supervisión.
 */
export async function verificarVidaUtilCumplida(): Promise<number> {
  const ahora = new Date();
  const candidatas = await prisma.entrega.findMany({
    where: {
      estado: { in: ESTADOS_EN_USO },
      venceUso: { lte: ahora, gt: new Date(ahora.getTime() - VENTANA_VENCIDOS_DIAS * DIA_MS) },
      epp: { vidaUtilDias: { gte: VIDA_UTIL_MINIMA_AVISO_DIAS } },
      operario: { activo: true },
    },
    include: {
      operario: { select: { nombre: true, telegramChatId: true } },
      epp: { select: { nombre: true } },
      area: { select: { nombre: true } },
    },
  });
  if (candidatas.length === 0) return 0;

  // Descarta las que ya fueron reemplazadas por una entrega posterior del mismo EPP.
  const reemplazos = await prisma.entrega.findMany({
    where: {
      estado: { in: ESTADOS_EN_USO },
      OR: candidatas.map((c) => ({ operarioId: c.operarioId, eppId: c.eppId, fecha: { gt: c.fecha } })),
    },
    select: { operarioId: true, eppId: true },
  });
  const reemplazado = new Set(reemplazos.map((r) => `${r.operarioId}:${r.eppId}`));

  const nuevas: string[] = [];
  for (const e of candidatas) {
    if (reemplazado.has(`${e.operarioId}:${e.eppId}`)) continue;

    const detalle = `${e.operario.nombre} (${e.area.nombre}) debe reemplazar ${e.epp.nombre}, entregado el ${e.fecha.toISOString().slice(0, 10)}.`;
    const r = await registrarAlerta({
      tipo: TipoAlerta.VIDA_UTIL_VENCIDA,
      dedupeKey: `VIDA_UTIL:${e.id}`,
      mensaje: `🔁 VIDA ÚTIL CUMPLIDA: ${detalle}`,
      metadata: { entregaId: e.id, operarioId: e.operarioId, eppId: e.eppId },
      telegram: false,
    });
    if (!r?.nueva) continue;

    nuevas.push(`• ${detalle}`);
    if (e.operario.telegramChatId) {
      await sendTelegramAlert(
        `Hola ${e.operario.nombre}, tu ${e.epp.nombre} cumplió su vida útil. Pasa por la estación de EPP para reemplazarlo.`,
        e.operario.telegramChatId,
      );
    }
  }

  if (nuevas.length > 0) {
    await sendTelegramAlert(`🔁 VIDA ÚTIL CUMPLIDA (${nuevas.length} EPP por reemplazar):\n${nuevas.join("\n")}`);
  }
  return nuevas.length;
}

/**
 * Lotes con stock que vencen en los próximos días (usarlos primero) o que ya vencieron
 * (FEFO ya no los entrega: hay que retirarlos físicamente del dispensador).
 * Cierra solas las alertas de lotes que ya no tienen stock.
 */
export async function verificarLotesPorVencer(): Promise<number> {
  const hoy = fechaEcuador();
  const lotes = await prisma.lote.findMany({
    where: { stockActual: { gt: 0 }, fechaVencimiento: { lte: fechaEcuador(DIAS_AVISO_LOTE) } },
    include: { inventario: { include: { epp: { select: { nombre: true } }, estacion: { select: { codigo: true } } } } },
  });

  let nuevas = 0;
  for (const lote of lotes) {
    const dias = Math.round((lote.fechaVencimiento!.getTime() - hoy.getTime()) / DIA_MS);
    const vencido = dias < 0;
    const donde = `${lote.inventario.epp.nombre} lote ${lote.codigo} (${lote.inventario.estacion.codigo}, compartimento #${lote.inventario.slotMotor})`;
    const r = await registrarAlerta({
      tipo: TipoAlerta.LOTE_POR_VENCER,
      dedupeKey: `${vencido ? "LOTE_VENCIDO" : "LOTE_POR_VENCER"}:${lote.id}`,
      mensaje: vencido
        ? `⛔ LOTE VENCIDO: ${donde} venció hace ${-dias} día(s) con ${lote.stockActual} u. Retirarlo del dispensador.`
        : `⏳ LOTE POR VENCER: ${donde} vence en ${dias} día(s) con ${lote.stockActual} u. en stock.`,
      metadata: { loteId: lote.id, stockActual: lote.stockActual, dias },
    });
    if (r?.nueva) nuevas++;
  }

  // Lotes que se agotaron: su alerta de vencimiento ya no aplica.
  const pendientes = await prisma.alerta.findMany({
    where: { tipo: TipoAlerta.LOTE_POR_VENCER, estado: EstadoAlerta.PENDIENTE, dedupeKey: { not: null } },
    select: { dedupeKey: true },
  });
  const conStock = new Set(lotes.map((l) => l.id));
  for (const { dedupeKey } of pendientes) {
    const loteId = dedupeKey!.split(":")[1];
    if (loteId && !conStock.has(loteId)) {
      const lote = await prisma.lote.findUnique({ where: { id: loteId }, select: { stockActual: true } });
      if (!lote || lote.stockActual === 0) await resolverAlerta(dedupeKey!);
    }
  }
  return nuevas;
}

/** Punto de entrada del cron: ejecuta todas las revisiones y nunca lanza. */
export async function ejecutarRevisionesProgramadas() {
  const inicio = Date.now();
  const ejecutar = async (nombre: string, fn: () => Promise<number>) => {
    try {
      return await fn();
    } catch (error) {
      console.error(`[cron] Falló la revisión ${nombre}:`, error);
      return -1; // -1 = la revisión falló
    }
  };

  const [vidaUtil, lotesPorVencer, stockBajo] = await Promise.all([
    ejecutar("vida útil", verificarVidaUtilCumplida),
    ejecutar("lotes por vencer", verificarLotesPorVencer),
    ejecutar("stock bajo", () => verificarStockBajo()),
  ]);

  const resumen = { vidaUtil, lotesPorVencer, stockBajo, duracionMs: Date.now() - inicio };
  console.log("[cron] Revisión completada:", resumen);
  return resumen;
}
