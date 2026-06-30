import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransporteAccionesBar } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/TransporteAccionesBar";
import { EscaneoCajasPanel, type ProgresoEscaneo, type ResultadoEscaneo, type UltimoResultadoEscaneo } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/EscaneoCajasPanel";
import type { EstadoPedidoGourmet } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components";

const ALL_ESTADOS: EstadoPedidoGourmet[] = [
  "BORRADOR", "UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE", "EN_CARGUE",
  "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO",
];

function renderIniciar(estado: EstadoPedidoGourmet, puedeTransporte = true) {
  return renderToStaticMarkup(
    <TransporteAccionesBar estado={estado} puedeTransporte={puedeTransporte} onIniciarCargue={() => {}} />
  );
}

describe("TransporteAccionesBar — 'Iniciar cargue' por rol", () => {
  it("aparece para TRANSPORTE (puedeTransporte=true) en ENVIADO_A_TRANSPORTE", () => {
    expect(renderIniciar("ENVIADO_A_TRANSPORTE", true)).toContain('data-testid="btn-iniciar-cargue"');
  });

  it("aparece para SUPERVISOR_TRANSPORTE en ENVIADO_A_TRANSPORTE (mismo flag puedeTransporte)", () => {
    expect(renderIniciar("ENVIADO_A_TRANSPORTE", true)).toContain("Iniciar cargue");
  });

  it("aparece para ADMIN/GERENTE en ENVIADO_A_TRANSPORTE (mismo flag puedeTransporte)", () => {
    expect(renderIniciar("ENVIADO_A_TRANSPORTE", true)).toContain('data-testid="btn-iniciar-cargue"');
  });

  it("NO aparece cuando puedeTransporte=false (sin permiso de cargue)", () => {
    expect(renderIniciar("ENVIADO_A_TRANSPORTE", false)).toBe("");
  });
});

describe("TransporteAccionesBar — 'Iniciar cargue' por estado", () => {
  it("aparece SOLO en ENVIADO_A_TRANSPORTE", () => {
    expect(renderIniciar("ENVIADO_A_TRANSPORTE")).toContain('data-testid="btn-iniciar-cargue"');
  });

  it.each(["BORRADOR", "UBICACION_ASIGNADA", "EN_CARGUE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO"] as EstadoPedidoGourmet[])(
    "NO aparece en %s",
    (estado) => expect(renderIniciar(estado)).not.toContain('data-testid="btn-iniciar-cargue"')
  );
});

function renderEscaneo(opts: {
  estado: EstadoPedidoGourmet;
  puedeTransporte?: boolean;
  progreso?: ProgresoEscaneo | null;
  ultimoResultado?: UltimoResultadoEscaneo | null;
}) {
  return renderToStaticMarkup(
    <EscaneoCajasPanel
      estado={opts.estado}
      puedeTransporte={opts.puedeTransporte ?? true}
      progreso={opts.progreso ?? null}
      ultimoResultado={opts.ultimoResultado ?? null}
      onEscanear={async () => true}
    />
  );
}

describe("EscaneoCajasPanel — visibilidad por rol/estado", () => {
  it("aparece para TRANSPORTE en EN_CARGUE", () => {
    const html = renderEscaneo({ estado: "EN_CARGUE", puedeTransporte: true });
    expect(html).toContain("Escaneo de cajas");
    expect(html).toContain('data-testid="escaneo-input"');
  });

  it("NO aparece cuando puedeTransporte=false (sin permiso de cargue)", () => {
    expect(renderEscaneo({ estado: "EN_CARGUE", puedeTransporte: false })).toBe("");
  });

  it("NO aparece en ENVIADO_A_TRANSPORTE", () => {
    expect(renderEscaneo({ estado: "ENVIADO_A_TRANSPORTE" })).toBe("");
  });

  it.each(ALL_ESTADOS.filter((e) => e !== "EN_CARGUE"))(
    "NO aparece en %s",
    (estado) => expect(renderEscaneo({ estado })).toBe("")
  );
});

