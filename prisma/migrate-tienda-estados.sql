-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Nuevos estados de flujo logístico para Despachos Tienda
-- Railway DB — ejecutar en el panel SQL ANTES de npx prisma db push
--
-- Estados anteriores: PENDIENTE | RECIBIDO | DESPACHADO | CON_NOVEDAD
-- Estados nuevos:     CREADO_TIENDA | RECOGIDA_PENDIENTE | RECOGIDO | EN_RUTA | ENTREGADO | CON_NOVEDAD
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- PASO 1: Agregar los nuevos valores al enum existente
-- (PostgreSQL solo permite ADD VALUE en una transacción separada)
COMMIT;

ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS 'CREADO_TIENDA';
ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS 'RECOGIDA_PENDIENTE';
ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS 'RECOGIDO';
ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS 'EN_RUTA';
ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS 'ENTREGADO';

-- PASO 2: Migrar datos existentes
UPDATE despachos_tienda SET estado = 'CREADO_TIENDA'   WHERE estado = 'PENDIENTE';
UPDATE despachos_tienda SET estado = 'RECOGIDO'        WHERE estado = 'RECIBIDO';
UPDATE despachos_tienda SET estado = 'ENTREGADO'       WHERE estado = 'DESPACHADO';
-- CON_NOVEDAD se mantiene igual

-- PASO 3: Agregar columna enRutaAt
ALTER TABLE despachos_tienda
  ADD COLUMN IF NOT EXISTS en_ruta_at TIMESTAMP(3);

-- PASO 4: Recrear el enum sin los valores viejos
--   (PostgreSQL no tiene DROP VALUE; se hace recreando el tipo)
ALTER TABLE despachos_tienda
  ALTER COLUMN estado DROP DEFAULT;

CREATE TYPE "EstadoDespacho_v2" AS ENUM (
  'CREADO_TIENDA',
  'RECOGIDA_PENDIENTE',
  'RECOGIDO',
  'EN_RUTA',
  'ENTREGADO',
  'CON_NOVEDAD'
);

ALTER TABLE despachos_tienda
  ALTER COLUMN estado TYPE "EstadoDespacho_v2"
  USING estado::text::"EstadoDespacho_v2";

DROP TYPE "EstadoDespacho";
ALTER TYPE "EstadoDespacho_v2" RENAME TO "EstadoDespacho";

-- PASO 5: Restaurar el default
ALTER TABLE despachos_tienda
  ALTER COLUMN estado SET DEFAULT 'CREADO_TIENDA';

-- Verificar resultado
SELECT estado, COUNT(*) FROM despachos_tienda GROUP BY estado;
