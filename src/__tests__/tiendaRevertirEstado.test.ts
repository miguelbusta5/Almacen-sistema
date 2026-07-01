import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  despachoFindUnique: vi.fn(),
  despachoUpdate: vi.fn(),
  historialFindFirst: vi.fn(),
  historialCreate: vi.fn(),
  userFindMany: vi.fn(),
  notificacionCreateMany: vi.fn(),
  activityLogCreate: vi.fn(),
  transaction: vi.fn(),
}));

// Mismo motivo que en cargueGourmetApi.test.ts: @/lib/authz importa next-auth,
// que no resuelve "next/server" como subpath de ESM en este entorno de test.
vi.mock("@/lib/authz", () => ({
  requireAuth: async () => {
    const user = await mocks.getSessionUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    return user;
  },
  requireRole: async (roles: string[]) => {
    const user = await mocks.getSessionUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (!roles.includes(user.role)) {
      return NextResponse.json({ error: "No tienes permisos para realizar esta acción" }, { status: 403 });
    }
    return user;
  },
  requireCan: async () => {
    const user = await mocks.getSessionUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    return user;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    despachoTienda: {
      findUnique: mocks.despachoFindUnique,
      update: mocks.despachoUpdate,
    },
    historialDespacho: {
      findFirst: mocks.historialFindFirst,
      create: mocks.historialCreate,
    },
    user: { findMany: mocks.userFindMany },
    notificacion: { createMany: mocks.notificacionCreateMany },
    activityLog: { create: mocks.activityLogCreate },
    $transaction: mocks.transaction,
  },
}));

import { POST as postRevertirEstado } from "@/app/api/tienda/[id]/revertir-estado/route";

function actor(role: string) {
  return { id: "u_admin", email: "admin@test.com", name: "Admin Test", role };
}

function revertirEstadoReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/tienda/${id}/revertir-estado`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const REVERTIR_UPDATED_AT = new Date("2026-06-24T14:00:00.000Z");
const validBody = { updatedAt: REVERTIR_UPDATED_AT.toISOString() };
const params = { params: Promise.resolve({ id: "d1" }) };

function mockDespacho(estado: string, overrides: Partial<Record<string, unknown>> = {}) {
  mocks.despachoFindUnique.mockResolvedValue({
    id: "d1",
    estado,
    updatedAt: REVERTIR_UPDATED_AT,
    numeroDocumento: "FAC-0001",
    creadoPorId: "u_tienda",
    guardadoPendiente: null,
    ...overrides,
  });
}

function mockUpdateResultado(estado: string) {
  mocks.despachoUpdate.mockResolvedValue({
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
    recibidoAt: null,
    entregadoCediAt: null,
    despachadoAt: null,
    novedadAt: null,
    rechazadoAt: null,
    motivoRechazo: null,
    notaEntrega: null,
    guardadoPendiente: null,
    direccionEntrega: null, barrio: null, ciudad: null, departamento: null, latitud: null, longitud: null,
    contactoEntrega: null, telefonoEntrega: null,
    fotoRecogidaUrl: null, fotoCediUrl: null, recibidoPorCedi: null, observacionEntrega: null,
    fechaEntregaReal: null, novedad: null,
    creadoPorId: "u_tienda", creadoPor: { id: "u_tienda", name: "Usuario Tienda" },
    createdAt: new Date("2026-06-20"), updatedAt: new Date(), plines: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activityLogCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  mocks.historialCreate.mockResolvedValue({});
  mocks.userFindMany.mockResolvedValue([]);
  mocks.notificacionCreateMany.mockResolvedValue({ count: 0 });
});

describe("POST /api/tienda/[id]/revertir-estado", () => {
  it.each(["ADMIN", "GERENTE"])("%s puede revertir RECOGIDO_TIENDA a CREADO_TIENDA", async (role) => {
    mocks.getSessionUser.mockResolvedValue(actor(role));
    mockDespacho("RECOGIDO_TIENDA");
    mocks.historialFindFirst.mockResolvedValue({ estadoAnterior: "CREADO_TIENDA" });
    mockUpdateResultado("CREADO_TIENDA");

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.estado).toBe("CREADO_TIENDA");
    expect(mocks.despachoUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ estado: "CREADO_TIENDA", recibidoAt: null })
    );
    expect(mocks.despachoUpdate.mock.calls[0][0].where).toEqual({ id: "d1", updatedAt: REVERTIR_UPDATED_AT });
  });

  it("revierte CON_NOVEDAD a su origen real (ENTREGADO_CEDI) usando el último historial, no un mapa fijo", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("CON_NOVEDAD");
    mocks.historialFindFirst.mockResolvedValue({ estadoAnterior: "ENTREGADO_CEDI" });
    mockUpdateResultado("ENTREGADO_CEDI");

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.estado).toBe("ENTREGADO_CEDI");
    expect(mocks.despachoUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ estado: "ENTREGADO_CEDI", novedadAt: null })
    );
  });

  it.each(["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "TRANSPORTE"])("%s no puede revertir (403)", async (role) => {
    mocks.getSessionUser.mockResolvedValue(actor(role));

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    expect(res.status).toBe(403);
    expect(mocks.despachoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si el despacho no existe (404)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mocks.despachoFindUnique.mockResolvedValue(null);

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    expect(res.status).toBe(404);
  });

  it("rechaza si el despacho ya está en CREADO_TIENDA — nada que revertir (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("CREADO_TIENDA");

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("SIN_HISTORIAL");
    expect(mocks.historialFindFirst).not.toHaveBeenCalled();
  });

  it("rechaza si el despacho tiene un guardado de transporte asociado (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("ENTREGADO_CEDI", { guardadoPendiente: { id: "gp1" } });

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("GUARDADO_ASOCIADO");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si no hay historial de estados (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("RECOGIDO_TIENDA");
    mocks.historialFindFirst.mockResolvedValue(null);

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("SIN_HISTORIAL");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt fue modificado por otro usuario (409 CONFLICT)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("RECOGIDO_TIENDA");
    mocks.historialFindFirst.mockResolvedValue({ estadoAnterior: "CREADO_TIENDA" });
    mocks.transaction.mockRejectedValue(Object.assign(new Error("conflict"), { code: "P2025" }));

    const res = await postRevertirEstado(revertirEstadoReq("d1", validBody), params);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("CONFLICT");
  });

  it("registra la acción en activityLog", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("RECOGIDO_TIENDA");
    mocks.historialFindFirst.mockResolvedValue({ estadoAnterior: "CREADO_TIENDA" });
    mockUpdateResultado("CREADO_TIENDA");

    await postRevertirEstado(revertirEstadoReq("d1", validBody), params);

    expect(mocks.activityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPDATE", module: "tienda", recordId: "d1" }),
      })
    );
  });

  it("crea historial de la reversión con estadoAnterior/estadoNuevo correctos", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("RECOGIDO_TIENDA");
    mocks.historialFindFirst.mockResolvedValue({ estadoAnterior: "CREADO_TIENDA" });
    mockUpdateResultado("CREADO_TIENDA");

    await postRevertirEstado(revertirEstadoReq("d1", validBody), params);

    expect(mocks.historialCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        despachoId: "d1",
        estadoAnterior: "RECOGIDO_TIENDA",
        estadoNuevo: "CREADO_TIENDA",
        usuarioId: "u_admin",
      }),
    });
  });

  it("notifica al creador del despacho y a ADMIN/GERENTE activos, sin notificarse a sí mismo", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockDespacho("RECOGIDO_TIENDA", { creadoPorId: "u_tienda" });
    mocks.historialFindFirst.mockResolvedValue({ estadoAnterior: "CREADO_TIENDA" });
    mockUpdateResultado("CREADO_TIENDA");
    mocks.userFindMany.mockResolvedValue([{ id: "u_admin" }, { id: "u_gerente" }]);

    await postRevertirEstado(revertirEstadoReq("d1", validBody), params);

    expect(mocks.notificacionCreateMany).toHaveBeenCalled();
    const destinatarios = mocks.notificacionCreateMany.mock.calls[0][0].data.map((n: { userId: string }) => n.userId);
    expect(destinatarios).toEqual(expect.arrayContaining(["u_tienda", "u_gerente"]));
    expect(destinatarios).not.toContain("u_admin");
  });
});
