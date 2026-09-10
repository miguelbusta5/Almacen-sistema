-- Sobrantes: cuando al ayudante no le caben todas las unidades.
--
-- Almacena las que pudo y el resto vuelve al montacarguista como un registro
-- PROPIO, con su ubicacion final y su reloj. Se guarda el enlace al registro del
-- que salio para poder reconstruir la estiba completa: dos filas, dos
-- ubicaciones, un solo PLU.
--
-- Aditivo e idempotente.
ALTER TABLE movimientos_montacargas
  ADD COLUMN IF NOT EXISTS origen_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_montacargas_origen_id_fkey'
  ) THEN
    ALTER TABLE movimientos_montacargas
      ADD CONSTRAINT movimientos_montacargas_origen_id_fkey
      FOREIGN KEY (origen_id) REFERENCES movimientos_montacargas(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS movimientos_montacargas_origen_id_idx
  ON movimientos_montacargas (origen_id);
