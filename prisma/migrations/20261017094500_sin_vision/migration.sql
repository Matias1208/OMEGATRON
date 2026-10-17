CREATE TYPE "ResultadoLectura" AS ENUM ('CONCEDIDO', 'DENEGADO', 'ERROR');

BEGIN;
CREATE TYPE "EstadoEntrega_new" AS ENUM ('ENTREGADA', 'FALLIDA', 'ANULADA');
ALTER TABLE "Entrega" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Entrega"
  ALTER COLUMN "estado" TYPE "EstadoEntrega_new"
  USING (
    CASE "estado"::text
      WHEN 'PENDIENTE_VERIFICACION_CAMARA' THEN 'ENTREGADA'
      WHEN 'VERIFICADO' THEN 'ENTREGADA'
      WHEN 'INCUMPLIMIENTO_EHS' THEN 'ENTREGADA'
      WHEN 'FALLIDA' THEN 'FALLIDA'
      WHEN 'ANULADA' THEN 'ANULADA'
    END
  )::"EstadoEntrega_new";
ALTER TYPE "EstadoEntrega" RENAME TO "EstadoEntrega_old";
ALTER TYPE "EstadoEntrega_new" RENAME TO "EstadoEntrega";
DROP TYPE "EstadoEntrega_old";
ALTER TABLE "Entrega" ALTER COLUMN "estado" SET DEFAULT 'ENTREGADA';
COMMIT;

BEGIN;
DELETE FROM "Alerta" WHERE "tipo"::text = 'INCUMPLIMIENTO_EHS';
CREATE TYPE "TipoAlerta_new" AS ENUM (
  'STOCK_BAJO',
  'LOTE_POR_VENCER',
  'VIDA_UTIL_VENCIDA',
  'RETIRO_EXCESIVO',
  'FALLA_HARDWARE'
);
ALTER TABLE "Alerta"
  ALTER COLUMN "tipo" TYPE "TipoAlerta_new"
  USING ("tipo"::text::"TipoAlerta_new");
ALTER TYPE "TipoAlerta" RENAME TO "TipoAlerta_old";
ALTER TYPE "TipoAlerta_new" RENAME TO "TipoAlerta";
DROP TYPE "TipoAlerta_old";
COMMIT;

ALTER TABLE "Entrega" DROP COLUMN "verificadoAt";

CREATE TABLE "Lectura" (
  "id" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rfid" TEXT NOT NULL,
  "operarioId" TEXT,
  "estacionId" TEXT,
  "areaId" TEXT,
  "resultado" "ResultadoLectura" NOT NULL,
  "motivo" TEXT,
  "entregas" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "Lectura_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lectura_fecha_idx" ON "Lectura"("fecha");
CREATE INDEX "Lectura_resultado_fecha_idx" ON "Lectura"("resultado", "fecha");
CREATE INDEX "Lectura_operarioId_fecha_idx" ON "Lectura"("operarioId", "fecha");

ALTER TABLE "Lectura"
  ADD CONSTRAINT "Lectura_operarioId_fkey"
  FOREIGN KEY ("operarioId") REFERENCES "Operario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lectura"
  ADD CONSTRAINT "Lectura_estacionId_fkey"
  FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lectura"
  ADD CONSTRAINT "Lectura_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
