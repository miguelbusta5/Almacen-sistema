-- Permiso para cerrar novedades de montacargas.
--
-- Por PERSONA y no por rol: hoy lo tienen Eduardo Zurita y Felipe Ossa, que son
-- los dos SUPERVISOR_ALMACENAMIENTO. Atarlo al rol se lo daria en silencio a
-- cualquier supervisor que se cree despues, y este permiso decide quien puede
-- dar por buena una diferencia de inventario.
--
-- Aditivo e idempotente.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS puede_resolver_novedades BOOLEAN NOT NULL DEFAULT false;
