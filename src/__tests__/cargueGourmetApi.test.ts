import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  maestroFindMany: vi.fn(),
  maestroFindUnique: vi.fn(),
  pedidoCount: vi.fn(),
  pedidoFindMany: vi.fn(),
  pedidoCreate: vi.fn(),
  pedidoFindUnique: vi.fn(),
  pedidoUpdate: vi.fn(),
  estibaDeleteMany: vi.fn(),
  estibaCreateMany: vi.fn(),
  cajaDeleteMany: vi.fn(),
  cajaCreateMany: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
  notificacionCreateMany: vi.fn(),
  activityLogCreate: vi.fn(),
  cargueFindFirst: vi.fn(),
  cargueCreate: vi.fn(),
  cargueUpdate: vi.fn(),
  escaneoCreate: vi.fn(),
  novedadCreate: vi.fn(),
  novedadFindFirst: vi.fn(),
}));

// No usamos vi.importActual aquí: @/lib/authz importa next-auth, que en este
// setup de Vitest no resuelve "next/server" como subpath de ESM (limitación
// del entorno de test, no del código de producción). Mockeamos el módulo
// completo con la misma firma pública que ya usan los endpoints existentes.
vi.mock("@/lib/authz", () => ({
  getSessionUser: mocks.getSessionUser,
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
}));

const tx = {
  gourmetPedidoEstiba: { deleteMany: mocks.estibaDeleteMany, createMany: mocks.estibaCreateMany },
  gourmetPedidoCaja: { deleteMany: mocks.cajaDeleteMany, createMany: mocks.cajaCreateMany },
  gourmetPedido: { update: mocks.pedidoUpdate },
  gourmetCargue: { create: mocks.cargueCreate, update: mocks.cargueUpdate },
  gourmetCargueEscaneo: { create: mocks.escaneoCreate },
  gourmetCargueNovedad: { create: mocks.novedadCreate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    maestroTiendaGourmet: { findMany: mocks.maestroFindMany, findUnique: mocks.maestroFindUnique },
    gourmetPedido: {
      count: mocks.pedidoCount,
      findMany: mocks.pedidoFindMany,
      create: mocks.pedidoCreate,
      findUnique: mocks.pedidoFindUnique,
      update: mocks.pedidoUpdate,
    },
    gourmetPedidoEstiba: { deleteMany: mocks.estibaDeleteMany, createMany: mocks.estibaCreateMany },
    gourmetPedidoCaja: { deleteMany: mocks.cajaDeleteMany, createMany: mocks.cajaCreateMany },
    gourmetCargue: { findFirst: mocks.cargueFindFirst, create: mocks.cargueCreate, update: mocks.cargueUpdate },
    gourmetCargueEscaneo: { create: mocks.escaneoCreate },
    gourmetCargueNovedad: { create: mocks.novedadCreate, findFirst: mocks.novedadFindFirst },
    user: { findMany: mocks.userFindMany },
    notificacion: { createMany: mocks.notificacionCreateMany },
    activityLog: { create: mocks.activityLogCreate },
    $transaction: mocks.transaction,
  },
}));

import { GET as getMaestroTiendas } from "@/app/api/cargue-gourmet/maestro-tiendas/route";
import { GET as getPedidos, POST as postPedido } from "@/app/api/cargue-gourmet/route";
import { GET as getPedidoDetalle, PUT as putPedido } from "@/app/api/cargue-gourmet/[id]/route";
import { POST as postUbicacion } from "@/app/api/cargue-gourmet/[id]/ubicacion/route";
import { POST as postEnviarTransporte } from "@/app/api/cargue-gourmet/[id]/enviar-transporte/route";
import { POST as postIniciarCargue } from "@/app/api/cargue-gourmet/[id]/iniciar-cargue/route";
import { POST as postEscanear } from "@/app/api/cargue-gourmet/[id]/escanear/route";
import { POST as postFinalizar } from "@/app/api/cargue-gourmet/[id]/finalizar/route";
import { POST as postCierreManual } from "@/app/api/cargue-gourmet/[id]/cierre-manual/route";

function actor(role: string) {
  return { id: "u_1", email: "u@test.com", name: "Usuario Test", role };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activityLogCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  mocks.estibaDeleteMany.mockResolvedValue({ count: 0 });
  mocks.estibaCreateMany.mockResolvedValue({ count: 0 });
  mocks.cajaDeleteMany.mockResolvedValue({ count: 0 });
  mocks.cajaCreateMany.mockResolvedValue({ count: 0 });
  mocks.userFindMany.mockResolvedValue([]);
  mocks.notificacionCreateMany.mockResolvedValue({ count: 0 });
  mocks.cargueFindFirst.mockResolvedValue(null);
  mocks.escaneoCreate.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "esc1", createdAt: new Date(), ...args.data })
  );
  mocks.novedadCreate.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "nov1", createdAt: new Date(), ...args.data })
  );
  mocks.cargueUpdate.mockImplementation(() => Promise.resolve({ cantidadEscaneada: 1 }));
  mocks.novedadFindFirst.mockResolvedValue(null);
});

