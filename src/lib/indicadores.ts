import { prisma } from "@/lib/prisma";

export const INDICADORES_ROLES = [
  "ADMIN",
  "GERENTE",
  "SUPERVISOR_INVENTARIO",
  "SUPERVISOR_TRANSPORTE",
  "SUPERVISOR_TIENDA",
  "SUPERVISOR_ALMACENAMIENTO",
] as const;

export const INDICADORES_SYNC_ROLES = ["ADMIN", "GERENTE"] as const;

const DEFAULT_SOURCE_NAME = "Google Sheets CEDI";
const RANGE_BASE = "Base general!A:Z";
const RANGE_PLU = "Rotacion PLU!A:Z";

const MES_NOMBRES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MES_POR_NUM = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export interface IndicadoresSyncResult {
  fuenteId: string;
  resumenMes: number;
  tipoOrden: number;
  plus: number;
  syncedAt: string;
}

export function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.toString().replace(/\$/g, "").replace(/\s/g, "")
    .replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function toRow(headers: string[], cells: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, h, i) => {
    if (h) acc[h] = (cells[i] ?? "").trim();
    return acc;
  }, {});
}

function mesToNum(raw: string): number | null {
  const v = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const byName = MES_NOMBRES[v];
  if (byName) return byName;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function normalizeGrupo(raw: string): string {
  const v = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (v.includes("gourmet") || v === "ag") return "AG";
  if (v.includes("mueble")) return "MUEBLES";
  return "OTROS";
}

function normalizeTipoMov(raw: string): "OVDM" | "TSDM" {
  return raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .includes("traslado") ? "TSDM" : "OVDM";
}

// ── Parsers exportados para tests ───────────────────────────────────────────

export interface ResumenMesRow {
  anio: number; mes: number; mesNombre: string; grupo: string; tipoMov: string;
  ordenes: number; unidades: number; lineas: number;
}
export interface TipoOrdenRow {
  anio: number; tipoOrden: string; grupo: string; ordenes: number; unidades: number;
}
export interface PLURow {
  plu: string; descripcion: string; grupo: string; anio: number; enviados: number; unidades: number;
}

export function parseBaseGeneral(values: string[][]): { resumen: ResumenMesRow[]; tipoOrden: TipoOrdenRow[] } {
  const [headersRaw, ...rows] = values;
  if (!headersRaw?.length) return { resumen: [], tipoOrden: [] };
  const headers = headersRaw.map((h) => normalizeHeader(String(h ?? "")));

  const resumenMap = new Map<string, ResumenMesRow>();
  const tipoOrdenMap = new Map<string, TipoOrdenRow>();

  for (const cells of rows) {
    const row = toRow(headers, cells);

    const anioRaw = row["ano"] ?? row["anio"] ?? row["year"] ?? "";
    const mesRaw = row["mes"] ?? row["mes_de_fecha"] ?? "";
    const tipoRaw = row["tipo"] ?? "";
    const tipoOrdenRaw = (row["tipo_de_orden"] ?? "").trim().toUpperCase() || "OTROS";
    const grupoRaw = row["tipo_e_inventario_wms"] ?? row["tipo_inventario_wms"] ?? row["grupo"] ?? "";
    const unidades = parseNumber(row["cantidad_completada"] ?? row["cantidad_orden"] ?? "") ?? 0;
    const lineas = parseNumber(row["cantidad_de_lineas"] ?? row["cantidad_lineas"] ?? "") ?? 0;

    const anio = parseNumber(anioRaw);
    const mes = mesToNum(mesRaw);
    if (!anio || !mes) continue;

    const mesNombre = MES_POR_NUM[mes] ?? mesRaw.toLowerCase();
    const grupo = normalizeGrupo(grupoRaw);
    const tipoMov = normalizeTipoMov(tipoRaw);

    // Acumular resumen en granularidad (grupo × tipoMov)
    const rKey = `${anio}_${mes}_${grupo}_${tipoMov}`;
    const rExisting = resumenMap.get(rKey);
    if (rExisting) {
      rExisting.ordenes++;
      rExisting.unidades += unidades;
      rExisting.lineas += lineas;
    } else {
      resumenMap.set(rKey, { anio, mes, mesNombre, grupo, tipoMov, ordenes: 1, unidades, lineas });
    }

    // Acumular tipoOrden en grupo propio + TODOS (combinado)
    for (const g of [grupo, "TODOS"]) {
      const tKey = `${anio}_${tipoOrdenRaw}_${g}`;
      const tExisting = tipoOrdenMap.get(tKey);
      if (tExisting) {
        tExisting.ordenes++;
        tExisting.unidades += unidades;
      } else {
        tipoOrdenMap.set(tKey, { anio, tipoOrden: tipoOrdenRaw, grupo: g, ordenes: 1, unidades });
      }
    }
  }

  return { resumen: Array.from(resumenMap.values()), tipoOrden: Array.from(tipoOrdenMap.values()) };
}

export function parseRotacionPLU(values: string[][]): PLURow[] {
  const [headersRaw, ...rows] = values;
  if (!headersRaw?.length) return [];
  const headers = headersRaw.map((h) => normalizeHeader(String(h ?? "")));

  const plusMap = new Map<string, PLURow>();
  const years = [2024, 2025, 2026];

  for (const cells of rows) {
    const row = toRow(headers, cells);
    const plu = (row["articulo"] ?? row["plu"] ?? "").trim();
    if (!plu) continue;

    const descripcion = (row["descripcion"] ?? "").trim().slice(0, 220);
    const grupo = (row["grupo"] ?? "AG").trim().toUpperCase();

    for (const anio of years) {
      const enviados = parseNumber(row[`enviados_${anio}`]);
      const unidades = parseNumber(row[`unidades_${anio}`]);
      if (enviados === null && unidades === null) continue;

      const key = `${plu}_${anio}_${grupo}`;
      plusMap.set(key, { plu, descripcion, grupo, anio, enviados: enviados ?? 0, unidades: unidades ?? 0 });
    }
  }

  return Array.from(plusMap.values());
}

// ── Helpers internos ─────────────────────────────────────────────────────────

function getPrivateKey(): string | null {
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!key) return null;
  return key.replace(/\\n/g, "\n");
}

