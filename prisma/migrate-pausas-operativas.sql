-- Pausas de alimentacion y cambio de baterias (docs/cerebro/pausas-operativas.md).
--
-- Una pausa personal detiene los registros propios en curso de los cuatro flujos
-- con reloj; al continuar se abre un tramo nuevo. Cada registro guarda que pausa
-- lo tiene detenido y cuanto tiempo lleva pausado en total.
--
-- Aditivo e idempotente.

ALTER TABLE movimientos_montacargas ADD COLUMN IF NOT EXISTS pausa_id TEXT;
ALTER TABLE movimientos_montacargas ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP(3);
ALTER TABLE movimientos_montacargas ADD COLUMN IF NOT EXISTS pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE recepciones_contenedor ADD COLUMN IF NOT EXISTS pausa_id TEXT;
ALTER TABLE recepciones_contenedor ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP(3);
ALTER TABLE recepciones_contenedor ADD COLUMN IF NOT EXISTS pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE tareas_resurtido ADD COLUMN IF NOT EXISTS pausa_id TEXT;
ALTER TABLE tareas_resurtido ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP(3);
ALTER TABLE tareas_resurtido ADD COLUMN IF NOT EXISTS pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS pausa_id TEXT;
ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP(3);
ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS pausa_segundos DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pausas_operativas (
  id                TEXT PRIMARY KEY,
  usuario_id        TEXT NOT NULL,
  -- Unico solo mientras la pausa esta abierta (null al cerrar): una pausa a la vez.
  activa_usuario_id TEXT UNIQUE,
  motivo            VARCHAR(30) NOT NULL,
  inicio            TIMESTAMP(3) NOT NULL DEFAULT now(),
  fin               TIMESTAMP(3),
  movimientos       TEXT[] NOT NULL DEFAULT '{}',
  tareas            TEXT[] NOT NULL DEFAULT '{}',
  pendientes        TEXT[] NOT NULL DEFAULT '{}',
  recepciones       TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS pausas_operativas_usuario_id_inicio_idx ON pausas_operativas (usuario_id, inicio);

-- Cerrada a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE pausas_operativas ENABLE ROW LEVEL SECURITY;