describe("GET /api/cargue-gourmet/maestro-tiendas", () => {
  it("busca por código exacto", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mocks.maestroFindMany.mockResolvedValue([{ codigo: "T001", tienda: "Tienda Centro", ciudad: "Bogotá", activo: true }]);

    const req = new NextRequest("http://localhost/api/cargue-gourmet/maestro-tiendas?codigo=T001");
    const res = await getMaestroTiendas(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([{ codigo: "T001", tienda: "Tienda Centro", ciudad: "Bogotá", activo: true }]);
    expect(mocks.maestroFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ codigo: "T001", activo: true }) })
    );
  });

  it("busca parcialmente con q", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mocks.maestroFindMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/cargue-gourmet/maestro-tiendas?q=centro");
    const res = await getMaestroTiendas(req);

    expect(res.status).toBe(200);
    expect(mocks.maestroFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activo: true,
          OR: expect.any(Array),
        }),
      })
    );
  });

  it("rechaza rol sin acceso", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TIENDA"));
    const req = new NextRequest("http://localhost/api/cargue-gourmet/maestro-tiendas?q=centro");
    const res = await getMaestroTiendas(req);
    expect(res.status).toBe(403);
  });

  it("sin sesión responde 401", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/cargue-gourmet/maestro-tiendas");
    const res = await getMaestroTiendas(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cargue-gourmet", () => {
  it("lista pedidos con filtros de ciudad/estado/tipoOrden", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mocks.pedidoCount.mockResolvedValue(1);
    mocks.pedidoFindMany.mockResolvedValue([
      { id: "p1", orden: "TSDM1", tipoOrden: "TSDM", codigoTienda: "T001", nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá", cajasEsperadas: 5, estibasEsperadas: 2, estado: "BORRADOR", creadoPorId: "u_1", createdAt: new Date(), updatedAt: new Date() },
    ]);

    const req = new NextRequest("http://localhost/api/cargue-gourmet?ciudad=Bogot%C3%A1&estado=BORRADOR&tipoOrden=TSDM&page=1&pageSize=10");
    const res = await getPedidos(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.total).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(mocks.pedidoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ciudadDestino: "Bogotá", estado: "BORRADOR", tipoOrden: "TSDM" },
        skip: 0,
        take: 10,
      })
    );
  });

  it("ignora un campo de sort no permitido y usa createdAt por defecto", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mocks.pedidoCount.mockResolvedValue(0);
    mocks.pedidoFindMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/cargue-gourmet?sort=password");
    await getPedidos(req);

    expect(mocks.pedidoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("limita pageSize al máximo de 50", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mocks.pedidoCount.mockResolvedValue(0);
    mocks.pedidoFindMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/cargue-gourmet?pageSize=999");
    await getPedidos(req);

    expect(mocks.pedidoFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});

describe("POST /api/cargue-gourmet", () => {
  function postReq(body: unknown) {
    return new NextRequest("http://localhost/api/cargue-gourmet", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  const validBody = {
    orden: "TSDM98761",
    tipoOrden: "TSDM",
    codigoTienda: "T001",
    cajasEsperadas: 5,
    estibasEsperadas: 2,
  };

  it("crea pedido válido y autocompleta nombreTienda/ciudadDestino desde el maestro", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mocks.maestroFindUnique.mockResolvedValue({ codigo: "T001", tienda: "Tienda Centro", ciudad: "Bogotá", activo: true });
    mocks.pedidoCreate.mockResolvedValue({
      id: "p1", ...validBody, nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá",
      estado: "BORRADOR", creadoPorId: "u_1", createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await postPedido(postReq(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.nombreTienda).toBe("Tienda Centro");
    expect(json.data.ciudadDestino).toBe("Bogotá");
    expect(json.data.estado).toBe("BORRADOR");
    expect(mocks.pedidoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombreTienda: "Tienda Centro",
          ciudadDestino: "Bogotá",
          estado: "BORRADOR",
          creadoPorId: "u_1",
        }),
      })
    );
  });

  it("rechaza tienda inexistente con 400", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mocks.maestroFindUnique.mockResolvedValue(null);

    const res = await postPedido(postReq(validBody));
    expect(res.status).toBe(400);
    expect(mocks.pedidoCreate).not.toHaveBeenCalled();
  });

  it("rechaza tienda inactiva con 400", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mocks.maestroFindUnique.mockResolvedValue({ codigo: "T001", tienda: "Tienda Centro", ciudad: "Bogotá", activo: false });

    const res = await postPedido(postReq(validBody));
    expect(res.status).toBe(400);
    expect(mocks.pedidoCreate).not.toHaveBeenCalled();
  });

  it("rechaza tipoOrden inválido", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postPedido(postReq({ ...validBody, tipoOrden: "XOVDM" }));
    expect(res.status).toBe(400);
    expect(mocks.maestroFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza cajasEsperadas <= 0", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postPedido(postReq({ ...validBody, cajasEsperadas: 0 }));
    expect(res.status).toBe(400);
  });

  it("rechaza estibasEsperadas <= 0", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postPedido(postReq({ ...validBody, estibasEsperadas: 0 }));
    expect(res.status).toBe(400);
  });

  it("TRANSPORTE no puede crear (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postPedido(postReq(validBody));
    expect(res.status).toBe(403);
    expect(mocks.pedidoCreate).not.toHaveBeenCalled();
  });

  it("SUPERVISOR_TRANSPORTE no puede crear (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    const res = await postPedido(postReq(validBody));
    expect(res.status).toBe(403);
  });

  it("OPERACIONES_GOURMET sí puede crear", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mocks.maestroFindUnique.mockResolvedValue({ codigo: "T001", tienda: "Tienda Centro", ciudad: "Bogotá", activo: true });
    mocks.pedidoCreate.mockResolvedValue({ id: "p1", ...validBody, estado: "BORRADOR" });

    const res = await postPedido(postReq(validBody));
    expect(res.status).toBe(201);
  });

  it("ADMIN y GERENTE también pueden crear", async () => {
    for (const role of ["ADMIN", "GERENTE"]) {
      mocks.getSessionUser.mockResolvedValue(actor(role));
      mocks.maestroFindUnique.mockResolvedValue({ codigo: "T001", tienda: "Tienda Centro", ciudad: "Bogotá", activo: true });
      mocks.pedidoCreate.mockResolvedValue({ id: "p1", ...validBody, estado: "BORRADOR" });

      const res = await postPedido(postReq(validBody));
      expect(res.status).toBe(201);
    }
  });
});

const FIXED_UPDATED_AT = new Date("2026-06-24T10:00:00.000Z");

function pedidoDetalleMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "p1",
    orden: "TSDM98761",
    tipoOrden: "TSDM",
    codigoTienda: "T001",
    nombreTienda: "Tienda Centro",
    ciudadDestino: "Bogotá",
    cajasEsperadas: 5,
    estibasEsperadas: 2,
    estado: "BORRADOR",
    creadoPorId: "u_1",
    creadoPor: { name: "Usuario Test" },
    createdAt: new Date("2026-06-24T09:00:00.000Z"),
    updatedAt: FIXED_UPDATED_AT,
    ubicacionAsignadaAt: null,
    ubicacionAsignadaPorId: null,
    enviadoTransporteAt: null,
    enviadoTransportePorId: null,
    cargueIniciadoAt: null,
    cargueIniciadoPorId: null,
    cargueCompletadoAt: null,
    cargueCompletadoPorId: null,
    esCierreManual: false,
    cantidadContadaManual: null,
    motivoCierreManual: null,
    observacionCierreManual: null,
    estibas: [{ id: "e1", secuencia: 1, ubicacion: "A1" }],
    cajas: [{ id: "c1", numeroSecuencia: 1, codigoCaja: null }],
    cargues: [
      {
        id: "cg1",
        iniciadoPorId: "u_2",
        iniciadoAt: new Date(),
        finalizadoPorId: null,
        finalizadoAt: null,
        tipoCierre: null,
        cantidadEsperada: 5,
        cantidadEscaneada: 0,
        cantidadContadaManual: null,
        motivoCierreManual: null,
        observacion: null,
        estado: "EN_CARGUE",
        escaneos: [{ id: "s1", codigoEscaneado: "X", resultado: "VALIDO", createdAt: new Date() }],
      },
    ],
    novedades: [{ id: "n1", tipo: "CAJA_AJENA", estado: "ABIERTA", createdAt: new Date() }],
    ...overrides,
  };
}

