import Papa from "papaparse";
import type { ColumnPreview, FieldType, RawRow } from "@/types/studio";

export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function buildCsvUrl(sheetId: string, sheetName?: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}

export async function fetchSheetAsCsv(csvUrl: string): Promise<RawRow[]> {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Error al acceder al Sheet: HTTP ${res.status}. Asegúrate de que el Sheet sea público.`);
  }
  const text = await res.text();
  if (text.includes("<!DOCTYPE html")) {
    throw new Error("El Sheet no es público o la URL no es válida.");
  }
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return result.data;
}

function detectFieldType(values: string[]): FieldType {
  const nonEmpty = values.filter((v) => v && v.trim() !== "");
  if (nonEmpty.length === 0) return "texto";

  const sample = nonEmpty.slice(0, 50);

  // Booleano
  const boolValues = new Set(["si", "no", "true", "false", "1", "0", "sí"]);
  if (sample.every((v) => boolValues.has(v.toLowerCase().trim()))) return "booleano";

  // Número (limpiar formato moneda/porcentaje)
  const cleanNum = (v: string) => v.replace(/[$%\s.,]/g, "").replace(",", ".");
  if (sample.every((v) => !isNaN(parseFloat(cleanNum(v))) && cleanNum(v) !== "")) return "numero";

  // Fecha
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
  ];
  if (
    sample.every(
      (v) => datePatterns.some((p) => p.test(v.trim())) || !isNaN(Date.parse(v))
    )
  )
    return "fecha";

  return "texto";
}

export function detectColumns(rows: RawRow[]): ColumnPreview[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((nombre) => ({
    nombre,
    tipo: detectFieldType(rows.map((r) => r[nombre] ?? "")),
  }));
}
