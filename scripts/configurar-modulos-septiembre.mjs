// Ejecutar después de prisma db push. Sin --apply solo verifica las identidades.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
const normalizar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().split(/\s+/);
try {
  const users = await db.user.findMany({ select: { id: true, name: true, active: true, role: true } });
  const buscar = palabras => {
    const matches = users.filter(u => palabras.every(p => normalizar(u.name).includes(p)));
    if (matches.length !== 1 || !matches[0].active) throw new Error(`Identidad ambigua o inactiva: ${palabras.join(' ')}`);
    return matches[0];
  };
  const contadores = [buscar(['JUAN','ALBERTO','JIMENEZ']), buscar(['KEINER','BLANCO'])];
  const gestores = [buscar(['FELIPE','OSSA']), buscar(['EDUARDO','ZURITA'])];
  const viviana = buscar(['VIVIANA']);
  console.log({contadores:contadores.map(u=>u.name),gestoresStretch:gestores.map(u=>u.name),solicitante:viviana.name});
  if (process.argv.includes('--apply')) {
    await db.$transaction(async tx => {
      for (const u of contadores) await tx.inventarioAcceso.upsert({ where:{userId:u.id},create:{userId:u.id,contar:true},update:{contar:true} });
      for (const u of gestores) await tx.stretchAcceso.upsert({ where:{userId:u.id},create:{userId:u.id,gestionar:true,solicitar:true},update:{gestionar:true,solicitar:true} });
      await tx.stretchAcceso.upsert({ where:{userId:viviana.id},create:{userId:viviana.id,solicitar:true},update:{solicitar:true} });
      // Solo el servidor Prisma accede a estas tablas, nunca la API pública de Supabase.
      for (const tabla of ['inventario_accesos','inventario_cronogramas','inventario_maestro_versiones','inventario_productos_pvp','inventario_ciclicos','inventario_tareas','inventario_conteos','inventario_casos','stretch_accesos','stretch_stock','stretch_pedidos','stretch_movimientos','stretch_sesiones']) {
        await tx.$executeRawUnsafe(`ALTER TABLE public."${tabla}" ENABLE ROW LEVEL SECURITY`);
        await tx.$executeRawUnsafe(`REVOKE ALL ON TABLE public."${tabla}" FROM anon, authenticated`);
      }
    });
    console.log('Permisos individuales y protección de tablas aplicados.');
  }
} finally { await db.$disconnect(); }
