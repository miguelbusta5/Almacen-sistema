-- Cargue de camiones (25-09-2026): como Recepcion de contenedores, pero de
-- salida. Un camion (tipo de vehiculo, transportadora, placa) con los operarios
-- que lo cargan; se le agregan ordenes OVDM/TSDM (de Cargue Gourmet y/o de
-- Muebles) y cada una lleva su reloj y sus bultos contados.
-- Aditivo e idempotente: no toca tablas existentes salvo agregarles FKs nuevas.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoCargueCamion') THEN
    CREATE TYPE "EstadoCargueCamion" AS ENUM ('EN_CURSO', 'CERRADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigenOrdenCargue') THEN
    CREATE TYPE "OrigenOrdenCargue" AS ENUM ('GOURMET', 'MUEBLES', 'AMBOS', 'MANUAL');
  END IF;
END $$;

-- Catalogo de quienes cargan (no son usuarios: como los inspectores de muebles).
CREATE TABLE IF NOT EXISTS operarios_cargue (
  id          text PRIMARY KEY,
  nombre      varchar(120) NOT NULL,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamp(3) NOT NULL DEFAULT now(),
  updated_at  timestamp(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cargues_camion (
  id                  text PRIMARY KEY,
  estado              "EstadoCargueCamion" NOT NULL DEFAULT 'EN_CURSO',
  tipo_vehiculo       varchar(80) NOT NULL,
  transportadora      varchar(120) NOT NULL,
  placa               varchar(20),
  observacion         varchar(300),
  fecha               date NOT NULL,
  hora_inicio         timestamp(3) NOT NULL,
  hora_finalizacion   timestamp(3),
  creado_por_id       text NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cerrado_por_id      text REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  motivo_correccion   text,
  deleted_at          timestamp(3),
  created_at          timestamp(3) NOT NULL DEFAULT now(),
  updated_at          timestamp(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargues_camion_estado_fecha_idx ON cargues_camion (estado, fecha);

CREATE TABLE IF NOT EXISTS cargue_camion_operarios (
  id           text PRIMARY KEY,
  cargue_id    text NOT NULL REFERENCES cargues_camion(id) ON UPDATE CASCADE ON DELETE CASCADE,
  operario_id  text NOT NULL REFERENCES operarios_cargue(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at   timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cargue_camion_operarios_cargue_id_operario_id_key ON cargue_camion_operarios (cargue_id, operario_id);

CREATE TABLE IF NOT EXISTS cargue_camion_ordenes (
  id                  text PRIMARY KEY,
  cargue_id           text NOT NULL REFERENCES cargues_camion(id) ON UPDATE CASCADE ON DELETE CASCADE,
  codigo              varchar(100) NOT NULL,
  tipo_orden          varchar(10) NOT NULL,
  origen              "OrigenOrdenCargue" NOT NULL,
  gourmet_pedido_id   text REFERENCES gourmet_pedidos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  orden_muebles_id    text REFERENCES ordenes_muebles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  tienda              varchar(255),
  cliente             varchar(160),
  ciudad              varchar(80),
  bultos_gourmet      integer,
  bultos_muebles      integer,
  bultos_declarados   integer,
  bultos_cargados     integer,
  nota_diferencia     varchar(300),
  m3                  decimal(12, 4),
  kg                  decimal(12, 2),
  valor_ovdm          decimal(14, 2),
  hora_inicio         timestamp(3) NOT NULL,
  hora_fin            timestamp(3),
  created_at          timestamp(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargue_camion_ordenes_cargue_id_idx ON cargue_camion_ordenes (cargue_id);
CREATE INDEX IF NOT EXISTS cargue_camion_ordenes_codigo_idx ON cargue_camion_ordenes (codigo);

-- Los 10 que cargan hoy (solo si el catalogo esta vacio).
INSERT INTO operarios_cargue (id, nombre)
SELECT 'opc_' || md5(n), n FROM (VALUES
  ('JONATAN ORTEGA'), ('HECTOR CAÑAS'), ('JUAN CAMILO ARBOLEDA'), ('MARLON CABRERA'),
  ('JAFETH MATEO CARRILLO'), ('JONHATAN CIFUENTES'), ('ROBIN ALEJANDRO RETALLACK'),
  ('CRISMAN STIVEN HERNANDEZ'), ('DIEGO ALEJANDRO ZAPATA'), ('FREDY DAVID TRIGOS')
) AS v(n)
WHERE NOT EXISTS (SELECT 1 FROM operarios_cargue);
