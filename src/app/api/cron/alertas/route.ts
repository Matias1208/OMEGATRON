import { NextResponse } from "next/server";
import { verificarApiKey } from "@/lib/api-auth";
import { ejecutarRevisionesProgramadas } from "@/features/alertas/cron";

/**
 * Revisiones programadas: vida útil cumplida, lotes por vencer y stock bajo.
 *
 * GET /api/cron/alertas
 * Auth: `Authorization: Bearer <CRON_SECRET>` (formato de Vercel Cron) o `x-api-key: <HARDWARE_API_KEY>`.
 * En local se ejecuta solo vía instrumentation.ts (CRON_INTERNO_MINUTOS).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const autorizado =
    (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) || verificarApiKey(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const resumen = await ejecutarRevisionesProgramadas();
    return NextResponse.json({ ok: true, ...resumen });
  } catch (error) {
    console.error("[api/cron/alertas] Error:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
