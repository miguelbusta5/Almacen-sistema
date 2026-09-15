-- Inspeccion de Muebles: averias, almuerzo, PLU de tienda, facturas de contado
-- y varios inspectores por orden.
--
-- - Un PLU averiado se marca y se le pide reposicion a un operario de picking.
--   La ventana de espera se descuenta del reloj de inspeccion, igual que la de
--   ebanisteria, y la orden no cierra hasta reinspeccionar el repuesto.
-- - El almuerzo del inspector detiene el reloj de la orden y el del PLU.
-- - Una factura de contado es una orden mas (tipo CONTADO) con su cliente.
-- - Las TSDM las trabajan varios inspectores: quien entra queda registrado; el
--   tiempo de cada uno ya sale del inspector de cada PLU.
--
-- Aditivo e idempotente.

-- ── Averia y reposicion ──
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS averiado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS motivo_averia TEXT;
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS reposicion_inicio TIMESTAMP(3);
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS reposicion_fin TIMESTAMP(3);

ALTER TABLE pendientes_muebles ADD COLUMN IF NOT EXISTS motivo VARCHAR(20) NOT NULL DEFAULT 'FALTANTE';
ALTER TABLE pendientes_muebles ADD COLUMN IF NOT EXISTS linea_id TEXT;

-- ── Almuerzo del inspector ──
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS insp_pausa_inicio TIMESTAMP(3);
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS insp_pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS insp_pausa_inspector_id TEXT;

ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS insp_pausa_inicio TIMESTAMP(3);
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS insp_pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ── Factura de contado ──
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS cliente VARCHAR(160);

-- ── Varios inspectores en la misma orden ──
CREATE TABLE IF NOT EXISTS inspectores_orden_muebles (
  id           TEXT PRIMARY KEY,
  orden_id     TEXT NOT NULL REFERENCES ordenes_muebles (id) ON DELETE CASCADE,
  inspector_id TEXT NOT NULL REFERENCES inspectores_muebles (id),
  se_unio_at   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inspectores_orden_muebles_orden_inspector_key
  ON inspectores_orden_muebles (orden_id, inspector_id);
CREATE INDEX IF NOT EXISTS inspectores_orden_muebles_inspector_idx
  ON inspectores_orden_muebles (inspector_id);

-- Cerrada a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE inspectores_orden_muebles ENABLE ROW LEVEL SECURITY;
