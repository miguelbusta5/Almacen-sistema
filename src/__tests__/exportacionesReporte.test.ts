import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { readWorkbook, worksheetRows } from "@/lib/excel";
import {
  matricesDiarias,
  promediosMensuales,
  tiemposPorUsuario,
  totalTiempos,
  type RegistroReporte,
} from "@/lib/exportaciones/reporteCalc";
import { HOJAS, construirReporte } from "@/lib/exportaciones/reporteWorkbook";
import type { PaisExport } from "@/lib/exportaciones/paises";

const LABEL: Record<PaisExport, string> = { ecuador: "Ecuador", mexico: "México", eeuu: "EE.UU" };

function reg(
  pais: PaisExport,
  dia: string,
  usuario: string,
  unidades: number,
  minutos: number | null,
): RegistroReporte {
  const inicio = new Date(`${dia}T13:00:00.000Z`);
  return {
    pais,
    paisLabel: LABEL[pais],
    fecha: new Date(`${dia}T00:00:00.000Z`),
    numeroCaja: `C-${usuario}-${dia}`,
    plu: `PLU${unidades}`,
    descripcion: "Producto",
    unidadEmpaque: unidades,
    horaInicio: inicio,
    horaFinalizacion: minutos === null ? null : new Date(inicio.getTime() + minutos * 60000),
    hayReguero: false,
    cantidadReguero: null,
    motivoCorreccion: null,
    creadoPorId: usuario,
    creadoPorNombre: usuario === "u1" ? "Ana" : "Luis",
    actualizadoPorNombre: null,
  };
}

// Ana: Ecuador 2 cajas (10 + 20 min), México 1 caja sin finalizar.
// Luis: EE.UU 1 caja (30 min) en otro mes.
const REGISTROS: RegistroReporte[] = [
  reg("ecuador", "2026-07-01", "u1", 10, 10),
  reg("ecuador", "2026-07-02", "u1", 5, 20),
  reg("mexico", "2026-07-02", "u1", 7, null),
  reg("eeuu", "2026-06-15", "u2", 12, 30),
];

describe("tiemposPorUsuario", () => {
  const filas = tiemposPorUsuario(REGISTROS);

  it("separa por país y suma en general", () => {
    const ana = filas.find((f) => f.nombre === "Ana")!;
    expect(ana.porAmbito.ecuador).toMatchObject({ cajas: 2, unidades: 15, minutos: 30, finalizadas: 2 });
    expect(ana.porAmbito.mexico).toMatchObject({ cajas: 1, unidades: 7, minutos: 0, finalizadas: 0 });
    expect(ana.porAmbito.eeuu.cajas).toBe(0);
    expect(ana.porAmbito.general).toMatchObject({ cajas: 3, unidades: 22, minutos: 30, finalizadas: 2 });
  });

  it("promedia sobre las finalizadas, no sobre todas las cajas", () => {
    const ana = filas.find((f) => f.nombre === "Ana")!;
    // 30 min / 2 finalizadas = 15, aunque tenga 3 cajas.
    expect(ana.porAmbito.ecuador.promedioPorCajaMin).toBe(15);
    expect(ana.porAmbito.general.promedioPorCajaMin).toBe(15);
    // Sin ninguna finalizada no hay promedio que dar.
    expect(ana.porAmbito.mexico.promedioPorCajaMin).toBeNull();
    expect(ana.porAmbito.eeuu.promedioPorCajaMin).toBeNull();
  });

  it("ordena por cajas totales desc", () => {
    expect(filas.map((f) => f.nombre)).toEqual(["Ana", "Luis"]);
  });

  it("el total general pondera, no promedia promedios", () => {
    const total = totalTiempos(filas);
    expect(total.general).toMatchObject({ cajas: 4, unidades: 34, minutos: 60, finalizadas: 3 });
    expect(total.general.promedioPorCajaMin).toBe(20); // 60/3, no (15+30)/2
  });
});

