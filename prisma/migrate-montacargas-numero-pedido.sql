-- Control Montacargas: numero de pedido del contenedor en las RECEPCION (24-09).
--
-- Une cada PLU recibido por el montacarguista con su Recepcion de Contenedores
-- (mismo numero de pedido, normalizado en mayusculas y sin espacios) para sumar
-- por contenedor los m3, los PLU, las unidades y el tiempo de almacenamiento.
--
-- Aditivo e idempotente, nullable y sin backfill: lo anterior al 24-09 no lo
-- tiene y el codigo viejo convive con la columna.

ALTER TABLE movimientos_montacargas
  ADD COLUMN IF NOT EXISTS numero_pedido VARCHAR(50);

CREATE INDEX IF NOT EXISTS movimientos_montacargas_pedido_idx
  ON movimientos_montacargas (numero_pedido);
