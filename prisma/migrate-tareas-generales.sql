-- Tareas generales: lo que Felipe Ossa y Eduardo mandan a hacer y que no cabe en
-- ningun modulo (organizar una zona, apoyar una descarga, un aseo).
--
-- La tarea se describe en texto libre y se le asigna a uno o varios operarios.
-- El reloj de cada persona arranca cuando se la asignan y para cuando el
-- supervisor la da por terminada — a uno solo o a todos.
--
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS tareas_generales (
  id                TEXT PRIMARY KEY,
  descripcion       TEXT NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'EN_CURSO',
  fecha             DATE NOT NULL,
  hora_inicio       TIMESTAMP(3) NOT NULL DEFAULT now(),
  hora_fin          TIMESTAMP(3),
  creado_por_id     TEXT NOT NULL REFERENCES users (id),
  finalizada_por_id TEXT REFERENCES users (id),
  created_at        TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tareas_generales_estado_inicio_idx ON tareas_generales (estado, hora_inicio);
CREATE INDEX IF NOT EXISTS tareas_generales_fecha_idx ON tareas_generales (fecha);

-- Un tramo por persona: cada una tiene su propio inicio y su propio fin, porque
-- el supervisor puede sacar a quien ya termino y dejar a los demas.
CREATE TABLE IF NOT EXISTS asignados_tarea_general (
  id                TEXT PRIMARY KEY,
  tarea_id          TEXT NOT NULL REFERENCES tareas_generales (id) ON DELETE CASCADE,
  usuario_id        TEXT NOT NULL REFERENCES users (id),
  hora_inicio       TIMESTAMP(3) NOT NULL DEFAULT now(),
  hora_fin          TIMESTAMP(3),
  finalizado_por_id TEXT REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS asignados_tarea_general_tarea_usuario_key
  ON asignados_tarea_general (tarea_id, usuario_id);
CREATE INDEX IF NOT EXISTS asignados_tarea_general_usuario_fin_idx
  ON asignados_tarea_general (usuario_id, hora_fin);

-- Cerradas a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE tareas_generales ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignados_tarea_general ENABLE ROW LEVEL SECURITY;
