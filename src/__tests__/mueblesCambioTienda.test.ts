// Cambiar la tienda de origen de una orden ya registrada (23-09).
//
// Sirve para las que se registraron como contado antes de existir "Orden de
// tienda": al ponerles tienda recuperan su OVDM/TSDM. El endpoint se carga
// como texto (ver apoyo/nuxt.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarHandlerNuxt, cargarNuxt, h3Falso } from "./apoyo/nuxt";

const m = {
  body: vi.fn(), auth: vi.fn(), orden: vi.fn(), audit: vi.fn(),
  tienda: { findUnique: vi.fn() }, ordenes: { findFirst: vi.fn(), update: vi.fn() },
};
const handler = cargarHandlerNuxt("api/historial-muebles/[id]/tienda.post.ts", {
  h3: h3Falso({ readBody: m.body, getRouterParam: () => "o1" }),
  "../../../utils/prisma": { prisma: { maestroTiendaGourmet: m.tienda, ordenMuebles: m.ordenes } },
  "../../../utils/auth": { requireAuth: m.auth },
  "../../../utils/muebles": { auditar: m.audit, ordenPorId: m.orden, ORDEN_INCLUDE: {} },
  "../../../utils/mueblesCalc": cargarNuxt("utils/mueblesCalc.ts"),
  "../../../utils/mapRow": { mapOrdenMuebles: (o: unknown) => o },
});
const event = {} as never;
const AL109 = { codigo: "141", tienda: "AL Calle 109", ciudad: "BOGOTA", activo: true };
const datos = () => m.ordenes.update.mock.calls[0][0].data;

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "admin", role: "ADMIN" });
  m.tienda.findUnique.mockResolvedValue(AL109);
  m.ordenes.findFirst.mockResolvedValue(null);
  m.ordenes.update.mockImplementation(async ({ data }: any) => ({ id: "o1", ...data }));
  m.body.mockResolvedValue({ tiendaCodigo: "141", motivo: "Se registró como contado" });
});

describe("de contado a orden de tienda", () => {
  it("CONTADO-OVDM121831 recupera su código y su tipo, con la tienda sellada", async () => {
    m.orden.mockResolvedValue({ id: "o1", codigo: "CONTADO-OVDM121831", tipoOrden: "CONTADO", tiendaOrigenCodigo: null, tiendaOrigenNombre: null });
    await handler(event);
    expect(datos()).toMatchObject({
      codigo: "OVDM121831", tipoOrden: "OVDM", tiendaOrigenCodigo: "141", tiendaOrigenNombre: "AL Calle 109",
      motivoCorreccion: "Se registró como contado", actualizadoPorId: "admin",
    });
    // En la bitácora con el prefijo que lista el historial.
    expect(m.audit.mock.calls[0][4]).toMatch(/^Correccion en CONTADO-OVDM121831: Tienda: ninguna -> AL Calle 109; Codigo: CONTADO-OVDM121831 -> OVDM121831/);
  });

  it("un traslado sin OVDM no se convierte", async () => {
    m.orden.mockResolvedValue({ id: "o1", codigo: "CONTADO-TRASLADOALIVINGCALLE109", tipoOrden: "CONTADO", tiendaOrigenCodigo: null });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(m.ordenes.update).not.toHaveBeenCalled();
  });

  it("no duplica si la OVDM ya existe por separado", async () => {
    m.orden.mockResolvedValue({ id: "o1", codigo: "CONTADO-OVDM121831", tipoOrden: "CONTADO", tiendaOrigenCodigo: null });
    m.ordenes.findFirst.mockResolvedValue({ id: "otra" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("cambiar o quitar la tienda", () => {
  it("una orden normal solo cambia de tienda, no de código", async () => {
    m.orden.mockResolvedValue({ id: "o1", codigo: "OVDM1", tipoOrden: "OVDM", tiendaOrigenCodigo: "118", tiendaOrigenNombre: "AG Calle 109" });
    await handler(event);
    expect(datos()).toMatchObject({ tiendaOrigenCodigo: "141" });
    expect(datos()).not.toHaveProperty("codigo");
  });

  it("quitar la tienda", async () => {
    m.orden.mockResolvedValue({ id: "o1", codigo: "OVDM1", tipoOrden: "OVDM", tiendaOrigenCodigo: "141", tiendaOrigenNombre: "AL Calle 109" });
    m.body.mockResolvedValue({ tiendaCodigo: null, motivo: "No venía de tienda" });
    await handler(event);
    expect(datos()).toMatchObject({ tiendaOrigenCodigo: null, tiendaOrigenNombre: null });
  });

  it("motivo obligatorio, tienda activa y solo supervisión", async () => {
    m.orden.mockResolvedValue({ id: "o1", codigo: "OVDM1", tipoOrden: "OVDM", tiendaOrigenCodigo: null });
    m.body.mockResolvedValue({ tiendaCodigo: "141", motivo: "x" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    m.body.mockResolvedValue({ tiendaCodigo: "141", motivo: "motivo largo" });
    m.tienda.findUnique.mockResolvedValue({ ...AL109, activo: false });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    m.auth.mockResolvedValue({ id: "i", role: "INSPECCION_MUEBLES" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 });
    expect(m.ordenes.update).not.toHaveBeenCalled();
  });
});

describe("pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  it("el historial deja poner, cambiar o quitar la tienda; el buscador es compartido", () => {
    const det = leer("nuxt-app/app/components/historial-muebles/OrdenDetalle.vue");
    expect(det).toContain("/api/historial-muebles/${orden.value.id}/tienda");
    expect(det).toContain("<MueblesTiendaBuscador");
    expect(det).toContain("Quitar tienda");
    expect(leer("nuxt-app/app/components/inspeccion-muebles/TiendaModal.vue")).toContain("<MueblesTiendaBuscador");
  });
});
