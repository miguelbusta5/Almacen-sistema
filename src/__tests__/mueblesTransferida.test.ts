// Picking Muebles (24-09): orden transferida, pendiente de picking.
//
// Al pasar una orden a un operario que ya tenía otra abierta salía «el operario
// ya tiene una orden activa». Ahora queda transferida a su nombre y la toma
// cuando pasa la suya a inspección; la espera no cuenta en el reloj de picking.
// También: Inspección Muebles trabaja con el nombre de quien entró a la orden.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarHandlerNuxt, h3Falso } from "./apoyo/nuxt";

const m = {
  actor: vi.fn(), orden: vi.fn(), abierta: vi.fn(), equipo: vi.fn(), audit: vi.fn(), tx: vi.fn(),
  update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), leer: vi.fn(),
};
const unirse = cargarHandlerNuxt("api/picking-muebles/[id]/unirse.post.ts", {
  h3: h3Falso({ getRouterParam: () => "o1" }),
  "../../../utils/operacionAlmacen": { defineOperacionAlmacenHandler: (f: unknown) => f },
  "../../../utils/prisma": { prisma: { $transaction: m.tx } },
  "../../../utils/muebles": {
    auditar: m.audit, equipoDelDia: m.equipo, ordenAbierta: m.abierta, ordenPorId: m.orden, ORDEN_INCLUDE: {},
    requirePickingActivo: m.actor,
    esParticipante: (o: any, id: string) => o.participantes.some((p: any) => p.usuarioId === id && !p.salioAt),
  },
  "../../../utils/mapRow": { mapOrdenMuebles: (o: unknown) => o },
});
const event = {} as never;
let orden: any;

beforeEach(() => {
  vi.resetAllMocks();
  orden = {
    id: "o1", codigo: "OVDM1", estado: "EN_PICKING", operario: { name: "A" },
    transferidaAId: "b", transferidaA: { name: "B" }, transferidaAt: new Date(Date.now() - 30 * 60_000),
    participantes: [{ usuarioId: "a", salioAt: new Date() }],
  };
  m.actor.mockResolvedValue({ id: "b" });
  m.orden.mockImplementation(async () => orden);
  m.abierta.mockResolvedValue(null);
  m.equipo.mockResolvedValue({ id: "eq", codigo: "GENIE" });
  m.leer.mockResolvedValue({ id: "o1" });
  m.tx.mockImplementation((cb: any) => cb({
    ordenMuebles: { update: m.update, findUniqueOrThrow: m.leer },
    participanteOrdenMuebles: { upsert: m.upsert },
    lineaMuebles: { updateMany: m.updateMany },
  }));
});

describe("tomar la orden transferida", () => {
  it("entra, limpia la transferencia y la espera sale del reloj de picking", async () => {
    await unirse(event);
    const data = m.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ transferidaAId: null, transferidaAt: null });
    // ~30 min de espera descontados como pausa.
    expect(data.pausaSegundos.increment).toBeGreaterThan(29 * 60);
    expect(data.pausaSegundos.increment).toBeLessThan(31 * 60);
    expect(m.upsert).toHaveBeenCalledOnce();
    expect(m.audit.mock.calls[0][4]).toContain("Tomo la orden transferida OVDM1");
  });

  it("solo la toma a quien se la transfirieron", async () => {
    m.actor.mockResolvedValue({ id: "c" });
    await expect(unirse(event)).rejects.toMatchObject({ statusCode: 409 });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("con su propia orden abierta todavía no puede tomarla", async () => {
    m.abierta.mockResolvedValue({ codigo: "TSDM9" });
    await expect(unirse(event)).rejects.toMatchObject({ statusCode: 409 });
    expect(m.update).not.toHaveBeenCalled();
  });

  it("una orden normal (sin transferir) no toca la pausa", async () => {
    orden.transferidaAId = null; orden.transferidaAt = null;
    m.actor.mockResolvedValue({ id: "c" });
    await unirse(event);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.upsert).toHaveBeenCalledOnce();
  });
});

describe("pantallas, esquema y reglas", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

  it("no se abre otra orden con una transferida pendiente", () => {
    const crear = leer("nuxt-app/server/api/picking-muebles/index.post.ts");
    expect(crear).toContain("where: { transferidaAId: actor.id, estado: 'EN_PICKING', deletedAt: null }");
    expect(crear).toContain("tómala antes de abrir otra");
  });

  it("la pantalla del operario lista las transferidas y las toma por /unirse", () => {
    const mod = leer("nuxt-app/app/components/picking-muebles/Module.vue");
    expect(mod).toContain("Órdenes transferidas a ti · pendientes de picking");
    expect(mod).toContain("`${API_PICKING}/${t.id}/unirse`");
    expect(mod).toContain("transferidas.value = abierta.data.transferidas ?? []");
    expect(leer("nuxt-app/server/api/picking-muebles/abierta.get.ts")).toContain("transferidas: transferidas.map(mapOrdenMuebles)");
  });

  it("columnas aditivas en los dos schemas y SQL idempotente", () => {
    for (const f of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(f)).toContain('transferidaAId String?   @map("transferida_a_id")');
    }
    const sql = leer("prisma/migrate-ordenes-muebles-transferida.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS transferida_a_id text");
    // Sin NOT NULL ni UPDATE de datos (el ON UPDATE CASCADE de la FK no cuenta).
    expect(sql).not.toMatch(/NOT NULL|^\s*UPDATE /m);
  });

  it("inspección: sin nombre recordado en la PC; se trabaja con quien entró a la orden", () => {
    const mod = leer("nuxt-app/app/components/inspeccion-muebles/Module.vue");
    expect(mod).not.toContain("sessionStorage");
    expect(mod).not.toContain("Elegir mi nombre");
    // Al salir se olvida el nombre; al entrar o crear se fija.
    expect(mod).toMatch(/function salir\(\) \{\n  abierta\.value = null\n  inspectorActivo\.value = null/);
    expect(mod).toContain("recordar(id)\n    show(exito(res.data))");
  });
});
