-- Tareas de resurtido que se pueden pasar a un ayudante.
--
-- Como en todos los procesos del CEDI: quien empezo la tarea (escaneo la
-- ubicacion) se la puede pasar a un ayudante para que la cierre, y el reloj NO se
-- reinicia. Cada persona queda con su tramo, igual que tramos_pendiente.
--
-- Aditivo e idempotente.

ALTER TABLE tareas_resurtido ADD COLUMN IF NOT EXISTS responsable_id TEXT REFERENCES users(id);
ALTER TABLE tareas_resurtido ADD COLUMN IF NOT EXISTS pasado_por_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS tareas_resurtido_responsable_idx ON tareas_resurtido (responsable_id, estado);

CREATE TABLE IF NOT EXISTS tramos_tarea_resurtido (
  id         TEXT PRIMARY KEY,
  tarea_id   TEXT NOT NULL REFERENCES tareas_resurtido(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES users(id),
  orden      INTEGER NOT NULL,
  inicio     TIMESTAMP(3) NOT NULL,
  fin        TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tramos_tarea_resurtido_tarea_orden_idx ON tramos_tarea_resurtido (tarea_id, orden);
CREATE INDEX IF NOT EXISTS tramos_tarea_resurtido_usuario_fin_idx ON tramos_tarea_resurtido (usuario_id, fin);

-- Cerrada a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE tramos_tarea_resurtido ENABLE ROW LEVEL SECURITY;
