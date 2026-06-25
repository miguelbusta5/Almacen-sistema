import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  maestroFindMany: vi.fn(),
  maestroFindUnique: vi.fn(),
  pedidoCount: vi.fn(),
  pedidoFindMany: vi.fn(),
  pedidoCreate: vi.fn(),
  activityLogCreate: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    maestroTiendaGourmet: { findMany: mocks.maestroFindMany, findUnique: mocks.maestroFindUnique },
    gourmetPedido: { count: mocks.pedidoCount, findMany: mocks.pedidoFindMany, create: mocks.pedidoCreate },
    activityLog: { create: mocks.activityLogCreate },
  },
}));

import { GET as getMaestroTiendas } from "@/app/api/cargue-gourmet/maestro-tiendas/route";
import { GET as getPedidos, POST as postPedido } from "@/app/api/cargue-gourmet/route";

function actor(role: string) {
  return { id: "u_1", email: "u@test.com", name: "Usuario Test", role };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activityLogCreate.mockResolvedValue({});
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
