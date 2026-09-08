-- Control Montacargas / Resurtido: tramos por persona, traspaso a ayudantes y
-- novedades. Aditivo e idempotente sobre movimientos_montacargas.
--
-- La tabla estaba vacia (el modulo no se ha usado en produccion todavia), asi
-- que las columnas nuevas NOT NULL se pueden anadir sin backfill: el DEFAULT y
-- el UPDATE de abajo cubren cualquier fila que llegara a existir.

DO $$ BEGIN
  CREATE TYPE "EstadoMovimientoMontacargas" AS ENUM ('EN_CURSO', 'NOVEDAD', 'CERRADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoNovedadMontacargas" AS ENUM ('UNIDADES', 'UBICACION_INICIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rol del ayudante.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'OPERARIO_ALMACENAMIENTO'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'OPERARIO_ALMACENAMIENTO';
  END IF;
END $$;

ALTER TABLE movimientos_montacargas
  ADD COLUMN IF NOT EXISTS estado "EstadoMovimientoMontacargas" NOT NULL DEFAULT 'EN_CURSO';
-- Quien tiene el PLU en la mano ahora. Arranca en el creador y cambia con cada
-- traspaso; es lo que decide en la bandeja de quien aparece el registro.
ALTER TABLE movimientos_montacargas
  ADD COLUMN IF NOT EXISTS responsable_id TEXT REFERENCES users(id);
UPDATE movimientos_montacargas SET responsable_id = creado_por_id WHERE responsable_id IS NULL;
ALTER TABLE movimientos_montacargas ALTER COLUMN responsable_id SET NOT NULL;

-- El registro nace al digitar el PLU, con las cantidades todavia en cero.
ALTER TABLE movimientos_montacargas ALTER COLUMN cajas SET DEFAULT 0;
ALTER TABLE movimientos_montacargas ALTER COLUMN unidades_por_caja SET DEFAULT 0;
ALTER TABLE movimientos_montacargas ALTER COLUMN cantidad_total SET DEFAULT 0;

DROP INDEX IF EXISTS mov_montacargas_abierto_idx;
CREATE INDEX IF NOT EXISTS mov_montacargas_responsable_idx
  ON movimientos_montacargas(responsable_id, tipo, estado, deleted_at);

-- Un tramo por cada persona que tuvo el PLU en la mano.
CREATE TABLE IF NOT EXISTS tramos_montacargas (
  id TEXT PRIMARY KEY,
  movimiento_id TEXT NOT NULL REFERENCES movimientos_montacargas(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES users(id),
  orden INTEGER NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  fin TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tramos_montacargas_mov_idx ON tramos_montacargas(movimiento_id, orden);
CREATE INDEX IF NOT EXISTS tramos_montacargas_usuario_idx ON tramos_montacargas(usuario_id, fin);

-- Novedades: el ayudante no corrige, marca el descuadre y el reloj se detiene.
CREATE TABLE IF NOT EXISTS novedades_montacargas (
  id TEXT PRIMARY KEY,
  movimiento_id TEXT NOT NULL REFERENCES movimientos_montacargas(id) ON DELETE CASCADE,
  tipo "TipoNovedadMontacargas" NOT NULL,
  detalle TEXT,
  cantidad_encontrada INTEGER,
  ubicacion_encontrada VARCHAR(120),
  abierta_por_id TEXT NOT NULL REFERENCES users(id),
  abierta_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resuelta_por_id TEXT REFERENCES users(id),
  resuelta_at TIMESTAMP(3),
  nota_resolucion TEXT
);
CREATE INDEX IF NOT EXISTS novedades_montacargas_mov_idx ON novedades_montacargas(movimiento_id);
CREATE INDEX IF NOT EXISTS novedades_montacargas_resuelta_idx ON novedades_montacargas(resuelta_at);
