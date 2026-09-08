-- Mediciones de caja master (archivo "V2 MEDICION DE CAJA MASTER").
--
-- Dos tablas y no columnas en productos_maestro: un producto puede llegar en
-- varias cajas ("partes"), asi que la medida de la caja es una fila por parte;
-- y dejar el maestro intacto mantiene estas columnas fuera del
-- INSERT ... ON CONFLICT del importador de precios.
--
-- Sin FK a productos_maestro: el maestro se recarga entero cada tanto y una FK
-- convertiria cada recarga en un problema de orden.
--
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS medidas_caja_master (
  id            TEXT PRIMARY KEY,
  plu           VARCHAR(100) NOT NULL,
  parte         INTEGER NOT NULL,
  peso_bruto_kg DECIMAL(8, 3),
  peso_neto_kg  DECIMAL(8, 3),
  alto_cm       DECIMAL(8, 2),
  ancho_cm      DECIMAL(8, 2),
  prof_cm       DECIMAL(8, 2),
  -- alto x ancho x prof / 1.000.000, sellado al importar.
  volumen_m3    DECIMAL(10, 6),
  created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS medidas_caja_master_plu_parte_key
  ON medidas_caja_master (plu, parte);
CREATE INDEX IF NOT EXISTS medidas_caja_master_plu_idx
  ON medidas_caja_master (plu);

CREATE TABLE IF NOT EXISTS medidas_producto (
  id               TEXT PRIMARY KEY,
  plu              VARCHAR(100) NOT NULL,
  zona             VARCHAR(60),
  partes           INTEGER,
  unidades_set     INTEGER,
  sub_empaque      INTEGER,
  empaque_alto_cm  DECIMAL(8, 2),
  empaque_ancho_cm DECIMAL(8, 2),
  empaque_prof_cm  DECIMAL(8, 2),
  pieza_alto_cm    DECIMAL(8, 2),
  pieza_ancho_cm   DECIMAL(8, 2),
  pieza_prof_cm    DECIMAL(8, 2),
  created_at       TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS medidas_producto_plu_key
  ON medidas_producto (plu);
