-- Orden sin crear (24-09-2026): OVDM/TSDM que el operario de picking no
-- registro. La crea el inspector y queda a nombre del operario que la pickeo,
-- sin tiempo de picking (no se midio). Aditivo e idempotente.
ALTER TABLE ordenes_muebles ADD COLUMN IF NOT EXISTS sin_crear_picking boolean NOT NULL DEFAULT false;