function getReq(id: string, qs = "") {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}${qs}`);
}

function putReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/cargue-gourmet/[id]", () => {
  it("devuelve detalle con estibas, cajas, cargues, escaneos y novedades", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mocks.pedidoFindUnique.mockResolvedValue(pedidoDetalleMock());

    const res = await getPedidoDetalle(getReq("p1"), { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.estibas).toHaveLength(1);
    expect(json.data.cajas).toHaveLength(1);
    expect(json.data.cargues).toHaveLength(1);
    expect(json.data.cargues[0].escaneos).toHaveLength(1);
    expect(json.data.novedades).toHaveLength(1);
    expect(json.data.creadoPorNombre).toBe("Usuario Test");
  });

  it("404 si no existe", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mocks.pedidoFindUnique.mockResolvedValue(null);

    const res = await getPedidoDetalle(getReq("inexistente"), { params: Promise.resolve({ id: "inexistente" }) });
    expect(res.status).toBe(404);
  });

  it("401 si no hay sesión", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await getPedidoDetalle(getReq("p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(401);
  });

  it("403 si el rol no está autorizado", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TIENDA"));
    const res = await getPedidoDetalle(getReq("p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/cargue-gourmet/[id]", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };
  const validUpdate = {
    orden: "TSDM98761-B",
    tipoOrden: "TSDM" as const,
    cajasEsperadas: 6,
    estibasEsperadas: 3,
    updatedAt: FIXED_UPDATED_AT.toISOString(),
  };

  function mockCurrent(estado: string, codigoTienda = "T001") {
    mocks.pedidoFindUnique.mockResolvedValue({ estado, updatedAt: FIXED_UPDATED_AT, codigoTienda });
  }

  it("edita correctamente en estado BORRADOR", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mocks.pedidoUpdate.mockResolvedValue(pedidoDetalleMock({ ...validUpdate, updatedAt: new Date() }));

    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(200);
  });

  it("edita correctamente en estado UBICACION_ASIGNADA", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mocks.pedidoUpdate.mockResolvedValue(pedidoDetalleMock());

    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(200);
  });

  it("rechaza edición en ENVIADO_A_TRANSPORTE con 409", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("ENVIADO_A_TRANSPORTE");

    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(409);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza edición en EN_CARGUE con 409", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("EN_CARGUE");

    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(409);
  });

  it("rechaza edición en CARGUE_COMPLETO con 409", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("CARGUE_COMPLETO");

    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si falta updatedAt con 400", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const { updatedAt, ...sinUpdatedAt } = validUpdate;
    const res = await putPedido(putReq("p1", sinUpdatedAt), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt no coincide con 409", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");

    const res = await putPedido(
      putReq("p1", { ...validUpdate, updatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }),
      params
    );
    expect(res.status).toBe(409);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza tienda inexistente con 400", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mocks.maestroFindUnique.mockResolvedValue(null);

    const res = await putPedido(putReq("p1", { ...validUpdate, codigoTienda: "T999" }), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza tienda inactiva con 400", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mocks.maestroFindUnique.mockResolvedValue({ codigo: "T002", tienda: "Otra", ciudad: "Cali", activo: false });

    const res = await putPedido(putReq("p1", { ...validUpdate, codigoTienda: "T002" }), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza tipoOrden inválido", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await putPedido(putReq("p1", { ...validUpdate, tipoOrden: "XOVDM" }), params);
    expect(res.status).toBe(400);
  });

  it("rechaza cajasEsperadas/estibasEsperadas <= 0", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res1 = await putPedido(putReq("p1", { ...validUpdate, cajasEsperadas: 0 }), params);
    expect(res1.status).toBe(400);
    const res2 = await putPedido(putReq("p1", { ...validUpdate, estibasEsperadas: 0 }), params);
    expect(res2.status).toBe(400);
  });

  it("TRANSPORTE no puede editar (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("SUPERVISOR_TRANSPORTE no puede editar (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(403);
  });

  it("OPERACIONES_GOURMET sí puede editar", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mocks.pedidoUpdate.mockResolvedValue(pedidoDetalleMock());

    const res = await putPedido(putReq("p1", validUpdate), params);
    expect(res.status).toBe(200);
  });

  it("ADMIN/GERENTE sí pueden editar", async () => {
    for (const role of ["ADMIN", "GERENTE"]) {
      mocks.getSessionUser.mockResolvedValue(actor(role));
      mockCurrent("BORRADOR");
      mocks.pedidoUpdate.mockResolvedValue(pedidoDetalleMock());

      const res = await putPedido(putReq("p1", validUpdate), params);
      expect(res.status).toBe(200);
    }
  });

  it("nombreTienda/ciudadDestino salen del maestro, no del body, al cambiar codigoTienda", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mocks.maestroFindUnique.mockResolvedValue({ codigo: "T002", tienda: "Tienda Norte", ciudad: "Medellín", activo: true });
    mocks.pedidoUpdate.mockResolvedValue(pedidoDetalleMock());

    await putPedido(
      putReq("p1", {
        ...validUpdate,
        codigoTienda: "T002",
        // El cliente intenta falsificar estos campos — deben ser ignorados.
        nombreTienda: "NOMBRE_FALSO",
        ciudadDestino: "CIUDAD_FALSA",
      }),
      params
    );

    expect(mocks.pedidoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigoTienda: "T002",
          nombreTienda: "Tienda Norte",
          ciudadDestino: "Medellín",
        }),
      })
    );
  });

  it("no modifica estado ni transiciones — el body no puede forzarlos", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mocks.pedidoUpdate.mockResolvedValue(pedidoDetalleMock());

    await putPedido(
      putReq("p1", { ...validUpdate, estado: "CARGUE_COMPLETO", cargueCompletadoAt: new Date().toISOString() }),
      params
    );

    const callArg = mocks.pedidoUpdate.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty("estado");
    expect(callArg.data).not.toHaveProperty("cargueCompletadoAt");
  });
});

const UBICACION_UPDATED_AT = new Date("2026-06-24T11:00:00.000Z");

function ubicacionPostReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}/ubicacion`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function enviarTransportePostReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}/enviar-transporte`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cargue-gourmet/[id]/ubicacion", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };
  const validBody = {
    estibas: [{ secuencia: 1, ubicacion: "A1" }, { secuencia: 2, ubicacion: "A2" }],
    cajas: [{ codigoCaja: "TSDM1-CAJA-01", numeroSecuencia: 1 }],
    updatedAt: UBICACION_UPDATED_AT.toISOString(),
  };

  function mockCurrent(estado: string) {
    mocks.pedidoFindUnique.mockResolvedValue({ estado, updatedAt: UBICACION_UPDATED_AT });
  }

  function mockUpdateResult() {
    mocks.pedidoUpdate.mockResolvedValue({
      id: "p1", orden: "TSDM1", tipoOrden: "TSDM", codigoTienda: "T001",
      nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá",
      cajasEsperadas: 5, estibasEsperadas: 2, estado: "UBICACION_ASIGNADA",
      updatedAt: new Date(), ubicacionAsignadaAt: new Date(), ubicacionAsignadaPorId: "u_1",
      enviadoTransporteAt: null, enviadoTransportePorId: null,
      cargueIniciadoAt: null, cargueCompletadoAt: null,
      estibas: validBody.estibas, cajas: validBody.cajas,
    });
  }

  it("asigna ubicación correctamente desde BORRADOR", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mockUpdateResult();

    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.estado).toBe("UBICACION_ASIGNADA");
  });

  it("reasigna ubicación correctamente desde UBICACION_ASIGNADA", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();

    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("rechaza si está ENVIADO_A_TRANSPORTE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("ENVIADO_A_TRANSPORTE");

    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si está EN_CARGUE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("EN_CARGUE");

    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si está CARGUE_COMPLETO (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("CARGUE_COMPLETO");

    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si falta updatedAt (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const { updatedAt, ...sinUpdatedAt } = validBody;
    const res = await postUbicacion(ubicacionPostReq("p1", sinUpdatedAt), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt no coincide (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");

    const res = await postUbicacion(
      ubicacionPostReq("p1", { ...validBody, updatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }),
      params
    );
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si no hay estibas (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postUbicacion(ubicacionPostReq("p1", { ...validBody, estibas: [] }), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza estibas con secuencia duplicada (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postUbicacion(
      ubicacionPostReq("p1", { ...validBody, estibas: [{ secuencia: 1, ubicacion: "A1" }, { secuencia: 1, ubicacion: "A2" }] }),
      params
    );
    expect(res.status).toBe(400);
  });

  it("rechaza ubicación vacía (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postUbicacion(
      ubicacionPostReq("p1", { ...validBody, estibas: [{ secuencia: 1, ubicacion: "" }] }),
      params
    );
    expect(res.status).toBe(400);
  });

  it("rechaza TRANSPORTE (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza SUPERVISOR_TRANSPORTE (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(403);
  });

  it("OPERACIONES_GOURMET sí puede", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mockUpdateResult();
    const res = await postUbicacion(ubicacionPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("reemplaza estibas/cajas con deleteMany + createMany dentro de la transacción", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mockUpdateResult();

    await postUbicacion(ubicacionPostReq("p1", validBody), params);

    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.estibaDeleteMany).toHaveBeenCalledWith({ where: { pedidoId: "p1" } });
    expect(mocks.estibaCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ pedidoId: "p1", secuencia: 1, ubicacion: "A1" })]) })
    );
    expect(mocks.cajaDeleteMany).toHaveBeenCalledWith({ where: { pedidoId: "p1" } });
    expect(mocks.cajaCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ pedidoId: "p1", codigoCaja: "TSDM1-CAJA-01" })]) })
    );
  });

  it("no modifica timestamps de transporte/cargue", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");
    mockUpdateResult();

    await postUbicacion(ubicacionPostReq("p1", validBody), params);

    const callArg = mocks.pedidoUpdate.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty("enviadoTransporteAt");
    expect(callArg.data).not.toHaveProperty("enviadoTransportePorId");
    expect(callArg.data).not.toHaveProperty("cargueIniciadoAt");
    expect(callArg.data).not.toHaveProperty("cargueCompletadoAt");
    expect(callArg.data).toEqual(
      expect.objectContaining({ estado: "UBICACION_ASIGNADA", ubicacionAsignadaPorId: "u_1" })
    );
  });
});

describe("POST /api/cargue-gourmet/[id]/enviar-transporte", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };
  const validBody = { updatedAt: UBICACION_UPDATED_AT.toISOString() };

  function mockCurrent(estado: string, overrides: Partial<Record<string, unknown>> = {}) {
    mocks.pedidoFindUnique.mockResolvedValue({
      estado,
      updatedAt: UBICACION_UPDATED_AT,
      orden: "TSDM1",
      ciudadDestino: "Bogotá",
      cajasEsperadas: 5,
      estibasEsperadas: 2,
      _count: { estibas: 1 },
      ...overrides,
    });
  }

  function mockUpdateResult() {
    mocks.pedidoUpdate.mockResolvedValue({
      id: "p1", orden: "TSDM1", tipoOrden: "TSDM", codigoTienda: "T001",
      nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá",
      cajasEsperadas: 5, estibasEsperadas: 2, estado: "ENVIADO_A_TRANSPORTE",
      updatedAt: new Date(), enviadoTransporteAt: new Date(), enviadoTransportePorId: "u_1",
    });
  }

  it("envía correctamente desde UBICACION_ASIGNADA", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();

    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.estado).toBe("ENVIADO_A_TRANSPORTE");
  });

  it("rechaza desde BORRADOR (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("BORRADOR");

    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza desde EN_CARGUE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("EN_CARGUE");

    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si no tiene estibas (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA", { _count: { estibas: 0 } });

    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza si falta updatedAt (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postEnviarTransporte(enviarTransportePostReq("p1", {}), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt no coincide (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");

    const res = await postEnviarTransporte(
      enviarTransportePostReq("p1", { updatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }),
      params
    );
    expect(res.status).toBe(409);
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza TRANSPORTE (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza SUPERVISOR_TRANSPORTE (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(403);
  });

  it("OPERACIONES_GOURMET sí puede", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();
    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("actualiza enviadoTransporteAt/enviadoTransportePorId", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();

    await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);

    expect(mocks.pedidoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: "ENVIADO_A_TRANSPORTE",
          enviadoTransportePorId: "u_1",
        }),
      })
    );
  });

  it("no crea cargue (no toca prisma.gourmetCargue)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();

    await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);

    // El mock de prisma no expone gourmetCargue: si el endpoint intentara
    // usarlo, fallaría con TypeError antes de llegar aquí.
    expect(mocks.pedidoUpdate).toHaveBeenCalledTimes(1);
  });

  it("no modifica cajas ni estibas", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();

    await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);

    expect(mocks.estibaCreateMany).not.toHaveBeenCalled();
    expect(mocks.cajaCreateMany).not.toHaveBeenCalled();
    expect(mocks.estibaDeleteMany).not.toHaveBeenCalled();
    expect(mocks.cajaDeleteMany).not.toHaveBeenCalled();
  });

  it("intenta crear notificación para TRANSPORTE/SUPERVISOR_TRANSPORTE/ADMIN/GERENTE sin bloquear la respuesta", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();
    mocks.userFindMany.mockResolvedValue([{ id: "u_t1" }, { id: "u_t2" }]);

    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);

    expect(res.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          role: { in: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"] },
        }),
      })
    );
  });

  it("no bloquea la respuesta si la notificación falla", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    mockCurrent("UBICACION_ASIGNADA");
    mockUpdateResult();
    mocks.userFindMany.mockResolvedValue([{ id: "u_t1" }]);
    mocks.notificacionCreateMany.mockRejectedValue(new Error("db down"));

    const res = await postEnviarTransporte(enviarTransportePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });
});

function iniciarCarguePostReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}/iniciar-cargue`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cargue-gourmet/[id]/iniciar-cargue", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };
  const validBody = { updatedAt: UBICACION_UPDATED_AT.toISOString() };

  function mockCurrent(estado: string, overrides: Partial<Record<string, unknown>> = {}) {
    mocks.pedidoFindUnique.mockResolvedValue({
      estado,
      updatedAt: UBICACION_UPDATED_AT,
      orden: "TSDM1",
      ciudadDestino: "Bogotá",
      cajasEsperadas: 5,
      estibasEsperadas: 2,
      creadoPorId: "u_gourmet",
      _count: { estibas: 1 },
      ...overrides,
    });
  }

  function mockCreateResults() {
    mocks.cargueCreate.mockResolvedValue({
      id: "cg1", pedidoId: "p1", iniciadoPorId: "u_1", iniciadoAt: new Date(),
      cantidadEsperada: 5, cantidadEscaneada: 0, estado: "EN_CARGUE",
    });
    mocks.pedidoUpdate.mockResolvedValue({
      id: "p1", orden: "TSDM1", tipoOrden: "TSDM", codigoTienda: "T001",
      nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá",
      cajasEsperadas: 5, estibasEsperadas: 2, estado: "EN_CARGUE",
      updatedAt: new Date(), cargueIniciadoAt: new Date(), cargueIniciadoPorId: "u_1",
    });
  }

  it("inicia cargue correctamente desde ENVIADO_A_TRANSPORTE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.pedido.estado).toBe("EN_CARGUE");
    expect(json.data.cargue.estado).toBe("EN_CARGUE");
  });

  it("rechaza desde BORRADOR (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("BORRADOR");

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza desde UBICACION_ASIGNADA (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("UBICACION_ASIGNADA");

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza desde EN_CARGUE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("EN_CARGUE");

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza desde CARGUE_COMPLETO (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("CARGUE_COMPLETO");

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si falta updatedAt (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postIniciarCargue(iniciarCarguePostReq("p1", {}), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt no coincide (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");

    const res = await postIniciarCargue(
      iniciarCarguePostReq("p1", { updatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }),
      params
    );
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si no tiene estibas (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE", { _count: { estibas: 0 } });

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si ya existe un cargue activo (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mocks.cargueFindFirst.mockResolvedValue({ id: "cg_existente" });

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza OPERACIONES_GOURMET (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("permite TRANSPORTE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();
    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("permite SUPERVISOR_TRANSPORTE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();
    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("permite ADMIN", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();
    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("permite GERENTE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("GERENTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();
    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("crea GourmetCargue con los campos esperados", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();

    await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);

    expect(mocks.cargueCreate).toHaveBeenCalledWith({
      data: {
        pedidoId: "p1",
        iniciadoPorId: "u_1",
        cantidadEsperada: 5,
        cantidadEscaneada: 0,
        estado: "EN_CARGUE",
      },
    });
  });

  it("actualiza GourmetPedido a EN_CARGUE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();

    await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);

    expect(mocks.pedidoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ estado: "EN_CARGUE", cargueIniciadoPorId: "u_1" }),
      })
    );
  });

  it("no modifica estibas ni cajas", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();

    await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);

    expect(mocks.estibaCreateMany).not.toHaveBeenCalled();
    expect(mocks.estibaDeleteMany).not.toHaveBeenCalled();
    expect(mocks.cajaCreateMany).not.toHaveBeenCalled();
    expect(mocks.cajaDeleteMany).not.toHaveBeenCalled();
  });

  it("no crea escaneos (el mock no expone gourmetCargueEscaneo)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("intenta notificar al creador del pedido y a ADMIN/GERENTE sin bloquear", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();
    mocks.userFindMany.mockResolvedValue([{ id: "u_admin1" }]);

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);

    expect(res.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { in: ["ADMIN", "GERENTE"] } }) })
    );
    const notifData = mocks.notificacionCreateMany.mock.calls[0][0].data as Array<{ userId: string }>;
    expect(notifData.some((n) => n.userId === "u_gourmet")).toBe(true);
    expect(notifData.some((n) => n.userId === "u_admin1")).toBe(true);
  });

  it("responde éxito igual si la notificación falla", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockCurrent("ENVIADO_A_TRANSPORTE");
    mockCreateResults();
    mocks.notificacionCreateMany.mockRejectedValue(new Error("db down"));

    const res = await postIniciarCargue(iniciarCarguePostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });
});

function escanearPostReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}/escanear`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cargue-gourmet/[id]/escanear", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };

  function mockPedido(estado: string, cajas: { codigoCaja: string | null }[] = []) {
    mocks.pedidoFindUnique.mockResolvedValue({ id: "p1", orden: "TSDM98761", estado, cajas });
  }

  function mockCargueActivo(cantidadEsperada: number, cantidadEscaneada: number, escaneosValidos: string[] = []) {
    mocks.cargueFindFirst.mockResolvedValue({
      id: "cg1",
      cantidadEsperada,
      cantidadEscaneada,
      escaneos: escaneosValidos.map((codigoEscaneado) => ({ codigoEscaneado })),
    });
  }

  it("escaneo válido incrementa cantidadEscaneada", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);
    mocks.cargueUpdate.mockResolvedValue({ cantidadEscaneada: 1 });

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.resultado).toBe("VALIDO");
    expect(json.progreso).toEqual({ escaneados: 1, esperados: 2 });
    expect(mocks.cargueUpdate).toHaveBeenCalledWith({
      where: { id: "cg1" },
      data: { cantidadEscaneada: { increment: 1 } },
      select: { cantidadEscaneada: true },
    });
  });

  it("escaneo válido crea GourmetCargueEscaneo", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);

    expect(mocks.escaneoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cargueId: "cg1",
          pedidoId: "p1",
          codigoEscaneado: "TSDM98761-CAJA-01",
          resultado: "VALIDO",
          escaneadoPorId: "u_1",
        }),
      })
    );
  });

  it("duplicado crea escaneo, no incrementa contador y crea novedad CAJA_DUPLICADA", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 1, ["TSDM98761-CAJA-01"]);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);
    const json = await res.json();

    expect(json.resultado).toBe("DUPLICADO");
    expect(mocks.escaneoCreate).toHaveBeenCalled();
    expect(mocks.cargueUpdate).not.toHaveBeenCalled();
    expect(json.novedadCreada).toBe(true);
    expect(mocks.novedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "CAJA_DUPLICADA", estado: "ABIERTA" }) })
    );
  });

  it("caja ajena crea escaneo, no incrementa y crea novedad CAJA_AJENA", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "OVDM00001-CAJA-01" }), params);
    const json = await res.json();

    expect(json.resultado).toBe("CAJA_AJENA");
    expect(mocks.cargueUpdate).not.toHaveBeenCalled();
    expect(json.novedadCreada).toBe(true);
    expect(mocks.novedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "CAJA_AJENA" }) })
    );
  });

  it("formato inválido crea escaneo, no incrementa y no crea novedad", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "   " }), params);
    const json = await res.json();

    expect(json.resultado).toBe("FORMATO_INVALIDO");
    expect(mocks.escaneoCreate).toHaveBeenCalled();
    expect(mocks.cargueUpdate).not.toHaveBeenCalled();
    expect(mocks.novedadCreate).not.toHaveBeenCalled();
    expect(json.novedadCreada).toBe(false);
  });

  it("excede cantidad crea escaneo, no incrementa y crea novedad DIFERENCIA_CANTIDAD", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", []); // SIN_CODIGOS_PREVIOS
    mockCargueActivo(2, 2, ["TSDM98761", "TSDM98761"]);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761" }), params);
    const json = await res.json();

    expect(json.resultado).toBe("EXCEDE_CANTIDAD");
    expect(mocks.cargueUpdate).not.toHaveBeenCalled();
    expect(json.novedadCreada).toBe(true);
    expect(mocks.novedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "DIFERENCIA_CANTIDAD" }) })
    );
  });

  it("rechaza si el pedido no existe (404)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mocks.pedidoFindUnique.mockResolvedValue(null);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "X" }), params);
    expect(res.status).toBe(404);
  });

  it("rechaza si el pedido no está EN_CARGUE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("ENVIADO_A_TRANSPORTE");

    const res = await postEscanear(escanearPostReq("p1", { codigo: "X" }), params);
    expect(res.status).toBe(409);
    expect(mocks.cargueFindFirst).not.toHaveBeenCalled();
  });

  it("rechaza si no hay cargue activo (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mocks.cargueFindFirst.mockResolvedValue(null);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "X" }), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si falta codigo en el body (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postEscanear(escanearPostReq("p1", {}), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza OPERACIONES_GOURMET (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postEscanear(escanearPostReq("p1", { codigo: "X" }), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it.each(["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"])("permite %s", async (role) => {
    mocks.getSessionUser.mockResolvedValue(actor(role));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);
    expect(res.status).toBe(200);
  });

  it("modo QR_UNICO_CAJA usa los códigos de caja esperados (caja ajena si no está en la lista)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-99" }), params);
    const json = await res.json();
    expect(json.resultado).toBe("CAJA_AJENA");
  });

  it("modo QR_SOLO_ORDEN no devuelve DUPLICADO real, usa EXCEDE_CANTIDAD", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761" }, { codigoCaja: "TSDM98761" }]);
    mockCargueActivo(2, 2, ["TSDM98761", "TSDM98761"]);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761" }), params);
    const json = await res.json();
    expect(json.resultado).toBe("EXCEDE_CANTIDAD");
    expect(json.resultado).not.toBe("DUPLICADO");
  });

  it("modo SIN_CODIGOS_PREVIOS valida por orden", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", []);
    mockCargueActivo(2, 0);

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-X" }), params);
    const json = await res.json();
    expect(json.resultado).toBe("VALIDO");
  });

  it("no modifica GourmetPedido.estado", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);

    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("no finaliza el cargue automáticamente aunque se alcance la cantidad esperada", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 1, ["TSDM98761-CAJA-01"]);
    mocks.cargueUpdate.mockResolvedValue({ cantidadEscaneada: 2 });

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-02" }), params);
    const json = await res.json();

    expect(json.progreso).toEqual({ escaneados: 2, esperados: 2 });
    expect(mocks.pedidoUpdate).not.toHaveBeenCalled();
  });

  it("no crea notificaciones por escaneo válido", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);

    await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);

    expect(mocks.notificacionCreateMany).not.toHaveBeenCalled();
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("la respuesta incluye progreso actualizado", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE", [{ codigoCaja: "TSDM98761-CAJA-01" }, { codigoCaja: "TSDM98761-CAJA-02" }]);
    mockCargueActivo(2, 0);
    mocks.cargueUpdate.mockResolvedValue({ cantidadEscaneada: 1 });

    const res = await postEscanear(escanearPostReq("p1", { codigo: "TSDM98761-CAJA-01" }), params);
    const json = await res.json();

    expect(json.progreso.escaneados).toBe(1);
    expect(json.progreso.esperados).toBe(2);
  });
});

const FINALIZAR_UPDATED_AT = new Date("2026-06-24T12:00:00.000Z");

function finalizarPostReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}/finalizar`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cargue-gourmet/[id]/finalizar", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };
  const validBody = { updatedAt: FINALIZAR_UPDATED_AT.toISOString() };

  function mockPedido(estado: string, overrides: Partial<Record<string, unknown>> = {}) {
    mocks.pedidoFindUnique.mockResolvedValue({
      id: "p1",
      orden: "TSDM98761",
      estado,
      updatedAt: FINALIZAR_UPDATED_AT,
      ciudadDestino: "Bogotá",
      creadoPorId: "u_gourmet",
      ...overrides,
    });
  }

  function mockCargueActivo(cantidadEsperada: number, cantidadEscaneada: number) {
    mocks.cargueFindFirst.mockResolvedValue({
      id: "cg1",
      pedidoId: "p1",
      estado: "EN_CARGUE",
      cantidadEsperada,
      cantidadEscaneada,
    });
  }

  function mockFinalizarResultados() {
    mocks.cargueUpdate.mockResolvedValue({
      id: "cg1", pedidoId: "p1", estado: "CARGUE_COMPLETO", tipoCierre: "NORMAL",
      cantidadEsperada: 2, cantidadEscaneada: 2, finalizadoAt: new Date(), finalizadoPorId: "u_1",
    });
    mocks.pedidoUpdate.mockResolvedValue({
      id: "p1", orden: "TSDM98761", tipoOrden: "TSDM", codigoTienda: "T001",
      nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá", estado: "CARGUE_COMPLETO",
      updatedAt: new Date(), cargueCompletadoAt: new Date(), cargueCompletadoPorId: "u_1",
    });
  }

  it("finaliza correctamente desde EN_CARGUE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.pedido.estado).toBe("CARGUE_COMPLETO");
    expect(json.data.cargue.estado).toBe("CARGUE_COMPLETO");
  });

  it("rechaza si el pedido no existe (404)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mocks.pedidoFindUnique.mockResolvedValue(null);

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(404);
  });

  it("rechaza si el pedido está BORRADOR (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("BORRADOR");

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si el pedido está ENVIADO_A_TRANSPORTE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("ENVIADO_A_TRANSPORTE");

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si el pedido está CARGUE_COMPLETO (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("CARGUE_COMPLETO");

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si no hay cargue activo (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mocks.cargueFindFirst.mockResolvedValue(null);

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si falta updatedAt (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postFinalizar(finalizarPostReq("p1", {}), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt no coincide (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);

    const res = await postFinalizar(
      finalizarPostReq("p1", { updatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }),
      params
    );
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si cantidadEscaneada < cantidadEsperada (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(5, 3);

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si cantidadEscaneada > cantidadEsperada (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 3);

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si hay novedades abiertas (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mocks.novedadFindFirst.mockResolvedValue({ id: "nov1" });

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza OPERACIONES_GOURMET (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it.each(["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"])("permite %s", async (role) => {
    mocks.getSessionUser.mockResolvedValue(actor(role));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("actualiza GourmetCargue a CARGUE_COMPLETO con tipoCierre NORMAL", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    await postFinalizar(finalizarPostReq("p1", validBody), params);

    expect(mocks.cargueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cg1" },
        data: expect.objectContaining({
          estado: "CARGUE_COMPLETO",
          tipoCierre: "NORMAL",
          finalizadoPorId: "u_1",
        }),
      })
    );
  });

  it("actualiza GourmetPedido a CARGUE_COMPLETO", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    await postFinalizar(finalizarPostReq("p1", validBody), params);

    expect(mocks.pedidoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ estado: "CARGUE_COMPLETO", cargueCompletadoPorId: "u_1" }),
      })
    );
  });

  it("no modifica cajas ni estibas", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    await postFinalizar(finalizarPostReq("p1", validBody), params);

    expect(mocks.estibaCreateMany).not.toHaveBeenCalled();
    expect(mocks.estibaDeleteMany).not.toHaveBeenCalled();
    expect(mocks.cajaCreateMany).not.toHaveBeenCalled();
    expect(mocks.cajaDeleteMany).not.toHaveBeenCalled();
  });

  it("no crea escaneos", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    await postFinalizar(finalizarPostReq("p1", validBody), params);

    expect(mocks.escaneoCreate).not.toHaveBeenCalled();
  });

  it("no crea cierre manual (tipoCierre es NORMAL, no MANUAL)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();

    await postFinalizar(finalizarPostReq("p1", validBody), params);

    const callArg = mocks.cargueUpdate.mock.calls[0][0];
    expect(callArg.data.tipoCierre).toBe("NORMAL");
    expect(callArg.data).not.toHaveProperty("cantidadContadaManual");
    expect(callArg.data).not.toHaveProperty("motivoCierreManual");
  });

  it("intenta notificar al creador del pedido y a ADMIN/GERENTE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();
    mocks.userFindMany.mockResolvedValue([{ id: "u_admin1" }]);

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);

    expect(res.status).toBe(200);
    const notifData = mocks.notificacionCreateMany.mock.calls[0][0].data as Array<{ userId: string; titulo: string }>;
    expect(notifData.some((n) => n.userId === "u_gourmet")).toBe(true);
    expect(notifData.some((n) => n.userId === "u_admin1")).toBe(true);
    expect(notifData[0].titulo).toBe("Cargue Gourmet finalizado");
  });

  it("responde éxito igual si la notificación falla", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueActivo(2, 2);
    mockFinalizarResultados();
    mocks.notificacionCreateMany.mockRejectedValue(new Error("db down"));

    const res = await postFinalizar(finalizarPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });
});

