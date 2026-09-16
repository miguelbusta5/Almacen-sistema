-- Entrega a transporte de las ordenes de muebles (Patinador Muebles).
--
-- El inspector asigna la ciudad de envio al empezar la orden; cuando queda
-- inspeccionada pasa sola a la bandeja del patinador ("Lista para entregar a
-- transporte"), que filtra por ciudad, marca varias a la vez y con eso se cierra
-- la medicion: el lead time va desde que se abrio el picking hasta la entrega.
--
-- Aditivo e idempotente.

ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS ciudad_envio VARCHAR(80);
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS entregada_transporte_at TIMESTAMP(3);
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS entregada_por_id TEXT;

CREATE INDEX IF NOT EXISTS ordenes_muebles_ciudad_estado_idx ON ordenes_muebles (ciudad_envio, estado);
CREATE INDEX IF NOT EXISTS ordenes_muebles_entregada_idx ON ordenes_muebles (entregada_transporte_at);

-- Estado nuevo: ya salio del CEDI.
ALTER TYPE "EstadoOrdenMuebles" ADD VALUE IF NOT EXISTS 'ENTREGADA_TRANSPORTE';

-- Rol nuevo: el patinador de muebles solo ve su bandeja de entrega.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PATINADOR_MUEBLES';
