const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const DB_URL = 'postgresql://postgres:LQdPdtWiRUjeeYsGLPJNhpFeCdEXaWiH@roundhouse.proxy.rlwy.net:24334/railway';
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@almacen.com' } });
  if (existing) { console.log('Admin ya existe:', existing.email); return; }
  const hash = await bcrypt.hash('Admin1234!', 10);
  const user = await prisma.user.create({ data: { email: 'admin@almacen.com', name: 'Administrador', password: hash, role: 'ADMIN' } });
  console.log('Admin creado OK:', user.email, '| role:', user.role);
}
main().then(() => pool.end()).then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });