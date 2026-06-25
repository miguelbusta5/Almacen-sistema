"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";

const SEARCH_DEBOUNCE_MS = 250;

interface TiendaOption {
  codigo: string;
  tienda: string;
  ciudad: string;
}

const inp: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 12px",
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)",
  color: "var(--text)", outline: "none",
};

const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5,
};

function emptyForm() {
  return {
    orden: "",
    tipoOrden: "OVDM" as "OVDM" | "TSDM",
    codigoTiendaQuery: "",
    tiendaSeleccionada: null as TiendaOption | null,
    cajasEsperadas: "",
    estibasEsperadas: "",
  };
}

export function CrearPedidoModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState<TiendaOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setError("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [open]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  function onCodigoTiendaChange(value: string) {
    setForm((f) => ({ ...f, codigoTiendaQuery: value, tiendaSeleccionada: null }));
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/cargue-gourmet/maestro-tiendas?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) {
          setSearchError("No se pudo buscar tiendas");
          setSuggestions([]);
          return;
        }
        const json = await res.json();
        setSuggestions(json.data ?? []);
      } catch {
        setSearchError("No se pudo buscar tiendas");
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function selectTienda(t: TiendaOption) {
    setForm((f) => ({ ...f, codigoTiendaQuery: t.codigo, tiendaSeleccionada: t }));
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");

    if (!form.orden.trim()) { setError("La orden es obligatoria"); return; }
    if (!form.tiendaSeleccionada) { setError("Selecciona una tienda válida de la lista"); return; }
    const cajas = parseInt(form.cajasEsperadas, 10);
    if (!Number.isInteger(cajas) || cajas <= 0) { setError("Cajas esperadas debe ser un entero mayor a 0"); return; }
    const estibas = parseInt(form.estibasEsperadas, 10);
    if (!Number.isInteger(estibas) || estibas <= 0) { setError("Estibas esperadas debe ser un entero mayor a 0"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/cargue-gourmet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden: form.orden.trim(),
          tipoOrden: form.tipoOrden,
          codigoTienda: form.tiendaSeleccionada.codigo,
          cajasEsperadas: cajas,
          estibasEsperadas: estibas,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo crear el pedido");
        return;
      }
      toast.success("Pedido Gourmet creado en Borrador");
      onCreated();
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
      title="Nuevo pedido Gourmet"
      subtitle="Se creará en estado Borrador"
      footer={
        <>
          <button type="button" onClick={handleClose} className="g-btn g-btn-ghost" disabled={saving}>Cancelar</button>
          <button type="submit" form="crear-pedido-gourmet-form" className="g-btn g-btn-primary" disabled={saving}>
            {saving ? "Creando…" : "Crear pedido"}
          </button>
        </>
      }
    >
      <form id="crear-pedido-gourmet-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
          <div>
            <label style={label}>Orden</label>
            <input
              required
              value={form.orden}
              onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
              placeholder="Ej. TSDM123456"
              maxLength={100}
              style={inp}
              data-testid="orden-input"
            />
          </div>
          <div>
            <label style={label}>Tipo</label>
            <select
              value={form.tipoOrden}
              onChange={(e) => setForm((f) => ({ ...f, tipoOrden: e.target.value as "OVDM" | "TSDM" }))}
              style={inp}
              data-testid="tipo-orden-select"
            >
              <option value="OVDM">OVDM</option>
              <option value="TSDM">TSDM</option>
            </select>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <label style={label}>Código tienda</label>
          <input
            value={form.codigoTiendaQuery}
            onChange={(e) => onCodigoTiendaChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar por código, tienda o ciudad…"
            style={inp}
            data-testid="codigo-tienda-input"
            autoComplete="off"
          />
          {showSuggestions && form.codigoTiendaQuery && !form.tiendaSeleccionada && (
            <div
              data-testid="tienda-suggestions"
              style={{
                position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4,
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                maxHeight: 200, overflowY: "auto", boxShadow: "var(--shadow-md)",
              }}
            >
              {searchLoading && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>Buscando…</div>
              )}
              {!searchLoading && searchError && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--error)" }}>{searchError}</div>
              )}
              {!searchLoading && !searchError && suggestions.length === 0 && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>Sin coincidencias</div>
              )}
              {!searchLoading && suggestions.map((t) => (
                <button
                  type="button"
                  key={t.codigo}
                  data-testid={`tienda-option-${t.codigo}`}
                  onClick={() => selectTienda(t)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text)",
                  }}
                >
                  <strong>{t.codigo}</strong> — {t.tienda} <span style={{ color: "var(--muted)" }}>({t.ciudad})</span>
                </button>
              ))}
            </div>
          )}
          {form.tiendaSeleccionada && (
            <div data-testid="tienda-resuelta" style={{ marginTop: 6, fontSize: 12, color: "var(--muted2)" }}>
              {form.tiendaSeleccionada.tienda} — {form.tiendaSeleccionada.ciudad}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={label}>Cajas esperadas</label>
            <input
              type="number" min={1} required
              value={form.cajasEsperadas}
              onChange={(e) => setForm((f) => ({ ...f, cajasEsperadas: e.target.value }))}
              style={inp}
              data-testid="cajas-esperadas-input"
            />
          </div>
          <div>
            <label style={label}>Estibas esperadas</label>
            <input
              type="number" min={1} required
              value={form.estibasEsperadas}
              onChange={(e) => setForm((f) => ({ ...f, estibasEsperadas: e.target.value }))}
              style={inp}
              data-testid="estibas-esperadas-input"
            />
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="crear-pedido-error">{error}</p>}
      </form>
    </Modal>
  );
}
