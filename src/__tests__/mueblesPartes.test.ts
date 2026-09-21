// Aviso de PLU que viene en varias cajas: en Picking al escanear y en
// Inspeccion al iniciar, mas la confirmacion de cajas al darlo por listo.
//
// Los archivos de Nuxt se leen como TEXTO: en CI no estan sus dependencias.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("de dónde sale el número de cajas", () => {
  const api = leer("nuxt-app/server/api/muebles/plu-cajas.get.ts");

  it("sale del maestro de medidas, no de lo sellado en la linea", () => {
    expect(api).toContain("prisma.medidaCajaMaster.findMany");
    expect(api).toContain("orderBy: { parte: 'asc' }");
  });

  it("lo piden picking e inspeccion, nadie mas", () => {
    expect(api).toContain("!puedePickear(actor.role) && !puedeInspeccionar(actor.role)");
    expect(api).toContain("statusCode: 403");
  });
});

describe("picking — aviso al escanear el PLU", () => {
  const ui = leer("nuxt-app/app/components/picking-muebles/CapturaPlu.vue");

  it("el aviso tapa la pantalla y hay que confirmarlo", () => {
    expect(ui).toContain("MueblesPartesModal");
    expect(ui).toContain('@entendido="entendidoPartes"');
    // Mientras el aviso esta abierto, la ubicacion no toma el foco.
    expect(ui).toContain("if (!avisa) inputUbicacion.value?.focus()");
  });

  it("un PLU de una sola caja no avisa, y uno sin medir tampoco", () => {
    expect(ui).toContain("if ((linea.partes ?? 0) < MINIMO_PARTES_AVISO) return false");
    expect(ui).toContain("if (cajas.length < MINIMO_PARTES_AVISO) return false");
  });

  it("el aviso no se queda pegado al pasar al siguiente PLU", () => {
    expect(ui).toContain("avisoPartes.value = false");
  });
});

describe("inspeccion — aviso al iniciar y cajas al terminar", () => {
  const ui = leer("nuxt-app/app/components/inspeccion-muebles/Module.vue");

  it("avisa al iniciar el PLU", () => {
    expect(ui).toContain("await avisarPartes(l)");
    expect(ui).toContain("MueblesPartesModal");
  });

  it("al darlo por listo pregunta si estaban todas", () => {
    expect(ui).toContain("if ((l.partes ?? 0) >= MINIMO_PARTES_AVISO) {");
    expect(ui).toContain("lineaCajas.value = l");
    expect(ui).toContain("InspeccionMueblesCajasCompletasModal");
  });

  it("si falta una caja: se reporta a picking y el PLU queda revisado", () => {
    const f = ui.slice(ui.indexOf("async function cajasFaltantes"));
    const reporte = f.indexOf("/pendientes`");
    const cierre = f.indexOf("await completarLinea(l)");
    expect(reporte).toBeGreaterThan(0);
    expect(cierre).toBeGreaterThan(reporte);
    expect(f).toContain("Faltaron ${datos.cajas} de ${total} cajas del PLU");
  });
});

describe("la ventana del aviso", () => {
  const modal = leer("nuxt-app/app/components/muebles/PartesModal.vue");

  it("dice cuantas cajas son y la medida de cada una", () => {
    expect(modal).toContain("Este PLU viene en {{ cajas.length }} cajas");
    expect(modal).toContain("Caja {{ c.parte }}");
    expect(modal).toContain("fmtKg(c.pesoBrutoKg)");
  });

  it("no se cierra tocando por fuera: hay que confirmarla", () => {
    expect(modal).not.toContain("click.self");
    expect(modal).toContain("role=\"alertdialog\"");
  });
});
