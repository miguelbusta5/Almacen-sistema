import { describe, expect, it } from "vitest";
import {
  agregarIndicadoresMuebles,
  desplazamientos,
  etiquetaTramo,
  MAX_DESPLAZAMIENTO_SEG,
  tramoDe,
  TRAMOS_PESO_KG,
  TRAMOS_VOLUMEN_M3,
  type LineaMedida,
} from "@/lib/mueblesIndicadores";
import type { TipoMercanciaMueble } from "@/lib/pickingMuebles";

const H = (hhmm: string) => new Date(`2026-09-12T${hhmm}:00-05:00`);

function linea(p: Partial<LineaMedida> & { plu: string; operarioId: string }): LineaMedida {
  return {
    ordenId: "o1",
    horaInicio: H("08:00"),
    horaFin: H("08:10"),
    volumenTotalM3: null,
    pesoTotalKg: null,
    inspectorId: null,
    inspHoraInicio: null,
    inspHoraFin: null,
    ebanisteriaInicio: null,
    ebanisteriaFin: null,
    motivoEbanisteria: null,
    estado: "LISTO",
    ...p,
  };
}

describe("tramos", () => {
  it("coloca cada valor en su tramo", () => {
    expect(tramoDe(0.2, TRAMOS_VOLUMEN_M3)).toBe(0);
    expect(tramoDe(0.5, TRAMOS_VOLUMEN_M3)).toBe(1); // el corte entra en el de arriba
    expect(tramoDe(1.4, TRAMOS_VOLUMEN_M3)).toBe(1);
    expect(tramoDe(2.9, TRAMOS_VOLUMEN_M3)).toBe(2);
    expect(tramoDe(7, TRAMOS_VOLUMEN_M3)).toBe(3);
  });

  it("sin medida no hay tramo: no cae en el primero por defecto", () => {
    expect(tramoDe(null, TRAMOS_VOLUMEN_M3)).toBeNull();
    expect(tramoDe(undefined, TRAMOS_PESO_KG)).toBeNull();
    expect(tramoDe(Number.NaN, TRAMOS_PESO_KG)).toBeNull();
  });

  it("etiqueta los extremos como abiertos", () => {
    expect(etiquetaTramo(TRAMOS_VOLUMEN_M3, 0, "m³")).toBe("< 0,5 m³");
    expect(etiquetaTramo(TRAMOS_VOLUMEN_M3, 1, "m³")).toBe("0,5 - 1,5 m³");
    expect(etiquetaTramo(TRAMOS_VOLUMEN_M3, 3, "m³")).toBe("> 3 m³");
    expect(etiquetaTramo(TRAMOS_PESO_KG, 0, "kg")).toBe("< 20 kg");
  });
});

