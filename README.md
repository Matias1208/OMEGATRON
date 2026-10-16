# OMEGATRON

Estación Inteligente de EPP — Hackathon Expo Clean Ecuador 2026 (Reto 5: Monitoreo Ergonómico y Gestión Inteligente de EPP).

Entrega el equipo de protección correcto según **cargo, tarea y químico del turno**, controla su **vida útil** e **inventario por lote (FEFO)**, verifica su uso con **visión artificial** y alerta por **Telegram**. Incluye un tablero gerencial con metodología **1-3-10**.

**Stack:** Next.js 15 (App Router) · TypeScript · Prisma 6 + PostgreSQL (Docker) · Zod · Tailwind 4 · Recharts · Firebase Admin (Realtime Database) · Telegram Bot API · ESP32.

## Arranque rápido

Requisitos: Node 20+ y Docker Desktop abierto.

```bash
npm install
cp .env.example .env      # completar credenciales (ver abajo)
npm run db:up             # PostgreSQL en localhost:5432
npm run db:migrate        # aplica migraciones y carga los datos de demo
npm run dev               # http://localhost:3000
```

**Para la demo usa producción** (responde en ~200 ms; `dev` compila cada ruta en la primera petición y la ESP32 puede agotar su timeout):

```bash
npm run demo              # build de producción + servidor accesible desde la red (ESP32)
npm run start:red         # solo arrancar, si ya hiciste el build y no cambiaste código
```

### Scripts

| Script | Qué hace |
|---|---|
| `npm run db:up` / `db:down` | Levanta / detiene PostgreSQL (los datos persisten en un volumen) |
| `npm run db:migrate` | Aplica migraciones y ejecuta el seed |
| `npm run db:seed` | **Borra todo** y recarga los datos de demo (60 días de historial) |
| `npm run db:studio` | Explorar y editar datos en el navegador |
| `npm run firebase:env -- <service-account.json> <url-rtdb>` | Copia la cuenta de servicio de Firebase a `.env` sin mostrar la clave |
| `npm run telegram:test` | Valida el bot; sin `TELEGRAM_CHAT_ID` lista los chats para copiar el id |

### Credenciales de demo (seed)

| RFID | Operario | Escenario |
|---|---|---|
| `D21CF01B` | María Quishpe | Desinfección de quirófano (riesgo crítico) — tarjeta física |
| `097A5502` | Luis Chiluisa | Limpieza de oficinas — tarjeta física |
| `D4E5F6A7` | Jorge Caiza | Operario industrial, desengrase |
| `FFFFFFFF` | Pedro Inactivo | Rechazo por operario inactivo |

Cada retiro deja el EPP vigente según su vida útil (guantes: ~22 h). Ejecuta `npm run db:seed` antes de presentar para liberar las tarjetas.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL (el valor de `.env.example` sirve con `docker-compose.yml`) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Alertas. Bot con @BotFather; el chat id con `npm run telegram:test` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL` | Orden al motor vía Realtime Database (`npm run firebase:env`) |
| `HARDWARE_API_KEY` | Clave compartida con la ESP32 y el script de visión (header `x-api-key`) |
| `HARDWARE_SIMULADO` | `true` = no escribe en Firebase y habilita la simulación de cámara en el kiosco |
| `CRON_INTERNO_MINUTOS` | Revisiones de alertas automáticas en el servidor (vacío = desactivado) |
| `CRON_SECRET` | Solo producción: `GET /api/cron/alertas` con `Authorization: Bearer` |

`.env` y `hardware/esp32/**/secrets.h` **nunca** se suben a git.

## Pantallas

| Ruta | Contenido |
|---|---|
| `/` | Centro de control: estado del sistema, estaciones, integraciones y **panel de dispensación** (acepta lector RFID USB; mismo flujo que la ESP32) |
| `/dashboard?dias=7\|30\|90` | Tablero 1-3-10: estado + decisión prioritaria, 3 pilares (costo, cumplimiento EHS, disponibilidad), 10 vistas de diagnóstico, reposición de stock y resolución de alertas |

## API

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| POST | `/api/hardware/rfid` | `x-api-key` | ESP32: `{ "rfid": "D21CF01B", "estacion_id": "EST-01" }` → 200 dispensa / 403 denegado / 503 sin Firebase |
| POST | `/api/vision/validate` | `x-api-key` | Cámara: `{ "entrega_id", "epp_detectado", "confianza?" }` → aplica a todo el retiro |
| GET | `/api/dashboard?dias=30` | — | Resumen 1-3-10 en JSON (listo para Recharts) |
| GET | `/api/cron/alertas` | Bearer `CRON_SECRET` o `x-api-key` | Revisiones programadas de alertas |
| GET | `/api/health` | — | Verificación de conectividad (la ESP32 la llama al arrancar) |

## Flujo de dispensación

1. Se lee la credencial (ESP32 → `/api/hardware/rfid`, o el panel del kiosco).
2. EPP requerido = reglas del **cargo** ∪ reglas de la **tarea** del turno (si no hay asignación hoy, se usa su tarea habitual).
3. Se bloquea el EPP aún dentro de su vida útil (retiro excesivo → alerta Telegram; un re-toque < 2 min es rebote y no alerta).
4. Se descuenta del lote que vence primero (FEFO) en una transacción con bloqueo por operario y se registran las entregas como `PENDIENTE_VERIFICACION_CAMARA`.
5. Se escribe la orden en Firebase (`/estaciones/EST-01/comando`). Si falla, las entregas pasan a `FALLIDA` y el stock vuelve al lote.
6. La cámara envía su veredicto → `VERIFICADO` o `INCUMPLIMIENTO_EHS` (alerta Telegram).

**Alertas:** stock bajo (se cierra sola al reponer), lote por vencer / vencido con stock, vida útil cumplida (resumen consolidado; se cierra al reemplazar), retiro excesivo, incumplimiento EHS y falla de hardware. Todas deduplicadas.

## Estructura

```text
prisma/                      schema, migraciones y seed
hardware/esp32/              firmware del dispensador (Arduino) + secrets.example.h
scripts/                     firebase-env.mjs, telegram-test.mjs
src/
├── app/
│   ├── page.tsx             centro de control + panel de dispensación
│   ├── dashboard/           tablero 1-3-10 (+ _components: gráficos Recharts, formularios)
│   ├── _components/         shell, navegación y componentes de UI compartidos
│   └── api/                 hardware/rfid, vision/validate, dashboard, cron/alertas, health
├── features/                lógica de dominio
│   ├── dispensa/            reglas EHS, vida útil, entregas, veredicto de cámara
│   ├── hardware/            dispensarEnEstacion: reglas + orden al motor + reversión
│   ├── inventario/          FEFO, reversión, ingreso de lotes
│   ├── alertas/             alertas deduplicadas, Telegram, revisiones programadas
│   └── dashboard/           consultas agregadas y resumen 1-3-10
├── lib/                     prisma, firebase, telegram, fechas (UTC-5), api-auth
└── instrumentation.ts       cron interno en local
```

## Limitaciones conocidas (prototipo)

- **Un solo motor físico (guantes):** el backend registra todo el EPP requerido, pero solo los guantes salen por el dispensador.
- **Sin autenticación de usuarios:** el dashboard, la reposición de stock y la resolución de alertas están abiertos a la red local.
