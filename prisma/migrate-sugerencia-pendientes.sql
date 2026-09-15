-- Sugerencia de ubicacion para pendientes de gourmet (2026-09-15).
--
-- Al asignar un pendiente que no cruza con el resurtido se calcula, con el
-- teorico vigente (ultimas 12 horas), de que altura(s) sacarlo y a que picking
-- llevarlo. Se guarda la foto de esa sugerencia en el pendiente: la ve el
-- operario, la ve el modulo Pendientes y con ella se registra si el operario
-- uso otra ubicacion. Reasignar la recalcula.
--
-- Aditivo e idempotente.

ALTER TABLE pendientes_gourmet ADD COLUMN IF NOT EXISTS sugerencia JSONB;
