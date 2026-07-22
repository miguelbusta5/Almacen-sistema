import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // DATABASE_POOL_URL: usar cuando Railway PgBouncer esté activo (puerto 6543).
  // DATABASE_URL: conexión directa (puerto 24334). Se usa si no hay POOL_URL.
  const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;

  // SSL activo contra cualquier host remoto (Railway, Supabase, etc.); solo
  // se desactiva para una base local de desarrollo. Supabase EXIGE SSL, así
  // que la regla vieja (SSL solo si la cadena contenía "railway") fallaba
  // al migrar a otro proveedor.
  const isLocal = !!connectionString && (connectionString.includes("localhost") || connectionString.includes("127.0.0.1"));
  const isPgBouncer = !!process.env.DATABASE_POOL_URL;

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },

    // En Vercel serverless cada instancia puede abrir conexiones simultáneas.
    // Con max=3 podemos correr ~8 instancias paralelas antes de tocar el límite
    // de Railway (25 conexiones en plan Hobby).
    max: isPgBouncer ? 1 : 3,

    // Libera conexiones ociosas para no desperdiciar slots en Railway.
    idleTimeoutMillis: 30_000,

    // Railway puede tardar hasta 10 s en cold start; 15 s da margen sin colgar la función.
    connectionTimeoutMillis: 15_000,

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
