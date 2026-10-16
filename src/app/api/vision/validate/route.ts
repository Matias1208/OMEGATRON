import { NextResponse } from "next/server";
import { verificarApiKey } from "@/lib/api-auth";
import { veredictoCamaraSchema } from "@/features/dispensa/schemas";
import { registrarVeredictoCamara } from "@/features/dispensa/verificacion";

/**
 * Webhook del script de visión artificial (Python en el edge).
 *
 * POST /api/vision/validate
 * Headers: x-api-key: <HARDWARE_API_KEY>
 * Body:    { "entrega_id": "clx...", "epp_detectado": true, "confianza": 0.93 }
 */
export async function POST(request: Request) {
  if (!verificarApiKey(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = veredictoCamaraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datos inválidos", detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const resultado = await registrarVeredictoCamara(parsed.data);
    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: resultado.status });
    }
    return NextResponse.json({
      ok: true,
      entrega_id: resultado.entregaId,
      estado: resultado.estado,
      entregas_actualizadas: resultado.entregasActualizadas,
    });
  } catch (error) {
    console.error("[api/vision/validate] Error:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
