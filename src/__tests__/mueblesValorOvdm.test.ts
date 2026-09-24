// Valor movido en OVDM (24-09): lo que se mueve día a día a precio de venta
// del maestro (hoja MAESTRA del archivo de medición), sin facturas de contado
// ni órdenes de tienda.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const api = leer("nuxt-app/server/api/indicadores-muebles/procesos.get.ts");
const mod = leer("nuxt-app/app/components/indicadores-muebles/Module.vue");

describe("valor movido en OVDM", () => {
  it("solo OVDM: sin contado (tipo CONTADO) ni órdenes de tienda", () => {
    expect(api).toContain("orden: { deletedAt: null, tipoOrden: 'OVDM', tiendaOrigenCodigo: null }");
  });
  it("unidades x precio de venta del maestro, por día de picking", () => {
    expect(api).toContain("d.valor += (precio ?? 0) * l.unidades");
    expect(api).toContain("const dia = diaBogota(l.horaFin!)");
    expect(api).toContain("select: { plu: true, precio: true }");
  });
  it("promedio sobre los días con OVDM y comparación con el periodo anterior", () => {
    expect(api).toContain("porDia: porDia.length ? Math.round(total / porDia.length) : null");
    expect(mod).toContain("cambio: variacion(v.porDia, v.anterior.porDia)");
  });
  it("la tarjeta avisa los PLU sin precio y se exporta a Excel", () => {
    expect(mod).toContain('titulo="Valor movido en OVDM"');
    expect(mod).toContain("PLU sin precio en el maestro no suman");
    expect(mod).toContain("{ nombre: 'Valor OVDM por día', columnas: colsValor, filas: filasValor.value }");
  });
});
