-- Justificacion de tiempos muertos (modulo de Indicadores).
--
-- El tiempo muerto NO se guarda: se calcula de los tramos de trabajo (los ratos
-- de 10 minutos o mas sin ningun PLU en la mano dentro del dia). Lo que se
-- guarda es la explicacion que da un supervisor y el rato de reloj que cubre.
--
-- No se borran al corregir: una justificacion nueva sobre el mismo rato manda
-- sobre la anterior, y la anterior queda como historia. Quitar una es un borrado
-- logico (deleted_at).
--
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS justificaciones_tiempo_muerto (
  id                 TEXT PRIMARY KEY,
  usuario_id         TEXT NOT NULL REFERENCES users(id),
  inicio             TIMESTAMP(3) NOT NULL,
  fin                TIMESTAMP(3) NOT NULL,
  motivo             VARCHAR(40) NOT NULL,
  observacion        TEXT,
  justificado_por_id TEXT NOT NULL REFERENCES users(id),
  deleted_at         TIMESTAMP(3),
  created_at         TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS justificaciones_tiempo_muerto_usuario_inicio_idx
  ON justificaciones_tiempo_muerto (usuario_id, inicio);
CREATE INDEX IF NOT EXISTS justificaciones_tiempo_muerto_justificado_por_idx
  ON justificaciones_tiempo_muerto (justificado_por_id);

-- Cerrada a la API publica de Supabase (anon/authenticated): la app escribe
-- con el rol postgres, que no pasa por RLS. Sin politicas, nadie mas la lee.
ALTER TABLE justificaciones_tiempo_muerto ENABLE ROW LEVEL SECURITY;
