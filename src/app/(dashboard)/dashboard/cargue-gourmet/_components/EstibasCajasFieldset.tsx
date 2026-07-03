"use client";

import { useState } from "react";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import type { EstibaForm, CajaForm } from "./estibasCajasForm";
import { emptyEstiba, emptyCaja } from "./estibasCajasForm";

// Fieldset compartido de "estibas + cajas" — usado por `AsignarUbicacionModal`
// y por `EditarPedidoModal`. Solo pinta filas y dispara los setters que le
// pasa el caller; la validación/parseo vive en `estibasCajasForm.ts` y el
// submit en cada modal.
export function EstibasCajasFieldset({
  estibas,
  setEstibas,
  cajas,
  setCajas,
  cajasEsperadas,
}: {
  estibas: EstibaForm[];
  setEstibas: React.Dispatch<React.SetStateAction<EstibaForm[]>>;
  cajas: CajaForm[];
  setCajas: React.Dispatch<React.SetStateAction<CajaForm[]>>;
  cajasEsperadas: number | null;
}) {
  const [mostrarCajas, setMostrarCajas] = useState(false);

  function addEstiba() {
    setEstibas((rows) => [...rows, emptyEstiba()]);
  }
  function removeEstiba(idx: number) {
    setEstibas((rows) => rows.filter((_, i) => i !== idx));
  }
  function updateEstiba(idx: number, patch: Partial<EstibaForm>) {
    setEstibas((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addCaja() {
    setCajas((rows) => [...rows, emptyCaja()]);
  }
  function removeCaja(idx: number) {
    setCajas((rows) => rows.filter((_, i) => i !== idx));
  }
  function updateCaja(idx: number, patch: Partial<CajaForm>) {
    setCajas((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  const totalCajasAsignadas = estibas.reduce((sum, e) => {
    const n = parseInt(e.cantidadCajas, 10);
    return sum + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);
  const totalCoincide = cajasEsperadas != null && totalCajasAsignadas === cajasEsperadas;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>Estibas</label>
          <button type="button" onClick={addEstiba} data-testid="add-estiba-btn" style={{ fontSize: 12, background: "none", border: "none", color: "var(--brand)", cursor: "pointer" }}>
            <Plus size={12} style={{ verticalAlign: "middle" }} /> Añadir estiba
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="estibas-form-list">
          {estibas.map((row, idx) => (
            <div
              key={idx}
              data-testid={`estiba-row-${idx}`}
              style={{
                display: "flex", flexDirection: "column", gap: 6,
                padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }} data-testid={`estiba-label-${idx}`}>
                  Estiba {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeEstiba(idx)}
                  data-testid={`remove-estiba-${idx}`}
                  style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "var(--error-tint)", color: "var(--error)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
                <input
                  placeholder="Ubicación (ej. Pasillo B - Nivel 2)"
                  value={row.ubicacion}
                  onChange={(e) => updateEstiba(idx, { ubicacion: e.target.value })}
                  data-testid={`estiba-ubicacion-${idx}`}
                  style={{ minWidth: 0, width: "100%", height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                />
                <input
                  type="number" min={1} placeholder="Cajas"
                  value={row.cantidadCajas}
                  onChange={(e) => updateEstiba(idx, { cantidadCajas: e.target.value })}
                  data-testid={`estiba-cantidad-${idx}`}
                  style={{ minWidth: 0, width: "100%", height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                />
              </div>
              <input
                placeholder="Observación (opcional)"
                value={row.observacion}
                onChange={(e) => updateEstiba(idx, { observacion: e.target.value })}
                data-testid={`estiba-observacion-${idx}`}
                style={{ height: 32, padding: "0 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
              />
            </div>
          ))}
        </div>

        <div
          data-testid="total-cajas-resumen"
          style={{
            marginTop: 8, fontSize: 12, fontWeight: 600,
            color: cajasEsperadas == null ? "var(--muted)" : totalCoincide ? "var(--success)" : "var(--error)",
          }}
        >
          Total asignado: {totalCajasAsignadas} cajas
          {cajasEsperadas != null && ` / ${cajasEsperadas} esperadas`}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMostrarCajas((v) => !v)}
          data-testid="toggle-codigos-caja"
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
            color: "var(--muted2)", background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <ChevronDown size={13} style={{ transform: mostrarCajas ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          Avanzado: códigos de caja individuales (opcional)
        </button>

        {mostrarCajas && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                Solo si necesitas registrar el código exacto de cada caja para el escaneo.
              </p>
              <button type="button" onClick={addCaja} data-testid="add-caja-btn" style={{ fontSize: 12, background: "none", border: "none", color: "var(--brand)", cursor: "pointer", whiteSpace: "nowrap" }}>
                <Plus size={12} style={{ verticalAlign: "middle" }} /> Añadir caja
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="cajas-form-list">
              {cajas.map((row, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "90px 1fr 28px", gap: 6 }} data-testid={`caja-row-${idx}`}>
                  <input
                    type="number" min={1} placeholder="N°"
                    value={row.numeroSecuencia}
                    onChange={(e) => updateCaja(idx, { numeroSecuencia: e.target.value })}
                    data-testid={`caja-numero-${idx}`}
                    style={{ minWidth: 0, width: "100%", height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                  />
                  <input
                    placeholder="Código de caja (opcional)"
                    value={row.codigoCaja}
                    onChange={(e) => updateCaja(idx, { codigoCaja: e.target.value })}
                    data-testid={`caja-codigo-${idx}`}
                    style={{ minWidth: 0, width: "100%", height: 34, padding: "0 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" }}
                  />
                  <button type="button" onClick={() => removeCaja(idx)} data-testid={`remove-caja-${idx}`} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "var(--error-tint)", color: "var(--error)", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {cajas.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Sin códigos de caja registrados — opcional.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
