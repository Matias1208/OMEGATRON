import { NextResponse } from "next/server";
import { z } from "zod";
import { getResumenGerencial } from "@/features/dashboard/resumen";

const querySchema = z.object({ dias: z.coerce.number().int().min(1).max(365).default(30) });

/**
 * Tablero gerencial 1-3-10 para el frontend.
 *
 * GET /api/dashboard?dias=30
 * → { periodo, nivel1, nivel3: [costo, accesos, inventario], nivel10: { ...10 vistas } }
 *
 * Los Server Components pueden llamar directamente a getResumenGerencial() sin pasar por HTTP.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ dias: searchParams.get("dias") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Parámetro 'dias' inválido (1-365)" }, { status: 400 });
  }

  const resultado = await getResumenGerencial({ dias: parsed.data.dias });
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: 500 });
  }
  return NextResponse.json(resultado.data, { headers: { "Cache-Control": "no-store" } });
}
