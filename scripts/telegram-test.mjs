// Verifica la configuración de Telegram sin imprimir el token.
// Uso: npm run telegram:test
//  - Sin TELEGRAM_CHAT_ID: lista los chats donde el bot recibió mensajes (para copiar el id).
//  - Con TELEGRAM_CHAT_ID: envía un mensaje de prueba a ese chat.
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const api = (metodo, body) =>
  fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());

if (!token) {
  console.error("❌ Falta TELEGRAM_BOT_TOKEN en .env. Créalo con @BotFather en Telegram (/newbot).");
  process.exit(1);
}

const yo = await api("getMe");
if (!yo.ok) {
  console.error(`❌ Token inválido: ${yo.description}`);
  process.exit(1);
}
console.log(`✅ Bot conectado: @${yo.result.username}`);

if (!chatId) {
  const { result = [] } = await api("getUpdates");
  const chats = new Map();
  for (const u of result) {
    const chat = (u.message ?? u.my_chat_member ?? u.channel_post)?.chat;
    if (chat) chats.set(chat.id, chat.title ?? chat.username ?? chat.first_name ?? chat.type);
  }
  if (chats.size === 0) {
    console.log("ℹ️  El bot no ha recibido mensajes. Agrégalo a tu grupo, escribe cualquier cosa y vuelve a ejecutar.");
  } else {
    console.log("Chats encontrados (copia el id en TELEGRAM_CHAT_ID; los grupos empiezan con '-'):");
    for (const [id, nombre] of chats) console.log(`   ${id}  →  ${nombre}`);
  }
  process.exit(0);
}

const envio = await api("sendMessage", {
  chat_id: chatId,
  text: "✅ HARKAI conectado: las alertas EHS llegarán a este chat.",
});
if (!envio.ok) {
  console.error(`❌ No se pudo enviar al chat ${chatId}: ${envio.description}`);
  process.exit(1);
}
console.log(`✅ Mensaje de prueba enviado al chat ${chatId}.`);
