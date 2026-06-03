// Script de migración: nuevos estados de Despachos Tienda
// Uso: node prisma/run-migration.mjs
import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno: prioridad .env.local, fallback .env
let envPath = resolve(__dirname, "../.env.local");
let envContent = "";
try { envContent = readFileSync(envPath, "utf8"); } catch { /* no existe */ }
if (!envContent.includes("DATABASE_URL")) {
  try { envContent = readFileSync(resolve(__dirname, "../.env"), "utf8"); } catch { /* noop */ }
}
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log("🔄 Conectado a Railway PostgreSQL\n");

    // ─── PASO 1: Agregar nuevos valores al enum ───────────────
    // ADD VALUE NO puede correr dentro de una transacción
    console.log("PASO 1: Agregando nuevos valores al enum...");
    const newValues = ["CREADO_TIENDA", "RECOGIDA_PENDIENTE", "RECOGIDO", "EN_RUTA", "ENTREGADO"];
    for (const val of newValues) {
      await client.query(`ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS '${val}'`);
      console.log(`  ✓ Valor '${val}' agregado`);
    }

    // ─── PASO 2: Agregar columna enRutaAt ────────────────────
    console.log("\nPASO 2: Agregando columna en_ruta_at...");
    await client.query(`
      ALTER TABLE despachos_tienda
        ADD COLUMN IF NOT EXISTS en_ruta_at TIMESTAMP(3)
    `);
    console.log("  ✓ Columna en_ruta_at agregada");

    // ─── PASO 3: Migrar datos existentes ─────────────────────
    console.log("\nPASO 3: Migrando datos existentes...");
    const r1 = await client.query(`UPDATE despachos_tienda SET estado = 'CREADO_TIENDA'::\"EstadoDespacho\" WHERE estado = 'PENDIENTE'`);
    console.log(`  ✓ PENDIENTE → CREADO_TIENDA: ${r1.rowCount} filas`);
    const r2 = await client.query(`UPDATE despachos_tienda SET estado = 'RECOGIDO'::\"EstadoDespacho\" WHERE estado = 'RECIBIDO'`);
    console.log(`  ✓ RECIBIDO → RECOGIDO: ${r2.rowCount} filas`);
    const r3 = await client.query(`UPDATE despachos_tienda SET estado = 'ENTREGADO'::\"EstadoDespacho\" WHERE estado = 'DESPACHADO'`);
    console.log(`  ✓ DESPACHADO → ENTREGADO: ${r3.rowCount} filas`);
    console.log("  ✓ CON_NOVEDAD sin cambios");

    // ─── PASO 4: Cambiar el default ──────────────────────────
    console.log("\nPASO 4: Cambiando default del estado...");
    await client.query(`ALTER TABLE despachos_tienda ALTER COLUMN estado DROP DEFAULT`);
    await client.query(`ALTER TABLE despachos_tienda ALTER COLUMN estado SET DEFAULT 'CREADO_TIENDA'`);
    console.log("  ✓ Default = CREADO_TIENDA");

    // ─── PASO 5: Recrear el enum sin los valores viejos ──────
    console.log("\nPASO 5: Limpiando enum (eliminando valores obsoletos)...");
    await client.query(`
      CREATE TYPE "EstadoDespacho_v2" AS ENUM (
        'CREADO_TIENDA', 'RECOGIDA_PENDIENTE', 'RECOGIDO',
        'EN_RUTA', 'ENTREGADO', 'CON_NOVEDAD'
      )
    `);
    await client.query(`
      ALTER TABLE despachos_tienda
        ALTER COLUMN estado DROP DEFAULT
    `);
    await client.query(`
      ALTER TABLE despachos_tienda
        ALTER COLUMN estado TYPE "EstadoDespacho_v2"
        USING estado::text::"EstadoDespacho_v2"
    `);
    await client.query(`DROP TYPE "EstadoDespacho"`);
    await client.query(`ALTER TYPE "EstadoDespacho_v2" RENAME TO "EstadoDespacho"`);
    await client.query(`ALTER TABLE despachos_tienda ALTER COLUMN estado SET DEFAULT 'CREADO_TIENDA'`);
    console.log("  ✓ Enum recreado con 6 valores limpios");

    // ─── VERIFICACIÓN FINAL ───────────────────────────────────
    console.log("\nVERIFICACIÓN: distribución de estados actual");
    const res = await client.query(`
      SELECT estado, COUNT(*)::int AS count
      FROM despachos_tienda
      GROUP BY estado
      ORDER BY estado
    `);
    if (res.rows.length === 0) {
      console.log("  (tabla vacía — sin registros aún)");
    } else {
      for (const row of res.rows) console.log(`  ${row.estado}: ${row.count}`);
    }

    console.log("\n✅ Migración completada exitosamente.");
  } catch (err) {
    console.error("\n❌ Error durante la migración:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
