import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // DATABASE_POOL_URL: usar cuando Railway PgBouncer esté activo (puerto 6543).
  // DATABASE_URL: conexión directa (puerto 24334). Se usa si no hay POOL_URL.
  const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;

  const isRailway = connectionString?.includes("railway") || connectionString?.includes("rlwy.net");
  const isPgBouncer = !!process.env.DATABASE_POOL_URL;

  const pool = new Pool({
    connectionString,
    ssl: isRailway ? { rejectUnauthorized: false } : false,

    // En Vercel serverless cada instancia puede abrir conexiones simultáneas.
    // Con max=3 podemos correr ~8 instancias paralelas antes de tocar el límite
    // de Railway (25 conexiones en plan Hobby).
    max: isPgBouncer ? 1 : 3,

    // Libera conexiones ociosas para no desperdiciar slots en Railway.
    idleTimeoutMillis: 30_000,

    // Falla rápido si la DB no responde (mejor un 500 claro que un timeout de 30s).
    connectionTimeoutMillis: 5_000,

    // Permite que el proceso serverless termine limpiamente sin esperar al pool.
    allowExitOnIdle: true,
  });

  // Captura errores del pool sin crashear el proceso.
  pool.on("error", (err) => {
    console.error("[pg pool error]", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
