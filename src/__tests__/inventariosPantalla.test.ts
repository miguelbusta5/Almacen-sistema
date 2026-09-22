// La pantalla del conteo cíclico: escanear, contar una ubicación a la vez y
// volver al escaneo.
//
// Los archivos de Nuxt se leen como TEXTO (ver apoyo/nuxt.ts). Lo que se fija
// aquí es lo que hizo inusable el módulo el 22-09: el `min=1` del empaque, la
// lista de 2.106 ubicaciones encima del formulario y el borrador que no se
// borraba nunca.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const panel = leer("nuxt-app/app/components/inventarios/Panel.vue");
const captura = leer("nuxt-app/app/components/inventarios/CapturaModal.vue");
const utils = leer("nuxt-app/app/utils/inventario.ts");
const calc = cargarNuxt("utils/inventarioCiclicoCalc.ts");

describe("captura de una ubicación", () => {
  it("ningún campo exige un mínimo de 1", () => {
    expect(captura).not.toMatch(/min="1"/);
    expect(captura).toContain('min="0"');
    // Teclado numérico en la Zebra y campos de 16px o más (sin zoom en móvil).
    expect(captura).toContain('inputmode="numeric"');
    expect(captura).toContain(".field.grande { height: 46px; font-size: 16px; }");
  });

  it("avisa del cero y solo bloquea si hay cajas sin unidad de empaque", () => {
    expect(captura).toContain("faltaUnidadEmpaque");
    expect(captura).toContain("Vas a guardar cero");
    expect(captura).toContain(':disabled="guardando || faltaEmpaque"');
  });

  it("tapa la lista: una ubicación a la vez", () => {
    expect(captura).toContain(".overlay { position: fixed");
    expect(captura).toContain('role="dialog"');
  });
});

describe("la pantalla del operario", () => {
  it("se trabaja escaneando y el foco vuelve solo", () => {
    expect(panel).toContain("function escanear()");
    expect(panel).toContain("traerTarea({ ubicacion: texto })");
    // Al terminar, el campo de escaneo queda listo para la siguiente.
    expect(panel).toMatch(/async function cerrarCaptura\(\)[\s\S]*await enfocarEscaneo\(\)/);
    expect(panel).toContain("sonarVeredicto('VALIDO')");
    expect(panel).toContain("useToast");
  });

  it("borra el borrador al guardar y al terminar", () => {
    expect(panel).toContain("localStorage.removeItem");
    const cuerpo = (nombre: string) => {
      const desde = panel.indexOf(`async function ${nombre}`);
      const fin = panel.indexOf("async function", desde + 1);
      return panel.slice(desde, fin > 0 ? fin : undefined);
    };
    expect(cuerpo("guardar")).toContain("borrarBorrador()");
    expect(cuerpo("terminar")).toContain("borrarBorrador()");
  });

  it("no pide las 2.106 ubicaciones de una: pagina y busca", () => {
    expect(panel).toContain("pageSize: 50");
    expect(panel).toContain("q: busca.value.trim()");
    expect(panel).toContain("Solo las que me faltan");
  });

  it("usa el diseño del sistema, no clases inventadas", () => {
    for (const clase of ['class="card', 'class="btn', 'class="field']) expect(panel).toContain(clase);
    expect(panel).toContain("@lucide/vue");
  });
});

describe("el servidor manda lo justo", () => {
  const ciclos = leer("nuxt-app/server/api/inventarios/ciclos.get.ts");
  const tarea = leer("nuxt-app/server/api/inventarios/tarea.get.ts");

  it("la lista de ubicaciones no arrastra el teórico ni los registros", () => {
    const seleccion = ciclos.slice(ciclos.indexOf("prisma.inventarioTarea.findMany"));
    expect(seleccion).not.toContain("filas: true");
    expect(seleccion).not.toContain("teorico: true");
    // Los registros solo se cuentan; el contenido se pide al abrir la ubicación.
    expect(seleccion).toContain("_count: { select: { registros: true } }");
    expect(seleccion).not.toContain("include: { registros");
    expect(ciclos).toContain("sanearPaginacion");
  });

  it("el teórico solo viaja con detalle=1 y solo para el gestor", () => {
    expect(ciclos).toContain("const detalle = String(q.detalle ?? '') === '1' && permisos.gestionar");
  });

  it("una ubicación se puede pedir por lo escaneado", () => {
    expect(tarea).toContain("buscarTareaPorUbicacion");
    expect(tarea).toContain("esperadosDeUbicacion");
  });
});

describe("resolver la ubicación escaneada", () => {
  const tareas = [
    { id: "1", ubicacion: "04-A-01", tipo: "INICIAL", estado: "PENDIENTE", usuarioId: "juan" },
    { id: "2", ubicacion: "04-A-02", tipo: "INICIAL", estado: "COMPLETADA", usuarioId: "juan" },
    { id: "3", ubicacion: "04-A-03", tipo: "INICIAL", estado: "PENDIENTE", usuarioId: "keiner" },
  ];

  it("encuentra la suya sin importar mayúsculas ni espacios", () => {
    expect(calc.buscarTareaPorUbicacion(tareas, " 04-a-01 ", "juan")).toEqual({ tarea: tareas[0] });
  });

  it("dice por qué no sirve: ajena, terminada o inexistente", () => {
    expect(calc.buscarTareaPorUbicacion(tareas, "04-A-03", "juan")).toEqual({ motivo: "AJENA" });
    expect(calc.buscarTareaPorUbicacion(tareas, "04-A-02", "juan")).toEqual({ motivo: "COMPLETADA" });
    expect(calc.buscarTareaPorUbicacion(tareas, "99-Z-99", "juan")).toEqual({ motivo: "NO_EXISTE" });
    expect(calc.buscarTareaPorUbicacion(tareas, "", "juan")).toEqual({ motivo: "NO_EXISTE" });
  });

  it("entre el conteo y su reconteo, prefiere el que ya arrancó", () => {
    const dos = [
      { id: "a", ubicacion: "04-A-01", tipo: "INICIAL", estado: "PENDIENTE", usuarioId: "juan" },
      { id: "b", ubicacion: "04-A-01", tipo: "RECONTEO", estado: "EN_CURSO", usuarioId: "juan" },
    ];
    expect(calc.buscarTareaPorUbicacion(dos, "04-A-01", "juan")).toEqual({ tarea: dos[1] });
  });

  it("filtra y resume la lista", () => {
    expect(calc.filtrarTareas(tareas, { q: "04-a-0" }).length).toBe(3);
    expect(calc.filtrarTareas(tareas, { q: "02" })).toEqual([tareas[1]]);
    expect(calc.filtrarTareas(tareas, { estado: "PENDIENTE", usuarioId: "juan" })).toEqual([tareas[0]]);
    expect(calc.resumenTareas(tareas)).toEqual({ total: 3, pendientes: 2, enCurso: 0, completadas: 1 });
  });
});

describe("la regla del cero es la misma en pantalla y en el servidor", () => {
  it("cajas sin empaque es lo único que se rechaza", () => {
    // La copia de la UI se lee como texto: en CI no se puede importar de nuxt-app.
    expect(utils).toContain("export function faltaUnidadEmpaque");
    expect(utils).toContain("Number(cajas ?? 0) > 0 && !(Number(empaque ?? 0) > 0)");
    expect(calc.fisicoInventario(0, 0, 0)).toBe(0);
    expect(calc.fisicoInventario(0, 0, 7)).toBe(7);
    expect(() => calc.fisicoInventario(3, 0, 0)).toThrow();
  });
});
