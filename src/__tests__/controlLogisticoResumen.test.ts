import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/authz";

const mocks = vi.hoisted(() => ({
  novedadCount: vi.fn(),
  transporteCount: vi.fn(),
  despachoCount: vi.fn(),
  guardadoPendienteCount: vi.fn(),
  solicitudTransporteCount: vi.fn(),
  exportacionCount: vi.fn(),
  exportacionMexicoCount: vi.fn(),
  exportacionEeuuCount: vi.fn(),
  integracionCount: vi.fn(),
  notificacionCount: vi.fn(),
  inspeccionCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    novedad: { count: mocks.novedadCount },
    transporteGuardado: { count: mocks.transporteCount },
    despachoTienda: { count: mocks.despachoCount },
    guardadoPendienteTienda: { count: mocks.guardadoPendienteCount },
    solicitudTransporte: { count: mocks.solicitudTransporteCount },
    etiquetadoExportacion: { count: mocks.exportacionCount },
    etiquetadoExportacionMexico: { count: mocks.exportacionMexicoCount },
    etiquetadoExportacionEeuu: { count: mocks.exportacionEeuuCount },
    integracionPedido: { count: mocks.integracionCount },
    notificacion: { count: mocks.notificacionCount },
    inspeccionPreoperacional: { count: mocks.inspeccionCount },
  },
}));

import { buildControlLogisticoResumen } from "@/lib/controlLogistico/resumen";

function actor(role: SessionUser["role"]): SessionUser {
  return { id: "u_1", email: "u@test.com", name: "Usuario Test", role };
}

describe("buildControlLogisticoResumen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.novedadCount.mockResolvedValue(0);
    mocks.transporteCount.mockResolvedValue(0);
    mocks.despachoCount.mockResolvedValue(0);
    mocks.guardadoPendienteCount.mockResolvedValue(0);
    mocks.solicitudTransporteCount.mockResolvedValue(0);
    mocks.exportacionCount.mockResolvedValue(0);
    mocks.exportacionMexicoCount.mockResolvedValue(0);
    mocks.exportacionEeuuCount.mockResolvedValue(0);
    mocks.integracionCount.mockResolvedValue(0);
    mocks.notificacionCount.mockResolvedValue(0);
    mocks.inspeccionCount.mockResolvedValue(0);
  });

  it("TRANSPORTISTA solo recibe preoperacional y no consulta modulos suspendidos ni tienda", async () => {
    const resumen = await buildControlLogisticoResumen(actor("TRANSPORTISTA"));

    expect(resumen.visibleModules).toEqual(["preoperacional"]);
    expect(resumen.modules.map((m) => m.key)).toEqual(["preoperacional"]);
    expect(resumen.flow).toEqual([]);
    expect(resumen.priorities).toEqual([]);
    expect(mocks.despachoCount).not.toHaveBeenCalled();
    expect(mocks.transporteCount).not.toHaveBeenCalled();
    expect(mocks.integracionCount).not.toHaveBeenCalled();
  });

  it("TIENDA recibe senales de tienda y tareas, sin transporte ni usuarios", async () => {
    mocks.despachoCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);
    mocks.notificacionCount.mockResolvedValueOnce(7);

    const resumen = await buildControlLogisticoResumen(actor("TIENDA"));
    const moduleKeys = resumen.modules.map((m) => m.key);

    expect(resumen.visibleModules).toEqual(["mis-tareas", "tienda", "solicitudes-transporte"]);
    expect(moduleKeys).toEqual(["tienda", "solicitudes-transporte", "mis-tareas"]);
    expect(moduleKeys).not.toContain("transporte");
    expect(moduleKeys).not.toContain("usuarios");
    expect(resumen.priorities.map((p) => p.moduleKey)).toEqual(["tienda", "tienda"]);
    expect(resumen.headline.status).toBe("critical");
    expect(mocks.transporteCount).not.toHaveBeenCalled();
  });

  it("SUPERVISOR_TRANSPORTE combina tienda, transporte, centro-control e integracion permitida", async () => {
    mocks.transporteCount.mockResolvedValueOnce(6);
    mocks.despachoCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(8);
    mocks.guardadoPendienteCount.mockResolvedValueOnce(3);
    mocks.integracionCount.mockResolvedValueOnce(5);
    mocks.inspeccionCount.mockResolvedValueOnce(1);

    const resumen = await buildControlLogisticoResumen(actor("SUPERVISOR_TRANSPORTE"));
    const moduleKeys = resumen.modules.map((m) => m.key);

    expect(resumen.visibleModules).toEqual(["transporte", "preoperacional", "mis-tareas", "tienda", "solicitudes-transporte", "centro-control", "integracion", "cargue-gourmet", "mapa-ciudades"]);
    expect(moduleKeys).toContain("tienda");
    expect(moduleKeys).toContain("transporte");
    expect(moduleKeys).toContain("preoperacional");
    expect(moduleKeys).toContain("integracion");
    expect(moduleKeys).toContain("solicitudes-transporte");
    expect(moduleKeys).toContain("centro-control");
    expect(moduleKeys).not.toContain("usuarios");
    expect(resumen.flow.map((f) => f.key)).toEqual(["tienda", "cedi", "guardados", "cliente"]);
    expect(resumen.priorities.map((p) => p.id)).toContain("guardado-tienda");
  });

  it("ETIQUETADO solo recibe exportaciones", async () => {
    mocks.exportacionCount.mockResolvedValueOnce(1);

    const resumen = await buildControlLogisticoResumen(actor("ETIQUETADO"));

    expect(resumen.visibleModules).toEqual(["exportaciones", "exportaciones-mexico", "exportaciones-eeuu"]);
    expect(resumen.modules.map((m) => m.key)).toEqual(["exportaciones", "exportaciones-mexico", "exportaciones-eeuu"]);
    expect(resumen.actions.map((a) => a.href)).toEqual(["/dashboard/exportaciones"]);
    expect(mocks.exportacionCount).toHaveBeenCalledWith({
      where: { deletedAt: null, horaFinalizacion: null, creadoPorId: "u_1" },
    });
  });
});
