// Script de migración Sprint 8 — Flujo logístico completo
// Uso: node prisma/run-migration-sprint8.mjs
import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Cargar DATABASE_URL desde .env o .env.local
let dbUrl = null;
for (const file of [".env.local", ".env"]) {
  try {
    const content = readFileSync(resolve(__dirname, "../" + file), "utf8");
    for (const line of content.split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        dbUrl = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
    if (dbUrl) break;
  } catch { /* no existe */ }
}
if (!dbUrl) { console.error("❌ DATABASE_URL no encontrada"); process.exit(1); }

const { Pool } = require("pg");
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log("🔄 Conectado a Railway PostgreSQL\n");

    // ── PASO 0: Verificación de dependencias ───────────
    console.log("PASO 0: Verificando dependencias del enum EstadoDespacho...");
    const deps = await client.query(`
      SELECT c.relname AS objeto, n.nspname AS esquema,
             CASE c.relkind WHEN 'r' THEN 'TABLA' WHEN 'v' THEN 'VISTA' ELSE c.relkind::text END AS tipo
      FROM pg_depend d
      JOIN pg_class c ON c.oid = d.objid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE d.refobjid = (SELECT oid FROM pg_type WHERE typname = 'EstadoDespacho')
        AND c.relname != 'despachos_tienda'
        AND d.deptype NOT IN ('i', 'p')
    `);
    if (deps.rows.length > 0) {
      console.error("❌ Dependencias inesperadas detectadas:");
      deps.rows.forEach(r => console.error(`   ${r.tipo}: ${r.esquema}.${r.objeto}`));
      console.error("   Resolver estas dependencias antes de continuar.");
      process.exit(1);
    }
    console.log("  ✓ Sin dependencias bloqueantes\n");

    // ── PASO 1: ADD VALUE ──────────────────────────────
    console.log("PASO 1: Agregando nuevos valores al enum...");
    for (const val of ["ASIGNADO_RECOGIDA", "RECOGIDO_TIENDA", "ENTREGADO_CEDI", "ENTREGADO_CLIENTE"]) {
      await client.query(`ALTER TYPE "EstadoDespacho" ADD VALUE IF NOT EXISTS '${val}'`);
      console.log(`  ✓ '${val}' agregado`);
    }

    // ── PASO 2: Migración de datos ─────────────────────
    console.log("\nPASO 2: Migrando datos existentes...");
    const r1 = await client.query(`UPDATE despachos_tienda SET estado = 'ASIGNADO_RECOGIDA' WHERE estado = 'RECOGIDA_PENDIENTE'`);
    const r2 = await client.query(`UPDATE despachos_tienda SET estado = 'RECOGIDO_TIENDA'   WHERE estado = 'RECOGIDO'`);
    const r3 = await client.query(`UPDATE despachos_tienda SET estado = 'ENTREGADO_CLIENTE' WHERE estado = 'ENTREGADO'`);
    console.log(`  ✓ RECOGIDA_PENDIENTE → ASIGNADO_RECOGIDA: ${r1.rowCount} filas`);
    console.log(`  ✓ RECOGIDO → RECOGIDO_TIENDA: ${r2.rowCount} filas`);
    console.log(`  ✓ ENTREGADO → ENTREGADO_CLIENTE: ${r3.rowCount} filas`);

    // ── PASO 3: Columnas despachos_tienda ──────────────
    console.log("\nPASO 3: Agregando columnas a despachos_tienda...");
    await client.query(`
      ALTER TABLE despachos_tienda
        ADD COLUMN IF NOT EXISTS asignado_recogida_at    TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS asignado_por_id         TEXT,
        ADD COLUMN IF NOT EXISTS entregado_cedi_at       TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS novedad_at              TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS conductor_asignado_id   TEXT,
        ADD COLUMN IF NOT EXISTS vehiculo_asignado_id    TEXT,
        ADD COLUMN IF NOT EXISTS ruta_id                 TEXT,
        ADD COLUMN IF NOT EXISTS direccion_entrega        TEXT,
        ADD COLUMN IF NOT EXISTS barrio                  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS ciudad                  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS departamento            VARCHAR(100),
        ADD COLUMN IF NOT EXISTS latitud                 FLOAT8,
        ADD COLUMN IF NOT EXISTS longitud                FLOAT8,
        ADD COLUMN IF NOT EXISTS contacto_entrega        VARCHAR(255),
        ADD COLUMN IF NOT EXISTS telefono_entrega        VARCHAR(30),
        ADD COLUMN IF NOT EXISTS foto_recogida_url       TEXT,
        ADD COLUMN IF NOT EXISTS foto_cedi_url           TEXT,
        ADD COLUMN IF NOT EXISTS recibido_por_cedi       VARCHAR(255),
        ADD COLUMN IF NOT EXISTS firma_url               TEXT,
        ADD COLUMN IF NOT EXISTS evidencia_url           TEXT,
        ADD COLUMN IF NOT EXISTS observacion_entrega     TEXT,
        ADD COLUMN IF NOT EXISTS fecha_entrega_real      TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS fecha_gps_entrega       TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS latitud_entrega         FLOAT8,
        ADD COLUMN IF NOT EXISTS longitud_entrega        FLOAT8
    `);
    console.log("  ✓ 25 columnas nuevas en despachos_tienda");

    // ── PASO 4: Columnas rutas ─────────────────────────
    console.log("\nPASO 4: Agregando columnas a rutas...");
    await client.query(`
      ALTER TABLE rutas
        ADD COLUMN IF NOT EXISTS kilometraje_salida  INTEGER,
        ADD COLUMN IF NOT EXISTS kilometraje_llegada INTEGER,
        ADD COLUMN IF NOT EXISTS inspeccion_id       TEXT
    `);
    console.log("  ✓ 3 columnas nuevas en rutas");

    // ── PASO 5: Recrear enum limpio ────────────────────
    console.log("\nPASO 5: Recreando enum EstadoDespacho (7 valores limpios)...");
    await client.query(`
      CREATE TYPE "EstadoDespacho_v3" AS ENUM (
        'CREADO_TIENDA', 'ASIGNADO_RECOGIDA', 'RECOGIDO_TIENDA',
        'ENTREGADO_CEDI', 'EN_RUTA', 'ENTREGADO_CLIENTE', 'CON_NOVEDAD'
      )
    `);
    await client.query(`ALTER TABLE despachos_tienda ALTER COLUMN estado DROP DEFAULT`);
    await client.query(`
      ALTER TABLE despachos_tienda
        ALTER COLUMN estado TYPE "EstadoDespacho_v3"
        USING estado::text::"EstadoDespacho_v3"
    `);
    await client.query(`DROP TYPE "EstadoDespacho"`);
    await client.query(`ALTER TYPE "EstadoDespacho_v3" RENAME TO "EstadoDespacho"`);
    await client.query(`ALTER TABLE despachos_tienda ALTER COLUMN estado SET DEFAULT 'CREADO_TIENDA'`);
    console.log("  ✓ Enum recreado con 7 valores limpios");

    // ── PASO 6: Enums preoperacional ───────────────────
    console.log("\nPASO 6: Creando enums preoperacional...");
    await client.query(`
      DO $$ BEGIN CREATE TYPE "EstadoInspeccion" AS ENUM ('APROBADA', 'APROBADA_CON_OBSERVACIONES', 'BLOQUEADA');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await client.query(`
      DO $$ BEGIN CREATE TYPE "ResultadoInspeccion" AS ENUM ('CONFORME', 'NO_CONFORME', 'NO_APLICA');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    console.log("  ✓ EstadoInspeccion y ResultadoInspeccion creados");

    // ── Verificación final ─────────────────────────────
    console.log("\n📊 Distribución final de estados:");
    const res = await client.query(`SELECT estado, COUNT(*)::int AS n FROM despachos_tienda GROUP BY estado ORDER BY estado`);
    if (res.rows.length === 0) {
      console.log("   (tabla vacía)");
    } else {
      res.rows.forEach(r => console.log(`   ${r.estado}: ${r.n}`));
    }

    console.log("\n✅ Migración Sprint 8 completada exitosamente.");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
