-- Cuadro de turnos del almacenamiento.
--
-- Sin turno, los indicadores solo saben cuanto tiempo hubo un PLU en la mano;
-- con el se puede decir cuanto de la jornada fue eso, que es la efectividad.
--
-- El cuadro se sube en Excel y vale para un rango de fechas. Cada fila es el
-- turno de una persona un dia de la semana; un descanso no deja fila. Si el fin
-- es menor o igual que el inicio, el turno cruza la medianoche (20:30 a 6:00).
--
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS cuadros_turno (
  id             TEXT PRIMARY KEY,
  nombre_archivo VARCHAR(255) NOT NULL,
  desde          DATE NOT NULL,
  hasta          DATE NOT NULL,
  subido_por_id  TEXT NOT NULL REFERENCES users(id),
  deleted_at     TIMESTAMP(3),
  created_at     TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cuadros_turno_desde_hasta_idx ON cuadros_turno (desde, hasta);

CREATE TABLE IF NOT EXISTS turnos_operario (
  id         TEXT PRIMARY KEY,
  cuadro_id  TEXT NOT NULL REFERENCES cuadros_turno(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES users(id),
  dia_semana INTEGER NOT NULL,
  inicio_min INTEGER NOT NULL,
  fin_min    INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS turnos_operario_cuadro_usuario_dia_key
  ON turnos_operario (cuadro_id, usuario_id, dia_semana);
CREATE INDEX IF NOT EXISTS turnos_operario_usuario_dia_idx ON turnos_operario (usuario_id, dia_semana);

-- Cerradas a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE cuadros_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos_operario ENABLE ROW LEVEL SECURITY;
