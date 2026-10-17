import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarApiKey } from "@/lib/api-auth";
import type { CodigoRechazo } from "@/features/dispensa/types";
import { rfidRequestSchema } from "@/features/hardware/schemas";
import { buscarEstacion, dispensarEnEstacion } from "@/features/hardware/service";

// Rechazos de negocio → 403 (la ESP32 muestra "denegado"). El resto, su código HTTP natural.
const STATUS_POR_RECHAZO: Partial<Record<CodigoRechazo, number>> = {
  DATOS_INVALIDOS: 400,
  AREA_NO_ENCONTRADA: 404,
  ESTACION_NO_ENCONTRADA: 404,
  ESTACION_SIN_AREA: 409,
  HARDWARE_NO_DISPONIBLE: 503,
  ERROR_INTERNO: 500,
};

/**
 * Endpoint que consume la ESP32 al leer una tarjeta.
 *
 * POST /api/hardware/rfid
 * Headers: x-api-key: <HARDWARE_API_KEY>
 * Body:    { "rfid": "D21CF01B", "estacion_id": "EST-01" }   // estacion_id = código o id de la estación
 *
 * 200 → comando escrito en Firebase (/estaciones/{codigo}/comando), el motor girará.
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
    const contenido = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (typeof contenido?.rfid === "string") {
      const estacionRef = typeof contenido.estacion_id === "string" ? contenido.estacion_id : "";
      const resultado = await dispensarEnEstacion(contenido.rfid, estacionRef);
      if (!resultado.ok) {
        return NextResponse.json(
          { ok: false, codigo: resultado.codigo, mensaje: resultado.mensaje },
          { status: STATUS_POR_RECHAZO[resultado.codigo] ?? 403 },
        );
      }
    }
    return NextResponse.json(
      { ok: false, codigo: "DATOS_INVALIDOS", mensaje: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }
  const { rfid, estacion_id } = parsed.data;

  try {
    // Latido de la estación: la portada la muestra "En línea".
    after(async () => {
      const estacion = await buscarEstacion(estacion_id);
      if (estacion) await prisma.estacion.update({ where: { id: estacion.id }, data: { ultimoPing: new Date() } });
    });

    const resultado = await dispensarEnEstacion(rfid, estacion_id);
    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, codigo: resultado.codigo, mensaje: resultado.mensaje },
        { status: STATUS_POR_RECHAZO[resultado.codigo] ?? 403 },
      );
    }

    // Respuesta compacta: la ESP32 tiene poca memoria.
    return NextResponse.json({
      ok: true,
      mensaje: `Dispensando ${resultado.comandoMotor?.epp}`,
      operario: resultado.operario.nombre,
      motor: resultado.comandoMotor?.motor,
      entrega_id: resultado.comandoMotor?.entregaId,
      total_entregas: resultado.entregas.length,
      bloqueados: resultado.bloqueados.length,
    });
  } catch (error) {
    console.error("[api/hardware/rfid] Error:", error);
    return NextResponse.json({ ok: false, codigo: "ERROR_INTERNO", mensaje: "Error interno" }, { status: 500 });
  }
}
