import { describe, expect, it } from "vitest";
import {
  columnasResurtido,
  compararUbicaciones,
  esEjecutor,
  esSolicitante,
  faltanColumnas,
  mapFilaResurtido,
  ordenarPorPosicion,
  progresoMontaje,
  segundosEntre,
  validarCierrePendiente,
  validarCierreTarea,
  validarEscaneoPlu,
  validarEscaneoPosicion,
  validarSolicitudPendiente,
  puedeEditarPendiente,
  colorPendiente,
  compararPorPrioridad,
  devuelveASolicitante,
  esNovedadPendiente,
  puedeAsignarPendiente,
  puedeBorrarPendiente,
} from "@/lib/resurtidoTareas";

// Cabecera real del archivo que suben: PLU · NOMBRE · ALTURA · PICKING ·
// UNIDAD SOLICITADA.
const CABECERA = ["PLU", "NOMBRE ", "ALTURA", "PICKING", "UNIDAD SOLICITADA"];

describe("archivo de resurtido — lectura", () => {
  it("encuentra las columnas por su nombre, no por su sitio", () => {
    const cols = columnasResurtido(CABECERA);
    expect(cols).toEqual({ plu: 0, altura: 2, picking: 3, unidadesSolicitadas: 4 });
    expect(faltanColumnas(cols)).toBeNull();
    // Reordenadas sigue funcionando: es la gracia de buscarlas por encabezado.
    expect(columnasResurtido(["UNIDAD SOLICITADA", "PICKING", "ALTURA", "PLU"]))
      .toEqual({ plu: 3, altura: 2, picking: 1, unidadesSolicitadas: 0 });
  });

  it("avisa de las columnas que faltan en vez de fallar a medias", () => {
    const cols = columnasResurtido(["PLU", "NOMBRE"]);
    expect(faltanColumnas(cols)).toMatch(/ALTURA/);
    expect(faltanColumnas(cols)).toMatch(/PICKING/);
  });

  it("lee una fila real", () => {
    const cols = columnasResurtido(CABECERA);
    expect(mapFilaResurtido([25105, "TAZON CORAL", "02-B-01-02-01", "04-E-04-01-05", 12], cols))
      .toEqual({
        plu: "25105", altura: "02-B-01-02-01", picking: "04-E-04-01-05", unidadesSolicitadas: 12,
      });
  });

  // El NOMBRE del archivo se ignora: puede venir de una exportación vieja y
  // mandaría al operario a coger un producto distinto del que dice la etiqueta.
  it("descarta las filas que no sirven", () => {
    const cols = columnasResurtido(CABECERA);
    expect(mapFilaResurtido(["", "X", "02-B-01", "04-E-04", 3], cols)).toBeNull();
    expect(mapFilaResurtido([0, "X", "02-B-01", "04-E-04", 3], cols)).toBeNull();
    expect(mapFilaResurtido([25105, "X", "", "04-E-04", 3], cols)).toBeNull();
    expect(mapFilaResurtido([25105, "X", "02-B-01", "04-E-04", 0], cols)).toBeNull();
  });
});

// El operario tiene que recorrer el almacén una sola vez y en línea recta: ir
// saltando de pasillo y volver es lo que hace larga una tarea de segundos.
describe("archivo de resurtido — orden de la ruta", () => {
  it("ordena los tramos numéricos como números", () => {
    // Sin esto, 02-B-10 quedaría antes que 02-B-9 por orden alfabético.
    expect(compararUbicaciones("02-B-09-01-01", "02-B-10-01-01")).toBeLessThan(0);
    expect(compararUbicaciones("02-B-10-01-01", "02-B-09-01-01")).toBeGreaterThan(0);
    expect(compararUbicaciones("02-B-01-02-01", "02-B-01-02-01")).toBe(0);
  });

  it("ordena la lista por posición de origen", () => {
    const filas = [
      { plu: "3", altura: "02-C-01-05-02", picking: "x", unidadesSolicitadas: 1 },
      { plu: "1", altura: "02-B-01-02-01", picking: "x", unidadesSolicitadas: 1 },
      { plu: "2", altura: "02-B-12-05-02", picking: "x", unidadesSolicitadas: 1 },
    ];
    expect(ordenarPorPosicion(filas).map((f) => f.plu)).toEqual(["1", "2", "3"]);
  });
});

