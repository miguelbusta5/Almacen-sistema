-- Picking, Inspeccion e Indicadores de Muebles.
--
-- ADITIVO: no hay un solo DROP ni un ALTER sobre tabla existente. Lo unico que
-- toca algo que ya vive son los dos valores nuevos del enum "Role", y eso con
-- ADD VALUE IF NOT EXISTS, que no bloquea la tabla users.
--
-- Se aplica a mano y NO con `prisma db push`, por la razon que documenta
-- docs/cerebro/decisiones.md: `db push` compara el schema entero contra la base
-- y puede arrastrar drift no buscado en una base con 19k productos y datos
-- vivos. Mismo criterio que los otros 17 migrate-*.sql del proyecto.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrate-muebles.sql
--
-- Idempotente: correrlo dos veces no hace nada la segunda.
--
-- El cuerpo sale de `prisma migrate diff` entre el schema de master y el nuevo,
-- con guardas IF NOT EXISTS anadidas a mano. Generarlo asi y no escribirlo a
-- pulso es lo que garantiza que la base quede EXACTAMENTE como la espera Prisma:
-- la primera version escrita a mano dejaba 60 diferencias (claves foraneas sin
-- ON DELETE, un DEFAULT de mas en updated_at y nombres de indice propios) que
-- habrian quedado como drift permanente.
--
-- Vuelta atras: NO borrar estas tablas. Para desactivar el modulo basta con
-- quitar NUXT_PILOT_MUEBLES_URL de Vercel; las tablas quedan vacias y nadie mas
-- las consulta. Borrarlas seria el unico paso peligroso de todo el lanzamiento.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TipoEquipoMuebles" AS ENUM ('ORDER_PICKER', 'GENIE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EstadoOrdenMuebles" AS ENUM ('EN_PICKING', 'EN_INSPECCION', 'INSPECCIONADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EstadoLineaMuebles" AS ENUM ('EN_PICKING', 'PICKEADA', 'EN_INSPECCION', 'EN_EBANISTERIA', 'LISTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EstadoPendienteMuebles" AS ENUM ('PENDIENTE', 'ASIGNADO', 'RESUELTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TipoMercanciaMueble" AS ENUM ('SOFA', 'SILLA', 'MESA', 'LUMINARIA', 'RECLINABLE', 'POLTRONA', 'OTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OrigenTipoMueble" AS ENUM ('DERIVADO', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterEnum — Railway va en PostgreSQL 15+, donde varios ADD VALUE
-- en una misma tanda no dan problema. Van fuera de cualquier bloque DO:
-- ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de una transaccion.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PICKING_MUEBLES';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INSPECCION_MUEBLES';

-- CreateTable
CREATE TABLE IF NOT EXISTS "equipos_muebles" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "tipo" "TipoEquipoMuebles" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asignaciones_equipo_muebles" (
    "id" TEXT NOT NULL,
    "equipo_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "asignado_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignaciones_equipo_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ordenes_muebles" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "tipo_orden" VARCHAR(10) NOT NULL,
    "estado" "EstadoOrdenMuebles" NOT NULL DEFAULT 'EN_PICKING',
    "fecha" DATE NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_paso_inspeccion" TIMESTAMP(3),
    "hora_fin_inspeccion" TIMESTAMP(3),
    "operario_id" TEXT NOT NULL,
    "equipo_id" TEXT,
    "inspector_id" TEXT,
    "actualizado_por_id" TEXT,
    "motivo_correccion" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "lineas_muebles" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "partes" INTEGER,
    "peso_unitario_kg" DECIMAL(10,3),
    "volumen_unitario_m3" DECIMAL(10,6),
    "unidades" INTEGER NOT NULL DEFAULT 0,
    "ubicacion" VARCHAR(120),
    "numero_caja" VARCHAR(60),
    "volumen_total_m3" DECIMAL(12,6),
    "peso_total_kg" DECIMAL(12,3),
    "operario_id" TEXT NOT NULL,
    "estado" "EstadoLineaMuebles" NOT NULL DEFAULT 'EN_PICKING',
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_fin" TIMESTAMP(3),
    "inspector_id" TEXT,
    "insp_hora_inicio" TIMESTAMP(3),
    "insp_hora_fin" TIMESTAMP(3),
    "ebanisteria_inicio" TIMESTAMP(3),
    "ebanisteria_fin" TIMESTAMP(3),
    "motivo_ebanisteria" TEXT,
    "enviado_ebanisteria_por_id" TEXT,
    "recibido_ebanisteria_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lineas_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inspectores_muebles" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspectores_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Inspectores que entraron a una orden: una TSDM la revisan varios a la vez.
CREATE TABLE IF NOT EXISTS "inspectores_orden_muebles" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "inspector_id" TEXT NOT NULL,
    "se_unio_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspectores_orden_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pendientes_muebles" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT,
    "plu" VARCHAR(100) NOT NULL,
    "unidades" INTEGER NOT NULL,
    "observacion" TEXT,
    "estado" "EstadoPendienteMuebles" NOT NULL DEFAULT 'PENDIENTE',
    "creado_por_inspector_id" TEXT,
    "asignado_a_id" TEXT,
    "asignado_por_id" TEXT,
    "resuelto_por_id" TEXT,
    "solicitado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hora_inicio" TIMESTAMP(3),
    "hora_fin" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pendientes_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tipos_mueble_plu" (
    "id" TEXT NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "tipo" "TipoMercanciaMueble" NOT NULL,
    "origen" "OrigenTipoMueble" NOT NULL DEFAULT 'DERIVADO',
    "actualizado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_mueble_plu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "participantes_orden_muebles" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "equipo_id" TEXT,
    "es_creador" BOOLEAN NOT NULL DEFAULT false,
    "se_unio_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participantes_orden_muebles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "equipos_muebles_codigo_key" ON "equipos_muebles"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "equipos_muebles_activo_idx" ON "equipos_muebles"("activo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asignaciones_equipo_muebles_fecha_idx" ON "asignaciones_equipo_muebles"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "asignaciones_equipo_muebles_usuario_id_fecha_key" ON "asignaciones_equipo_muebles"("usuario_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ordenes_muebles_codigo_key" ON "ordenes_muebles"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ordenes_muebles_estado_fecha_idx" ON "ordenes_muebles"("estado", "fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ordenes_muebles_operario_id_estado_deleted_at_idx" ON "ordenes_muebles"("operario_id", "estado", "deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ordenes_muebles_inspector_id_estado_idx" ON "ordenes_muebles"("inspector_id", "estado");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lineas_muebles_orden_id_estado_idx" ON "lineas_muebles"("orden_id", "estado");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lineas_muebles_estado_idx" ON "lineas_muebles"("estado");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lineas_muebles_plu_idx" ON "lineas_muebles"("plu");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "lineas_muebles_orden_id_plu_key" ON "lineas_muebles"("orden_id", "plu");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inspectores_muebles_activo_idx" ON "inspectores_muebles"("activo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inspectores_orden_muebles_orden_id_inspector_id_key" ON "inspectores_orden_muebles"("orden_id", "inspector_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inspectores_orden_muebles_inspector_id_idx" ON "inspectores_orden_muebles"("inspector_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pendientes_muebles_estado_solicitado_at_idx" ON "pendientes_muebles"("estado", "solicitado_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pendientes_muebles_asignado_a_id_estado_idx" ON "pendientes_muebles"("asignado_a_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_mueble_plu_plu_key" ON "tipos_mueble_plu"("plu");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tipos_mueble_plu_tipo_idx" ON "tipos_mueble_plu"("tipo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tipos_mueble_plu_origen_idx" ON "tipos_mueble_plu"("origen");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "participantes_orden_muebles_usuario_id_idx" ON "participantes_orden_muebles"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "participantes_orden_muebles_orden_id_usuario_id_key" ON "participantes_orden_muebles"("orden_id", "usuario_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "asignaciones_equipo_muebles" ADD CONSTRAINT "asignaciones_equipo_muebles_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos_muebles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "asignaciones_equipo_muebles" ADD CONSTRAINT "asignaciones_equipo_muebles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "asignaciones_equipo_muebles" ADD CONSTRAINT "asignaciones_equipo_muebles_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ordenes_muebles" ADD CONSTRAINT "ordenes_muebles_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ordenes_muebles" ADD CONSTRAINT "ordenes_muebles_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ordenes_muebles" ADD CONSTRAINT "ordenes_muebles_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "inspectores_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ordenes_muebles" ADD CONSTRAINT "ordenes_muebles_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lineas_muebles" ADD CONSTRAINT "lineas_muebles_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_muebles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lineas_muebles" ADD CONSTRAINT "lineas_muebles_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lineas_muebles" ADD CONSTRAINT "lineas_muebles_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "inspectores_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lineas_muebles" ADD CONSTRAINT "lineas_muebles_enviado_ebanisteria_por_id_fkey" FOREIGN KEY ("enviado_ebanisteria_por_id") REFERENCES "inspectores_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lineas_muebles" ADD CONSTRAINT "lineas_muebles_recibido_ebanisteria_por_id_fkey" FOREIGN KEY ("recibido_ebanisteria_por_id") REFERENCES "inspectores_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pendientes_muebles" ADD CONSTRAINT "pendientes_muebles_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pendientes_muebles" ADD CONSTRAINT "pendientes_muebles_creado_por_inspector_id_fkey" FOREIGN KEY ("creado_por_inspector_id") REFERENCES "inspectores_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pendientes_muebles" ADD CONSTRAINT "pendientes_muebles_asignado_a_id_fkey" FOREIGN KEY ("asignado_a_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pendientes_muebles" ADD CONSTRAINT "pendientes_muebles_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pendientes_muebles" ADD CONSTRAINT "pendientes_muebles_resuelto_por_id_fkey" FOREIGN KEY ("resuelto_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tipos_mueble_plu" ADD CONSTRAINT "tipos_mueble_plu_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "participantes_orden_muebles" ADD CONSTRAINT "participantes_orden_muebles_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_muebles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "participantes_orden_muebles" ADD CONSTRAINT "participantes_orden_muebles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "participantes_orden_muebles" ADD CONSTRAINT "participantes_orden_muebles_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos_muebles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
