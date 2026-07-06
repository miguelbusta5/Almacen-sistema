// Migración FS.3 — fusión de estados de Facturas Contado a 3 pasos
// (Pendiente recogida → En CEDI → Enviado al cliente).
//
// Migra los DespachoTienda que quedaron en RECOGIDO_TIENDA (estado legado,
// ya no se produce en el código) hacia ENTREGADO_CEDI, dejando registro en
// HistorialDespacho y ActivityLog. Idempotente: si no hay registros en
// RECOGIDO_TIENDA, no hace nada.
//
// Uso:
//   1. Copia .env con tu DATABASE_URL real (o exporta la variable).
//   2. Consigue tu userId de ADMIN (SELECT id FROM users WHERE role='ADMIN' LIMIT 1;
//      o usa el UI: Usuarios → tu usuario → copia el id de la URL/API).
//   3. Corre:  ADMIN_USER_ID=<tu-id> node scripts/migrar-recogido-tienda.mjs
//      (usa --dry-run primero para ver qué haría sin escribir nada)
//
//      ADMIN_USER_ID=<tu-id> node scripts/migrar-recogido-tienda.mjs --dry-run

import { PrismaClient } from '@prisma/client'

const DRY_RUN = process.argv.includes('--dry-run')
const ADMIN_USER_ID = process.env.ADMIN_USER_ID

async function main() {
  if (!ADMIN_USER_ID) {
    console.error('Falta ADMIN_USER_ID. Uso: ADMIN_USER_ID=<id> node scripts/migrar-recogido-tienda.mjs [--dry-run]')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    const admin = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID }, select: { id: true, name: true, role: true } })
    if (!admin) {
      console.error(`No existe un usuario con id ${ADMIN_USER_ID}`)
      process.exit(1)
    }
    console.log(`Ejecutando como: ${admin.name} (${admin.role})${DRY_RUN ? ' — DRY RUN' : ''}`)

    const registros = await prisma.despachoTienda.findMany({
      where: { estado: 'RECOGIDO_TIENDA' },
      select: { id: true, numeroDocumento: true, recibidoAt: true, entregadoCediAt: true },
    })

    console.log(`Encontrados ${registros.length} despacho(s) en RECOGIDO_TIENDA.`)
    if (registros.length === 0) {
      console.log('Nada que migrar. ✓')
      return
    }

    registros.forEach((r) => console.log(`  - ${r.numeroDocumento} (${r.id})`))

    if (DRY_RUN) {
      console.log('\nDRY RUN: no se escribió nada. Corre sin --dry-run para aplicar.')
      return
    }

    let migrados = 0
    for (const r of registros) {
      await prisma.$transaction([
        prisma.despachoTienda.update({
          where: { id: r.id },
          data: {
            estado: 'ENTREGADO_CEDI',
            // Conserva el timestamp de recogida si ya existía; si no había
            // entregadoCediAt, usa recibidoAt como aproximación real, o ahora.
            entregadoCediAt: r.entregadoCediAt ?? r.recibidoAt ?? new Date(),
          },
        }),
        prisma.historialDespacho.create({
          data: {
            despachoId: r.id,
            estadoAnterior: 'RECOGIDO_TIENDA',
            estadoNuevo: 'ENTREGADO_CEDI',
            observacion: 'Migración automática: fusión de flujo a 3 estados (En CEDI)',
            usuarioId: admin.id,
          },
        }),
        prisma.activityLog.create({
          data: {
            userId: admin.id,
            action: 'UPDATE',
            module: 'tienda',
            recordId: r.id,
            details: `Migración de estado — RECOGIDO_TIENDA → ENTREGADO_CEDI (${r.numeroDocumento})`,
          },
        }),
      ])
      migrados++
      console.log(`  ✓ ${r.numeroDocumento} migrado`)
    }

    console.log(`\nListo: ${migrados}/${registros.length} despacho(s) migrado(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
