import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  columnasPresentes,
  mapExcelProductoRow,
  MAESTRO_SHEET_NAMES,
  ProductoMaestroDTO,
} from "@/lib/productosMaestro";
import { mapMedicionRows, tieneColumnasDeMedicion } from "@/lib/medidasCajaMaster";
import { guardarMediciones, recalcularLineasMuebles } from "@/lib/medidasCajaMasterDb";
import { guardarProductosMaestro } from "@/lib/productosMaestroDb";
import { readWorkbook, worksheetObjects, worksheetRows } from "@/lib/excel";
import { validateImportFile, validateRowLimit } from "@/lib/fileSecurity";

const MAX_MAESTRO_ROWS = 25000;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo .xlsx requerido" }, { status: 400 });
  }
  const fileError = validateImportFile(file, { allowedExtensions: [".xlsx"] });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = await readWorkbook(buffer);
  // Se prueban los nombres conocidos en orden antes de caer al primer worksheet:
  // la planilla de montacargas trae varias hojas y la primera es la de un
  // operario, no el maestro.
  const sheet =
    MAESTRO_SHEET_NAMES.map((name) => workbook.getWorksheet(name)).find(Boolean) ??
    workbook.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "No se encontro hoja en el archivo" }, { status: 400 });

  const rows = worksheetObjects(sheet);
  const rowLimitError = validateRowLimit(rows.length, MAX_MAESTRO_ROWS);
  if (rowLimitError) return NextResponse.json({ error: rowLimitError }, { status: 400 });

  // Las mediciones se leen aparte porque el archivo de medicion trae una
  // cabecera de DOS niveles y worksheetObjects() solo mira la primera fila: ahi
  // "PARTE 1 PESO CAJA MASTER (KG)" nombra a la vez el peso bruto y el neto.
  const filasCrudas = worksheetRows(sheet);

  // Solo se actualizan las columnas que el archivo TRAE. Sin esto, importar un
  // maestro parcial (la planilla de montacargas no lleva Fabricante, PRECIO ni
  // MARCAS) vaciaba esos campos en los ~19k productos existentes — y `precio`
  // alimenta el costo unitario de Novedades.
  const columnas = columnasPresentes(rows);
  if (!columnas.length) {
    return NextResponse.json(
      { error: "El archivo no trae ninguna columna reconocida del maestro" },
      { status: 400 }
    );
  }

  let ignorados = 0;
  // Mapa por PLU: si el archivo trae PLUs repetidos, gana la ultima fila (mismo
  // comportamiento que el upsert secuencial anterior).
  const productosPorPlu = new Map<string, ProductoMaestroDTO>();
  rows.forEach((row) => {
    const producto = mapExcelProductoRow(row);
    if (!producto) {
      ignorados += 1;
      return;
    }
    productosPorPlu.set(producto.plu, producto);
  });
  const productos = [...productosPorPlu.values()];

  const { importados, actualizados, errores } = await guardarProductosMaestro(
    prisma,
    productos,
    columnas
  );

  // Mediciones de caja master: solo si el archivo TRAE esa cabecera. Misma
  // filosofia que columnasPresentes — un maestro de precios no debe vaciar unas
  // medidas que no menciona.
  let mediciones = { productos: 0, cajas: 0 };
  let lineasRecalculadas = 0;
  if (tieneColumnasDeMedicion(filasCrudas)) {
    const medidos = mapMedicionRows(filasCrudas);
    if (medidos.length) {
      const res = await guardarMediciones(prisma, medidos);
      mediciones = { productos: res.productos, cajas: res.cajas };
      errores.push(...res.errores);
      // Las medidas no se congelan en el trabajo ya hecho: corregir el maestro
      // arregla tambien las ordenes de muebles anteriores.
      try {
        lineasRecalculadas = await recalcularLineasMuebles(prisma, medidos.map((m) => m.plu));
      } catch (error) {
        errores.push(`recalculo de lineas de muebles: ${String(error)}`);
      }
    }
  }

  const resumen =
    `${importados} importados, ${actualizados} actualizados, ${ignorados} ignorados` +
    (mediciones.productos
      ? `, ${mediciones.productos} con medidas (${mediciones.cajas} cajas)`
      : "") +
    (lineasRecalculadas ? `, ${lineasRecalculadas} lineas de muebles recalculadas` : "");

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "IMPORT",
      module: "productos-maestro",
      recordId: file.name,
      details: resumen,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    data: { importados, actualizados, ignorados, errores, columnas, mediciones, lineasRecalculadas },
  });
}
