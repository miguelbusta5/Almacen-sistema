// Alertas de lo que lleva abierto demasiado tiempo (25-09).
// El calculo vive en nuxt-app sin gemelo en src/lib: se carga con cargarNuxt.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const { alertasAbiertas, esGestionAlertas, LIMITES_ABIERTO_MIN } = cargarNuxt("utils/alertasAbiertasCalc.ts");
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const ahora = new Date("2026-09-25T20:00:00Z");
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000);
const reg = (o: Partial<any>) => ({
  tipo: "montacargas", id: "m1", titulo: "PLU 100", detalle: null, desde: hace(50),
  duenoId: "op1", modulo: "control-montacargas", enlace: "/dashboard/control-montacargas", ...o,
});
const todo = () => true;

describe("alertas de registros abiertos", () => {
  it("solo lo que pasa su limite", () => {
    const r = alertasAbiertas([reg({ desde: hace(44) }), reg({ id: "m2", desde: hace(45) })], ahora, { id: "sup", role: "ADMIN" }, todo);
    expect(r.map((a: any) => a.id)).toEqual(["m2"]);
    expect(r[0]).toMatchObject({ minutos: 45, limite: LIMITES_ABIERTO_MIN.montacargas, etiqueta: "PLU de montacargas abierto" });
  });

  it("supervision ve lo de sus modulos; los demas, solo lo suyo", () => {
    const regs = [reg({ id: "a", duenoId: "op1" }), reg({ id: "b", duenoId: "op2" })];
    expect(alertasAbiertas(regs, ahora, { id: "op1", role: "MONTACARGUISTA" }, todo).map((a: any) => a.id)).toEqual(["a"]);
    expect(alertasAbiertas(regs, ahora, { id: "x", role: "SUPERVISOR_ALMACENAMIENTO" }, todo)).toHaveLength(2);
    // Supervision de un modulo que no ve: nada (salvo lo suyo).
    expect(alertasAbiertas(regs, ahora, { id: "x", role: "SUPERVISOR_TIENDA" }, () => false)).toHaveLength(0);
    expect(esGestionAlertas("GERENTE")).toBe(true);
    expect(esGestionAlertas("PICKING_MUEBLES")).toBe(false);
  });

  it("primero lo mas pasado de su limite, en proporcion", () => {
    const r = alertasAbiertas([
      reg({ id: "cont", tipo: "recepcion", desde: hace(7 * 60) }), // 7 h de 6 h = 1,17
      reg({ id: "plu", desde: hace(120) }), // 2 h de 45 min = 2,7
    ], ahora, { id: "sup", role: "ADMIN" }, todo);
    expect(r.map((a: any) => a.id)).toEqual(["plu", "cont"]);
  });

  it("el endpoint pide sesion, filtra en la base por el limite y la barra lo muestra", () => {
    const api = leer("nuxt-app/server/api/alertas/abiertas.get.ts");
    expect(api).toContain("await requireAuth(event)");
    expect(api).toContain("horaInicio: { lte: antes(L.recepcion) }");
    expect(api).toContain("transferidaAId: null");
    const layout = leer("nuxt-app/app/layouts/default.vue");
    expect(layout).toContain("$fetch<{ data: Abierto[] }>('/api/alertas/abiertas')");
    expect(layout).toContain("void cargarAvisos(); void cargarAbiertos()");
    expect(layout).toContain('class="alerta alerta-abierto"');
  });
});
