// Inspección Muebles (24-09): orden sin crear, quién crea y aviso de orden ocupada.
//
// - «Orden sin crear»: OVDM/TSDM que se pickeó pero el operario de picking no
//   registró. La crea el inspector a nombre del operario que la pickeó.
// - Todo lo que se crea desde inspección pregunta antes, en su propia ventana y
//   sin nombre preseleccionado, qué inspector lo crea (se estaban equivocando).
// - Entrar a una orden que ya tiene inspector avisa «¿desea continuar?».
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as indicadores from "@/lib/indicadores";
import { cargarHandlerNuxt, cargarNuxt, h3Falso } from "./apoyo/nuxt";

const mueblesCalc = cargarNuxt("utils/mueblesCalc.ts");
const m = {
  body: vi.fn(), actor: vi.fn(), audit: vi.fn(), tx: vi.fn(), equipo: vi.fn(),
  inspector: { findFirst: vi.fn() }, user: { findFirst: vi.fn() }, orden: { findFirst: vi.fn() },
  crear: vi.fn(), unir: vi.fn(), leer: vi.fn(),
};
const handler = cargarHandlerNuxt("api/inspeccion-muebles/sin-crear.post.ts", {
  h3: h3Falso({ readBody: m.body }),
  "../../utils/prisma": { prisma: { inspector: m.inspector, user: m.user, ordenMuebles: m.orden, $transaction: m.tx } },
  "../../utils/muebles": { auditar: m.audit, equipoDelDia: m.equipo, ORDEN_INCLUDE: {}, requireInspeccion: m.actor },
  "../../utils/mueblesCalc": mueblesCalc,
  "../../utils/exportacionesCalc": { todayBogota: () => new Date("2026-09-24T00:00:00Z") },
  "../../utils/mapRow": { mapOrdenMuebles: (o: unknown) => o },
});
const event = {} as never;

beforeEach(() => {
  vi.resetAllMocks();
  m.actor.mockResolvedValue({ id: "u-insp" });
  m.body.mockResolvedValue({ inspectorId: "i1", orden: " ovdm 121900 ", operarioId: "op1", cliente: "" });
  m.inspector.findFirst.mockResolvedValue({ id: "i1", nombre: "DIEGO" });
  m.user.findFirst.mockResolvedValue({ id: "op1", name: "KEINER" });
  m.orden.findFirst.mockResolvedValue(null);
  m.equipo.mockResolvedValue({ id: "eq1" });
  m.crear.mockResolvedValue({ id: "o1" });
  m.leer.mockResolvedValue({ id: "o1", codigo: "OVDM121900" });
  m.tx.mockImplementation((cb: any) => cb({
    ordenMuebles: { create: m.crear, findUniqueOrThrow: m.leer },
    inspectorOrdenMuebles: { create: m.unir },
  }));
});

