import ExcelJS from "exceljs";

export type ExcelRow = unknown[];

function getCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("result" in value) return value.result ?? null;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

export async function readWorkbook(buffer: Buffer | ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

export function worksheetRows(worksheet: ExcelJS.Worksheet): ExcelRow[] {
  const rows: ExcelRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1).map((_, index) => getCellValue(row.getCell(index + 1))));
  });
  return rows;
}

export function worksheetObjects(worksheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const rows = worksheetRows(worksheet);
  if (rows.length === 0) return [];
  const headers = rows[0].map((value) => String(value ?? "").trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index] ?? null;
    });
    return obj;
  });
}

export async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const raw = await workbook.xlsx.writeBuffer();
  if (raw instanceof ArrayBuffer) return raw;
  const view = raw as Uint8Array;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

export function parseCsvRows(text: string): ExcelRow[] {
  const rows: ExcelRow[] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}
