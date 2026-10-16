// Copia las credenciales de un service-account.json de Firebase a .env (sin imprimir la clave).
// Uso: npm run firebase:env -- <ruta/al/service-account.json> [FIREBASE_DATABASE_URL]
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";

const [jsonPath, databaseUrl] = process.argv.slice(2);
if (!jsonPath) {
  console.error("Uso: npm run firebase:env -- <ruta/al/service-account.json> [FIREBASE_DATABASE_URL]");
  process.exit(1);
}

const sa = JSON.parse(readFileSync(jsonPath, "utf8"));
if (sa.type !== "service_account" || !sa.private_key || !sa.client_email) {
  console.error("El archivo no parece una cuenta de servicio de Firebase.");
  process.exit(1);
}

if (databaseUrl && !/^https:\/\/[a-z0-9-]+\.(firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)\/?$/.test(databaseUrl)) {
  console.error(
    `URL de Realtime Database inválida: "${databaseUrl}".\n` +
      "Cópiala de Consola Firebase > Realtime Database, p.ej. https://omegatron-hackathon-default-rtdb.firebaseio.com",
  );
  process.exit(1);
}

if (!existsSync(".env")) copyFileSync(".env.example", ".env");
let env = readFileSync(".env", "utf8");

const valores = {
  FIREBASE_PROJECT_ID: sa.project_id,
  FIREBASE_CLIENT_EMAIL: sa.client_email,
  FIREBASE_PRIVATE_KEY: sa.private_key.replace(/\n/g, "\\n"),
  ...(databaseUrl && { FIREBASE_DATABASE_URL: databaseUrl }),
};

for (const [clave, valor] of Object.entries(valores)) {
  const linea = `${clave}="${valor}"`;
  const regex = new RegExp(`^${clave}=.*$`, "m");
  // Función como reemplazo: evita que "$" dentro del valor se interprete como patrón.
  env = regex.test(env) ? env.replace(regex, () => linea) : `${env.trimEnd()}\n${linea}\n`;
}

writeFileSync(".env", env);
console.log(`✅ .env actualizado: ${Object.keys(valores).join(", ")} (proyecto ${sa.project_id})`);
if (!databaseUrl) console.log("ℹ️  Recuerda revisar FIREBASE_DATABASE_URL en .env");
