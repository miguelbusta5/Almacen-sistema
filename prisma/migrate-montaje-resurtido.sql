-- Montaje de resurtido, tareas y pendientes de operaciones gourmet.
--
-- El montaje NO se cronometra: quien sube el archivo reparte trabajo, no lo
-- hace. Lo que se mide es cada tarea. En resurtido el reloj arranca al escanear
-- la posicion de origen; en un pendiente, al escanear el PLU (igual que un
-- movimiento de deposito).
--
-- Aditivo e idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoMontajeResurtido') THEN
    CREATE TYPE "EstadoMontajeResurtido" AS ENUM ('EN_CURSO', 'COMPLETADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoTareaResurtido') THEN
    CREATE TYPE "EstadoTareaResurtido" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoPendienteGourmet') THEN
    CREATE TYPE "EstadoPendienteGourmet" AS ENUM ('SOLICITADO', 'ASIGNADO', 'EN_CURSO', 'COMPLETADO');
  END IF;
END $$;

-- Permiso POR PERSONA, igual que el de cerrar novedades: hoy lo tienen Felipe
-- Ossa y Eduardo Zurita, y un supervisor nuevo no debe heredarlo por serlo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS puede_montar_resurtido BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS montajes_resurtido (
  id             TEXT PRIMARY KEY,
  estado         "EstadoMontajeResurtido" NOT NULL DEFAULT 'EN_CURSO',
  nombre_archivo VARCHAR(255) NOT NULL,
  operario_id    TEXT NOT NULL REFERENCES users(id),
  creado_por_id  TEXT NOT NULL REFERENCES users(id),
  fecha          DATE NOT NULL,
  montado_at     TIMESTAMP(3) NOT NULL DEFAULT now(),
  completado_at  TIMESTAMP(3),
  deleted_at     TIMESTAMP(3),
  created_at     TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS montajes_resurtido_operario_estado_idx ON montajes_resurtido (operario_id, estado, deleted_at);
CREATE INDEX IF NOT EXISTS montajes_resurtido_fecha_idx ON montajes_resurtido (fecha);

CREATE TABLE IF NOT EXISTS tareas_resurtido (
  id                   TEXT PRIMARY KEY,
  montaje_id           TEXT NOT NULL REFERENCES montajes_resurtido(id) ON DELETE CASCADE,
  estado               "EstadoTareaResurtido" NOT NULL DEFAULT 'PENDIENTE',
  -- Se ordena por la ubicacion de origen para recorrer el almacen en linea recta.
  orden                INTEGER NOT NULL,
  plu                  VARCHAR(100) NOT NULL,
  descripcion          VARCHAR(255) NOT NULL,
  altura               VARCHAR(120) NOT NULL,
  picking_sugerido     VARCHAR(120) NOT NULL,
  unidades_solicitadas INTEGER NOT NULL,
  -- Lo que realmente cupo en el picking: puede no coincidir con lo solicitado.
  unidades_bajadas     INTEGER,
  picking_final        VARCHAR(120),
  hora_inicio          TIMESTAMP(3),
  hora_fin             TIMESTAMP(3),
  created_at           TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tareas_resurtido_montaje_orden_idx ON tareas_resurtido (montaje_id, orden);
CREATE INDEX IF NOT EXISTS tareas_resurtido_montaje_estado_idx ON tareas_resurtido (montaje_id, estado);
CREATE INDEX IF NOT EXISTS tareas_resurtido_plu_idx ON tareas_resurtido (plu);

CREATE TABLE IF NOT EXISTS pendientes_gourmet (
  id                   TEXT PRIMARY KEY,
  estado               "EstadoPendienteGourmet" NOT NULL DEFAULT 'SOLICITADO',
  plu                  VARCHAR(100) NOT NULL,
  descripcion          VARCHAR(255) NOT NULL,
  unidades_solicitadas INTEGER NOT NULL,
  observacion          TEXT,
  solicitado_por_id    TEXT NOT NULL REFERENCES users(id),
  solicitado_at        TIMESTAMP(3) NOT NULL DEFAULT now(),
  asignado_por_id      TEXT REFERENCES users(id),
  operario_id          TEXT REFERENCES users(id),
  asignado_at          TIMESTAMP(3),
  unidades_bajadas     INTEGER,
  ubicacion_final      VARCHAR(120),
  hora_inicio          TIMESTAMP(3),
  hora_fin             TIMESTAMP(3),
  completado_at        TIMESTAMP(3),
  fecha                DATE NOT NULL,
  deleted_at           TIMESTAMP(3),
  created_at           TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pendientes_gourmet_estado_idx ON pendientes_gourmet (estado, deleted_at);
CREATE INDEX IF NOT EXISTS pendientes_gourmet_operario_idx ON pendientes_gourmet (operario_id, estado);
CREATE INDEX IF NOT EXISTS pendientes_gourmet_solicitado_por_idx ON pendientes_gourmet (solicitado_por_id);
CREATE INDEX IF NOT EXISTS pendientes_gourmet_fecha_idx ON pendientes_gourmet (fecha);

-- Devolucion: el operario ve que el PLU no le corresponde (tipicamente porque es
-- de muebles y no de gourmet) y lo regresa a quien lo pidio. No es un fallo
-- suyo, asi que el reloj se descarta entero.
ALTER TYPE "EstadoPendienteGourmet" ADD VALUE IF NOT EXISTS 'DEVUELTO';
ALTER TABLE pendientes_gourmet
  ADD COLUMN IF NOT EXISTS devuelto_por_id TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS devuelto_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS motivo_devolucion TEXT;

-- Reglas de prioridad y novedades de los pendientes.
--
-- Un pendiente es alguien esperando en la tienda, asi que va antes que el
-- resurtido de rutina. Si su PLU ya esta en el resurtido del operario no es una
-- tarea aparte: se suma a esa tarea, que sube al principio y se pinta en rojo, y
-- el pendiente se da por ubicado cuando la tarea se completa.
--
-- El operario puede reportar novedades. Solo el area de muebles DEVUELVE el
-- pendiente a quien lo pidio; el resto se queda en almacenamiento en rojo.
ALTER TYPE "EstadoPendienteGourmet" ADD VALUE IF NOT EXISTS 'NOVEDAD';

ALTER TABLE tareas_resurtido
  ADD COLUMN IF NOT EXISTS prioridad BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unidades_pendientes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pendientes_gourmet
  ADD COLUMN IF NOT EXISTS tipo_novedad VARCHAR(40),
  ADD COLUMN IF NOT EXISTS novedad_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS novedad_por_id TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS tarea_resurtido_id TEXT REFERENCES tareas_resurtido(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pasado_por_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS pendientes_gourmet_tarea_resurtido_idx ON pendientes_gourmet (tarea_resurtido_id);
CREATE INDEX IF NOT EXISTS tareas_resurtido_prioridad_idx ON tareas_resurtido (montaje_id, prioridad);
