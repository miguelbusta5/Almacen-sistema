-- Bloqueo por fuerza bruta en el login. Aditivo e idempotente.
--
-- Se persiste en la base y no en memoria porque en serverless cada instancia
-- tendria su propio contador: repartiendo los intentos entre instancias el
-- limite seria trivial de esquivar.
ALTER TABLE users ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP(3);
