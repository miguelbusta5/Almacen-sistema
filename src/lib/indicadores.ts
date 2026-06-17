import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
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
const DEFAULT_RANGE = "Indicadores!A:Z";

type SheetRow = Record<string, string>;

export interface ParsedIndicador {
  proceso: string;
  indicador: string;
  periodo: string;
  valor: number;
  meta: number | null;
  unidad: string | null;
  estado: string;
  rawRow: SheetRow;
  rowKey: string;
  rowHash: string;
}

export interface IndicadoresSyncResult {
  fuenteId: string;
  importados: number;
  actualizados: number;
  ignorados: number;
  errores: string[];
  syncedAt: string;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function first(row: SheetRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value
    .toString()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function inferEstado(valor: number, meta: number | null, explicit: string): string {
  const status = explicit.trim().toUpperCase();
  if (status) return status.slice(0, 30);
  if (meta === null || meta === 0) return "NORMAL";
  const cumplimiento = valor / meta;
  if (cumplimiento >= 1) return "EN_META";
  if (cumplimiento >= 0.9) return "ALERTA";
  return "CRITICO";
}

export function rowsToIndicadores(values: string[][], fuenteId: string): ParsedIndicador[] {
  const [headersRaw, ...rows] = values;
  if (!headersRaw?.length) return [];
  const headers = headersRaw.map((h) => normalizeHeader(String(h ?? "")));

  return rows.flatMap((cells, index) => {
    const rawRow = headers.reduce<SheetRow>((acc, header, cellIndex) => {
      if (header) acc[header] = String(cells[cellIndex] ?? "").trim();
      return acc;
    }, {});

    const proceso = first(rawRow, ["proceso", "area", "modulo", "departamento"]);
    const indicador = first(rawRow, ["indicador", "kpi", "nombre", "metrica"]);
    const periodo = first(rawRow, ["periodo", "mes", "fecha", "semana"]);
    const valor = parseNumber(first(rawRow, ["valor", "resultado", "actual", "cantidad"]));
    const meta = parseNumber(first(rawRow, ["meta", "objetivo", "target"]));
    const unidad = first(rawRow, ["unidad", "tipo_unidad", "medida"]) || null;
    const explicitEstado = first(rawRow, ["estado", "semaforo", "status"]);

    if (!proceso || !indicador || !periodo || valor === null) return [];

    const rowKey = `${fuenteId}:${index + 2}:${proceso}:${indicador}:${periodo}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9:.-]+/g, "_")
      .slice(0, 220);
    const rowHash = createHash("sha256").update(JSON.stringify(rawRow)).digest("hex");

    return [{
      proceso,
      indicador,
      periodo,
      valor,
      meta,
      unidad,
      estado: inferEstado(valor, meta, explicitEstado),
      rawRow,
      rowKey,
      rowHash,
    }];
  });
}

function getPrivateKey(): string | null {
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!key) return null;
  return key.replace(/\\n/g, "\n");
}

async function ensureFuente(actorId?: string) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_INDICADORES_SPREADSHEET_ID;
  const rango = process.env.GOOGLE_SHEETS_INDICADORES_RANGE || DEFAULT_RANGE;

  return prisma.indicadorFuente.upsert({
    where: { nombre: DEFAULT_SOURCE_NAME },
    update: {
      spreadsheetId,
      rango,
      activa: true,
      syncedById: actorId ?? null,
    },
    create: {
      nombre: DEFAULT_SOURCE_NAME,
      spreadsheetId,
      rango,
      syncedById: actorId ?? null,
    },
  });
}

export async function syncIndicadoresFromSheets(actorId?: string): Promise<IndicadoresSyncResult> {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const spreadsheetId = process.env.GOOGLE_SHEETS_INDICADORES_SPREADSHEET_ID;
  const fuente = await ensureFuente(actorId);
  const syncedAt = new Date();

  if (!clientEmail || !privateKey || !spreadsheetId) {
    await prisma.indicadorFuente.update({
      where: { id: fuente.id },
      data: {
        lastSyncAt: syncedAt,
        lastSyncStatus: "ERROR",
        lastSyncError: "Faltan credenciales de Google Sheets",
      },
    });
    throw new Error("Faltan credenciales de Google Sheets");
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fuente.rango,
    });

    const values = (response.data.values ?? []) as string[][];
    const parsed = rowsToIndicadores(values, fuente.id);
    let importados = 0;
    let actualizados = 0;

    for (const item of parsed) {
      const existing = await prisma.indicadorCedi.findUnique({
        where: { rowKey: item.rowKey },
        select: { id: true, rowHash: true },
      });

      const data = {
        fuenteId: fuente.id,
        proceso: item.proceso,
        indicador: item.indicador,
        periodo: item.periodo,
        valor: new Prisma.Decimal(item.valor),
        meta: item.meta === null ? null : new Prisma.Decimal(item.meta),
        unidad: item.unidad,
        estado: item.estado,
        rawRow: item.rawRow,
        rowHash: item.rowHash,
        syncedAt,
      };

      await prisma.indicadorCedi.upsert({
        where: { rowKey: item.rowKey },
        update: data,
        create: { ...data, rowKey: item.rowKey },
      });

      if (existing) {
        if (existing.rowHash !== item.rowHash) actualizados += 1;
      } else {
        importados += 1;
      }
    }

    const ignored = Math.max(0, values.length - 1 - parsed.length);
    await prisma.indicadorFuente.update({
      where: { id: fuente.id },
      data: {
        lastSyncAt: syncedAt,
        lastSyncStatus: "OK",
        lastSyncError: null,
        syncedById: actorId ?? null,
      },
    });

    return {
      fuenteId: fuente.id,
      importados,
      actualizados,
      ignorados: ignored,
      errores: [],
      syncedAt: syncedAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido sincronizando Sheets";
    await prisma.indicadorFuente.update({
      where: { id: fuente.id },
      data: {
        lastSyncAt: syncedAt,
        lastSyncStatus: "ERROR",
        lastSyncError: message,
        syncedById: actorId ?? null,
      },
    });
    throw error;
  }
}
