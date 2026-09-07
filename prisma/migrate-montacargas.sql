-- Control Montacargas: recepcion de contenedor, movimientos de deposito y
-- resurtido en una sola tabla, discriminados por `tipo`.
--
-- Reemplaza a la tabla `estibas` de la primera version del modulo, que nunca
-- llego a usarse en produccion (la variable NUXT_PILOT_ESTIBAS_URL jamas se
-- activo, asi que la tabla quedo vacia). Por eso se puede reestructurar en vez
-- de migrar datos.
--
-- Cambios respecto de `estibas`:
--   - fuera `pedido`: el operario ya no lo captura.
--   - nuevo `tipo`: RECEPCION | MOVIMIENTO | RESURTIDO.
--   - nuevo reguero (`hay_reguero`, `unidades_sueltas`): unidades que no vienen
--     en caja master y que suman a la cantidad total.
--   - nueva `ubicacion_inicial`: de donde sale la mercancia (null en RECEPCION,
--     porque un contenedor no tiene ubicacion previa).
--   - `ubicacion` pasa a llamarse `ubicacion_final`.

DO $$ BEGIN
  CREATE TYPE "TipoMovimientoMontacargas" AS ENUM ('RECEPCION', 'MOVIMIENTO', 'RESURTIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TABLE IF EXISTS estibas;

CREATE TABLE IF NOT EXISTS movimientos_montacargas (
  id TEXT PRIMARY KEY,
  tipo "TipoMovimientoMontacargas" NOT NULL,
  plu VARCHAR(100) NOT NULL,
  ean VARCHAR(20),
  descripcion VARCHAR(255) NOT NULL,
  cajas INTEGER NOT NULL,
  unidades_por_caja INTEGER NOT NULL,
  unidades_manuales BOOLEAN NOT NULL DEFAULT false,
  hay_reguero BOOLEAN NOT NULL DEFAULT false,
  unidades_sueltas INTEGER NOT NULL DEFAULT 0,
  cantidad_total INTEGER NOT NULL,
  ubicacion_inicial VARCHAR(120),
  ubicacion_final VARCHAR(120),
  fecha DATE NOT NULL,
  hora_inicio TIMESTAMP(3) NOT NULL,
  hora_finalizacion TIMESTAMP(3),
  motivo_correccion TEXT,
  deleted_at TIMESTAMP(3),
  creado_por_id TEXT NOT NULL REFERENCES users(id),
  actualizado_por_id TEXT REFERENCES users(id),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sirve la consulta caliente: "el registro abierto de este operario en este tipo".
CREATE INDEX IF NOT EXISTS mov_montacargas_abierto_idx
  ON movimientos_montacargas(creado_por_id, tipo, hora_finalizacion, deleted_at);
CREATE INDEX IF NOT EXISTS mov_montacargas_tipo_fecha_idx
  ON movimientos_montacargas(tipo, fecha);
CREATE INDEX IF NOT EXISTS mov_montacargas_plu_idx
  ON movimientos_montacargas(plu);
