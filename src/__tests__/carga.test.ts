// Peso y volumen de lo que se mueve: la caja master repartida entre lo que trae.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cargaDeUnidades,
  resumirCargaPorPersona,
  sumarCargas,
  unidadesPorCajaValidas,
  type MedidaPlu,
} from "@/lib/carga";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
// Silla que viene 4 por caja: la caja pesa 21 kg y ocupa 0,365568 m3.
const silla: MedidaPlu = { unidadesPorCaja: 4, cajaKg: 21, cajaM3: 0.365568 };
const escritorio: MedidaPlu = { unidadesPorCaja: 1, cajaKg: 45, cajaM3: 1.029134 };

describe("carga de un trabajo", () => {
  it("una caja de 4 pesa lo que 4 unidades", () => {
    expect(cargaDeUnidades(1, silla)).toEqual({ kg: 5.25, m3: 0.091392 });
    expect(cargaDeUnidades(4, silla)).toEqual({ kg: 21, m3: 0.365568 });
    expect(cargaDeUnidades(8, silla)).toEqual({ kg: 42, m3: 0.731136 });
  });

  it("lo que va de a uno no cambia", () => {
    expect(cargaDeUnidades(2, escritorio)).toEqual({ kg: 90, m3: 2.058268 });
  });

  it("un PLU sin medir no vale cero", () => {
    expect(cargaDeUnidades(5, null)).toEqual({ kg: null, m3: null });
    expect(cargaDeUnidades(5, { unidadesPorCaja: 1, cajaKg: null, cajaM3: null })).toEqual({ kg: null, m3: null });
  });

  it("sin unidad de empaque valida se asume 1 por caja", () => {
    for (const n of [null, undefined, 0, -3, 0.5]) expect(unidadesPorCajaValidas(n as number | null)).toBe(1);
    expect(unidadesPorCajaValidas(4)).toBe(4);
  });

  it("lo no medido se cuenta aparte, no como cero", () => {
    const total = sumarCargas([cargaDeUnidades(4, silla), cargaDeUnidades(1, null), cargaDeUnidades(1, escritorio)]);
    expect(total).toEqual({ kg: 66, m3: 1.394702, sinMedida: 1 });
  });
});

describe("carga por persona", () => {
  const personas = [{ id: "a", nombre: "ANA" }, { id: "b", nombre: "BETO" }];

  it("suma por modulo y ordena por volumen", () => {
    const filas = resumirCargaPorPersona(personas, [
      { usuarioId: "a", tipo: "resurtido", carga: cargaDeUnidades(4, silla) },
      { usuarioId: "a", tipo: "pendiente", carga: cargaDeUnidades(1, silla) },
      { usuarioId: "b", tipo: "montacargas", carga: cargaDeUnidades(1, escritorio) },
      { usuarioId: "a", tipo: "resurtido", carga: cargaDeUnidades(2, null) },
    ]);
    expect(filas.map((f) => f.nombre)).toEqual(["BETO", "ANA"]);
    const ana = filas.find((f) => f.id === "a")!;
    expect(ana.kg).toBe(26.3);
    expect(ana.porTipo.resurtido.kg).toBe(21);
    expect(ana.porTipo.pendiente.kg).toBe(5.3);
    expect(ana.porTipo.montacargas.kg).toBe(0);
    expect(ana.sinMedida).toBe(1);
  });

  it("quien no movio nada no sale", () => {
    expect(resumirCargaPorPersona(personas, [])).toEqual([]);
  });
});

describe("carga — copia de Nitro y conexiones", () => {
  it("la copia del servidor es identica a la fuente", () => {
    const quitarCr = (s: string) => s.split(String.fromCharCode(13)).join("");
    const salto = String.fromCharCode(10);
    const lineas = quitarCr(leer("src/lib/carga.ts")).split(salto);
    const cuerpo = lineas.findIndex((l) => !l.startsWith("//"));
    const fuente = lineas.slice(cuerpo).join(salto).trim().split(";" + salto).join(salto);
    const copia = quitarCr(leer("nuxt-app/server/utils/cargaCalc.ts")).trim();
    expect(copia).toBe(fuente);
  });

  it("los modulos devuelven la carga", () => {
    expect(leer("nuxt-app/server/api/montaje-resurtido/index.get.ts")).toContain("conCargaMontajes");
    expect(leer("nuxt-app/server/api/resurtido-tareas/index.get.ts")).toContain("conCargaMontajes");
    expect(leer("nuxt-app/server/api/pendientes/index.get.ts")).toContain("conCargaPendientes");
    expect(leer("nuxt-app/server/api/montacargas/abiertos.get.ts")).toContain("conCargaMovimientos");
    expect(leer("nuxt-app/server/utils/picking.ts")).toContain("cargaTarea");
    expect(leer("nuxt-app/server/api/indicadores/index.get.ts")).toContain("resumirCargaPorPersona");
  });

  it("se calcula con el maestro vigente, no sellado", () => {
    // Muebles: al cargar el maestro se recalcula lo ya registrado.
    expect(leer("src/lib/medidasCajaMasterDb.ts")).toContain("export async function recalcularLineasMuebles");
    expect(leer("src/app/api/productos-maestro/importar/route.ts")).toContain("recalcularLineasMuebles(prisma");
  });

  it("las pantallas lo muestran", () => {
    expect(leer("nuxt-app/app/components/montaje/Module.vue")).toContain("fmtKg(m.carga.kg)");
    expect(leer("nuxt-app/app/components/pendientes/Module.vue")).toContain("fmtKg(p.carga.kg)");
    expect(leer("nuxt-app/app/components/montacargas/RegistroAbierto.vue")).toContain("fmtKg(m.carga.kg)");
    expect(leer("nuxt-app/app/components/indicadores/Module.vue")).toContain("Peso y volumen movido");
    expect(leer("nuxt-app/app/components/picking/Teorico.vue")).toContain("cargaElegida");
  });
});

describe("muebles — peso y m³ en las pantallas", () => {
  it("historial: por orden y por PLU", () => {
    const lista = leer("nuxt-app/app/components/historial-muebles/Module.vue");
    expect(lista).toContain("fmtKg(o.volumen.kg)");
    expect(lista).toContain("o.volumen.lineasSinMedida");
    const detalle = leer("nuxt-app/app/components/historial-muebles/OrdenDetalle.vue");
    expect(detalle).toContain("fmtKg(l.pesoTotalKg)");
    expect(detalle).toContain("fmtM3(l.volumenTotalM3)");
  });

  it("inspección y entrega muestran la carga de la orden", () => {
    expect(leer("nuxt-app/app/components/inspeccion-muebles/OrdenDetalle.vue")).toContain("fmtKg(orden.volumen.kg)");
    expect(leer("nuxt-app/app/components/entrega-muebles/Module.vue")).toContain("fmtKg(o.volumen.kg)");
  });
});

describe("formato de m³ y kg", () => {
  it("usa coma decimal y punto de miles (es-CO)", () => {
    const muebles = leer("nuxt-app/app/utils/muebles.ts");
    expect(muebles).not.toContain("toFixed(3)");
    expect(muebles).toContain("toLocaleString('es-CO'");
    // 19.222 con toFixed se leia como diecinueve mil.
    expect((19.222).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 3 })).toBe("19,222");
  });
});
