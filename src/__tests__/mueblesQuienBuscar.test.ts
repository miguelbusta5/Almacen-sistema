// Inspeccion Muebles pregunta quien toma la orden al entrar, y Entrega a
// Transporte tiene buscador. Los archivos de Nuxt se leen como TEXTO.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("inspeccion muebles — quien toma la orden", () => {
  const ui = leer("nuxt-app/app/components/inspeccion-muebles/Module.vue");

  it("al abrir la orden pregunta quien la toma, sin nombre preseleccionado", () => {
    expect(ui).toContain("pidiendoQuien.value = true");
    expect(ui).toMatch(/:abierto="pidiendoQuien" :inspectores="inspectores" :seleccionado="null"/);
  });

  it("el elegido entra a la orden y despues se pide la ciudad", () => {
    const f = ui.slice(ui.indexOf("async function confirmarQuien"));
    const unirse = f.indexOf("/unirse`");
    const ciudad = f.indexOf("pidiendoCiudad.value = true");
    expect(unirse).toBeGreaterThan(0);
    expect(ciudad).toBeGreaterThan(unirse);
  });

  it("cancelar vuelve a la parrilla", () => {
    expect(ui).toMatch(/function cancelarQuien\(\) \{\s+pidiendoQuien\.value = false\s+salir\(\)/);
  });
});

describe("entrega a transporte — buscador", () => {
  it("el servidor busca por orden, cliente, ciudad o PLU", () => {
    const api = leer("nuxt-app/server/api/entrega-muebles/index.get.ts");
    expect(api).toContain("codigo: { contains: buscar, mode: 'insensitive' as const }");
    expect(api).toContain("lineas: { some: { plu: buscar } }");
  });

  it("la pantalla manda la busqueda en pendientes y entregadas", () => {
    const ui = leer("nuxt-app/app/components/entrega-muebles/Module.vue");
    expect(ui).toContain("buscar: buscar.value.trim()");
    expect(ui).toContain("Buscar entregadas por orden");
  });
});

describe("medidas por unidad de empaque", () => {
  it("una unidad ocupa y pesa lo de la caja entre lo que trae", async () => {
    const { medidaPorUnidad } = await import("@/lib/pickingMuebles");
    // SILLA X NEGRA COUNTER: caja de 4, 0,365568 m3 y 21 kg.
    expect(medidaPorUnidad(0.365568, 4, 6)).toBe(0.091392);
    expect(medidaPorUnidad(21, 4, 3)).toBe(5.25);
    // Sin unidad de empaque valida se asume 1 por caja.
    for (const n of [null, undefined, 0, -2]) expect(medidaPorUnidad(0.8448, n as number | null, 6)).toBe(0.8448);
    // PLU sin medir sigue sin medida: un cero mentiria.
    expect(medidaPorUnidad(null, 4, 6)).toBeNull();
  });

  it("el maestro de muebles reparte la caja entre sus unidades", () => {
    const f = readFileSync(path.join(process.cwd(), "nuxt-app/server/utils/maestroMuebles.ts"), "utf8");
    expect(f).toContain("medidaPorUnidad(sumar(cajas.map((c) => aNumero(c.volumenM3))), unidadesPorCaja, 6)");
    expect(f).toContain("select: { descripcion: true, unidadesPorCaja: true }");
  });
});
