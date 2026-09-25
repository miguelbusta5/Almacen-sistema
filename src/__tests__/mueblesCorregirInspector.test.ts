// Inspección Muebles (25-09): corregir a nombre de quién quedó un PLU.
//
// Las PCs se comparten y el PLU a veces queda a nombre de otro inspector. Solo
// supervisión lo corrige, con motivo; sirve para el PLU en curso y el ya listo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarHandlerNuxt, cargarNuxt, h3Falso } from "./apoyo/nuxt";

const calc = cargarNuxt("utils/mueblesCalc.ts");
const m = {
  body: vi.fn(), actor: vi.fn(), orden: vi.fn(), audit: vi.fn(), tx: vi.fn(),
  inspector: { findFirst: vi.fn() }, update: vi.fn(), upsert: vi.fn(), leer: vi.fn(),
};
const handler = cargarHandlerNuxt("api/inspeccion-muebles/[id]/linea/[lineaId]/inspector.post.ts", {
  h3: h3Falso({ readBody: m.body, getRouterParam: (_e: unknown, k: string) => (k === "id" ? "o1" : "l1") }),
  "../../../../../utils/prisma": { prisma: { inspector: m.inspector, $transaction: m.tx } },
  "../../../../../utils/muebles": { auditar: m.audit, ordenPorId: m.orden, ORDEN_INCLUDE: {}, requireInspeccion: m.actor },
  "../../../../../utils/mueblesCalc": calc,
  "../../../../../utils/mapRow": { mapOrdenMuebles: (o: unknown) => o },
});
const event = {} as never;
let linea: any;

beforeEach(() => {
  vi.resetAllMocks();
  linea = { id: "l1", plu: "26279", estado: "LISTO", inspector: { id: "i1", nombre: "DIEGO" } };
  m.actor.mockResolvedValue({ id: "u", role: "ADMIN" });
  m.body.mockResolvedValue({ inspectorId: "i2", motivo: "Lo hizo Laura en la PC de Diego" });
  m.orden.mockImplementation(async () => ({ id: "o1", codigo: "OVDM1", lineas: [linea] }));
  m.inspector.findFirst.mockResolvedValue({ id: "i2", nombre: "LAURA" });
  m.leer.mockResolvedValue({ id: "o1" });
  m.tx.mockImplementation((cb: any) => cb({
    lineaMuebles: { update: m.update },
    inspectorOrdenMuebles: { upsert: m.upsert },
    ordenMuebles: { findUniqueOrThrow: m.leer },
  }));
});

describe("corregir el inspector de un PLU", () => {
  it("cambia el inspector del PLU (relojes intactos), lo suma a la orden y deja auditoría", async () => {
    await handler(event);
    expect(m.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { inspectorId: "i2" } });
    expect(m.upsert.mock.calls[0][0].where).toEqual({ ordenId_inspectorId: { ordenId: "o1", inspectorId: "i2" } });
    expect(m.audit.mock.calls[0][4]).toContain("PLU 26279: inspector DIEGO -> LAURA. Motivo: Lo hizo Laura");
  });

  it("también el PLU que sigue en inspección o en ebanistería", async () => {
    for (const estado of ["EN_INSPECCION", "EN_EBANISTERIA"]) {
      linea.estado = estado;
      await handler(event);
    }
    expect(m.update).toHaveBeenCalledTimes(2);
  });

  it("solo supervisión: el login de inspección no puede", async () => {
    m.actor.mockResolvedValue({ id: "u", role: "INSPECCION_MUEBLES" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 });
    for (const role of ["GERENTE", "SUPERVISOR_ALMACENAMIENTO"]) {
      m.actor.mockResolvedValue({ id: "u", role });
      await handler(event);
    }
    expect(m.update).toHaveBeenCalledTimes(2);
  });

  it("motivo obligatorio, un PLU sin inspección no se corrige y no se «corrige» al mismo", async () => {
    m.body.mockResolvedValue({ inspectorId: "i2", motivo: "  ok " });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    m.body.mockResolvedValue({ inspectorId: "i1", motivo: "motivo largo" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    linea.estado = "PICKEADA";
    m.body.mockResolvedValue({ inspectorId: "i2", motivo: "motivo largo" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(m.update).not.toHaveBeenCalled();
  });

  it("inspector inexistente o inactivo", async () => {
    m.inspector.findFirst.mockResolvedValue(null);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(m.inspector.findFirst.mock.calls[0][0].where).toEqual({ id: "i2", activo: true });
  });
});

describe("pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  it("botón por PLU solo para supervisión y en PLU con inspección; ventana con motivo", () => {
    const det = leer("nuxt-app/app/components/inspeccion-muebles/OrdenDetalle.vue");
    expect(det).toContain('v-if="esGestion && conInspector(l)"');
    expect(det).toContain("l.estado === 'EN_INSPECCION' || l.estado === 'EN_EBANISTERIA' || l.estado === 'LISTO'");
    const mod = leer("nuxt-app/app/components/inspeccion-muebles/Module.vue");
    expect(mod).toContain("const esGestion = computed(() => esGestionMuebles(me.value?.role))");
    expect(mod).toContain("/linea/${l.id}/inspector`");
    const modal = leer("nuxt-app/app/components/inspeccion-muebles/CorregirInspectorModal.vue");
    expect(modal).toContain("motivo.value.trim().length >= 5");
  });
});
