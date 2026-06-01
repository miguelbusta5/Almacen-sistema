import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { detectarColumnas, esAutoFill } from "@/lib/conteo";
import * as XLSX from "xlsx";

// POST /api/conteo/ciclos/[id]/importar — sube CSV/Excel del WMS y crea líneas de conteo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const ciclo = await prisma.cicloConteo.findUnique({ where: { id } });
  if (!ciclo) return NextResponse.json({ error: "Ciclo no encontrado" }, { status: 404 });
  if (ciclo.estado !== "PLANIFICADO") return NextResponse.json({ error: "Solo se puede importar en estado PLANIFICADO" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("archivo") as File | null;
  if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (rows.length < 2) return NextResponse.json({ error: "El archivo está vacío o sin datos" }, { status: 400 });

  const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
  const colMap = detectarColumnas(headers);
  if (!colMap) {
    return NextResponse.json({
      error: "No se encontraron las columnas requeridas (PLU/Artículo, Descripción, Ubicación/Depósito, Teórico/Disponible). Verifica el formato del archivo.",
    }, { status: 400 });
  }

  const dataRows = rows.slice(1);
  const lineas = dataRows
    .filter((row) => row[colMap.plu] != null && String(row[colMap.plu]).trim() !== "")
    .map((row) => {
      const tipoPasillo = colMap.tipoPasillo != null ? String(row[colMap.tipoPasillo] ?? "Almacenamiento").trim() : "Almacenamiento";
      const autoFill = esAutoFill(tipoPasillo);
      const teorico = parseFloat(String(row[colMap.teorico] ?? "0").replace(",", ".")) || 0;
      const plu = String(row[colMap.plu]).trim();
      const descripcion = String(row[colMap.descripcion] ?? "").trim();
      const ubicacion = String(row[colMap.ubicacion] ?? "").trim();

      return {
        cicloId: id,
        plu,
        descripcion,
        marca: colMap.marca != null ? (String(row[colMap.marca] ?? "").trim() || null) : null,
        codigoBarras: colMap.codigoBarras != null ? (String(row[colMap.codigoBarras] ?? "").trim() || null) : null,
        ubicacion,
        tipoPasillo,
        autoFill,
        teorico,
        precioBase: colMap.precioBase != null ? (parseFloat(String(row[colMap.precioBase] ?? "").replace(",", ".")) || null) : null,
        ultimoPrecio: colMap.ultimoPrecio != null ? (parseFloat(String(row[colMap.ultimoPrecio] ?? "").replace(",", ".")) || null) : null,
        // Auto-fill lines are immediately OK
        estado: autoFill ? "OK" : "PENDIENTE",
        cantidadContada: autoFill ? teorico : null,
        diferenciaFinal: autoFill ? 0 : null,
      };
    })
    .filter((l) => l.ubicacion && l.plu);

  if (lineas.length === 0) return NextResponse.json({ error: "No se encontraron filas válidas en el archivo" }, { status: 400 });

  // Eliminar líneas anteriores del ciclo (reimportación)
  await prisma.lineaConteo.deleteMany({ where: { cicloId: id } });

  // Insertar en lotes de 500
  for (let i = 0; i < lineas.length; i += 500) {
    await prisma.lineaConteo.createMany({ data: lineas.slice(i, i + 500) });
  }

  // Actualizar total del ciclo
  await prisma.cicloConteo.update({ where: { id }, data: { totalLineas: lineas.length } });

  // Registrar importación
  await prisma.importacionTeorico.create({
    data: { cicloId: id, archivo: file.name, totalFilas: lineas.length, importadoPor: actor.id },
  });

  const autoFillCount = lineas.filter((l) => l.autoFill).length;
  const fisicasCount = lineas.length - autoFillCount;

  return NextResponse.json({ success: true, totalLineas: lineas.length, fisicas: fisicasCount, autoFill: autoFillCount });
}
