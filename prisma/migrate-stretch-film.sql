-- Stretch film: inventario de rollos, pedidos internos y de tiendas, y la
-- sesion compartida con la que se pide sin cuenta de usuario.
--
-- ADITIVO: solo crea. No hay un DROP ni un ALTER sobre nada que ya exista.
--
-- Las tablas ya estan en produccion: se aplicaron el 18-09 con `prisma db push`
-- y este archivo es el registro que faltaba. Correrlo contra produccion no hace
-- nada (todo lleva IF NOT EXISTS); sirve para levantar la base desde cero o para
-- una copia de QA.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrate-stretch-film.sql
--
-- El cuerpo sale de `prisma migrate diff --from-empty --to-schema prisma/schema.prisma`,
-- con las guardas anadidas: generarlo asi y no a pulso es lo que garantiza que la
-- base quede EXACTAMENTE como la espera Prisma (tipos, defaults, ON DELETE y
-- nombres de indice). Mismo criterio que los otros migrate-*.sql.
--
-- Vuelta atras: NO borrar estas tablas. Para apagar el modulo basta con quitarle
-- el acceso a la gente en stretch_accesos.

-- CreateTable
CREATE TABLE IF NOT EXISTS "stretch_accesos" (
    "user_id" TEXT NOT NULL,
    "gestionar" BOOLEAN NOT NULL DEFAULT false,
    "solicitar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stretch_accesos_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stretch_stock" (
    "id" TEXT NOT NULL DEFAULT 'principal',
    "rollos" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stretch_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stretch_pedidos" (
    "id" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "rollos" INTEGER NOT NULL,
    "usuario_id" TEXT,
    "sesion_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_at" TIMESTAMP(3),
    "procesado_por_id" TEXT,
    "nota" TEXT,

    CONSTRAINT "stretch_pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stretch_movimientos" (
    "id" TEXT NOT NULL,
    "solicitud_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "saldo" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stretch_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stretch_sesiones" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creada_por_id" TEXT NOT NULL,
    "activada" BOOLEAN NOT NULL DEFAULT false,
    "expira_at" TIMESTAMP(3) NOT NULL,
    "revocada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stretch_sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stretch_pedidos_estado_created_at_idx" ON "stretch_pedidos"("estado", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stretch_pedidos_sesion_id_created_at_idx" ON "stretch_pedidos"("sesion_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stretch_movimientos_solicitud_id_key" ON "stretch_movimientos"("solicitud_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stretch_movimientos_pedido_id_key" ON "stretch_movimientos"("pedido_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stretch_movimientos_created_at_idx" ON "stretch_movimientos"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stretch_sesiones_token_hash_key" ON "stretch_sesiones"("token_hash");
