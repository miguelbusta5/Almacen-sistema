-- Modulo Recepcion de Contenedores: la planilla de recepcion del CEDI.
--
-- El reloj arranca al registrar el numero de pedido y se cierra cuando el
-- operario vuelve con las estibas usadas. Los reportes de novedad llegan
-- DESPUES de cerrar y no cuentan tiempo.
--
-- Aditivo e idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoProductoRecepcion') THEN
    CREATE TYPE "TipoProductoRecepcion" AS ENUM ('GOURMET', 'MUEBLES');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoRecepcion') THEN
    CREATE TYPE "EstadoRecepcion" AS ENUM ('EN_CURSO', 'CERRADO');
  END IF;
  -- Faltante y sobrante separados: en la planilla de papel son dos casillas
  -- distintas y contarlos juntos esconde cual problema tiene el proveedor.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoNovedadRecepcion') THEN
    CREATE TYPE "TipoNovedadRecepcion" AS ENUM ('FALTANTE', 'SOBRANTE', 'AVERIA', 'MALTRATADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS recepciones_contenedor (
  id                    TEXT PRIMARY KEY,
  estado                "EstadoRecepcion" NOT NULL DEFAULT 'EN_CURSO',
  numero_pedido         VARCHAR(50) NOT NULL,
  proveedor             VARCHAR(160) NOT NULL,
  tipo_producto         "TipoProductoRecepcion" NOT NULL,
  peso_kg               DECIMAL(10, 2) NOT NULL,
  referencias_esperadas INTEGER NOT NULL,
  cajas                 INTEGER NOT NULL,
  unidades              INTEGER NOT NULL,
  estibas_usadas        INTEGER,
  referencias_nuevas    INTEGER,
  unidades_nuevas       INTEGER,
  fecha                 DATE NOT NULL,
  hora_inicio           TIMESTAMP(3) NOT NULL,
  hora_finalizacion     TIMESTAMP(3),
  motivo_correccion     TEXT,
  deleted_at            TIMESTAMP(3),
  creado_por_id         TEXT NOT NULL REFERENCES users(id),
  actualizado_por_id    TEXT REFERENCES users(id),
  created_at            TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at            TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recepciones_contenedor_estado_deleted_at_idx
  ON recepciones_contenedor (estado, deleted_at);
CREATE INDEX IF NOT EXISTS recepciones_contenedor_fecha_idx
  ON recepciones_contenedor (fecha);
CREATE INDEX IF NOT EXISTS recepciones_contenedor_numero_pedido_idx
  ON recepciones_contenedor (numero_pedido);
CREATE INDEX IF NOT EXISTS recepciones_contenedor_creado_por_id_idx
  ON recepciones_contenedor (creado_por_id);

-- Quien estuvo descargando. Tabla propia y no texto libre: son usuarios reales,
-- y asi el indicador puede repartir el trabajo por persona.
CREATE TABLE IF NOT EXISTS descargadores_recepcion (
  id           TEXT PRIMARY KEY,
  recepcion_id TEXT NOT NULL REFERENCES recepciones_contenedor(id) ON DELETE CASCADE,
  usuario_id   TEXT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS descargadores_recepcion_recepcion_usuario_key
  ON descargadores_recepcion (recepcion_id, usuario_id);
CREATE INDEX IF NOT EXISTS descargadores_recepcion_usuario_id_idx
  ON descargadores_recepcion (usuario_id);

-- Una fila = una linea de novedad. Un contenedor puede traer varios faltantes,
-- y la foto es por linea porque se fotografia la caja averiada, no el contenedor.
CREATE TABLE IF NOT EXISTS novedades_recepcion (
  id            TEXT PRIMARY KEY,
  recepcion_id  TEXT NOT NULL REFERENCES recepciones_contenedor(id) ON DELETE CASCADE,
  tipo          "TipoNovedadRecepcion" NOT NULL,
  plu           VARCHAR(100) NOT NULL,
  -- Copiada del maestro al registrarla: si el maestro cambia despues, el
  -- reporte tiene que seguir diciendo lo que se vio ese dia.
  descripcion   VARCHAR(255) NOT NULL,
  cantidad      INTEGER NOT NULL,
  foto_url      TEXT,
  observacion   TEXT,
  creado_por_id TEXT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS novedades_recepcion_recepcion_tipo_idx
  ON novedades_recepcion (recepcion_id, tipo);
CREATE INDEX IF NOT EXISTS novedades_recepcion_plu_idx
  ON novedades_recepcion (plu);
