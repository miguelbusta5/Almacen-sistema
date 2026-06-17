import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { extractSheetId, buildCsvUrl, fetchSheetAsCsv, detectColumns } from "@/lib/studio-sheets";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { url?: string; hoja?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { url, hoja } = body;
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL requerida" }, { status: 400 });
  }

  const sheetId = extractSheetId(url.trim());
  if (!sheetId) {
    return NextResponse.json(
      { error: "URL inválida. Debe ser una URL de Google Sheets (docs.google.com/spreadsheets/d/...)" },
      { status: 400 }
    );
  }

  try {
    const csvUrl = buildCsvUrl(sheetId, hoja);
    const rows = await fetchSheetAsCsv(csvUrl);

    if (rows.length === 0) {
      return NextResponse.json({ error: "El Sheet está vacío o no tiene datos en la pestaña indicada." }, { status: 400 });
    }

    const columnas = detectColumns(rows);
    const preview = rows.slice(0, 5);

    return NextResponse.json({ columnas, preview, total: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
