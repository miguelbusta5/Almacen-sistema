import PrismaClientPkg from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// @prisma/client (v7) expone su entrypoint como `module.exports = { ...require(...) }`
// (spread dinámico), que los bundlers de Nitro/esbuild no pueden analizar de forma
// estática para exports con nombre. El import por defecto (solo valor, en runtime)
// evita que PrismaClient llegue `undefined` en el bundle serverless de Vercel; el
// `import type` aparte se elide en el bundle y solo aporta el tipo.
const PrismaClientCtor = PrismaClientPkg.PrismaClient

// Cliente Prisma singleton para Nitro. Reutiliza la misma DB (Railway) que la
// app Next.js — mismo schema, mismas tablas. Espejo de src/lib/prisma.ts.
const g = globalThis as unknown as { _prisma?: PrismaClient }

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL
  // SSL activo contra cualquier host remoto (Railway, Supabase, etc.); solo
  // se desactiva para una base local. Supabase EXIGE SSL — la regla vieja
  // (SSL solo si la cadena decía "railway") fallaba al migrar.
  const isLocal = !!connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
  const isPgBouncer = !!process.env.DATABASE_POOL_URL

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: isPgBouncer ? 1 : 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  })
  pool.on('error', (err) => console.error('[pg pool error]', err.message))

  const adapter = new PrismaPg(pool)
  return new PrismaClientCtor({ adapter, log: ['error', 'warn'] })
}

export const prisma = g._prisma ?? create()
if (process.env.NODE_ENV !== 'production') g._prisma = prisma
