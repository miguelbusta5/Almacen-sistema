-- Recepcion de Contenedores: tipo de contenedor (carga suelta, 20 o 40 pies).
--
-- La columna es NULLABLE y sin backfill: las recepciones anteriores no dicen
-- que contenedor fue, y adivinarlo ensuciaria el indicador. Quedan como
-- "Sin tipo" y supervision las corrige desde la tabla (con motivo).
-- Las nuevas lo exigen al abrir (validarApertura).
--
-- Aditivo e idempotente: el codigo viejo convive con la columna.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoContenedorRecepcion') THEN
    CREATE TYPE "TipoContenedorRecepcion" AS ENUM ('CARGA_SUELTA', 'PIES_20', 'PIES_40');
  END IF;
END $$;

ALTER TABLE recepciones_contenedor
  ADD COLUMN IF NOT EXISTS tipo_contenedor "TipoContenedorRecepcion";
