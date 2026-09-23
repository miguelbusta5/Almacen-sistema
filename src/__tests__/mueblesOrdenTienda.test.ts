// Orden de tienda en Inspección Muebles (23-09).
//
// La mercancía que llega de una tienda tiene su OVDM/TSDM de NetSuite y NO es
// contado: hasta hoy se metía como "CONTADO-OVDM121831" porque no había otra
// opción. El endpoint se carga como texto (ver apoyo/nuxt.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarHandlerNuxt, cargarNuxt, h3Falso } from "./apoyo/nuxt";

const mueblesCalc = cargarNuxt("utils/mueblesCalc.ts");
const m = {
  body: vi.fn(), actor: vi.fn(), audit: vi.fn(), tx: vi.fn(),
  inspector: { findFirst: vi.fn() }, tienda: { findUnique: vi.fn() }, orden: { findFirst: vi.fn() },
  crear: vi.fn(), unir: vi.fn(), leer: vi.fn(),
};
const handler = cargarHandlerNuxt("api/inspeccion-muebles/tienda.post.ts", {
  h3: h3Falso({ readBody: m.body }),
  "../../utils/prisma": { prisma: {
    inspector: m.inspector, maestroTiendaGourmet: m.tienda, ordenMuebles: m.orden, $transaction: m.tx,
  } },
  "../../utils/muebles": { auditar: m.audit, ORDEN_INCLUDE: {}, requireInspeccion: m.actor },
  "../../utils/mueblesCalc": mueblesCalc,
  "../../utils/exportacionesCalc": { todayBogota: () => new Date("2026-09-23T00:00:00Z") },
  "../../utils/mapRow": { mapOrdenMuebles: (o: unknown) => o },
});
const event = {} as never;

beforeEach(() => {
  vi.resetAllMocks();
  m.actor.mockResolvedValue({ id: "u-insp" });
  m.body.mockResolvedValue({ inspectorId: "i1", orden: " ovdm 121831 ", tiendaCodigo: "141", cliente: " Catalina " });
  m.inspector.findFirst.mockResolvedValue({ id: "i1", nombre: "DIEGO" });
  m.tienda.findUnique.mockResolvedValue({ codigo: "141", tienda: "AL Calle 109", ciudad: "BOGOTA", activo: true });
  m.orden.findFirst.mockResolvedValue(null);
  m.crear.mockResolvedValue({ id: "o1" });
  m.leer.mockResolvedValue({ id: "o1", codigo: "OVDM121831" });
  m.tx.mockImplementation((cb: any) => cb({
    ordenMuebles: { create: m.crear, findUniqueOrThrow: m.leer },
    inspectorOrdenMuebles: { create: m.unir },
  }));
});

describe("crear una orden de tienda", () => {
  it("nace en inspección con su OVDM, sin prefijo CONTADO y con la tienda sellada", async () => {
    await handler(event);
    const data = m.crear.mock.calls[0][0].data;
    expect(data).toMatchObject({
      codigo: "OVDM121831", tipoOrden: "OVDM", estado: "EN_INSPECCION",
      tiendaOrigenCodigo: "141", tiendaOrigenNombre: "AL Calle 109", cliente: "Catalina", inspectorId: "i1",
    });
    // Sin picking en el CEDI: el reloj de picking nace y muere a la vez.
    expect(data.horaInicio).toBe(data.horaPasoInspeccion);
    expect(m.unir).toHaveBeenCalledWith({ data: { ordenId: "o1", inspectorId: "i1" } });
    expect(m.audit).toHaveBeenCalledOnce();
  });

  it("una TSDM queda como TSDM", async () => {
    m.body.mockResolvedValue({ inspectorId: "i1", orden: "TSDM104350", tiendaCodigo: "141" });
    await handler(event);
    expect(m.crear.mock.calls[0][0].data).toMatchObject({ codigo: "TSDM104350", tipoOrden: "TSDM", cliente: null });
  });

  it("exige una OVDM o TSDM: un traslado o una factura no pasan", async () => {
    for (const orden of ["TRASLADOALIVINGCALLE109", "1147395", "CONTADO-OVDM1"]) {
      m.body.mockResolvedValue({ inspectorId: "i1", orden, tiendaCodigo: "141" });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("la tienda tiene que existir y estar activa", async () => {
    m.tienda.findUnique.mockResolvedValue(null);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    m.tienda.findUnique.mockResolvedValue({ codigo: "141", tienda: "X", activo: false });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("la misma orden no puede estar dos veces", async () => {
    m.orden.findFirst.mockResolvedValue({ estado: "ENTREGADA_TRANSPORTE" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 409 });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("inspector inexistente", async () => {
    m.inspector.findFirst.mockResolvedValue(null);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("pantalla, esquema y analítica", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

  it("el botón vive en Inspección, junto al de contado", () => {
    const mod = leer("nuxt-app/app/components/inspeccion-muebles/Module.vue");
    expect(mod).toContain("<Store :size=\"14\" /> Orden de tienda");
    expect(mod).toContain("<InspeccionMueblesTiendaModal");
    expect(mod).toContain("`${API_INSPECCION}/tienda`");
  });

  it("el cliente valida con la misma regla que el servidor", () => {
    const cliente = leer("nuxt-app/app/utils/muebles.ts");
    const servidor = leer("nuxt-app/server/utils/mueblesCalc.ts");
    const re = "/^(TSDM|OVDM)[-]?\\d{3,}$/";
    expect(cliente).toContain(re);
    expect(servidor).toContain(re);
  });

  it("columna aditiva en los dos schemas y SQL idempotente", () => {
    for (const f of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(f)).toContain('tiendaOrigenNombre String? @map("tienda_origen_nombre")');
    }
    const sql = leer("prisma/migrate-ordenes-muebles-tienda-origen.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS tienda_origen_codigo VARCHAR(50)");
    expect(sql).not.toMatch(/NOT NULL|UPDATE /);
  });

  it("la analítica la mide como su propio tipo", () => {
    expect(leer("nuxt-app/server/api/indicadores-muebles/analitica.get.ts"))
      .toContain("tipoOrden: o.tiendaOrigenCodigo ? 'TIENDA' : o.tipoOrden");
    expect(leer("nuxt-app/app/utils/mueblesAnalitica.ts")).toContain("TIENDA: 'De tienda'");
  });
});
