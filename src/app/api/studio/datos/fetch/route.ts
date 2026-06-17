import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { buildCsvUrl, fetchSheetAsCsv } from "@/lib/studio-sheets";
import type { ComponentConfig, FilterConfig, RawRow, AggregatedRow } from "@/types/studio";

function cleanNum(v: string): number {
  return parseFloat(v.replace(/[$%,\s]/g, "")) || 0;
}

function applyFilters(rows: RawRow[], filtros: FilterConfig[]): RawRow[] {
  return rows.filter((row) =>
    filtros.every((f) => {
      const cellRaw = row[f.campo] ?? "";
      const cell = cellRaw.toLowerCase();
      const val = f.valor.toLowerCase();
      switch (f.operador) {
        case "eq": return cell === val;
        case "neq": return cell !== val;
        case "gt": return cleanNum(cellRaw) > cleanNum(f.valor);
        case "gte": return cleanNum(cellRaw) >= cleanNum(f.valor);
        case "lt": return cleanNum(cellRaw) < cleanNum(f.valor);
        case "lte": return cleanNum(cellRaw) <= cleanNum(f.valor);
        case "contains": return cell.includes(val);
        case "not_contains": return !cell.includes(val);
        default: return true;
      }
    })
  );
}

function aggregate(rows: RawRow[], config: ComponentConfig): AggregatedRow[] {
  if (!config.dimension || !config.metrica) return [];

  const filtered = config.filtros?.length ? applyFilters(rows, config.filtros) : rows;

  const grouped = new Map<string, number[]>();
  for (const row of filtered) {
    const dim = row[config.dimension] ?? "(vacío)";
    const val = cleanNum(row[config.metrica] ?? "0");
    if (!grouped.has(dim)) grouped.set(dim, []);
    grouped.get(dim)!.push(val);
  }

  const agg = config.agregacion ?? "sum";
  let result: AggregatedRow[] = Array.from(grouped.entries()).map(([dimension, vals]) => {
    let valor = 0;
    switch (agg) {
      case "sum": valor = vals.reduce((a, b) => a + b, 0); break;
      case "count": valor = vals.length; break;
      case "avg": valor = vals.reduce((a, b) => a + b, 0) / vals.length; break;
      case "min": valor = Math.min(...vals); break;
      case "max": valor = Math.max(...vals); break;
      default: valor = vals.reduce((a, b) => a + b, 0);
    }
    return { dimension, valor };
  });

  if (config.ordenPor === config.metrica) {
    result.sort((a, b) => config.orden === "asc" ? a.valor - b.valor : b.valor - a.valor);
  } else if (config.ordenPor === config.dimension) {
    result.sort((a, b) => config.orden === "asc"
      ? a.dimension.localeCompare(b.dimension)
      : b.dimension.localeCompare(a.dimension));
  }

  if (config.limiteFilas && config.limiteFilas > 0) {
    result = result.slice(0, config.limiteFilas);
  }

  return result;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { fuenteId?: string; config?: ComponentConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { fuenteId, config } = body;
  if (!fuenteId) return NextResponse.json({ error: "fuenteId requerido" }, { status: 400 });

  const fuente = await prisma.studioFuente.findUnique({ where: { id: fuenteId } });
  if (!fuente || !fuente.urlSheets) {
    return NextResponse.json({ error: "Fuente no encontrada o sin URL" }, { status: 404 });
  }

  try {
    const { extractSheetId } = await import("@/lib/studio-sheets");
    const sheetId = extractSheetId(fuente.urlSheets);
    if (!sheetId) return NextResponse.json({ error: "URL de fuente inválida" }, { status: 400 });

    const csvUrl = buildCsvUrl(sheetId, fuente.hojaActiva ?? undefined);
    const rows = await fetchSheetAsCsv(csvUrl);

    if (!config?.dimension || !config?.metrica) {
      return NextResponse.json({ rows: rows.slice(0, 100) });
    }

    const aggregated = aggregate(rows, config);
    return NextResponse.json({ aggregated, total: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
