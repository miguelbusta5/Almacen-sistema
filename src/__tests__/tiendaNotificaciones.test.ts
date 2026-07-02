import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Fase 6 (mejora Facturas Contado): notificaciones persistentes por evento.
// Matriz: creación → SUPERVISOR_TRANSPORTE/GERENTE/ADMIN · guardado → operario
// asignado · CON_NOVEDAD → creador + SUPERVISOR_TIENDA · ENVIADO_CLIENTE →
// creador. Siempre se excluye al actor. Mismo esquema de mocks que
// tiendaRevertirEstado.test.ts.

const { mocks, prismaMock } = vi.hoisted(() => {
  const mocks = {
    getSessionUser: vi.fn(),
    despachoFindUnique: vi.fn(),
    despachoUpdate: vi.fn(),
    despachoCreate: vi.fn(),
    historialCreate: vi.fn(),
    userFindMany: vi.fn(),
    userFindUnique: vi.fn(),
    notificacionCreate: vi.fn(),
    notificacionCreateMany: vi.fn(),
    activityLogCreate: vi.fn(),
    guardadoUpsert: vi.fn(),
    plinCreateMany: vi.fn(),
    productoFindMany: vi.fn(),
    transaction: vi.fn(),
  };
  const prismaMock = {
    despachoTienda: {
      findUnique: mocks.despachoFindUnique,
      update: mocks.despachoUpdate,
      create: mocks.despachoCreate,
    },
    historialDespacho: { create: mocks.historialCreate },
    user: { findMany: mocks.userFindMany, findUnique: mocks.userFindUnique },
    notificacion: { create: mocks.notificacionCreate, createMany: mocks.notificacionCreateMany },
    activityLog: { create: mocks.activityLogCreate },
    guardadoPendienteTienda: { upsert: mocks.guardadoUpsert },
    plinDespacho: { createMany: mocks.plinCreateMany },
    productoMaestro: { findMany: mocks.productoFindMany },
    $transaction: mocks.transaction,
  };
  return { mocks, prismaMock };
});

