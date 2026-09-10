import { describe, expect, it } from "vitest";
import {
  esDescargador,
  exigeFoto,
  normalizarPedido,
  normalizarProveedor,
  puedeGestionarRecepcion,
  puedeUsarRecepcion,
  segundosRecepcion,
  unidadesPorHora,
  validarApertura,
  validarCierre,
  validarLineaNovedad,
} from "@/lib/recepcionContenedores";

const apertura = {
  numeroPedido: "PEDDM11887",
  proveedor: "Importadora del Norte",
  tipoProducto: "GOURMET",
  pesoKg: 12500.5,
  referenciasEsperadas: 40,
  cajas: 900,
  unidades: 21600,
  descargadores: ["u1", "u2"],
};

describe("recepcion — quien lleva la planilla", () => {
  // Los montacarguistas descargan pero NO abren planillas: la lleva siempre la
  // misma figura, y ellos salen en la lista de personas descargando.
  it("el montacarguista descarga pero no abre la planilla", () => {
    expect(puedeUsarRecepcion("MONTACARGAS")).toBe(false);
    expect(esDescargador("MONTACARGAS")).toBe(true);
  });

  it("el operario de almacenamiento abre y tambien descarga", () => {
    expect(puedeUsarRecepcion("OPERARIO_ALMACENAMIENTO")).toBe(true);
    expect(esDescargador("OPERARIO_ALMACENAMIENTO")).toBe(true);
  });

  it("supervision gestiona; el operario no", () => {
    expect(puedeGestionarRecepcion("SUPERVISOR_ALMACENAMIENTO")).toBe(true);
    expect(puedeGestionarRecepcion("ADMIN")).toBe(true);
    expect(puedeGestionarRecepcion("OPERARIO_ALMACENAMIENTO")).toBe(false);
  });

  it("un rol de otro modulo no entra", () => {
    expect(puedeUsarRecepcion("TIENDA")).toBe(false);
    expect(puedeUsarRecepcion(null)).toBe(false);
    // Y supervision de almacenamiento no convierte a nadie en descargador.
    expect(esDescargador("SUPERVISOR_ALMACENAMIENTO")).toBe(false);
  });
});

describe("recepcion — apertura", () => {
  it("acepta una planilla completa", () => {
    expect(validarApertura(apertura)).toBeNull();
  });

  // Guardar ARRANCA EL RELOJ: abrir a medias dejaria un cronometro corriendo
  // sobre datos que nadie puede interpretar despues.
  it("exige todo antes de arrancar el reloj", () => {
    expect(validarApertura({ ...apertura, numeroPedido: "  " })).toMatch(/número del pedido/);
    expect(validarApertura({ ...apertura, proveedor: "" })).toMatch(/proveedor/);
    expect(validarApertura({ ...apertura, tipoProducto: "OTRO" })).toMatch(/gourmet o muebles/);
    expect(validarApertura({ ...apertura, pesoKg: 0 })).toMatch(/peso/);
    expect(validarApertura({ ...apertura, referenciasEsperadas: 0 })).toMatch(/referencias/);
    expect(validarApertura({ ...apertura, unidades: 0 })).toMatch(/unidades/);
  });

  // Sin nadie descargando el indicador por persona no puede existir, que es
  // media razon de ser del modulo.
  it("no deja abrir sin personas descargando", () => {
    expect(validarApertura({ ...apertura, descargadores: [] })).toMatch(/persona descargando/);
  });

  it("normaliza el pedido y el proveedor", () => {
    expect(normalizarPedido(" peddm 11887 ")).toBe("PEDDM11887");
    expect(normalizarProveedor("  Importadora   del  Norte ")).toBe("Importadora del Norte");
  });
});

describe("recepcion — cierre", () => {
  it("acepta un cierre coherente", () => {
    expect(validarCierre({ estibasUsadas: 22, referenciasNuevas: 3, unidadesNuevas: 120 })).toBeNull();
    // Sin referencias nuevas tampoco hay unidades nuevas: es valido y comun.
    expect(validarCierre({ estibasUsadas: 22, referenciasNuevas: 0, unidadesNuevas: 0 })).toBeNull();
  });

  it("exige las estibas usadas", () => {
    expect(validarCierre({ estibasUsadas: 0, referenciasNuevas: 0, unidadesNuevas: 0 }))
      .toMatch(/estibas/);
  });

  // Son la misma cifra contada de dos formas: descuadradas no significan nada.
  it("no deja referencias nuevas sin unidades, ni al reves", () => {
    expect(validarCierre({ estibasUsadas: 5, referenciasNuevas: 0, unidadesNuevas: 40 }))
      .toMatch(/ninguna referencia nueva/);
    expect(validarCierre({ estibasUsadas: 5, referenciasNuevas: 2, unidadesNuevas: 0 }))
      .toMatch(/ninguna unidad/);
  });
});

describe("recepcion — novedades", () => {
  const linea = { plu: "3", descripcion: "PLATO SIMPLE 25CM", cantidad: 4, fotoUrl: null };

  it("faltantes y sobrantes no necesitan foto", () => {
    expect(exigeFoto("FALTANTE")).toBe(false);
    expect(exigeFoto("SOBRANTE")).toBe(false);
    expect(validarLineaNovedad(linea, "FALTANTE")).toBeNull();
  });

  // La foto es la prueba con la que se le reclama al proveedor: un reporte de
  // averia sin foto no sirve para lo unico que se levanta.
  it("averias y maltratada exigen foto", () => {
    expect(exigeFoto("AVERIA")).toBe(true);
    expect(exigeFoto("MALTRATADA")).toBe(true);
    expect(validarLineaNovedad(linea, "AVERIA")).toMatch(/foto/);
    expect(validarLineaNovedad({ ...linea, fotoUrl: "https://x/y.jpg" }, "AVERIA")).toBeNull();
  });

  it("un PLU que no esta en el maestro no se puede reportar", () => {
    expect(validarLineaNovedad({ ...linea, descripcion: "" }, "FALTANTE"))
      .toMatch(/no existe en el maestro/);
  });

  it("la cantidad tiene que ser al menos 1", () => {
    expect(validarLineaNovedad({ ...linea, cantidad: 0 }, "FALTANTE")).toMatch(/al menos 1/);
  });
});

describe("recepcion — tiempo", () => {
  const t = (h: number, m: number) => new Date(Date.UTC(2026, 8, 10, h, m)).toISOString();

  it("mide en segundos de punta a punta", () => {
    // Una recepcion es un bloque continuo: no hay tramos como en montacargas.
    expect(segundosRecepcion(t(8, 0), t(10, 30))).toBe(9000);
  });

  it("sin cierre no hay duracion, salvo que se pida contra ahora", () => {
    expect(segundosRecepcion(t(8, 0), null)).toBeNull();
    expect(segundosRecepcion(t(8, 0), null, new Date(Date.UTC(2026, 8, 10, 8, 5)))).toBe(300);
  });

  // El ritmo es lo que permite comparar un contenedor con otro: ni las unidades
  // ni los minutos sueltos dicen si se fue rapido.
  it("calcula el ritmo en unidades por hora", () => {
    expect(unidadesPorHora(21600, 9000)).toBe(8640);
    expect(unidadesPorHora(100, 0)).toBeNull();
    expect(unidadesPorHora(100, null)).toBeNull();
  });
});