describe("desplazamiento entre PLUs", () => {
  it("mide el hueco entre el fin de uno y el inicio del siguiente", () => {
    const huecos = desplazamientos([
      linea({ plu: "1", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:10") }),
      linea({ plu: "2", operarioId: "a", horaInicio: H("08:16"), horaFin: H("08:25") }),
    ]);
    expect(huecos).toEqual([6 * 60]);
  });

  it("descarta el hueco largo: es almuerzo o fin de turno, no caminar", () => {
    const huecos = desplazamientos([
      linea({ plu: "1", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:10") }),
      linea({ plu: "2", operarioId: "a", horaInicio: H("10:30"), horaFin: H("10:40") }),
    ]);
    expect(huecos).toEqual([]);
  });

  it("el corte esta justo en MAX_DESPLAZAMIENTO_SEG", () => {
    const justo = desplazamientos([
      linea({ plu: "1", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:10") }),
      linea({ plu: "2", operarioId: "a", horaInicio: H("08:40"), horaFin: H("08:45") }),
    ]);
    expect(justo).toEqual([MAX_DESPLAZAMIENTO_SEG]);
  });

  it("ignora las lineas sin cerrar", () => {
    const huecos = desplazamientos([
      linea({ plu: "1", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:10") }),
      linea({ plu: "2", operarioId: "a", horaInicio: H("08:12"), horaFin: null }),
    ]);
    expect(huecos).toEqual([]);
  });

  it("con un solo PLU no hay desplazamiento que medir", () => {
    expect(desplazamientos([linea({ plu: "1", operarioId: "a" })])).toEqual([]);
  });
});

describe("agregarIndicadoresMuebles", () => {
  const tipos = new Map<string, TipoMercanciaMueble>([
    ["1001", "SOFA"],
    ["1002", "MESA"],
  ]);

  const base = {
    operarios: [{ id: "a", nombre: "Ana" }, { id: "b", nombre: "Beto" }],
    inspectores: [{ id: "i1", nombre: "Carlos" }],
    ordenes: [{
      id: "o1", codigo: "TSDM1",
      horaInicio: H("08:00"), horaPasoInspeccion: H("09:00"), horaFinInspeccion: H("09:40"),
    }],
    tipoPorPlu: tipos,
  };

  // Caso real (SANAYDER, 16-09): once PLU de ~10 s cada uno. Redondear cada PLU a
  // minutos enteros antes de sumar daba "0.0 h" de picking y "0 min" por PLU.
  it("los PLU de segundos suman: no se redondean a cero antes de sumar", () => {
    const S = (hhmmss: string) => new Date(`2026-09-12T${hhmmss}-05:00`);
    const lineas = Array.from({ length: 11 }, (_, i) =>
      linea({ plu: `P${i}`, operarioId: "a", horaInicio: S(`08:${String(10 + i * 2).padStart(2, "0")}:00`), horaFin: S(`08:${String(10 + i * 2).padStart(2, "0")}:12`) }));
    const r = agregarIndicadoresMuebles({ ...base, lineas });
    const ana = r.operarios.find((o) => o.id === "a")!;
    expect(ana.minutosPicking).toBeCloseTo(2.2, 1); // 11 x 12 s
    expect(ana.promedioPluMin).toBeCloseTo(0.2, 2);
    expect(r.resumen.desplazamientoPorcentaje).toBeLessThan(100);
  });

  // El almuerzo del operario no es tiempo de picking: si contara, un PLU de 10
  // minutos con una hora de pausa diria 70.
  it("descuenta la pausa del reloj del PLU y del de la orden", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      ordenes: [{ ...base.ordenes[0]!, pausaSegundos: 1800 }],
      lineas: [linea({ plu: "1001", operarioId: "a", horaFin: H("08:40"), pausaSegundos: 1800 })],
    });
    expect(r.operarios[0]!.minutosPicking).toBe(10);
    expect(r.ordenes[0]!.pickingMin).toBe(30);
    expect(r.ordenes[0]!.totalMin).toBe(70);
  });

  it("reparte el tiempo entre los dos operarios de una orden compartida", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [
        linea({ plu: "1001", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:20"), volumenTotalM3: 1.1 }),
        linea({ plu: "1002", operarioId: "b", horaInicio: H("08:30"), horaFin: H("08:40"), volumenTotalM3: 0.3 }),
      ],
    });
    const ana = r.operarios.find((o) => o.id === "a")!;
    const beto = r.operarios.find((o) => o.id === "b")!;
    expect(ana.minutosPicking).toBe(20);
    expect(beto.minutosPicking).toBe(10);
    // Lo importante del caso de reasignacion: ninguno carga con el tiempo del otro.
    expect(ana.plus).toBe(1);
    expect(beto.plus).toBe(1);
    expect(r.resumen.m3).toBe(1.4);
  });

  it("no lista operarios que no pickearon nada en el periodo", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [linea({ plu: "1001", operarioId: "a" })],
    });
    expect(r.operarios.map((o) => o.id)).toEqual(["a"]);
  });

  it("agrupa por tipo de mercancia usando el tipo corregible, no uno sellado", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [
        linea({ plu: "1001", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:20") }),
        linea({ plu: "1002", operarioId: "a", horaInicio: H("08:30"), horaFin: H("08:40") }),
      ],
    });
    const sofa = r.porTipo.find((g) => g.clave === "SOFA")!;
    const mesa = r.porTipo.find((g) => g.clave === "MESA")!;
    expect(sofa.promedioPickingMin).toBe(20);
    expect(mesa.promedioPickingMin).toBe(10);
  });

  it("un PLU sin tipo conocido cae en OTRO, no desaparece del informe", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [linea({ plu: "9999", operarioId: "a" })],
    });
    expect(r.porTipo.find((g) => g.clave === "OTRO")?.plus).toBe(1);
  });

  it("agrupa por tramo de volumen y de peso", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [
        linea({ plu: "1001", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:30"), volumenTotalM3: 4, pesoTotalKg: 120 }),
        linea({ plu: "1002", operarioId: "a", horaInicio: H("08:40"), horaFin: H("08:45"), volumenTotalM3: 0.2, pesoTotalKg: 8 }),
      ],
    });
    expect(r.porVolumen.find((g) => g.etiqueta === "> 3 m³")!.promedioPickingMin).toBe(30);
    expect(r.porVolumen.find((g) => g.etiqueta === "< 0,5 m³")!.promedioPickingMin).toBe(5);
    expect(r.porPeso.find((g) => g.etiqueta === "> 100 kg")!.plus).toBe(1);
  });

  it("los PLU sin medida no ensucian los tramos", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [linea({ plu: "1001", operarioId: "a", volumenTotalM3: null, pesoTotalKg: null })],
    });
    expect(r.porVolumen).toEqual([]);
    expect(r.porPeso).toEqual([]);
    // pero sigue contando en el total y en su tipo
    expect(r.resumen.plusPickeados).toBe(1);
  });

  it("descuenta la ventana de ebanisteria del tiempo de inspeccion", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [linea({
        plu: "1001", operarioId: "a", inspectorId: "i1",
        inspHoraInicio: H("09:00"), inspHoraFin: H("10:00"),
        ebanisteriaInicio: H("09:10"), ebanisteriaFin: H("09:50"),
        motivoEbanisteria: "Golpe en la tapa",
      })],
    });
    expect(r.inspectores[0]!.minutosInspeccion).toBe(20);
    expect(r.ebanisteria.promedioEsperaMin).toBe(40);
    expect(r.ebanisteria.enviados).toBe(1);
    expect(r.ebanisteria.motivos).toEqual([{ motivo: "Golpe en la tapa", veces: 1 }]);
  });

  it("cuenta lo que sigue en el taller ahora mismo", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [linea({
        plu: "1001", operarioId: "a", inspectorId: "i1",
        ebanisteriaInicio: H("09:10"), ebanisteriaFin: null, estado: "EN_EBANISTERIA",
      })],
    });
    expect(r.ebanisteria.enTallerAhora).toBe(1);
    // Sin devolver todavia, no hay espera que promediar.
    expect(r.ebanisteria.promedioEsperaMin).toBeNull();
  });

  it("separa picking de inspeccion en la orden completa", () => {
    const r = agregarIndicadoresMuebles({ ...base, lineas: [linea({ plu: "1001", operarioId: "a" })] });
    expect(r.ordenes[0]).toMatchObject({ pickingMin: 60, inspeccionMin: 40, totalMin: 100 });
  });

  it("una orden aun sin cerrar deja sus duraciones en null", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      ordenes: [{ id: "o2", codigo: "TSDM2", horaInicio: H("08:00"), horaPasoInspeccion: null, horaFinInspeccion: null }],
      lineas: [],
    });
    expect(r.ordenes[0]).toMatchObject({ pickingMin: null, inspeccionMin: null, totalMin: null });
  });

  it("calcula el peso del desplazamiento sobre el tiempo en la jugada", () => {
    const r = agregarIndicadoresMuebles({
      ...base,
      lineas: [
        linea({ plu: "1001", operarioId: "a", horaInicio: H("08:00"), horaFin: H("08:09") }),
        linea({ plu: "1002", operarioId: "a", horaInicio: H("08:10"), horaFin: H("08:19") }),
      ],
    });
    // 18 min de picking + 1 min caminando = 5% del tiempo en la jugada.
    expect(r.resumen.desplazamientoPromedioSeg).toBe(60);
    expect(r.resumen.desplazamientoPorcentaje).toBe(5);
  });

  it("un periodo vacio no revienta ni divide por cero", () => {
    const r = agregarIndicadoresMuebles({ ...base, lineas: [], ordenes: [] });
    expect(r.resumen.plusPickeados).toBe(0);
    expect(r.resumen.desplazamientoPorcentaje).toBeNull();
    expect(r.operarios).toEqual([]);
    expect(r.ebanisteria.enviados).toBe(0);
  });
});
