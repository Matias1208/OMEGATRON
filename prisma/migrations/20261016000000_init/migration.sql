-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "TipoEPP" AS ENUM ('GUANTES', 'MASCARILLA', 'RESPIRADOR', 'GAFAS', 'CALZADO', 'ROPA', 'PROTECCION_AUDITIVA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('PENDIENTE_VERIFICACION_CAMARA', 'VERIFICADO', 'INCUMPLIMIENTO_EHS', 'FALLIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('STOCK_BAJO', 'LOTE_POR_VENCER', 'VIDA_UTIL_VENCIDA', 'RETIRO_EXCESIVO', 'INCUMPLIMIENTO_EHS', 'FALLA_HARDWARE');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('PENDIENTE', 'RESUELTA');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "rfid" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cargoId" TEXT NOT NULL,
    "areaId" TEXT,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quimico" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivelRiesgo" "NivelRiesgo" NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Quimico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivelRiesgo" "NivelRiesgo" NOT NULL,
    "quimicoId" TEXT,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionTurno" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "operarioId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "areaId" TEXT,

    CONSTRAINT "AsignacionTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EPP" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEPP" NOT NULL,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "vidaUtilDias" INTEGER NOT NULL,
    "especificaciones" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EPP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoEPP" (
    "cargoId" TEXT NOT NULL,
    "eppId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CargoEPP_pkey" PRIMARY KEY ("cargoId","eppId")
);

-- CreateTable
CREATE TABLE "TareaEPP" (
    "tareaId" TEXT NOT NULL,
    "eppId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TareaEPP_pkey" PRIMARY KEY ("tareaId","eppId")
);

-- CreateTable
CREATE TABLE "Estacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "areaId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimoPing" TIMESTAMP(3),

    CONSTRAINT "Estacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "estacionId" TEXT NOT NULL,
    "eppId" TEXT NOT NULL,
    "slotMotor" INTEGER NOT NULL,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cantidadInicial" INTEGER NOT NULL,
    "stockActual" INTEGER NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATE,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operarioId" TEXT NOT NULL,
    "eppId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "estacionId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "asignacionId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "costoTotal" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION_CAMARA',
    "venceUso" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "verificadoAt" TIMESTAMP(3),

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'PENDIENTE',
    "mensaje" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "enviadaTelegram" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaAt" TIMESTAMP(3),

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_ruc_key" ON "Cliente"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Area_clienteId_nombre_key" ON "Area"("clienteId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Turno_nombre_key" ON "Turno"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nombre_key" ON "Cargo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Operario_cedula_key" ON "Operario"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "Operario_rfid_key" ON "Operario"("rfid");

-- CreateIndex
CREATE UNIQUE INDEX "Quimico_nombre_key" ON "Quimico"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Tarea_nombre_key" ON "Tarea"("nombre");

-- CreateIndex
CREATE INDEX "AsignacionTurno_fecha_idx" ON "AsignacionTurno"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionTurno_operarioId_fecha_turnoId_key" ON "AsignacionTurno"("operarioId", "fecha", "turnoId");

-- CreateIndex
CREATE UNIQUE INDEX "EPP_codigo_key" ON "EPP"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Estacion_codigo_key" ON "Estacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_estacionId_eppId_key" ON "Inventario"("estacionId", "eppId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_estacionId_slotMotor_key" ON "Inventario"("estacionId", "slotMotor");

-- CreateIndex
CREATE INDEX "Lote_inventarioId_fechaVencimiento_idx" ON "Lote"("inventarioId", "fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_inventarioId_codigo_key" ON "Lote"("inventarioId", "codigo");

-- CreateIndex
CREATE INDEX "Entrega_operarioId_eppId_venceUso_idx" ON "Entrega"("operarioId", "eppId", "venceUso");

-- CreateIndex
CREATE INDEX "Entrega_fecha_idx" ON "Entrega"("fecha");

-- CreateIndex
CREATE INDEX "Entrega_estado_idx" ON "Entrega"("estado");

-- CreateIndex
CREATE INDEX "Entrega_areaId_fecha_idx" ON "Entrega"("areaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_dedupeKey_key" ON "Alerta"("dedupeKey");

-- CreateIndex
CREATE INDEX "Alerta_estado_tipo_idx" ON "Alerta"("estado", "tipo");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operario" ADD CONSTRAINT "Operario_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operario" ADD CONSTRAINT "Operario_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_quimicoId_fkey" FOREIGN KEY ("quimicoId") REFERENCES "Quimico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionTurno" ADD CONSTRAINT "AsignacionTurno_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionTurno" ADD CONSTRAINT "AsignacionTurno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionTurno" ADD CONSTRAINT "AsignacionTurno_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionTurno" ADD CONSTRAINT "AsignacionTurno_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoEPP" ADD CONSTRAINT "CargoEPP_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoEPP" ADD CONSTRAINT "CargoEPP_eppId_fkey" FOREIGN KEY ("eppId") REFERENCES "EPP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaEPP" ADD CONSTRAINT "TareaEPP_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaEPP" ADD CONSTRAINT "TareaEPP_eppId_fkey" FOREIGN KEY ("eppId") REFERENCES "EPP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estacion" ADD CONSTRAINT "Estacion_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_estacionId_fkey" FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_eppId_fkey" FOREIGN KEY ("eppId") REFERENCES "EPP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_eppId_fkey" FOREIGN KEY ("eppId") REFERENCES "EPP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_estacionId_fkey" FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionTurno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

