#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Creación en lote de usuarios con contraseña temporal
//
// Uso:
//   Dry-run (no escribe nada, solo muestra el resumen):
//     node scripts/import-usuarios.mjs ./data/usuarios.csv
//
//   Aplicar (crea los usuarios reales):
//     node scripts/import-usuarios.mjs ./data/usuarios.csv --apply
//
// CSV esperado: columnas "nombre" y "rol" (requeridas), "email" (opcional —
// si falta, se genera como nombre.apellido@grupoambiente.com).
//
// Reglas:
//   - Cada usuario se crea con una contraseña temporal aleatoria y
//     mustChangePassword: true — debe cambiarla en su primer login.
//   - Si el email ya existe en la base, esa fila se omite (no se sobreescribe).
//   - Al aplicar, se escribe un CSV de salida con nombre/email/contraseña
//     temporal para distribuir las credenciales — ese archivo NO se commitea
//     (queda en scripts/output/, que está en .gitignore).
//   - Sin --apply, el script es de solo lectura: no escribe en la base ni
//     genera contraseñas reales (dry-run muestra solo nombre/email/rol).
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { validateColumns, processRows, generateTemporaryPassword } from "./lib/usuariosCsv.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes("--apply");
  const filePath = args.find((a) => !a.startsWith("--"));
  return { filePath, apply };
}

async function main() {
  const { filePath, apply } = parseArgs(process.argv);

  if (!filePath) {
    console.error("Uso: node scripts/import-usuarios.mjs <ruta-csv> [--apply]");
    process.exitCode = 1;
    return;
  }

  const absolutePath = resolve(process.cwd(), filePath);
  let csvText;
  try {
    csvText = readFileSync(absolutePath, "utf-8");
  } catch (err) {
    console.error(`✗ No se pudo leer el archivo: ${absolutePath}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    console.error("✗ Errores de formato CSV:");
    for (const e of parsed.errors.slice(0, 10)) {
      console.error(`  fila ${e.row}: ${e.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const fields = parsed.meta?.fields ?? [];
  const columnCheck = validateColumns(fields);
  if (!columnCheck.ok) {
    console.error(`✗ Faltan columnas requeridas en el CSV: ${columnCheck.missing.join(", ")}`);
    console.error(`  Columnas esperadas: nombre, rol (email es opcional)`);
    process.exitCode = 1;
    return;
  }

  const result = processRows(parsed.data);

  console.log("── Resumen de importación — Usuarios ──");
  console.log(`Archivo:              ${absolutePath}`);
  console.log(`Filas leídas:         ${result.totalRows}`);
  console.log(`Filas válidas:        ${result.validCount}`);
  console.log(`Filas inválidas:      ${result.invalidCount}`);
  console.log(`Emails duplicados:    ${result.duplicateEmails.length}`);
  console.log(`Usuarios a crear:     ${result.createPlan.length} (tras resolver duplicados)`);

  if (result.invalidCount > 0) {
    console.log("\nFilas inválidas:");
    for (const inv of result.invalid.slice(0, 20)) {
      console.log(`  fila ${inv.rowNumber}: ${inv.error}`);
    }
    if (result.invalid.length > 20) {
      console.log(`  … y ${result.invalid.length - 20} más`);
    }
  }

  if (result.duplicateEmails.length > 0) {
    console.log("\nEmails duplicados dentro del CSV (se usará la última fila válida de cada uno):");
    console.log(`  ${result.duplicateEmails.join(", ")}`);
  }

  if (!apply) {
    console.log("\nVista previa (sin contraseñas — se generan solo con --apply):");
    for (const row of result.createPlan.slice(0, 30)) {
      console.log(`  ${row.nombre} · ${row.email} · ${row.rol}`);
    }
    if (result.createPlan.length > 30) console.log(`  … y ${result.createPlan.length - 30} más`);
    console.log("\nModo dry-run (solo lectura) — no se escribió nada en la base.");
    console.log("Para aplicar realmente, vuelve a ejecutar agregando --apply.");
    return;
  }

  if (result.createPlan.length === 0) {
    console.log("\nNo hay filas válidas para aplicar. No se realizó ningún cambio.");
    return;
  }

  console.log(`\n--apply detectado: creando ${result.createPlan.length} usuario(s)…`);

  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) {
    console.error("\n✗ Falta DATABASE_URL en el entorno. No se aplicó ningún cambio.");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { default: bcrypt } = await import("bcryptjs");

  const pool = new Pool({
    connectionString: DB_URL,
    ssl: DB_URL.includes("railway") ? { rejectUnauthorized: false } : false,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let skipped = 0;
  const failures = [];
  const credentials = [];

  try {
    for (const row of result.createPlan) {
      try {
        const existing = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } });
        if (existing) {
          skipped += 1;
          console.log(`  omitido (ya existe): ${row.email}`);
          continue;
        }
        const temporaryPassword = generateTemporaryPassword();
        const hashed = await bcrypt.hash(temporaryPassword, 12);
        await prisma.user.create({
          data: { email: row.email, name: row.nombre, password: hashed, role: row.rol, mustChangePassword: true },
        });
        created += 1;
        credentials.push({ nombre: row.nombre, email: row.email, rol: row.rol, contrasenaTemporal: temporaryPassword });
      } catch (err) {
        failures.push({ email: row.email, error: err.message });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n── Resultado ──");
  console.log(`Creados:  ${created}`);
  console.log(`Omitidos (ya existían): ${skipped}`);
  console.log(`Fallidos: ${failures.length}`);
  if (failures.length > 0) {
    console.log("\nFallos:");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.email}: ${f.error}`);
    }
  }

  if (credentials.length > 0) {
    const outDir = resolve(process.cwd(), "scripts/output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `usuarios-creados-${Date.now()}.csv`);
    const csv = Papa.unparse(credentials, {
      columns: ["nombre", "email", "rol", "contrasenaTemporal"],
    });
    writeFileSync(outPath, csv, "utf-8");
    console.log(`\nCredenciales guardadas en: ${outPath}`);
    console.log("Distribúyelas de forma segura y borra el archivo después — no se sube al repositorio.");
  }
}

main().catch((err) => {
  console.error("✗ Error inesperado:", err.message);
  process.exitCode = 1;
});
