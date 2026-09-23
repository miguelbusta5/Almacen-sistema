-- Muebles: ordenes que llegan DE TIENDA (23-09).
--
-- Tienen su OVDM/TSDM de NetSuite pero la mercancia viene de una tienda y no se
-- pickea en el CEDI. Con tienda de origen = orden de tienda; sin ella = orden
-- normal (o contado). Se sella codigo y nombre del maestro de tiendas, igual
-- que despachos_tienda, para que el historico no cambie si el catalogo se edita.
--
-- Aditivo e idempotente, nullable y sin backfill: el codigo viejo convive.

ALTER TABLE ordenes_muebles
  ADD COLUMN IF NOT EXISTS tienda_origen_codigo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tienda_origen_nombre VARCHAR(255);
