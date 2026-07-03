import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Cliente Prisma singleton para Nitro. Reutiliza la misma DB (Railway) que la
// app Next.js — mismo schema, mismas tablas. Espejo de src/lib/prisma.ts.
const g = globalThis as unknown as { _prisma?: PrismaClient }

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL
  const isRailway = connectionString?.includes('railway') || connectionString?.includes('rlwy.net')
  const isPgBouncer = !!process.env.DATABASE_POOL_URL

  const pool = new Pool({
    connectionString,
    ssl: isRailway ? { rejectUnauthorized: false } : false,
    max: isPgBouncer ? 1 : 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  })
  pool.on('error', (err) => console.error('[pg pool error]', err.message))

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, log: ['error', 'warn'] })
}

export const prisma = g._prisma ?? create()
if (process.env.NODE_ENV !== 'production') g._prisma = prisma