describe("tarea de resurtido — ejecución", () => {
  // Escanear la posición es lo que arranca el reloj: así el tiempo mide caminar
  // y bajar la mercancía, no el rato que la pantalla estuvo abierta.
  it("solo arranca si escanea la ubicación de la tarea", () => {
    expect(validarEscaneoPosicion("02-b-01-02-01", "02-B-01-02-01")).toBeNull();
    expect(validarEscaneoPosicion("", "02-B-01-02-01")).toMatch(/Escanea/);
    expect(validarEscaneoPosicion("04-E-04-01-05", "02-B-01-02-01"))
      .toMatch(/Ve a 02-B-01-02-01/);
  });

  it("comprueba que el producto es el de la tarea", () => {
    expect(validarEscaneoPlu("25105", "25105")).toBeNull();
    expect(validarEscaneoPlu("99999", "25105")).toMatch(/Buscas el 25105/);
  });

  // Las unidades bajadas pueden no coincidir con las solicitadas: dependen del
  // espacio que quede en el picking.
  it("acepta bajar una cantidad distinta de la solicitada", () => {
    expect(validarCierreTarea({ unidadesBajadas: 5, pickingFinal: "04-E-04-01-05" })).toBeNull();
    expect(validarCierreTarea({ unidadesBajadas: 50, pickingFinal: "04-E-04-01-05" })).toBeNull();
  });

  it("no acepta cerrar sin bajar nada ni sin ubicación", () => {
    expect(validarCierreTarea({ unidadesBajadas: 0, pickingFinal: "04-E-04" })).toMatch(/unidades/);
    expect(validarCierreTarea({ unidadesBajadas: 5, pickingFinal: "  " })).toMatch(/picking/);
  });
});

describe("progreso del montaje", () => {
  it("cuenta las completadas sobre el total", () => {
    expect(progresoMontaje([
      { estado: "COMPLETADA" }, { estado: "COMPLETADA" },
      { estado: "PENDIENTE" }, { estado: "EN_CURSO" },
    ])).toEqual({ total: 4, completadas: 2, porcentaje: 50 });
  });

  // Sin tareas el porcentaje es 0 y no NaN: la barra tiene que poder pintarse.
  it("un montaje vacío no rompe la barra", () => {
    expect(progresoMontaje([])).toEqual({ total: 0, completadas: 0, porcentaje: 0 });
  });
});

describe("pendientes de gourmet", () => {
  it("quien pide y quien ejecuta son roles distintos", () => {
    expect(esSolicitante("OPERACIONES_GOURMET")).toBe(true);
    expect(esEjecutor("OPERACIONES_GOURMET")).toBe(false);
    expect(esEjecutor("OPERARIO_ALMACENAMIENTO")).toBe(true);
    expect(esEjecutor("MONTACARGAS")).toBe(true);
    // Supervisión reparte, no ejecuta.
    expect(esEjecutor("SUPERVISOR_ALMACENAMIENTO")).toBe(false);
  });

  it("la solicitud exige un PLU que exista en el maestro", () => {
    expect(validarSolicitudPendiente({ plu: "3", descripcion: "PLATO", unidadesSolicitadas: 6 }))
      .toBeNull();
    expect(validarSolicitudPendiente({ plu: "3", descripcion: "", unidadesSolicitadas: 6 }))
      .toMatch(/no existe en el maestro/);
    expect(validarSolicitudPendiente({ plu: "3", descripcion: "PLATO", unidadesSolicitadas: 0 }))
      .toMatch(/unidades/);
  });

  it("se cierra con las unidades bajadas y la ubicación", () => {
    expect(validarCierrePendiente({ unidadesBajadas: 4, ubicacionFinal: "05-B-25-03-01" }))
      .toBeNull();
    expect(validarCierrePendiente({ unidadesBajadas: 0, ubicacionFinal: "05-B" }))
      .toMatch(/unidades/);
    expect(validarCierrePendiente({ unidadesBajadas: 4, ubicacionFinal: "" }))
      .toMatch(/ubicación final/);
  });
});

describe("tiempo", () => {
  const t = (h: number, m: number, s = 0) => new Date(Date.UTC(2026, 8, 10, h, m, s)).toISOString();

  it("mide en segundos", () => {
    expect(segundosEntre(t(8, 0), t(8, 0, 42))).toBe(42);
    expect(segundosEntre(t(8, 0), t(9, 30))).toBe(5400);
  });

  // Mientras la tarea no ha empezado no hay duración: null, no cero. Un cero se
  // leería como "tardó nada".
  it("sin inicio no hay duración", () => {
    expect(segundosEntre(null, t(8, 0))).toBeNull();
    expect(segundosEntre(t(8, 0), null)).toBeNull();
    expect(segundosEntre(t(8, 0), null, new Date(Date.UTC(2026, 8, 10, 8, 1)))).toBe(60);
  });
});

