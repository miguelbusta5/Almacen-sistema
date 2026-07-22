#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Importador controlado de Maestro de Tiendas Gourmet (MaestroTiendaGourmet)
//
// Uso:
//   Dry-run (no escribe nada, solo muestra el resumen):
//     node scripts/import-maestro-tiendas-gourmet.mjs ./data/maestro-tiendas-gourmet.csv
//
//   Aplicar (upsert real por codigo):
//     node scripts/import-maestro-tiendas-gourmet.mjs ./data/maestro-tiendas-gourmet.csv --apply
//
// Reglas:
//   - codigo, tienda, ciudad son requeridos. activo es opcional (default true).
//   - codigo se trata siempre como string (nunca number) para no perder ceros
//     a la izquierda.
//   - Si el codigo ya existe en la base, se ACTUALIZA (tienda/ciudad/activo).
//   - Si el codigo no existe, se CREA.
//   - NUNCA se borran tiendas que no estén en el CSV.
//   - Sin --apply, el script es de solo lectura: no escribe en la base.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { validateColumns, processRows } from "./lib/maestroTiendasCsv.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes("--apply");
  const filePath = args.find((a) => !a.startsWith("--"));
  return { filePath, apply };
}

async function main() {
  const { filePath, apply } = parseArgs(process.argv);

  if (!filePath) {
    console.error("Uso: node scripts/import-maestro-tiendas-gourmet.mjs <ruta-csv> [--apply]");
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
    console.error(`  Columnas esperadas: codigo, tienda, ciudad (activo es opcional)`);
    process.exitCode = 1;
    return;
  }

  const result = processRows(parsed.data);

  console.log("── Resumen de importación — Maestro de Tiendas Gourmet ──");
  console.log(`Archivo:              ${absolutePath}`);
  console.log(`Filas leídas:         ${result.totalRows}`);
  console.log(`Filas válidas:        ${result.validCount}`);
  console.log(`Filas inválidas:      ${result.invalidCount}`);
  console.log(`Códigos duplicados:   ${result.duplicateCodigos.length}`);
  console.log(`Registros a escribir: ${result.upsertPlan.length} (tras resolver duplicados)`);

  if (result.invalidCount > 0) {
    console.log("\nFilas inválidas:");
    for (const inv of result.invalid.slice(0, 20)) {
      console.log(`  fila ${inv.rowNumber}: ${inv.error}`);
    }
    if (result.invalid.length > 20) {
      console.log(`  … y ${result.invalid.length - 20} más`);
    }
  }

  if (result.duplicateCodigos.length > 0) {
    console.log("\nCódigos duplicados dentro del CSV (se usará la última fila válida de cada uno):");
    console.log(`  ${result.duplicateCodigos.join(", ")}`);
  }

  if (!apply) {
    console.log("\nModo dry-run (solo lectura) — no se escribió nada en la base.");
    console.log("Para aplicar realmente, vuelve a ejecutar agregando --apply.");
    return;
  }

  if (result.upsertPlan.length === 0) {
    console.log("\nNo hay filas válidas para aplicar. No se realizó ningún cambio.");
    return;
  }

  console.log(`\n--apply detectado: aplicando ${result.upsertPlan.length} upsert(s) por codigo…`);

  // Conexión a Prisma fuera del runtime de Next — mismo patrón que prisma/seed.js
  // (PrismaClient + adapter-pg + Pool), usando DATABASE_URL del entorno.
  // No se imprime ni se registra el valor de DATABASE_URL en ningún momento.
  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) {
    console.error("\n✗ Falta DATABASE_URL en el entorno. No se aplicó ningún cambio.");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");

  const pool = new Pool({
    connectionString: DB_URL,
    // SSL para cualquier host remoto (Railway, Supabase…); solo local sin SSL.
    ssl: (DB_URL.includes("localhost") || DB_URL.includes("127.0.0.1")) ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let updated = 0;
  const failures = [];

  try {
    for (const row of result.upsertPlan) {
      try {
        const existing = await prisma.maestroTiendaGourmet.findUnique({
          where: { codigo: row.codigo },
          select: { id: true },
        });
        await prisma.maestroTiendaGourmet.upsert({
          where: { codigo: row.codigo },
          create: { codigo: row.codigo, tienda: row.tienda, ciudad: row.ciudad, activo: row.activo },
          update: { tienda: row.tienda, ciudad: row.ciudad, activo: row.activo },
        });
        if (existing) updated += 1;
        else created += 1;
      } catch (err) {
        failures.push({ codigo: row.codigo, error: err.message });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n── Resultado ──");
  console.log(`Creados:   ${created}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Fallidos:  ${failures.length}`);
  if (failures.length > 0) {
    console.log("\nFallos:");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.codigo}: ${f.error}`);
    }
  }
  console.log("\nNo se eliminó ningún registro existente — solo se crearon/actualizaron los códigos del CSV.");
}

main().catch((err) => {
  console.error("✗ Error inesperado:", err.message);
  process.exitCode = 1;
});
