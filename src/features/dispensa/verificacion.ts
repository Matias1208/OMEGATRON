import { after } from "next/server";
import { EstadoEntrega, TipoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAlerta } from "@/features/alertas/service";
import type { VeredictoCamara } from "./schemas";

export type ResultadoVeredicto =
  | { ok: true; entregaId: string; estado: EstadoEntrega }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Aplica el veredicto del script de visión. Solo transiciona entregas que siguen en
 * PENDIENTE_VERIFICACION_CAMARA, así un reintento del webhook no duplica alertas.
 */
export async function registrarVeredictoCamara({
  entrega_id,
  epp_detectado,
  confianza,
}: VeredictoCamara): Promise<ResultadoVeredicto> {
  const estado = epp_detectado ? EstadoEntrega.VERIFICADO : EstadoEntrega.INCUMPLIMIENTO_EHS;

  const { count } = await prisma.entrega.updateMany({
    where: { id: entrega_id, estado: EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA },
    data: {
      estado,
      verificadoAt: new Date(),
      ...(confianza !== undefined && { observacion: `Confianza cámara: ${(confianza * 100).toFixed(1)}%` }),
    },
  });

  if (count === 0) {
    const actual = await prisma.entrega.findUnique({ where: { id: entrega_id }, select: { estado: true } });
    return actual
      ? { ok: false, status: 409, error: `La entrega ya fue procesada (estado: ${actual.estado}).` }
      : { ok: false, status: 404, error: "Entrega no encontrada." };
  }

  if (!epp_detectado) {
    const entrega = await prisma.entrega.findUniqueOrThrow({
      where: { id: entrega_id },
      include: { operario: { select: { nombre: true } }, epp: { select: { nombre: true } }, area: { select: { nombre: true } } },
    });
    after(() =>
      registrarAlerta({
        tipo: TipoAlerta.INCUMPLIMIENTO_EHS,
        dedupeKey: `EHS:${entrega_id}`,
        mensaje: `🚨 RIESGO EHS: Operario ${entrega.operario.nombre} retiró ${entrega.epp.nombre} pero la cámara detectó que NO se lo colocó. (Área: ${entrega.area.nombre})`,
        metadata: { entregaId: entrega_id, operarioId: entrega.operarioId, areaId: entrega.areaId, confianza },
      }),
    );
  }

  return { ok: true, entregaId: entrega_id, estado };
}
