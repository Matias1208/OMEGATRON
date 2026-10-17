import { timingSafeEqual } from "node:crypto";

/**
 * Autenticación de dispositivos edge (ESP32) mediante
 * el header `x-api-key`, comparado contra HARDWARE_API_KEY en tiempo constante.
 */
export function verificarApiKey(request: Request): boolean {
  const esperada = process.env.HARDWARE_API_KEY;
  const recibida = request.headers.get("x-api-key");
  if (!esperada || !recibida) return false;

  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