const CIERRE_MANUAL_UPDATED_AT = new Date("2026-06-24T13:00:00.000Z");

function cierreManualPostReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cargue-gourmet/${id}/cierre-manual`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cargue-gourmet/[id]/cierre-manual", () => {
  const params = { params: Promise.resolve({ id: "p1" }) };
  const validBody = {
    cantidadContadaManual: 4,
    motivo: "QR ilegibles por daño en varias cajas",
    observacion: "Se reintentó 3 veces sin éxito",
    updatedAt: CIERRE_MANUAL_UPDATED_AT.toISOString(),
  };

  function mockPedido(estado: string, overrides: Partial<Record<string, unknown>> = {}) {
    mocks.pedidoFindUnique.mockResolvedValue({
      id: "p1",
      orden: "TSDM98761",
      estado,
      updatedAt: CIERRE_MANUAL_UPDATED_AT,
      ciudadDestino: "Bogotá",
      creadoPorId: "u_gourmet",
      ...overrides,
    });
  }

  function mockCargueValido(estado: "EN_CARGUE" | "CON_NOVEDAD" = "EN_CARGUE") {
    mocks.cargueFindFirst.mockResolvedValue({
      id: "cg1",
      pedidoId: "p1",
      estado,
      cantidadEsperada: 5,
      cantidadEscaneada: 3,
    });
  }

  function mockCierreManualResultados() {
    mocks.novedadCreate.mockResolvedValue({
      id: "nov1", cargueId: "cg1", pedidoId: "p1", tipo: "CIERRE_MANUAL",
      descripcion: "desc", estado: "RESUELTA", registradaPorId: "u_1", resueltaPorId: "u_1", resueltaAt: new Date(),
    });
    mocks.cargueUpdate.mockResolvedValue({
      id: "cg1", pedidoId: "p1", estado: "CARGUE_COMPLETO_MANUAL", tipoCierre: "MANUAL",
      cantidadEsperada: 5, cantidadEscaneada: 3, cantidadContadaManual: 4, motivoCierreManual: "QR ilegibles por daño en varias cajas",
      observacion: "Se reintentó 3 veces sin éxito", finalizadoAt: new Date(), finalizadoPorId: "u_1",
    });
    mocks.pedidoUpdate.mockResolvedValue({
      id: "p1", orden: "TSDM98761", tipoOrden: "TSDM", codigoTienda: "T001",
      nombreTienda: "Tienda Centro", ciudadDestino: "Bogotá", estado: "CARGUE_COMPLETO_MANUAL",
      updatedAt: new Date(), esCierreManual: true, cantidadContadaManual: 4,
      motivoCierreManual: "QR ilegibles por daño en varias cajas", observacionCierreManual: "Se reintentó 3 veces sin éxito",
      cargueCompletadoAt: new Date(), cargueCompletadoPorId: "u_1",
    });
  }

  it("cierra manualmente desde EN_CARGUE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.pedido.estado).toBe("CARGUE_COMPLETO_MANUAL");
    expect(json.data.cargue.estado).toBe("CARGUE_COMPLETO_MANUAL");
    expect(json.data.novedad.tipo).toBe("CIERRE_MANUAL");
  });

  it("cierra manualmente desde CON_NOVEDAD", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("CON_NOVEDAD");
    mockCargueValido("CON_NOVEDAD");
    mockCierreManualResultados();

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("rechaza si el pedido no existe (404)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mocks.pedidoFindUnique.mockResolvedValue(null);

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(404);
  });

  it("rechaza si el pedido está BORRADOR (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("BORRADOR");

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si el pedido está ENVIADO_A_TRANSPORTE (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("ENVIADO_A_TRANSPORTE");

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si el pedido está CARGUE_COMPLETO (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("CARGUE_COMPLETO");

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si el pedido está CARGUE_COMPLETO_MANUAL (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("CARGUE_COMPLETO_MANUAL");

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si el pedido está CANCELADO (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("CANCELADO");

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
  });

  it("rechaza si no hay cargue válido (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mocks.cargueFindFirst.mockResolvedValue(null);

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si falta updatedAt (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    const { updatedAt, ...sinUpdatedAt } = validBody;
    const res = await postCierreManual(cierreManualPostReq("p1", sinUpdatedAt), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si updatedAt no coincide (409)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");

    const res = await postCierreManual(
      cierreManualPostReq("p1", { ...validBody, updatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }),
      params
    );
    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza si cantidadContadaManual es negativa (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    const res = await postCierreManual(cierreManualPostReq("p1", { ...validBody, cantidadContadaManual: -1 }), params);
    expect(res.status).toBe(400);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza si cantidadContadaManual no es entero (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    const res = await postCierreManual(cierreManualPostReq("p1", { ...validBody, cantidadContadaManual: 2.5 }), params);
    expect(res.status).toBe(400);
  });

  it("rechaza si falta motivo (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    const { motivo, ...sinMotivo } = validBody;
    const res = await postCierreManual(cierreManualPostReq("p1", sinMotivo), params);
    expect(res.status).toBe(400);
  });

  it("rechaza si motivo tiene menos de 5 caracteres (400)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    const res = await postCierreManual(cierreManualPostReq("p1", { ...validBody, motivo: "abc" }), params);
    expect(res.status).toBe(400);
  });

  it("rechaza TRANSPORTE (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("TRANSPORTE"));
    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(403);
    expect(mocks.pedidoFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza OPERACIONES_GOURMET (403)", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("OPERACIONES_GOURMET"));
    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(403);
  });

  it.each(["SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"])("permite %s", async (role) => {
    mocks.getSessionUser.mockResolvedValue(actor(role));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });

  it("crea novedad CIERRE_MANUAL", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(mocks.novedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cargueId: "cg1",
          pedidoId: "p1",
          tipo: "CIERRE_MANUAL",
          registradaPorId: "u_1",
        }),
      })
    );
  });

  it("actualiza GourmetCargue a CARGUE_COMPLETO_MANUAL con tipoCierre MANUAL", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(mocks.cargueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cg1" },
        data: expect.objectContaining({
          estado: "CARGUE_COMPLETO_MANUAL",
          tipoCierre: "MANUAL",
          cantidadContadaManual: 4,
          motivoCierreManual: validBody.motivo,
        }),
      })
    );
  });

  it("actualiza GourmetPedido a CARGUE_COMPLETO_MANUAL", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(mocks.pedidoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ estado: "CARGUE_COMPLETO_MANUAL", cargueCompletadoPorId: "u_1" }),
      })
    );
  });

  it("guarda cantidadContadaManual y motivoCierreManual en ambos modelos", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(mocks.cargueUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ cantidadContadaManual: 4, motivoCierreManual: validBody.motivo })
    );
    expect(mocks.pedidoUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ cantidadContadaManual: 4, motivoCierreManual: validBody.motivo })
    );
  });

  it("no modifica cajas ni estibas", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(mocks.estibaCreateMany).not.toHaveBeenCalled();
    expect(mocks.estibaDeleteMany).not.toHaveBeenCalled();
    expect(mocks.cajaCreateMany).not.toHaveBeenCalled();
    expect(mocks.cajaDeleteMany).not.toHaveBeenCalled();
  });

  it("no crea escaneos", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();

    await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(mocks.escaneoCreate).not.toHaveBeenCalled();
  });

  it("intenta notificar al creador del pedido y a ADMIN/GERENTE", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("SUPERVISOR_TRANSPORTE"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();
    mocks.userFindMany.mockResolvedValue([{ id: "u_admin1" }]);

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);

    expect(res.status).toBe(200);
    const notifData = mocks.notificacionCreateMany.mock.calls[0][0].data as Array<{ userId: string; titulo: string }>;
    expect(notifData.some((n) => n.userId === "u_gourmet")).toBe(true);
    expect(notifData.some((n) => n.userId === "u_admin1")).toBe(true);
    expect(notifData[0].titulo).toBe("Cargue Gourmet cerrado manualmente");
  });

  it("responde éxito igual si la notificación falla", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("ADMIN"));
    mockPedido("EN_CARGUE");
    mockCargueValido("EN_CARGUE");
    mockCierreManualResultados();
    mocks.notificacionCreateMany.mockRejectedValue(new Error("db down"));

    const res = await postCierreManual(cierreManualPostReq("p1", validBody), params);
    expect(res.status).toBe(200);
  });
});
