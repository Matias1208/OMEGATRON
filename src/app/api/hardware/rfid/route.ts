import { after, NextResponse } from "next/server";
import { TipoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarApiKey } from "@/lib/api-auth";
import { ejecutarDispensacion } from "@/features/dispensa/service";
import type { CodigoRechazo } from "@/features/dispensa/types";
import { rfidRequestSchema } from "@/features/hardware/schemas";
import { elegirEntregaParaMotor, enviarComandoMotor } from "@/features/hardware/service";
import { revertirEntregas } from "@/features/inventario/stock";
import { registrarAlerta } from "@/features/alertas/service";

// Rechazos de negocio → 403 (la ESP32 muestra "denegado"). El resto, su código HTTP natural.
const STATUS_POR_RECHAZO: Partial<Record<CodigoRechazo, number>> = {
  DATOS_INVALIDOS: 400,
  AREA_NO_ENCONTRADA: 404,
  ESTACION_NO_ENCONTRADA: 404,
  ERROR_INTERNO: 500,
};

/**
 * Endpoint que consume la ESP32 al leer una tarjeta.
 *
 * POST /api/hardware/rfid
 * Headers: x-api-key: <HARDWARE_API_KEY>
 * Body:    { "rfid": "A1B2C3D4", "estacion_id": "EST-01" }   // estacion_id = código o id de la estación
 *
 * 200 → comando escrito en Firebase (/estaciones/{estacion_id}/comando), el motor girará.
 * 403 → denegado por negocio (retiro excesivo, operario inactivo, sin stock...).
 */
export async function POST(request: Request) {
  if (!verificarApiKey(request)) {
    return NextResponse.json({ ok: false, codigo: "NO_AUTORIZADO", mensaje: "API key inválida" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, codigo: "DATOS_INVALIDOS", mensaje: "JSON inválido" }, { status: 400 });
  }

  const parsed = rfidRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, codigo: "DATOS_INVALIDOS", mensaje: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }
  const { rfid, estacion_id } = parsed.data;

  try {
    // La estación define el área física (trazabilidad de ubicación).
    const estacion = await prisma.estacion.findFirst({
      where: { OR: [{ id: estacion_id }, { codigo: estacion_id }] },
      select: { id: true, codigo: true, areaId: true, activa: true },
    });
    if (!estacion || !estacion.activa) {
      return NextResponse.json(
        { ok: false, codigo: "ESTACION_NO_ENCONTRADA", mensaje: "Estación no registrada o inactiva" },
        { status: 404 },
      );
    }
    if (!estacion.areaId) {
      return NextResponse.json(
        { ok: false, codigo: "ESTACION_SIN_AREA", mensaje: "La estación no tiene un área asignada" },
        { status: 409 },
      );
    }

    after(() =>
      prisma.estacion.update({ where: { id: estacion.id }, data: { ultimoPing: new Date() } }).catch(() => {}),
    );

    const resultado = await ejecutarDispensacion({ rfid, areaId: estacion.areaId, estacionId: estacion.id });

    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, codigo: resultado.codigo, mensaje: resultado.mensaje },
        { status: STATUS_POR_RECHAZO[resultado.codigo] ?? 403 },
      );
    }

    // Aprobado: ordenar el giro del motor vía Firebase.
    const entregaMotor = elegirEntregaParaMotor(resultado.entregas);
    try {
      const comando = await enviarComandoMotor(estacion_id, entregaMotor);

      return NextResponse.json({
        ok: true,
        mensaje: `Dispensando ${entregaMotor.nombre}`,
        operario: resultado.operario.nombre,
        motor: comando.motor,
        epp_id: comando.epp_id,
        entrega_id: comando.entrega_id,
        total_entregas: resultado.entregas.length,
        bloqueados: resultado.bloqueados.length,
      });
    } catch (error) {
      // El motor nunca recibió la orden: anular las entregas y devolver el stock.
      console.error("[api/hardware/rfid] Falló la escritura en Firebase:", error);
      const ids = resultado.entregas.map((e) => e.entregaId);
      await revertirEntregas(ids, "No se pudo enviar el comando al motor (Firebase)");
      after(() =>
        registrarAlerta({
          tipo: TipoAlerta.FALLA_HARDWARE,
          mensaje: `🔌 FALLA HARDWARE: no se pudo enviar la orden de dispensación a la estación ${estacion.codigo}. Revisar conexión con Firebase.`,
          metadata: { estacionId: estacion.id, entregaIds: ids },
        }),
      );
      return NextResponse.json(
        { ok: false, codigo: "HARDWARE_NO_DISPONIBLE", mensaje: "No se pudo comunicar con el dispensador. Intente de nuevo." },
        { status: 503 },
      );
    }
  } catch (error) {
    console.error("[api/hardware/rfid] Error:", error);
    return NextResponse.json({ ok: false, codigo: "ERROR_INTERNO", mensaje: "Error interno" }, { status: 500 });
  }
}
