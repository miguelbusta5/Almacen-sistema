"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";

export interface EstibaForm { ubicacion: string; cantidadCajas: string; observacion: string; }
export interface CajaForm { codigoCaja: string; numeroSecuencia: string; }

export interface PedidoUbicable {
  id: string;
  updatedAt: string;
  cajasEsperadas: number;
  estibas: Array<{ secuencia: number; ubicacion: string; observacion: string | null }>;
  cajas: Array<{ numeroSecuencia: number | null; codigoCaja: string | null }>;
}

// ── Codificación de "cajas por estiba" dentro de `observacion` ──────────────
// El modelo de datos real (operación) es "por estiba": cada estiba tiene una
// ubicación y una cantidad de cajas. El esquema actual (`GourmetPedidoEstiba`)
// no tiene una columna `cantidadCajas` — solo `secuencia`, `ubicacion` y
// `observacion` libre. Para no tocar Prisma/el endpoint en esta fase de UI,
// la cantidad de cajas se codifica como un prefijo `[cajas:N]` dentro del
// mismo texto de `observacion` que el backend ya acepta y persiste tal cual.
const CAJAS_TAG_RE = /^\[cajas:(\d+)\]\s*(?:·\s*(.*))?$/;

export function decodeEstibaObservacion(raw: string | null): { cantidadCajas: number | null; observacion: string } {
  if (!raw) return { cantidadCajas: null, observacion: "" };
  const m = raw.match(CAJAS_TAG_RE);
  if (!m) return { cantidadCajas: null, observacion: raw };
  return { cantidadCajas: parseInt(m[1], 10), observacion: m[2] ?? "" };
}

function encodeEstibaObservacion(cantidadCajas: number, observacion: string): string {
  const obs = observacion.trim();
  return obs ? `[cajas:${cantidadCajas}] · ${obs}` : `[cajas:${cantidadCajas}]`;
}

function emptyEstiba(): EstibaForm {
  return { ubicacion: "", cantidadCajas: "", observacion: "" };
}
function emptyCaja(): CajaForm {
  return { codigoCaja: "", numeroSecuencia: "" };
}

function estibasFromPedido(p: PedidoUbicable | null): EstibaForm[] {
  if (!p || p.estibas.length === 0) return [emptyEstiba()];
  return p.estibas
    .slice()
    .sort((a, b) => a.secuencia - b.secuencia)
    .map((e) => {
      const { cantidadCajas, observacion } = decodeEstibaObservacion(e.observacion);
      return {
        ubicacion: e.ubicacion,
        cantidadCajas: cantidadCajas != null ? String(cantidadCajas) : "",
        observacion,
      };
    });
}
function cajasFromPedido(p: PedidoUbicable | null): CajaForm[] {
  return (p?.cajas ?? []).map((c) => ({
    codigoCaja: c.codigoCaja ?? "",
    numeroSecuencia: c.numeroSecuencia != null ? String(c.numeroSecuencia) : "",
  }));
}

export function AsignarUbicacionModal({
  open,
  pedido,
  onClose,
  onSaved,
}: {
  open: boolean;
  pedido: PedidoUbicable | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [estibas, setEstibas] = useState<EstibaForm[]>(estibasFromPedido(pedido));
  const [cajas, setCajas] = useState<CajaForm[]>(cajasFromPedido(pedido));
  const [mostrarCajas, setMostrarCajas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEstibas(estibasFromPedido(pedido));
      setCajas(cajasFromPedido(pedido));
      setMostrarCajas(false);
      setError("");
    }
  }, [open, pedido]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

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
  const cajasEsperadas = pedido?.cajasEsperadas ?? null;
  const totalCoincide = cajasEsperadas != null && totalCajasAsignadas === cajasEsperadas;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !pedido) return;
    setError("");

    if (estibas.length === 0) { setError("Agrega al menos una estiba"); return; }

    const estibasParsed: { secuencia: number; ubicacion: string; observacion?: string }[] = [];
    let sumaCajas = 0;
    for (let i = 0; i < estibas.length; i++) {
      const row = estibas[i];
      if (!row.ubicacion.trim()) { setError(`Estiba ${i + 1}: indica la ubicación`); return; }
      const cantidad = parseInt(row.cantidadCajas, 10);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        setError(`Estiba ${i + 1}: indica la cantidad de cajas (mayor a 0)`);
        return;
      }
      sumaCajas += cantidad;
      estibasParsed.push({
        secuencia: i + 1,
        ubicacion: row.ubicacion.trim(),
        observacion: encodeEstibaObservacion(cantidad, row.observacion),
      });
    }

    if (sumaCajas !== pedido.cajasEsperadas) {
      setError(
        `La suma de cajas por estiba (${sumaCajas}) no coincide con las cajas esperadas del pedido (${pedido.cajasEsperadas})`
      );
      return;
    }

    const cajasParsed: { codigoCaja?: string; numeroSecuencia?: number }[] = [];
    for (const row of cajas) {
      if (!row.codigoCaja.trim() && !row.numeroSecuencia.trim()) continue;
      const entry: { codigoCaja?: string; numeroSecuencia?: number } = {};
      if (row.codigoCaja.trim()) entry.codigoCaja = row.codigoCaja.trim();
      if (row.numeroSecuencia.trim()) {
        const n = parseInt(row.numeroSecuencia, 10);
        if (!Number.isInteger(n) || n <= 0) { setError("El número de secuencia de caja debe ser un entero mayor a 0"); return; }
        entry.numeroSecuencia = n;
      }
      cajasParsed.push(entry);
    }
    const numerosCaja = cajasParsed.map((c) => c.numeroSecuencia).filter((n): n is number => n !== undefined);
    if (new Set(numerosCaja).size !== numerosCaja.length) {
      setError("No puede haber dos cajas con el mismo número de secuencia");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/cargue-gourmet/${pedido.id}/ubicacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estibas: estibasParsed,
          cajas: cajasParsed.length > 0 ? cajasParsed : undefined,
          updatedAt: pedido.updatedAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar la ubicación");
        return;
      }
      toast.success("Ubicación asignada");
      onSaved();
      onClose();
    } catch {
      setError("Error de red — verifica tu conexión e intenta de nuevo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Asignar ubicación"
      subtitle="Una ubicación y cantidad de cajas por cada estiba"
      size="lg"
      footer={
        <>
          <button type="button" onClick={handleClose} className="g-btn g-btn-ghost" disabled={saving}>Cancelar</button>
          <button type="submit" form="asignar-ubicacion-form" className="g-btn g-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar ubicación"}
          </button>
        </>
      }
    >
      <form id="asignar-ubicacion-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="ubicacion-error">{error}</p>}
      </form>
    </Modal>
  );
}
