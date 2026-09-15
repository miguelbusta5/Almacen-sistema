-- El boton de almuerzo (pausas operativas) tambien en Picking de Muebles.
--
-- Una pausa personal detiene la orden que el operario tiene abierta y los PLU
-- que lleva en la mano; el tiempo pausado se descuenta del reloj de picking,
-- igual que en montacargas y resurtido.
--
-- Aditivo e idempotente.

ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS pausa_id TEXT;
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP(3);
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS pausa_id TEXT;
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP(3);
ALTER TABLE lineas_muebles ADD COLUMN IF NOT EXISTS pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE pausas_operativas ADD COLUMN IF NOT EXISTS ordenes_muebles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE pausas_operativas ADD COLUMN IF NOT EXISTS lineas_muebles TEXT[] NOT NULL DEFAULT '{}';
