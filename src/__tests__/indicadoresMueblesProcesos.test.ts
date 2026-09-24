// Indicadores de muebles por proceso (23-09): Picking | Inspección | Órdenes
// dentro del módulo único de Indicadores.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const api = leer("nuxt-app/server/api/indicadores-muebles/procesos.get.ts");
const mod = leer("nuxt-app/app/components/indicadores-muebles/Module.vue");

describe("endpoint de procesos de muebles", () => {
  it("solo supervisión del área", () => {
    expect(api).toContain("if (!esGestionMuebles(actor.role))");
  });

  it("picking solo de usuarios de picking; inspección por inspector del catálogo", () => {
    expect(api).toContain("l.horaFin && l.operario?.role === ROL_PICKING");
    expect(api).toContain("usuarioId: l.inspectorId!, dia: diaBogota(l.inspHoraFin!)");
  });

  it("periodo anterior y meta de 4 semanas, igual que almacenamiento", () => {
    expect(api).toContain("const metaVentana = { desde: diaMas(desde, -28), hasta: diaMas(desde, -1) }");
    expect(api).toContain("metaDeProceso(");
  });

  it("ebanistería por PLU y por proveedor (fabricante del maestro), con la espera", () => {
    expect(api).toContain("prisma.productoMaestro.findMany");
    expect(api).toContain("l.fabricante?.trim() || 'Sin proveedor'".replace("l.", "p."));
    expect(api).toContain("esperaMin");
  });

  it("el informe de siempre filtra por inspector", () => {
    expect(leer("nuxt-app/server/api/indicadores-muebles/index.get.ts")).toContain("...(inspectorId ? { inspectorId } : {})");
  });
});

describe("la pantalla de muebles", () => {
  it("tres pestañas: Picking, Inspección y Órdenes", () => {
    expect(mod).toContain("const pestana = ref<'picking' | 'inspeccion' | 'ordenes'>('picking')");
    for (const t of ["> Picking", "> Inspección", "> Órdenes"]) expect(mod).toContain(t);
  });

  it("cada proceso con su resumen por día, su filtro de persona y su Excel", () => {
    expect(mod).toContain('titulo-top="PLU con más demanda"');
    expect(mod).toContain('persona="inspector"');
    expect(mod).toContain('<select v-model="inspectorId"');
    expect(mod).toContain("exportarDashboard({");
  });

  it("el área Muebles vive en Indicadores y el menú tiene una sola entrada", () => {
    expect(leer("nuxt-app/app/layouts/default.vue")).not.toContain("'Indicadores Muebles'");
    expect(leer("src/components/common/Sidebar.tsx")).not.toContain('label: "Indicadores Muebles"');
    expect(leer("src/config/homeActions.ts")).toContain('href: "/dashboard/indicadores?area=muebles"');
  });
});
