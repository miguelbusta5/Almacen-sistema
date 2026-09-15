-- Capacidad picking (docs/cerebro/capacidad-picking.md).
--
-- Informes de capacidad real por PLU/ubicacion, capacidades vigentes, cargas del
-- inventario teorico y permiso individual de acceso. Mismo DDL que genera Prisma
-- para estos modelos, en forma aditiva e idempotente (en lugar de db push, que
-- podria proponer cambios sobre tablas existentes).

CREATE TABLE IF NOT EXISTS "picking_accesos" (
    "userId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "picking_accesos_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "picking_informes" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "pausaInicio" TIMESTAMP(3),
    "pausaMotivo" TEXT,
    "pausaSegundos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pausas" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "picking_informes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "picking_informes_autorId_estado_idx" ON "picking_informes"("autorId", "estado");

CREATE TABLE IF NOT EXISTS "picking_lineas" (
    "id" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "plu" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "cajas" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    CONSTRAINT "picking_lineas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "picking_lineas_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "picking_informes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "picking_lineas_informeId_plu_key" ON "picking_lineas"("informeId", "plu");
CREATE UNIQUE INDEX IF NOT EXISTS "picking_lineas_informeId_ubicacion_key" ON "picking_lineas"("informeId", "ubicacion");

CREATE TABLE IF NOT EXISTS "picking_capacidades" (
    "plu" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "cajas" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "picking_capacidades_pkey" PRIMARY KEY ("plu")
);
CREATE UNIQUE INDEX IF NOT EXISTS "picking_capacidades_ubicacion_key" ON "picking_capacidades"("ubicacion");

CREATE TABLE IF NOT EXISTS "picking_teoricos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filas" JSONB NOT NULL,
    "validaciones" JSONB NOT NULL DEFAULT '{}',
    "montajeId" TEXT,
    CONSTRAINT "picking_teoricos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "picking_teoricos_montajeId_key" ON "picking_teoricos"("montajeId");

-- Cerradas a la API publica de Supabase: la app escribe con el rol postgres.
ALTER TABLE "picking_accesos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "picking_informes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "picking_lineas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "picking_capacidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "picking_teoricos" ENABLE ROW LEVEL SECURITY;
