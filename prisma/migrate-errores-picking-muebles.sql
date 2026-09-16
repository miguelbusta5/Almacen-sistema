-- Errores de picking en Muebles.
--
-- El administrador marca, sobre un PLU de una orden en inspeccion, que el
-- picking salio mal (PLU equivocado, unidades, faltante...). Con los errores
-- marcados puede terminar la orden aunque esos PLU no se hayan inspeccionado,
-- para que el patinador la entregue. Cada error queda a nombre del operario que
-- pickeo ese PLU y sale en Indicadores Muebles.
--
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS errores_picking_muebles (
  id             TEXT PRIMARY KEY,
  orden_id       TEXT NOT NULL REFERENCES ordenes_muebles (id) ON DELETE CASCADE,
  linea_id       TEXT NOT NULL REFERENCES lineas_muebles (id) ON DELETE CASCADE,
  -- Sellados al marcar: si despues se corrige la linea, el error dice lo que paso.
  plu            VARCHAR(100) NOT NULL,
  operario_id    TEXT NOT NULL REFERENCES users (id),
  tipo           VARCHAR(30) NOT NULL,
  nota           TEXT,
  marcado_por_id TEXT NOT NULL REFERENCES users (id),
  created_at     TIMESTAMP(3) NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS errores_picking_muebles_orden_idx ON errores_picking_muebles (orden_id);
CREATE INDEX IF NOT EXISTS errores_picking_muebles_linea_idx ON errores_picking_muebles (linea_id);
CREATE INDEX IF NOT EXISTS errores_picking_muebles_operario_idx ON errores_picking_muebles (operario_id, created_at);

-- Un solo error vigente por PLU: marcarlo otra vez lo corrige.
CREATE UNIQUE INDEX IF NOT EXISTS errores_picking_muebles_linea_vigente_key
  ON errores_picking_muebles (linea_id) WHERE deleted_at IS NULL;

ALTER TABLE errores_picking_muebles ENABLE ROW LEVEL SECURITY;
