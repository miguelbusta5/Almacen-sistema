// Eliminación puntual autorizada expresamente. No acepta otros códigos ni IDs.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
try {
  const resultado = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71420914)`;
    const conservar = await tx.ordenMuebles.findUnique({ where: { id: 'cmuba9efk000304i809lywyrp' }, select: { codigo: true } });
    if (conservar?.codigo !== 'OVDM121515') throw new Error('No se verificó la orden que debe conservarse');
    const objetivo = await tx.ordenMuebles.findUnique({ where: { id: 'cmubb9gej000c04l8nyliwdk0' }, select: { id: true, codigo: true, _count: { select: { lineas: true, participantes: true } } } });
    if (!objetivo) return { estado: 'Ya eliminado', conservada: conservar.codigo };
    if (objetivo.codigo !== 'CONTADO-OVDM121515') throw new Error('El código no coincide con la autorización');
    if (await tx.pendienteMuebles.count({ where: { ordenId: objetivo.id } })) throw new Error('Hay pendientes vinculados; revisar antes de eliminar');
    if (process.argv.includes('--apply')) await tx.ordenMuebles.delete({ where: { id: objetivo.id } });
    return { estado: process.argv.includes('--apply') ? 'Eliminado definitivamente' : 'Revisión', codigo: objetivo.codigo, dependencias: objetivo._count, conservada: conservar.codigo };
  });
  console.log(JSON.stringify({ fecha: new Date().toISOString(), ...resultado }));
} finally { await db.$disconnect(); }
