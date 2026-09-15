// Crea el usuario admin inicial a partir de variables de entorno.
// Lee .env y luego .env.local (este último tiene prioridad, igual que en Next.js).
// NO hardcodear credenciales aquí: este archivo está versionado en git.
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';

if (!DB_URL) {
  console.error('✗ Falta DATABASE_URL en el entorno (.env / .env.local)');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('✗ Falta ADMIN_EMAIL o ADMIN_PASSWORD en el entorno (.env.local)');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) { console.log('Admin ya existe:', existing.email); return; }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await prisma.user.create({
    data: { email: ADMIN_EMAIL, name: ADMIN_NAME, password: hash, role: 'ADMIN' },
  });
  console.log('Admin creado OK:', user.email, '| role:', user.role);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => { console.error(e.message); process.exit(1); });
