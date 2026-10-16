# OMEGATRON

Estación Inteligente de EPP — Hackathon Expo Clean Ecuador 2026 (Reto 5: Monitoreo Ergonómico y Gestión Inteligente de EPP).

Backend + kiosco/dashboard en **Next.js 15 (App Router) + TypeScript**, **Prisma + PostgreSQL** (Docker), **Zod**, alertas por **Telegram**, puente IoT con **Firebase** y validación de uso de EPP por **visión artificial** (script Python en el edge).

## Arranque rápido

Requisitos: Node 20+, Docker Desktop.

```bash
npm install
cp .env.example .env      # completar tokens de Telegram/Firebase
npm run db:up             # PostgreSQL en localhost:5432
npm run db:migrate        # aplica migraciones y ejecuta el seed
npm run dev               # http://localhost:3000
```

Otros scripts: `npm run db:studio` (explorar datos), `npm run db:seed`, `npm run db:down`.

RFIDs de prueba del seed: `A1B2C3D4` (desinfección de quirófano), `B2C3D4E5` (oficinas), `D4E5F6A7` (operario industrial), `FFFFFFFF` (inactivo).

## Estructura

```text
prisma/                 schema, migraciones y seed
src/
├── app/api/vision/validate   webhook del script de visión (POST)
├── features/
│   ├── dispensa/       validación de EPP por RFID, vida útil, registro de entregas
│   ├── inventario/     descuento de stock FEFO por lotes
│   ├── alertas/        alertas deduplicadas + Telegram
│   └── dashboard/      KPIs agregados listos para Recharts
└── lib/                prisma, telegram, fechas (UTC-5), auth de dispositivos
```

## Flujo de dispensación

1. El operario pasa su tarjeta → `procesarDispensacion(rfid, areaId)`.
2. EPP requerido = reglas del **cargo** ∪ reglas de la **tarea** del turno.
3. Se bloquea el EPP que aún está dentro de su vida útil (retiro excesivo → alerta Telegram).
4. Se descuenta stock del lote que vence primero y se registra la entrega como `PENDIENTE_VERIFICACION_CAMARA`.
5. La cámara envía su veredicto a `POST /api/vision/validate` (header `x-api-key`) → `VERIFICADO` o `INCUMPLIMIENTO_EHS` (alerta Telegram).
