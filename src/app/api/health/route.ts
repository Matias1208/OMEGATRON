import { NextResponse } from "next/server";

/**
 * GET /api/health — la ESP32 lo llama al arrancar para verificar que llega al backend.
 * No toca la base de datos ni requiere API key.
 */
export function GET() {
  return NextResponse.json({ ok: true, servicio: "omegatron", hora: new Date().toISOString() });
}
