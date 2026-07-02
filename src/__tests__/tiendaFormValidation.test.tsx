import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field } from "@/app/(dashboard)/dashboard/tienda/_components";

// Fase 3 (mejora UX Facturas Contado): `Field` acepta `error`/`hint` opcionales
// para validación en vivo. Sin jsdom en el proyecto, se valida el markup
// estático (mismo criterio que el resto de *.render.test.tsx).

describe("Field (tienda) — validación en vivo", () => {
  it("sin error ni hint: solo label + input", () => {
    const html = renderToStaticMarkup(
      <Field label="Centro de costos *"><input className="ds-input" readOnly value="" /></Field>,
    );
    expect(html).toContain("Centro de costos *");
    expect(html).not.toContain('role="alert"');
  });

  it("con error: muestra el mensaje con role=alert", () => {
    const html = renderToStaticMarkup(
      <Field label="Centro de costos *" error="Campo obligatorio">
        <input className="ds-input ds-input-error" readOnly value="" />
      </Field>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Campo obligatorio");
    expect(html).toContain("ds-input-error");
  });

  it("con hint (sin error): muestra el hint sin role=alert", () => {
    const html = renderToStaticMarkup(
      <Field label="Motivo del rechazo *" hint="3/5 caracteres mínimos">
        <textarea className="ds-input" readOnly value="abc" />
      </Field>,
    );
    expect(html).toContain("3/5 caracteres mínimos");
    expect(html).not.toContain('role="alert"');
  });

  it("error tiene prioridad sobre hint", () => {
    const html = renderToStaticMarkup(
      <Field label="Campo" error="Error visible" hint="Hint oculto">
        <input className="ds-input" readOnly value="" />
      </Field>,
    );
    expect(html).toContain("Error visible");
    expect(html).not.toContain("Hint oculto");
  });
});