async function ensureFuente(actorId?: string) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_INDICADORES_SPREADSHEET_ID;
  return prisma.indicadorFuente.upsert({
    where: { nombre: DEFAULT_SOURCE_NAME },
    update: { spreadsheetId, activa: true, syncedById: actorId ?? null },
    create: { nombre: DEFAULT_SOURCE_NAME, spreadsheetId, syncedById: actorId ?? null },
  });
}

// ── Sync principal ────────────────────────────────────────────────────────────

export async function syncIndicadoresFromSheets(actorId?: string): Promise<IndicadoresSyncResult> {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const spreadsheetId = process.env.GOOGLE_SHEETS_INDICADORES_SPREADSHEET_ID;
  const fuente = await ensureFuente(actorId);
  const syncedAt = new Date();

  if (!clientEmail || !privateKey || !spreadsheetId) {
    await prisma.indicadorFuente.update({
      where: { id: fuente.id },
      data: { lastSyncAt: syncedAt, lastSyncStatus: "ERROR", lastSyncError: "Faltan credenciales de Google Sheets" },
    });
    throw new Error("Faltan credenciales de Google Sheets");
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: clientEmail, key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const fetchRange = async (range: string): Promise<string[][]> => {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return (res.data.values ?? []) as string[][];
    };

    const [baseValues, pluValues] = await Promise.all([
      fetchRange(RANGE_BASE),
      fetchRange(RANGE_PLU),
    ]);

    const { resumen, tipoOrden } = parseBaseGeneral(baseValues);
    const plus = parseRotacionPLU(pluValues);

    const now = syncedAt;
    await prisma.$transaction(async (tx) => {
      await tx.indicadorResumenMes.deleteMany({});
      await tx.indicadorTipoOrden.deleteMany({});
      await tx.indicadorPLU.deleteMany({});

      if (resumen.length) {
        await tx.indicadorResumenMes.createMany({
          data: resumen.map((r) => ({ ...r, syncedAt: now })),
        });
      }
      if (tipoOrden.length) {
        await tx.indicadorTipoOrden.createMany({
          data: tipoOrden.map((r) => ({ ...r, syncedAt: now })),
        });
      }
      if (plus.length) {
        await tx.indicadorPLU.createMany({
          data: plus.map((r) => ({ ...r, syncedAt: now })),
        });
      }
    });

    await prisma.indicadorFuente.update({
      where: { id: fuente.id },
      data: { lastSyncAt: syncedAt, lastSyncStatus: "OK", lastSyncError: null, syncedById: actorId ?? null },
    });

    return {
      fuenteId: fuente.id,
      resumenMes: resumen.length,
      tipoOrden: tipoOrden.length,
      plus: plus.length,
      syncedAt: syncedAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido sincronizando Sheets";
    await prisma.indicadorFuente.update({
      where: { id: fuente.id },
      data: { lastSyncAt: syncedAt, lastSyncStatus: "ERROR", lastSyncError: message },
    });
    throw error;
  }
}
