-- Orden transferida (24-09-2026): al pasar una orden a un operario que ya tiene
-- otra abierta, queda a su nombre como pendiente de picking hasta que la tome.
-- Aditivo e idempotente; nullable (el codigo viejo convive con las columnas).
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS transferida_a_id text;
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS transferida_at timestamp(3);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_muebles_transferida_a_id_fkey') THEN
    ALTER TABLE ordenes_muebles ADD CONSTRAINT ordenes_muebles_transferida_a_id_fkey
      FOREIGN KEY (transferida_a_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ordenes_muebles_transferida_a_id_idx ON ordenes_muebles (transferida_a_id);
