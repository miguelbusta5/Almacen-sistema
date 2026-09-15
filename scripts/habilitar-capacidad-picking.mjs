// Requiere DATABASE_URL. Sin --apply solo verifica las tres identidades.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL para habilitar los permisos individuales');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/);
try {
  const users = await db.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true } });
  const elegidos = ['bryan torres', 'felipe ossa', 'eduardo zurita'].map(nombre => {
    const candidatos = users.filter(u => nombre.split(' ').every(p => norm(u.name ?? '').includes(p)));
    if (candidatos.length !== 1) throw new Error(`Se esperaba una cuenta activa para ${nombre}; encontradas: ${candidatos.length}. Revisa Usuarios.`);
    return candidatos[0];
  });
  console.log(elegidos.map(u => ({ nombre: u.name, rol: u.role })));
  if (process.argv.includes('--apply')) {
    await db.$transaction(elegidos.map(u => db.pickingAcceso.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: { activo: true } })));
    console.log('Permiso Capacidad picking habilitado para las tres cuentas verificadas.');
  }
} finally { await db.$disconnect(); }
