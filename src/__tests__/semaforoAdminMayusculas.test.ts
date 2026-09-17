// Semaforo del resurtido por capacidad, el administrador con los permisos por
// persona, nombres en mayuscula y montacarguista que apoya a otro.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calcularPicking, porcentajePicking, semaforoPicking, type PickingBase, type PickingFila } from "@/lib/pickingCalc";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("semaforo del picking", () => {
  it("rojo hasta 25 %, amarillo hasta 50 %, verde por encima", () => {
    expect(semaforoPicking(0)).toBe("ROJO");
    expect(semaforoPicking(25)).toBe("ROJO");
    expect(semaforoPicking(26)).toBe("AMARILLO");
    expect(semaforoPicking(50)).toBe("AMARILLO");
    expect(semaforoPicking(51)).toBe("VERDE");
    expect(semaforoPicking(null)).toBeNull();
  });

  it("el porcentaje es lo que tiene sobre su capacidad", () => {
    expect(porcentajePicking(30, 120)).toBe(25);
    expect(porcentajePicking(null, 120)).toBeNull();
    expect(porcentajePicking(10, 0)).toBeNull();
  });

  it("cada fila del calculo trae su semaforo", () => {
    const base: PickingBase = { plu: "10", ubicacion: "P1", cajas: 10, tipo: "DOBLE", unidadesPorCaja: 12, descripcion: "X" };
    const filas: PickingFila[] = [{ plu: "10", ubicacion: "P1", disponible: 24, concepto: "RETIRO" }];
    const [r] = calcularPicking([base], filas, new Set());
    expect(r).toMatchObject({ porcentaje: 20, semaforo: "ROJO" });
    // Sin el picking en el teorico no se inventa un color.
    expect(calcularPicking([base], [], new Set())[0]).toMatchObject({ porcentaje: null, semaforo: null });
  });

  it("solo se generan las tareas de los picking elegidos", () => {
    const api = leer("nuxt-app/server/api/picking-teorico/accion.post.ts");
    expect(api).toContain("p.filas.filter(f => elegidos.has(f.plu))");
    expect(api).toContain("Selecciona los picking a resurtir");
    const ui = leer("nuxt-app/app/components/picking/Teorico.vue");
    expect(ui).toContain("r.semaforo === 'ROJO' && conTareas(r)");
    expect(ui).toContain("plus: elegidos.value");
  });
});

describe("el administrador tiene los permisos por persona", () => {
  it("montar resurtido y verificar novedades", () => {
    expect(leer("nuxt-app/server/utils/resurtido.ts")).toContain("(u?.role === 'ADMIN' && u.active === true)");
    expect(leer("nuxt-app/server/utils/montacargas.ts")).toContain("(u?.role === 'ADMIN' && u.active === true)");
    const me = leer("nuxt-app/server/api/me.get.ts");
    expect(me).toContain("montarResurtido: user.role === 'ADMIN' ||");
    expect(me).toContain("resolverNovedades: user.role === 'ADMIN' ||");
  });
});

describe("nombres de usuario en mayuscula", () => {
  it("crear y editar guardan el nombre en mayuscula en las dos apps", () => {
    for (const f of ["nuxt-app/server/utils/usuarios.ts", "src/app/api/users/route.ts", "src/app/api/users/[id]/route.ts"]) {
      expect(leer(f)).toMatch(/toUpperCase\(\)/);
    }
  });
});

describe("tareas generales — montacarguista que apoya a otro", () => {
  it("el servidor lo permite, pero no a si mismo", () => {
    const api = leer("nuxt-app/server/api/tareas-generales/index.post.ts");
    expect(api).toContain("['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'].includes(rolDe.get(p)");
    expect(api).toContain("p === m");
  });
});
