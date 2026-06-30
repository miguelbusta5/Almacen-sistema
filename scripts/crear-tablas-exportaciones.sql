-- Crea las 2 tablas nuevas de exportaciones (México y EE.UU).
-- Pegar y ejecutar en Railway → servicio Postgres → pestaña "Query".
-- Es aditivo: NO toca la tabla existente de Ecuador (etiquetado_exportaciones).

-- ── México ────────────────────────────────────────────────
CREATE TABLE "etiquetado_exportaciones_mexico" (
    "id" TEXT NOT NULL,
    "numero_caja" VARCHAR(100) NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "unidad_empaque" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_finalizacion" TIMESTAMP(3),
    "motivo_correccion" TEXT,
    "hay_reguero" BOOLEAN NOT NULL DEFAULT false,
    "cantidad_reguero" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" TEXT NOT NULL,
    "actualizado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "etiquetado_exportaciones_mexico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "etiquetado_exportaciones_mexico_creado_por_id_deleted_at_idx" ON "etiquetado_exportaciones_mexico"("creado_por_id", "deleted_at");
CREATE INDEX "etiquetado_exportaciones_mexico_fecha_idx" ON "etiquetado_exportaciones_mexico"("fecha");
CREATE INDEX "etiquetado_exportaciones_mexico_plu_idx" ON "etiquetado_exportaciones_mexico"("plu");
CREATE INDEX "etiquetado_exportaciones_mexico_numero_caja_idx" ON "etiquetado_exportaciones_mexico"("numero_caja");
CREATE INDEX "etiquetado_exportaciones_mexico_hora_finalizacion_idx" ON "etiquetado_exportaciones_mexico"("hora_finalizacion");

ALTER TABLE "etiquetado_exportaciones_mexico" ADD CONSTRAINT "etiquetado_exportaciones_mexico_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etiquetado_exportaciones_mexico" ADD CONSTRAINT "etiquetado_exportaciones_mexico_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── EE.UU ─────────────────────────────────────────────────
CREATE TABLE "etiquetado_exportaciones_eeuu" (
    "id" TEXT NOT NULL,
    "numero_caja" VARCHAR(100) NOT NULL,
    "plu" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "unidad_empaque" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_finalizacion" TIMESTAMP(3),
    "motivo_correccion" TEXT,
    "hay_reguero" BOOLEAN NOT NULL DEFAULT false,
    "cantidad_reguero" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" TEXT NOT NULL,
    "actualizado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "etiquetado_exportaciones_eeuu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "etiquetado_exportaciones_eeuu_creado_por_id_deleted_at_idx" ON "etiquetado_exportaciones_eeuu"("creado_por_id", "deleted_at");
CREATE INDEX "etiquetado_exportaciones_eeuu_fecha_idx" ON "etiquetado_exportaciones_eeuu"("fecha");
CREATE INDEX "etiquetado_exportaciones_eeuu_plu_idx" ON "etiquetado_exportaciones_eeuu"("plu");
CREATE INDEX "etiquetado_exportaciones_eeuu_numero_caja_idx" ON "etiquetado_exportaciones_eeuu"("numero_caja");
CREATE INDEX "etiquetado_exportaciones_eeuu_hora_finalizacion_idx" ON "etiquetado_exportaciones_eeuu"("hora_finalizacion");

ALTER TABLE "etiquetado_exportaciones_eeuu" ADD CONSTRAINT "etiquetado_exportaciones_eeuu_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etiquetado_exportaciones_eeuu" ADD CONSTRAINT "etiquetado_exportaciones_eeuu_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
