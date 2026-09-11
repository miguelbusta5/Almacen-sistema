-- Borrado de pendientes con justificante.
--
-- Un pendiente ya ubicado solo lo borra el administrador y escribiendo por que:
-- es historia y cuenta en los indicadores del operario, asi que borrarlo tiene
-- que quedar explicado. Se guarda quien y por que en el propio pendiente (el
-- borrado sigue siendo logico, con deleted_at) ademas de en auditoria.
--
-- Aditivo e idempotente.

ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS motivo_borrado TEXT;
ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS borrado_por_id TEXT REFERENCES users(id);
