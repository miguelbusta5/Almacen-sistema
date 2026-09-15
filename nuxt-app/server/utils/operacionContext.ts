import { AsyncLocalStorage } from 'node:async_hooks'
import type { Prisma } from '@prisma/client'

// Solo los handlers operativos entran aquí. Sus helpers comparten la misma
// transacción, incluso los que importan el singleton de Prisma.
export const operacionContext = new AsyncLocalStorage<Prisma.TransactionClient>()
