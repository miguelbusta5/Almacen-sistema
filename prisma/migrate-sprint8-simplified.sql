-- Sprint 8 simplified tienda flow
-- Target EstadoDespacho:
--   CREADO_TIENDA | RECOGIDO_TIENDA | ENTREGADO_CEDI | ENVIADO_CLIENTE | CON_NOVEDAD
--
-- Safe data mapping:
--   RECOGIDA_PENDIENTE -> CREADO_TIENDA
--   ASIGNADO_RECOGIDA  -> CREADO_TIENDA
--   RECOGIDO           -> RECOGIDO_TIENDA
--   EN_RUTA            -> ENVIADO_CLIENTE
--   ENTREGADO          -> ENVIADO_CLIENTE
--   ENTREGADO_CLIENTE  -> ENVIADO_CLIENTE

BEGIN;

ALTER TABLE despachos_tienda
  ADD COLUMN IF NOT EXISTS nota_entrega TEXT;

UPDATE despachos_tienda
SET nota_entrega = concat_ws(E'\n',
  NULLIF(trim(coalesce(direccion_entrega, '')), ''),
  NULLIF(trim(coalesce(barrio, '')), ''),
  NULLIF(trim(coalesce(ciudad, '')), ''),
  NULLIF(trim(coalesce(departamento, '')), ''),
  CASE
    WHEN contacto_entrega IS NOT NULL OR telefono_entrega IS NOT NULL
    THEN NULLIF(trim(concat_ws(' ', 'Contacto:', contacto_entrega, telefono_entrega)), 'Contacto:')
    ELSE NULL
  END,
  NULLIF(trim(coalesce(observacion_entrega, '')), '')
)
WHERE nota_entrega IS NULL
  AND (
    direccion_entrega IS NOT NULL
    OR barrio IS NOT NULL
    OR ciudad IS NOT NULL
    OR departamento IS NOT NULL
    OR contacto_entrega IS NOT NULL
    OR telefono_entrega IS NOT NULL
    OR observacion_entrega IS NOT NULL
  );

ALTER TABLE despachos_tienda ALTER COLUMN estado DROP DEFAULT;

DROP TYPE IF EXISTS "EstadoDespacho_sprint8_simplified";

CREATE TYPE "EstadoDespacho_sprint8_simplified" AS ENUM (
  'CREADO_TIENDA',
  'RECOGIDO_TIENDA',
  'ENTREGADO_CEDI',
  'ENVIADO_CLIENTE',
  'CON_NOVEDAD'
);

ALTER TABLE despachos_tienda
  ALTER COLUMN estado TYPE "EstadoDespacho_sprint8_simplified"
  USING (
    CASE estado::text
      WHEN 'RECOGIDA_PENDIENTE' THEN 'CREADO_TIENDA'
      WHEN 'ASIGNADO_RECOGIDA'  THEN 'CREADO_TIENDA'
      WHEN 'RECOGIDO'           THEN 'RECOGIDO_TIENDA'
      WHEN 'EN_RUTA'            THEN 'ENVIADO_CLIENTE'
      WHEN 'ENTREGADO'          THEN 'ENVIADO_CLIENTE'
      WHEN 'ENTREGADO_CLIENTE'  THEN 'ENVIADO_CLIENTE'
      ELSE estado::text
    END
  )::"EstadoDespacho_sprint8_simplified";

ALTER TABLE historial_despachos
  ALTER COLUMN estado_anterior TYPE "EstadoDespacho_sprint8_simplified"
  USING (
    CASE estado_anterior::text
      WHEN 'RECOGIDA_PENDIENTE' THEN 'CREADO_TIENDA'
      WHEN 'ASIGNADO_RECOGIDA'  THEN 'CREADO_TIENDA'
      WHEN 'RECOGIDO'           THEN 'RECOGIDO_TIENDA'
      WHEN 'EN_RUTA'            THEN 'ENVIADO_CLIENTE'
      WHEN 'ENTREGADO'          THEN 'ENVIADO_CLIENTE'
      WHEN 'ENTREGADO_CLIENTE'  THEN 'ENVIADO_CLIENTE'
      ELSE estado_anterior::text
    END
  )::"EstadoDespacho_sprint8_simplified",
  ALTER COLUMN estado_nuevo TYPE "EstadoDespacho_sprint8_simplified"
  USING (
    CASE estado_nuevo::text
      WHEN 'RECOGIDA_PENDIENTE' THEN 'CREADO_TIENDA'
      WHEN 'ASIGNADO_RECOGIDA'  THEN 'CREADO_TIENDA'
      WHEN 'RECOGIDO'           THEN 'RECOGIDO_TIENDA'
      WHEN 'EN_RUTA'            THEN 'ENVIADO_CLIENTE'
      WHEN 'ENTREGADO'          THEN 'ENVIADO_CLIENTE'
      WHEN 'ENTREGADO_CLIENTE'  THEN 'ENVIADO_CLIENTE'
      ELSE estado_nuevo::text
    END
  )::"EstadoDespacho_sprint8_simplified";

DROP TYPE "EstadoDespacho";
ALTER TYPE "EstadoDespacho_sprint8_simplified" RENAME TO "EstadoDespacho";

ALTER TABLE despachos_tienda ALTER COLUMN estado SET DEFAULT 'CREADO_TIENDA';

ALTER TABLE despachos_tienda
  DROP COLUMN IF EXISTS asignado_recogida_at,
  DROP COLUMN IF EXISTS en_ruta_at,
  DROP COLUMN IF EXISTS conductor_asignado_id,
  DROP COLUMN IF EXISTS vehiculo_asignado_id,
  DROP COLUMN IF EXISTS ruta_id,
  DROP COLUMN IF EXISTS firma_url,
  DROP COLUMN IF EXISTS evidencia_url,
  DROP COLUMN IF EXISTS fecha_gps_entrega,
  DROP COLUMN IF EXISTS latitud_entrega,
  DROP COLUMN IF EXISTS longitud_entrega;

COMMIT;
