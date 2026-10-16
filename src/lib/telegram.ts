const TELEGRAM_API = "https://api.telegram.org";

/**
 * Envía un mensaje de texto al chat configurado. Nunca lanza: una caída de Telegram
 * no debe bloquear una dispensación. Devuelve true si Telegram aceptó el mensaje.
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados. Mensaje:", message);
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Texto plano (sin parse_mode) para no tener que escapar nombres con caracteres especiales.
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`[telegram] Error ${res.status}:`, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[telegram] No se pudo enviar el mensaje:", error);
    return false;
  }
}