describe("matricesDiarias", () => {
  it("devuelve un bloque por país más el general, con los mismos usuarios", () => {
    const matrices = matricesDiarias(REGISTROS, "unidades");
    expect(matrices.map((m) => m.ambito)).toEqual(["ecuador", "mexico", "eeuu", "general"]);
    for (const m of matrices) expect(m.usuarios.map((u) => u.nombre)).toEqual(["Ana", "Luis"]);
  });

  it("suma unidades por fecha y usuario", () => {
    const [ecuador] = matricesDiarias(REGISTROS, "unidades");
    expect(ecuador.fechas).toEqual(["2026-07-01", "2026-07-02"]);
    expect(ecuador.valores).toEqual([
      [10, 0],
      [5, 0],
    ]);
    expect(ecuador.totalesPorFecha).toEqual([10, 5]);
  });

  it("cuenta registros en vez de unidades cuando se pide", () => {
    const general = matricesDiarias(REGISTROS, "registros").at(-1)!;
    expect(general.fechas).toEqual(["2026-06-15", "2026-07-01", "2026-07-02"]);
    expect(general.totalesPorFecha).toEqual([1, 1, 2]);
  });

  it("solo lista las fechas con actividad del ámbito", () => {
    const [, mexico] = matricesDiarias(REGISTROS, "unidades");
    expect(mexico.fechas).toEqual(["2026-07-02"]);
  });
});

describe("promediosMensuales", () => {
  const meses = promediosMensuales(REGISTROS);

  it("agrupa por mes en orden ascendente", () => {
    expect(meses.map((m) => m.mes)).toEqual(["2026-06", "2026-07"]);
  });

  it("promedia por días con actividad, no por días de calendario", () => {
    const julio = meses[1].porAmbito.ecuador;
    expect(julio).toMatchObject({ registros: 2, unidades: 15, dias: 2, usuarios: 1 });
    expect(julio.promedioRegistrosDia).toBe(1);
    expect(julio.promedioUnidadesDia).toBe(7.5);
    expect(julio.promedioPorCajaMin).toBe(15);
  });

  it("el general de un mes suma los tres países", () => {
    expect(meses[1].porAmbito.general).toMatchObject({ registros: 3, unidades: 22, usuarios: 1 });
    expect(meses[0].porAmbito.general.registros).toBe(1);
  });
});

describe("construirReporte", () => {
  it("genera las 5 hojas con la columna País en la base", async () => {
    const wb = await readWorkbook(await construirReporte(REGISTROS));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      HOJAS.registros,
      HOJAS.tiempos,
      HOJAS.unidadesDia,
      HOJAS.registrosDia,
      HOJAS.mensual,
    ]);

    const filas = worksheetRows(wb.getWorksheet(HOJAS.registros)!);
    expect(filas[0][0]).toBe("País");
    expect(filas).toHaveLength(REGISTROS.length + 1);
    expect(new Set(filas.slice(1).map((f) => f[0]))).toEqual(new Set(["Ecuador", "México", "EE.UU"]));
  });

  it("incluye los cuatro ámbitos en la hoja de tiempos", async () => {
    const wb = await readWorkbook(await construirReporte(REGISTROS));
    // worksheetRows salta las filas vacías: [0] título, [1] ámbitos, [2] métricas.
    const filas = worksheetRows(wb.getWorksheet(HOJAS.tiempos)!);
    // Las celdas combinadas repiten el valor del maestro al releerlas: se deduplica.
    expect([...new Set(filas[1].filter(Boolean))]).toEqual([
      "Usuario", "Ecuador", "México", "EE.UU", "General",
    ]);
    expect(filas[2].filter(Boolean)).toEqual(
      Array(4).fill(["Cajas", "Unidades", "Minutos totales", "Prom. min/caja"]).flat(),
    );
    // Ana: cajas/unidades/minutos/prom de Ecuador en las 4 primeras columnas del bloque.
    expect(filas[3].slice(0, 5)).toEqual(["Ana", 2, 15, 30, 15]);
    expect(filas.at(-1)![0]).toBe("TOTAL");
  });

  it("embebe gráficas nativas en las cuatro hojas de análisis", async () => {
    const zip = await JSZip.loadAsync(await construirReporte(REGISTROS));
    // 2 (tiempos) + 4 (unidades/día) + 4 (registros/día) + 2 (mensual)
    expect(zip.file(/^xl\/charts\/chart\d+\.xml$/)).toHaveLength(12);
    expect(zip.file(/^xl\/drawings\/drawing\d+\.xml$/)).toHaveLength(4);
  });

  it("no genera gráficas vacías si no hay registros", async () => {
    const buf = await construirReporte([]);
    const zip = await JSZip.loadAsync(buf);
    expect(zip.file(/^xl\/charts\//)).toHaveLength(0);
    const wb = await readWorkbook(buf);
    expect(wb.worksheets).toHaveLength(5);
  });
});