describe("crear una orden sin crear", () => {
  it("nace en inspección a nombre del operario que la pickeó, marcada y sin tiempo de picking", async () => {
    await handler(event);
    const data = m.crear.mock.calls[0][0].data;
    expect(data).toMatchObject({
      codigo: "OVDM121900", tipoOrden: "OVDM", estado: "EN_INSPECCION",
      operarioId: "op1", equipoId: "eq1", inspectorId: "i1", sinCrearPicking: true, cliente: null,
    });
    expect(data.horaInicio).toBe(data.horaPasoInspeccion);
    // Participante ya salido: no le bloquea abrir su siguiente orden de picking.
    expect(data.participantes.create).toMatchObject({ usuarioId: "op1", esCreador: true });
    expect(data.participantes.create.salioAt).toBeInstanceOf(Date);
    expect(m.unir).toHaveBeenCalledWith({ data: { ordenId: "o1", inspectorId: "i1" } });
    expect(m.audit.mock.calls[0][4]).toContain("creada por DIEGO");
  });

  it("el operario tiene que ser de picking y estar activo", async () => {
    m.user.findFirst.mockResolvedValue(null);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(m.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: "op1", role: "PICKING_MUEBLES", active: true });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("si ya existe no se duplica; solo OVDM/TSDM; inspector obligatorio", async () => {
    m.orden.findFirst.mockResolvedValue({ estado: "EN_PICKING" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 409 });
    m.orden.findFirst.mockResolvedValue(null);
    m.body.mockResolvedValue({ inspectorId: "i1", orden: "1147395", operarioId: "op1" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    m.body.mockResolvedValue({ inspectorId: "i1", orden: "TSDM1", operarioId: "op1" });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    m.body.mockResolvedValue({ inspectorId: "i1", orden: "TSDM104350", operarioId: "op1" });
    m.inspector.findFirst.mockResolvedValue(null);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("sin equipo del día igual se crea", async () => {
    m.equipo.mockResolvedValue(null);
    await handler(event);
    expect(m.crear.mock.calls[0][0].data.equipoId).toBeNull();
  });
});

describe("analítica: sin crear no tiene tiempo de picking", () => {
  const { medirOrden } = cargarNuxt("utils/mueblesAnaliticaCalc.ts", { "./indicadoresCalc": indicadores });
  const base = {
    id: "o1", codigo: "OVDM1", tipoOrden: "OVDM", estado: "INSPECCIONADA",
    horaInicio: new Date("2026-09-24T14:00:00Z"), horaPasoInspeccion: new Date("2026-09-24T14:00:00Z"),
    horaFinInspeccion: null, entregadaTransporteAt: null, ciudadEnvio: null, pausaSegundos: 0,
    lineas: [], errores: 0, pendientes: 0,
  };
  it("un 0 no entra a los promedios", () => {
    expect(medirOrden({ ...base, sinCrearPicking: true }).pickingMin).toBeNull();
    expect(medirOrden(base).pickingMin).toBe(0);
  });
});

describe("pantalla, esquema e indicadores", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const mod = leer("nuxt-app/app/components/inspeccion-muebles/Module.vue");

  it("tres botones de crear y todos preguntan antes quién crea, sin nombre preseleccionado", () => {
    expect(mod).toContain("@click=\"crear('tienda')\"");
    expect(mod).toContain("@click=\"crear('sinCrear')\"");
    expect(mod).toContain("@click=\"crear('contado')\"");
    expect(mod).toContain("<FilePlus2 :size=\"14\" /> Orden sin crear");
    expect(mod).toMatch(/:abierto="pidiendoCreador != null" :inspectores="inspectores" :seleccionado="null"/);
    // Crear ya no usa el nombre recordado de la PC.
    const crear = mod.slice(mod.indexOf("function confirmarContado"), mod.indexOf("/** Toda acción devuelve"));
    expect(crear).not.toContain("conInspector");
    expect(mod).toContain("body: { ...body, inspectorId: id }");
  });

  it("orden con inspector: aviso con Continuar / Cancelar antes de entrar", () => {
    expect(mod).toContain("if (res.data.inspector || res.data.inspectores.length)");
    expect(mod).toContain("la está inspeccionando ${nombresOcupada}. ¿Desea continuar?");
    expect(mod).toContain('confirm-label="Continuar"');
    expect(mod).toContain('@close="ordenOcupada = null" @confirm="continuarOcupada"');
  });

  it("columna aditiva en los dos schemas y SQL idempotente", () => {
    for (const f of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(f)).toContain('sinCrearPicking Boolean @default(false) @map("sin_crear_picking")');
    }
    expect(leer("prisma/migrate-ordenes-muebles-sin-crear.sql"))
      .toContain("ADD COLUMN IF NOT EXISTS sin_crear_picking boolean NOT NULL DEFAULT false");
  });

  it("indicadores de picking muestran cuántas deja sin crear cada operario", () => {
    expect(leer("nuxt-app/server/api/indicadores-muebles/procesos.get.ts")).toContain("sinCrearPicking: true");
    expect(leer("nuxt-app/app/components/indicadores-muebles/Module.vue")).toContain('titulo="Órdenes sin crear"');
    expect(leer("nuxt-app/server/api/indicadores-muebles/analitica.get.ts")).toContain("sinCrearPicking: o.sinCrearPicking");
  });
});
