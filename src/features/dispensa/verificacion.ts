import { after } from "next/server";
import { EstadoEntrega, TipoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAlerta } from "@/features/alertas/service";
import type { VeredictoCamara } from "./schemas";

export type ResultadoVeredicto =
  | { ok: true; entregaId: string; estado: EstadoEntrega; entregasActualizadas: number }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Aplica el veredicto del script de visión a TODO el retiro al que pertenece la entrega:
 * las entregas de una misma lectura RFID comparten operario, estación e instante (se crean
 * en la misma transacción), y la cámara evalúa al operario completo, no un EPP aislado.
 * Solo transiciona entregas en PENDIENTE_VERIFICACION_CAMARA, así un reintento del
 * webhook no duplica alertas.
 */
export async function registrarVeredictoCamara({
  entrega_id,
  epp_detectado,
  confianza,
}: VeredictoCamara): Promise<ResultadoVeredicto> {
  const referencia = await prisma.entrega.findUnique({
    where: { id: entrega_id },
    select: { estado: true, operarioId: true, estacionId: true, fecha: true },
  });
  if (!referencia) return { ok: false, status: 404, error: "Entrega no encontrada." };
  if (referencia.estado !== EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA) {
    return { ok: false, status: 409, error: `La entrega ya fue procesada (estado: ${referencia.estado}).` };
  }

  const estado = epp_detectado ? EstadoEntrega.VERIFICADO : EstadoEntrega.INCUMPLIMIENTO_EHS;
  const delRetiro = {
    operarioId: referencia.operarioId,
    estacionId: referencia.estacionId,
    fecha: referencia.fecha,
    estado: EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA,
  };

  // Para la alerta: qué EPP se llevó en este retiro (antes de cambiar su estado).
  const entregasRetiro = epp_detectado
    ? []
    : await prisma.entrega.findMany({ where: delRetiro, select: { epp: { select: { nombre: true } } } });

  const { count } = await prisma.entrega.updateMany({
    where: delRetiro,
    data: {
      estado,
      verificadoAt: new Date(),
      ...(confianza !== undefined && { observacion: `Confianza cámara: ${(confianza * 100).toFixed(1)}%` }),
    },
  });
  // Otra petición procesó el retiro entre la lectura y la actualización.
  if (count === 0) return { ok: false, status: 409, error: "La entrega ya fue procesada." };

  if (!epp_detectado) {
    const entrega = await prisma.entrega.findUniqueOrThrow({
      where: { id: entrega_id },
      include: { operario: { select: { nombre: true } }, area: { select: { nombre: true } } },
    });
    const listaEpp = entregasRetiro.map((e) => e.epp.nombre).join(", ");
    after(() =>
      registrarAlerta({
        tipo: TipoAlerta.INCUMPLIMIENTO_EHS,
        dedupeKey: `EHS:${entrega_id}`,
        mensaje: `🚨 RIESGO EHS: Operario ${entrega.operario.nombre} retiró ${listaEpp} pero la cámara detectó que NO se lo colocó. (Área: ${entrega.area.nombre})`,
        metadata: { entregaId: entrega_id, operarioId: entrega.operarioId, areaId: entrega.areaId, confianza, entregas: count },
      }),
    );
  }

  return { ok: true, entregaId: entrega_id, estado, entregasActualizadas: count };
}
