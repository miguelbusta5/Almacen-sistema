-- Inventarios: conteo ciclico de Gourmet (cronogramas, maestro PVP, conteos,
-- reconteos y cierre).
--
-- ADITIVO: solo crea. No hay un DROP ni un ALTER sobre nada que ya exista.
--
-- Las tablas ya estan en produccion: se aplicaron el 18-09 con `prisma db push`
-- y este archivo es el registro que faltaba. Correrlo contra produccion no hace
-- nada (todo lleva IF NOT EXISTS); sirve para levantar la base desde cero o para
-- una copia de QA.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrate-inventarios-ciclicos.sql
--
-- El cuerpo sale de `prisma migrate diff --from-empty --to-schema prisma/schema.prisma`,
-- con las guardas anadidas: generarlo asi y no a pulso es lo que garantiza que la
-- base quede EXACTAMENTE como la espera Prisma (tipos, defaults, ON DELETE y
-- nombres de indice). Mismo criterio que los otros migrate-*.sql.
--
-- Vuelta atras: NO borrar estas tablas. Para apagar el modulo basta con quitarle
-- el acceso a la gente en inventario_accesos.

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_ciclicos" (
    "id" TEXT NOT NULL,
    "cronograma_id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "archivo" VARCHAR(255) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    "filas" JSONB NOT NULL,
    "teorico" JSONB NOT NULL,
    "avisos" JSONB NOT NULL DEFAULT '[]',
    "autor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_at" TIMESTAMP(3),
    "version_cierre_id" TEXT,
    "cierre" JSONB,

    CONSTRAINT "inventario_ciclicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_tareas" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "ubicacion" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'INICIAL',
    "usuario_id" TEXT,
    "caso_id" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "pausa_inicio" TIMESTAMP(3),
    "pausa_motivo" TEXT,
    "pausa_segundos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pausas" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventario_tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_conteos" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "cajas" INTEGER NOT NULL,
    "empaque" INTEGER NOT NULL,
    "reguero" INTEGER NOT NULL,
    "fisico" INTEGER NOT NULL,
    "teorico_actual" INTEGER,
    "estado" VARCHAR(20) NOT NULL,
    "inesperado" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_conteos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_casos" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "ubicacion" VARCHAR(120) NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
    "resultado_id" TEXT,
    "cerrado_por_id" TEXT,
    "cerrado_at" TIMESTAMP(3),
    "observacion" TEXT,

    CONSTRAINT "inventario_casos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_accesos" (
    "user_id" TEXT NOT NULL,
    "contar" BOOLEAN NOT NULL DEFAULT false,
    "gestionar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inventario_accesos_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_cronogramas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
    "autor_id" TEXT NOT NULL,
    "autor_nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_cronogramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_maestro_versiones" (
    "id" TEXT NOT NULL,
    "cronograma_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "archivo" VARCHAR(255) NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "total" INTEGER NOT NULL,
    "resumen" JSONB NOT NULL,
    "autor_id" TEXT NOT NULL,
    "autor_nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_maestro_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventario_productos_pvp" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "proveedor" VARCHAR(500) NOT NULL,
    "upc" VARCHAR(50) NOT NULL,
    "precio" DECIMAL(12,2),
    "marca" VARCHAR(500) NOT NULL,
    "linea" VARCHAR(500) NOT NULL,

    CONSTRAINT "inventario_productos_pvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inventario_ciclicos_cronograma_id_created_at_idx" ON "inventario_ciclicos"("cronograma_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inventario_tareas_ciclo_id_tipo_estado_idx" ON "inventario_tareas"("ciclo_id", "tipo", "estado");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inventario_tareas_usuario_id_estado_idx" ON "inventario_tareas"("usuario_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inventario_conteos_tarea_id_plu_key" ON "inventario_conteos"("tarea_id", "plu");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inventario_casos_ciclo_id_ubicacion_plu_key" ON "inventario_casos"("ciclo_id", "ubicacion", "plu");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inventario_maestro_versiones_cronograma_id_numero_key" ON "inventario_maestro_versiones"("cronograma_id", "numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inventario_productos_pvp_version_id_upc_idx" ON "inventario_productos_pvp"("version_id", "upc");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inventario_productos_pvp_version_id_plu_key" ON "inventario_productos_pvp"("version_id", "plu");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_ciclicos" ADD CONSTRAINT "inventario_ciclicos_cronograma_id_fkey" FOREIGN KEY ("cronograma_id") REFERENCES "inventario_cronogramas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_tareas" ADD CONSTRAINT "inventario_tareas_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "inventario_ciclicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_tareas" ADD CONSTRAINT "inventario_tareas_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "inventario_casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_conteos" ADD CONSTRAINT "inventario_conteos_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "inventario_tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_casos" ADD CONSTRAINT "inventario_casos_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "inventario_ciclicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_maestro_versiones" ADD CONSTRAINT "inventario_maestro_versiones_cronograma_id_fkey" FOREIGN KEY ("cronograma_id") REFERENCES "inventario_cronogramas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inventario_productos_pvp" ADD CONSTRAINT "inventario_productos_pvp_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "inventario_maestro_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
