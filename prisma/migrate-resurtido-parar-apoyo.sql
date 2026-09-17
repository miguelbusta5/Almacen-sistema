-- Parar un resurtido y patinador que apoya a un montacarguista.
--
-- 1) Supervision puede PARAR un resurtido: las tareas sin empezar quedan
--    detenidas (el operario no las ve ni las puede iniciar); las que estan en
--    curso las termina el operario. Se retoma con "Reasignar lo que falta".
-- 2) En una tarea general, un operario de almacenamiento (patinador) puede ir
--    de apoyo de un montacarguista: su tiempo tambien le cuenta al montacarguista
--    en Indicadores (sin duplicar si ese rato ya estaba trabajando).
--
-- Aditivo e idempotente.

ALTER TABLE montajes_resurtido ADD COLUMN IF NOT EXISTS detenido_at TIMESTAMP(3);
ALTER TABLE montajes_resurtido ADD COLUMN IF NOT EXISTS detenido_por_id TEXT;

ALTER TABLE asignados_tarea_general ADD COLUMN IF NOT EXISTS apoya_a_id TEXT REFERENCES users (id);
CREATE INDEX IF NOT EXISTS asignados_tarea_general_apoya_a_idx ON asignados_tarea_general (apoya_a_id);
