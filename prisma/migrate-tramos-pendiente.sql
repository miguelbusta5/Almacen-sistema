-- Pendientes con ubicacion inicial y tiempo por persona.
--
-- El pendiente se trabaja como un movimiento de deposito: se escanea el PLU y la
-- ubicacion inicial, y eso arranca el reloj. Quien lo tiene puede pasarselo a un
-- ayudante para que lo cierre, y el reloj NO se reinicia: cada persona queda con
-- su tramo, igual que tramos_montacargas.
--
-- Aditivo e idempotente.

ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS ubicacion_inicial VARCHAR(120);

CREATE TABLE IF NOT EXISTS tramos_pendiente (
  id           TEXT PRIMARY KEY,
  pendiente_id TEXT NOT NULL REFERENCES pendientes_gourmet(id) ON DELETE CASCADE,
  usuario_id   TEXT NOT NULL REFERENCES users(id),
  orden        INTEGER NOT NULL,
  inicio       TIMESTAMP(3) NOT NULL,
  fin          TIMESTAMP(3),
  created_at   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tramos_pendiente_pendiente_orden_idx ON tramos_pendiente (pendiente_id, orden);
CREATE INDEX IF NOT EXISTS tramos_pendiente_usuario_fin_idx ON tramos_pendiente (usuario_id, fin);

-- Cerrada a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE tramos_pendiente ENABLE ROW LEVEL SECURITY;