// Quien lo pidio lo puede corregir mientras el operario todavia no lo bajo.
describe("pendientes — correccion", () => {
  it("se corrige aunque ya este asignado, pero no una vez ubicado", () => {
    expect(puedeEditarPendiente("SOLICITADO")).toBe(true);
    expect(puedeEditarPendiente("ASIGNADO")).toBe(true);
    expect(puedeEditarPendiente("EN_CURSO")).toBe(true);
    expect(puedeEditarPendiente("NOVEDAD")).toBe(true);
    // Ya ubicado es historia: cambiarlo falsearia lo que de verdad paso.
    expect(puedeEditarPendiente("COMPLETADO")).toBe(false);
  });
});

// Las novedades que puede reportar el operario, y a donde va cada una.
describe("pendientes — novedades del operario", () => {
  it("son las cuatro que se usan en el CEDI", () => {
    for (const n of ["SIN_EXISTENCIAS", "EN_INSPECCION", "AREA_MUEBLES", "EN_PASILLO"]) {
      expect(esNovedadPendiente(n)).toBe(true);
    }
    expect(esNovedadPendiente("OTRA_COSA")).toBe(false);
  });

  // Muebles no es un problema del deposito: se pidio al area equivocada.
  it("solo el area de muebles vuelve a quien lo pidio", () => {
    expect(devuelveASolicitante("AREA_MUEBLES")).toBe(true);
    expect(devuelveASolicitante("SIN_EXISTENCIAS")).toBe(false);
    expect(devuelveASolicitante("EN_INSPECCION")).toBe(false);
    expect(devuelveASolicitante("EN_PASILLO")).toBe(false);
  });
});

// El color es lo que se lee primero en una pila de vinetas.
describe("pendientes — color de la vineta", () => {
  it("sin color si nadie lo tiene", () => {
    expect(colorPendiente("SOLICITADO")).toBe("ninguno");
  });
  it("amarillo mientras un operario lo hace", () => {
    expect(colorPendiente("ASIGNADO")).toBe("amarillo");
    expect(colorPendiente("EN_CURSO")).toBe("amarillo");
  });
  it("verde cuando ya esta ubicado", () => {
    expect(colorPendiente("COMPLETADO")).toBe("verde");
  });
  it("rojo si tiene una novedad o se devolvio", () => {
    expect(colorPendiente("NOVEDAD")).toBe("rojo");
    expect(colorPendiente("DEVUELTO")).toBe("rojo");
  });
});

// Un pendiente es alguien esperando en la tienda: va antes que la rutina.
describe("pendientes — prioridad sobre el resurtido", () => {
  it("lo prioritario va primero aunque este mas lejos en la ruta", () => {
    const tareas = [
      { id: "a", prioridad: false, orden: 1 },
      { id: "b", prioridad: true, orden: 40 },
      { id: "c", prioridad: false, orden: 2 },
    ];
    expect([...tareas].sort(compararPorPrioridad).map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  // Entre iguales se respeta la ruta, para no romper el recorrido en linea recta.
  it("entre iguales manda la posicion", () => {
    const tareas = [
      { id: "x", prioridad: true, orden: 9 },
      { id: "y", prioridad: true, orden: 3 },
    ];
    expect([...tareas].sort(compararPorPrioridad).map((t) => t.id)).toEqual(["y", "x"]);
  });
});

describe("pendientes — quien asigna", () => {
  it("almacenamiento con el permiso, o quien lo pidio", () => {
    expect(puedeAsignarPendiente({ tienePermisoMontar: true, esQuienLoPidio: false })).toBe(true);
    expect(puedeAsignarPendiente({ tienePermisoMontar: false, esQuienLoPidio: true })).toBe(true);
    expect(puedeAsignarPendiente({ tienePermisoMontar: false, esQuienLoPidio: false })).toBe(false);
  });
});

describe("pendientes — quien borra", () => {
  const base = { estado: "ASIGNADO" as const, esAdmin: false, tienePermisoMontar: false, esQuienLoPidio: false };

  // Viviana (lo pidio), Felipe Ossa y Eduardo Zurita (permiso por persona) y el admin.
  it("quien lo pidio, almacenamiento con el permiso y el administrador", () => {
    expect(puedeBorrarPendiente({ ...base, esQuienLoPidio: true })).toBe(true);
    expect(puedeBorrarPendiente({ ...base, tienePermisoMontar: true })).toBe(true);
    expect(puedeBorrarPendiente({ ...base, esAdmin: true })).toBe(true);
    expect(puedeBorrarPendiente(base)).toBe(false);
  });

  it("se puede borrar en cualquier estado menos ya ubicado", () => {
    for (const estado of ["SOLICITADO", "ASIGNADO", "EN_CURSO", "DEVUELTO", "NOVEDAD"] as const) {
      expect(puedeBorrarPendiente({ ...base, estado, esAdmin: true })).toBe(true);
    }
    // Ni el administrador: es historia, y cuenta en los indicadores del operario.
    expect(puedeBorrarPendiente({ ...base, estado: "COMPLETADO", esAdmin: true })).toBe(false);
  });
});
