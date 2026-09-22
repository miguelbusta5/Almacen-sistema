// Sin --apply verifica la identidad; el permiso se concede al ID, nunca al nombre.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
try {
  const users = await db.user.findMany({ where: process.argv.includes('--reactivar') ? {} : { active: true }, select: { id: true, name: true, role: true } });
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/);
  const candidatos = users.filter(u => ['carlos', 'moreno'].every(n => normalize(u.name).includes(n)));
  if (candidatos.length !== 1) throw new Error(`Se requiere una cuenta inequívoca de Carlos Moreno; encontradas: ${candidatos.length}`);
  const user = candidatos[0];
  if (!['ADMIN', 'SUPERVISOR_INVENTARIO', 'INVENTARIO', 'GERENTE', 'OPERADOR'].includes(user.role)) throw new Error('El rol de Carlos no permite Inventarios; revisar antes de conceder acceso');
  console.log({ nombre: user.name, rol: user.role });
  if (process.argv.includes('--apply')) {
    await db.$transaction(async tx => {
      if (process.argv.includes('--reactivar')) await tx.user.update({ where: { id: user.id }, data: { active: true } });
      await tx.inventarioAcceso.upsert({ where: { userId: user.id }, create: { userId: user.id, gestionar: true }, update: { gestionar: true } });
      await tx.activityLog.create({ data: { userId: user.id, action: 'UPDATE', module: 'inventarios', recordId: user.id, details: `Habilitación inicial de gestión de cronogramas para Carlos Moreno (script de instalación)${process.argv.includes('--reactivar') ? '; reactivación autorizada por el responsable' : ''}` } });
    });
    console.log('Permiso de Inventarios habilitado.');
  }
} finally { await db.$disconnect(); }
