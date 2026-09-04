-- Módulo Estibas (montacargas). Sustituye la "PLANILLA MONTACARGAS" de Sheets.
--
-- Estrictamente ADITIVO: nuevo valor de enum, dos columnas nulables en
-- productos_maestro y una tabla nueva. No toca ni borra nada existente, por eso
-- se aplica como script en vez de con `prisma db push` (que compara el schema
-- completo contra la base y podría arrastrar drift no intencionado).
-- Idempotente: se puede correr varias veces sin efecto.

-- ── Rol del montacarguista ───────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE no admite IF NOT EXISTS en todas las versiones, de
-- ahí el guard por catálogo.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'MONTACARGAS'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'MONTACARGAS';
  END IF;
END $$;

-- ── Maestro de productos: código de barras y unidades por caja ───────
-- La pistola del montacarguista lee el EAN, no el PLU. "Und Emp" es la columna
-- que la planilla usaba con VLOOKUP para calcular la cantidad total.
ALTER TABLE productos_maestro ADD COLUMN IF NOT EXISTS ean VARCHAR(20);
ALTER TABLE productos_maestro ADD COLUMN IF NOT EXISTS unidades_por_caja INTEGER;

CREATE INDEX IF NOT EXISTS productos_maestro_ean_idx ON productos_maestro(ean);

-- ── Estibas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estibas (
  id TEXT PRIMARY KEY,
  pedido VARCHAR(50) NOT NULL,
  plu VARCHAR(100) NOT NULL,
  ean VARCHAR(20),
  descripcion VARCHAR(255) NOT NULL,
  cajas INTEGER NOT NULL,
  unidades_por_caja INTEGER NOT NULL,
  -- El maestro no trae "Und Emp" para ~71% del catálogo: cuando el operario la
  -- escribe a mano se marca aquí, y esa lista es el trabajo de completar el maestro.
  unidades_manuales BOOLEAN NOT NULL DEFAULT false,
  -- cajas * unidades_por_caja, sellado al crear: es la cifra que agregan los KPI.
  cantidad_total INTEGER NOT NULL,
  -- Null mientras la estiba está en curso: asignarla es lo que la cierra.
  ubicacion VARCHAR(120),
  fecha DATE NOT NULL,
  hora_inicio TIMESTAMP(3) NOT NULL,
  hora_finalizacion TIMESTAMP(3),
  motivo_correccion TEXT,
  deleted_at TIMESTAMP(3),
  creado_por_id TEXT NOT NULL REFERENCES users(id),
  actualizado_por_id TEXT REFERENCES users(id),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sirve la consulta caliente: "la estiba abierta de este operario".
CREATE INDEX IF NOT EXISTS estibas_creado_por_id_hora_finalizacion_deleted_at_idx
  ON estibas(creado_por_id, hora_finalizacion, deleted_at);
CREATE INDEX IF NOT EXISTS estibas_fecha_idx ON estibas(fecha);
CREATE INDEX IF NOT EXISTS estibas_pedido_idx ON estibas(pedido);
CREATE INDEX IF NOT EXISTS estibas_plu_idx ON estibas(plu);