describe("EscaneoCajasPanel — progreso", () => {
  it("renderiza escaneados/esperados y porcentaje", () => {
    const html = renderEscaneo({ estado: "EN_CARGUE", progreso: { escaneados: 3, esperados: 10 } });
    expect(html).toContain('data-testid="progreso-escaneo"');
    expect(html).toContain("3 / 10");
    expect(html).toContain("30%");
  });

  it("marca como Completo cuando escaneados >= esperados", () => {
    const html = renderEscaneo({ estado: "EN_CARGUE", progreso: { escaneados: 5, esperados: 5 } });
    expect(html).toContain("Completo");
  });

  it("marca como Incompleto cuando faltan cajas y no hay novedad", () => {
    const html = renderEscaneo({ estado: "EN_CARGUE", progreso: { escaneados: 1, esperados: 5 } });
    expect(html).toContain("Incompleto");
  });

  it("marca como 'Con novedad' si el último resultado es un error operativo", () => {
    const html = renderEscaneo({
      estado: "EN_CARGUE",
      progreso: { escaneados: 1, esperados: 5 },
      ultimoResultado: { codigo: "X", resultado: "CAJA_AJENA" },
    });
    expect(html).toContain("Con novedad");
  });

  it("sin progreso muestra guion", () => {
    const html = renderEscaneo({ estado: "EN_CARGUE", progreso: null });
    expect(cellText(html)).toContain("—");
  });
});

function cellText(html: string): string {
  const m = html.match(/data-testid="progreso-escaneo"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  return m ? m[1] : html;
}

describe("EscaneoCajasPanel — último resultado", () => {
  const casos: { resultado: ResultadoEscaneo; texto: string }[] = [
    { resultado: "VALIDO", texto: "Caja válida" },
    { resultado: "DUPLICADO", texto: "Caja duplicada" },
    { resultado: "CAJA_AJENA", texto: "Caja ajena" },
    { resultado: "FORMATO_INVALIDO", texto: "Formato inválido" },
    { resultado: "EXCEDE_CANTIDAD", texto: "Excede cantidad esperada" },
  ];

  for (const { resultado, texto } of casos) {
    it(`renderiza el resultado ${resultado} como "${texto}"`, () => {
      const html = renderEscaneo({ estado: "EN_CARGUE", ultimoResultado: { codigo: "ABC123", resultado } });
      expect(html).toContain('data-testid="ultimo-resultado-escaneo"');
      expect(html).toContain(texto);
      expect(html).toContain("ABC123");
    });
  }
});

describe("EscaneoCajasPanel / TransporteAccionesBar — sin cierre manual cuando puedeCierreManual=false (cierre manual real llegó en G3C7)", () => {
  it("renderIniciar/renderEscaneo (sin puedeCierreManual) no muestran 'Cierre manual' en ningún estado", () => {
    for (const estado of ALL_ESTADOS) {
      const htmlIniciar = renderIniciar(estado);
      const htmlEscaneo = renderEscaneo({ estado });
      expect(htmlIniciar).not.toContain("Cierre manual");
      expect(htmlEscaneo).not.toContain("Cierre manual");
    }
  });
});

describe("EscaneoCajasPanel — pendiente de cobertura (documentado, requiere jsdom)", () => {
  it.todo("submit por Enter envía el código y limpia el input al éxito (requiere jsdom)");
  it.todo("conserva el texto escrito si el escaneo falla por red (requiere jsdom)");
  it.todo("mantiene foco en el input después de cada escaneo (requiere jsdom)");
  it.todo("ConfirmModal de iniciar cargue llama POST /iniciar-cargue con updatedAt (requiere jsdom)");
  it.todo("409 de iniciar cargue muestra mensaje del backend y refresca el detalle (requiere jsdom)");
});
