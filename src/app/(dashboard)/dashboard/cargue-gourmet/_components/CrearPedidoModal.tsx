"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { apiGet, apiPost, ApiError } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { CIUDAD_TIENDA_CLIENTE, CODIGO_TIENDA_CLIENTE, NOMBRE_TIENDA_CLIENTE, esCodigoTiendaCliente } from "@/lib/gourmetCliente";
import { EscaneoEstibasCreacion, useEscaneoEstibas } from "./EscaneoEstibasCreacion";

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
  onVerExistente,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  // Se llama cuando el backend responde "orden duplicada" (código
  // ORDEN_DUPLICADA), con el id del pedido ya existente. El caller decide qué
  // hacer (p. ej. abrir su detalle/edición) en vez de crear uno nuevo.
  onVerExistente?: (id: string) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicadoId, setDuplicadoId] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<TiendaOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cajasEsperadasNum = parseInt(form.cajasEsperadas, 10);
  const estibasEsperadasNum = parseInt(form.estibasEsperadas, 10);
  const { estibas, setEstibas, totalEscaneado } = useEscaneoEstibas(
    Number.isInteger(estibasEsperadasNum) && estibasEsperadasNum > 0 ? estibasEsperadasNum : 0
  );
  const cajasEsperadasValidas = Number.isInteger(cajasEsperadasNum) && cajasEsperadasNum > 0;
  const escaneoCompleto = cajasEsperadasValidas && totalEscaneado === cajasEsperadasNum;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setError("");
      setDuplicadoId(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setEstibas([]);
    }
  }, [open, setEstibas]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  function onCodigoTiendaChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (esCodigoTiendaCliente(value)) {
      selectTienda({ codigo: CODIGO_TIENDA_CLIENTE, tienda: NOMBRE_TIENDA_CLIENTE, ciudad: CIUDAD_TIENDA_CLIENTE });
      return;
    }

    setForm((f) => ({ ...f, codigoTiendaQuery: value, tiendaSeleccionada: null }));
    setShowSuggestions(true);

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const json = await apiGet<{ data?: TiendaOption[] }>(`/api/cargue-gourmet/maestro-tiendas?q=${encodeURIComponent(value.trim())}`);
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
    setDuplicadoId(null);

    if (!form.orden.trim()) { setError("La orden es obligatoria"); return; }
    if (!form.tiendaSeleccionada) { setError("Selecciona una tienda válida de la lista"); return; }
    const cajas = parseInt(form.cajasEsperadas, 10);
    if (!Number.isInteger(cajas) || cajas <= 0) { setError("Cajas esperadas debe ser un entero mayor a 0"); return; }
    const estibasCount = parseInt(form.estibasEsperadas, 10);
    if (!Number.isInteger(estibasCount) || estibasCount <= 0) { setError("Estibas esperadas debe ser un entero mayor a 0"); return; }
    if (totalEscaneado !== cajas) {
      setError(`Escanea las ${cajas} caja(s) esperadas antes de crear el pedido (llevas ${totalEscaneado}).`);
      return;
    }

    setSaving(true);
    try {
      await apiPost("/api/cargue-gourmet", {
        orden: form.orden.trim(),
        codigoTienda: form.tiendaSeleccionada.codigo,
        cajasEsperadas: cajas,
        estibasEsperadas: estibasCount,
        estibas: estibas.map((e) => ({ secuencia: e.secuencia, cajas: e.cajas })),
      });
      toast.success("Pedido Gourmet creado sin ubicación");
      onCreated();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ORDEN_DUPLICADA") {
        const info = e.data as { id?: string } | undefined;
        if (info?.id) setDuplicadoId(info.id);
      }
      setError(getErrorMessage(e, "No se pudo crear el pedido"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo pedido Gourmet"
      subtitle="Se creará sin ubicación asignada"
      footer={
        <>
          <button type="button" onClick={handleClose} className="g-btn g-btn-ghost" disabled={saving}>Cancelar</button>
          <button
            type="submit"
            form="crear-pedido-gourmet-form"
            className="g-btn g-btn-primary"
            disabled={saving || !escaneoCompleto}
            data-testid="btn-crear-pedido"
          >
            {saving ? "Creando…" : "Crear pedido"}
          </button>
        </>
      }
    >
      <form id="crear-pedido-gourmet-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

        <div style={{ position: "relative" }}>
          <label style={label}>Código tienda</label>
          <input
            value={form.codigoTiendaQuery}
            onChange={(e) => onCodigoTiendaChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar por código, tienda o ciudad… o escribe CLIENTE"
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

        {estibas.length > 0 && (
          <EscaneoEstibasCreacion
            estibas={estibas}
            setEstibas={setEstibas}
            cajasEsperadas={cajasEsperadasValidas ? cajasEsperadasNum : null}
          />
        )}

        {error && (
          <div>
            <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="crear-pedido-error">{error}</p>
            {duplicadoId && onVerExistente && (
              <button
                type="button"
                onClick={() => { onVerExistente(duplicadoId); onClose(); }}
                className="g-btn g-btn-secondary g-btn-sm"
                style={{ marginTop: 8 }}
                data-testid="crear-pedido-ver-existente"
              >
                Editar el pedido existente
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