vi.mock("@/lib/authz", () => ({
  requireAuth: async () => {
    const user = await mocks.getSessionUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    return user;
  },
  requireCan: async () => {
    const user = await mocks.getSessionUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    return user;
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { PUT as putDespacho } from "@/app/api/tienda/[id]/route";
import { POST as postDespacho } from "@/app/api/tienda/route";
import { POST as postGuardado } from "@/app/api/tienda/[id]/guardado/route";

const params = { params: Promise.resolve({ id: "d1" }) };

function actor(role: string, id = "u_actor") {
  return { id, email: "actor@test.com", name: "Actor Test", role };
}

function req(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// Fila completa para mapRow (mismos campos que tiendaRevertirEstado.test.ts).
function fullRow(estado: string) {
  return {
    id: "d1",
    centroCostos: "CC-01",
    numeroDocumento: "FAC-0001",
    consecutivo: "001",
    clienteNombre: "Cliente Test",
    clienteDocumento: null,
    clienteTelefono: null,
    estado,
    fechaCreacion: new Date("2026-06-20"),
    fechaEntregaComprometida: null,
    numeroCajas: null,
    netsuiteId: null,
    recibidoAt: null, entregadoCediAt: null, despachadoAt: null,
    novedadAt: null, rechazadoAt: null, motivoRechazo: null, notaEntrega: null,
    guardadoPendiente: null,
    direccionEntrega: null, barrio: null, ciudad: null, departamento: null, latitud: null, longitud: null,
    contactoEntrega: null, telefonoEntrega: null,
    fotoRecogidaUrl: null, fotoCediUrl: null, recibidoPorCedi: null, observacionEntrega: null,
    fechaEntregaReal: null, novedad: null,
    creadoPorId: "u_tienda", creadoPor: { id: "u_tienda", name: "Usuario Tienda" },
    createdAt: new Date("2026-06-20"), updatedAt: new Date(), plines: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activityLogCreate.mockResolvedValue({});
  mocks.historialCreate.mockResolvedValue({});
  mocks.userFindMany.mockResolvedValue([]);
  mocks.notificacionCreate.mockResolvedValue({});
  mocks.notificacionCreateMany.mockResolvedValue({ count: 0 });
  // Soporta las dos formas: array de promesas (PUT) y callback (POST create).
  mocks.transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("PUT /api/tienda/[id] — notificación CON_NOVEDAD", () => {
  it("notifica al creador y a SUPERVISOR_TIENDA activos, excluyendo al actor", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mocks.despachoFindUnique.mockResolvedValue({ estado: "CREADO_TIENDA", updatedAt: new Date(), creadoPorId: "u_tienda", numeroDocumento: "FAC-0001" });
    mocks.despachoUpdate.mockResolvedValue(fullRow("CON_NOVEDAD"));
    mocks.userFindMany.mockResolvedValue([{ id: "u_suptienda" }, { id: "u_actor" }]);

    const res = await putDespacho(req("/api/tienda/d1", { estado: "CON_NOVEDAD", novedad: "Caja dañada en bodega" }), params);
    expect(res.status).toBe(200);

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { in: ["SUPERVISOR_TIENDA"] } }) }),
    );
    expect(mocks.notificacionCreateMany).toHaveBeenCalled();
    const notifs = mocks.notificacionCreateMany.mock.calls[0][0].data as Array<{ userId: string; titulo: string; tipo: string }>;
    const destinatarios = notifs.map((n) => n.userId);
    expect(destinatarios).toEqual(expect.arrayContaining(["u_tienda", "u_suptienda"]));
    expect(destinatarios).not.toContain("u_actor");
    expect(notifs[0].titulo).toBe("Novedad registrada en factura");
    expect(notifs[0].tipo).toBe("TIENDA");
  });

  it("no notifica si el estado no cambia realmente", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mocks.despachoFindUnique.mockResolvedValue({ estado: "CON_NOVEDAD", updatedAt: new Date(), creadoPorId: "u_tienda", numeroDocumento: "FAC-0001" });
    mocks.despachoUpdate.mockResolvedValue(fullRow("CON_NOVEDAD"));

    const res = await putDespacho(req("/api/tienda/d1", { estado: "CON_NOVEDAD", novedad: "Sigue igual" }), params);
    expect(res.status).toBe(200);
    expect(mocks.notificacionCreateMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/tienda/[id] — notificación ENVIADO_CLIENTE", () => {
  it("notifica al creador el cierre del ciclo", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mocks.despachoFindUnique.mockResolvedValue({ estado: "ENTREGADO_CEDI", updatedAt: new Date(), creadoPorId: "u_tienda", numeroDocumento: "FAC-0001" });
    mocks.despachoUpdate.mockResolvedValue(fullRow("ENVIADO_CLIENTE"));

    const res = await putDespacho(req("/api/tienda/d1", { estado: "ENVIADO_CLIENTE" }), params);
    expect(res.status).toBe(200);

    expect(mocks.notificacionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u_tienda",
        titulo: "Factura enviada al cliente",
        tipo: "TIENDA",
        enlace: "/dashboard/tienda",
      }),
    });
  });

  it("no se notifica a sí mismo si el actor es el creador", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("GERENTE", "u_tienda"));
    mocks.despachoFindUnique.mockResolvedValue({ estado: "ENTREGADO_CEDI", updatedAt: new Date(), creadoPorId: "u_tienda", numeroDocumento: "FAC-0001" });
    mocks.despachoUpdate.mockResolvedValue(fullRow("ENVIADO_CLIENTE"));

    const res = await putDespacho(req("/api/tienda/d1", { estado: "ENVIADO_CLIENTE" }), params);
    expect(res.status).toBe(200);
    expect(mocks.notificacionCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/tienda — notificación de factura creada", () => {
  it("notifica a SUPERVISOR_TRANSPORTE/GERENTE/ADMIN activos, excluyendo al actor", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TIENDA"));
    mocks.despachoCreate.mockResolvedValue(fullRow("CREADO_TIENDA"));
    mocks.despachoFindUnique.mockResolvedValue(fullRow("CREADO_TIENDA"));
    mocks.userFindMany.mockResolvedValue([{ id: "u_sup_transporte" }, { id: "u_gerente" }, { id: "u_actor" }]);

    const res = await postDespacho(req("/api/tienda", {
      centroCostos: "CC-01", numeroDocumento: "FAC-0001", consecutivo: "001", clienteNombre: "Cliente Test",
    }));
    expect(res.status).toBe(201);

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, role: { in: ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"] } }),
      }),
    );
    expect(mocks.notificacionCreateMany).toHaveBeenCalled();
    const notifs = mocks.notificacionCreateMany.mock.calls[0][0].data as Array<{ userId: string; titulo: string }>;
    const destinatarios = notifs.map((n) => n.userId);
    expect(destinatarios).toEqual(expect.arrayContaining(["u_sup_transporte", "u_gerente"]));
    expect(destinatarios).not.toContain("u_actor");
    expect(notifs[0].titulo).toBe("Nueva factura contado pendiente de recogida");
  });
});

describe("POST /api/tienda/[id]/guardado — notificación al operario", () => {
  it("notifica al operario asignado con enlace a Guardados (transporte)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mocks.despachoFindUnique.mockResolvedValue({ id: "d1", estado: "ENTREGADO_CEDI", numeroDocumento: "FAC-0001", clienteNombre: "Cliente Test" });
    mocks.userFindUnique.mockResolvedValue({ id: "cjld2cjxh0000qzrmn831i7rn", role: "TRANSPORTE", active: true, name: "Operario" });
    mocks.guardadoUpsert.mockResolvedValue({
      id: "gp1", despachoId: "d1", asignadoAId: "cjld2cjxh0000qzrmn831i7rn", estado: "PENDIENTE",
      nota: null, createdAt: new Date(), asignadoA: { id: "cjld2cjxh0000qzrmn831i7rn", name: "Operario", email: "op@test.com" },
    });

    const res = await postGuardado(req("/api/tienda/d1/guardado", { asignadoAId: "cjld2cjxh0000qzrmn831i7rn" }), params);
    expect(res.status).toBe(200);

    expect(mocks.notificacionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "cjld2cjxh0000qzrmn831i7rn",
        titulo: "Te asignaron un guardado",
        tipo: "TIENDA",
        enlace: "/dashboard/transporte",
      }),
    });
  });
});
