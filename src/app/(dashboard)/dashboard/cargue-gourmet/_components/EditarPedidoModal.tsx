"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { CIUDAD_TIENDA_CLIENTE, CODIGO_TIENDA_CLIENTE, NOMBRE_TIENDA_CLIENTE, esCodigoTiendaCliente } from "@/lib/gourmetCliente";
import { EstibasCajasFieldset } from "./EstibasCajasFieldset";
import {
  type EstibaForm, type CajaForm, type PedidoConEstibasCajas,
  estibasFromPedido, cajasFromPedido, parseEstibasCajas,
} from "./estibasCajasForm";

// Estados desde los que se permite (re)asignar ubicaciones — coincide con las
// transiciones que acepta `POST /api/cargue-gourmet/[id]/ubicacion`
// (`assertTransicionGourmet`, ver `gourmetCargueFlow.ts`): una vez el pedido
// avanza más allá de UBICACION_ASIGNADA esa acción deja de estar disponible
// para todos los roles, incluido ADMIN/GERENTE — no se puede reubicar cajas
// que ya están en cargue o cerradas.
const ESTADOS_CON_UBICACION_EDITABLE = ["BORRADOR", "UBICACION_ASIGNADA"] as const;

const SEARCH_DEBOUNCE_MS = 250;

interface TiendaOption {
  codigo: string;
  tienda: string;
  ciudad: string;
}

export interface PedidoEditable extends PedidoConEstibasCajas {
  id: string;
  orden: string;
  tipoOrden: string;
  estado: string;
  codigoTienda: string;
  nombreTienda: string;
  ciudadDestino: string;
  cajasEsperadas: number;
  estibasEsperadas: number;
  updatedAt: string;
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

function formFromPedido(p: PedidoEditable | null) {
  return {
    orden: p?.orden ?? "",
    codigoTiendaQuery: p?.codigoTienda ?? "",
    tiendaSeleccionada: p ? { codigo: p.codigoTienda, tienda: p.nombreTienda, ciudad: p.ciudadDestino } as TiendaOption : null,
    cajasEsperadas: p ? String(p.cajasEsperadas) : "",
    estibasEsperadas: p ? String(p.estibasEsperadas) : "",
  };
}

export function EditarPedidoModal({
  open,
  pedido,
  onClose,
  onUpdated,
}: {
  open: boolean;
  pedido: PedidoEditable | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(formFromPedido(pedido));
  const [estibas, setEstibas] = useState<EstibaForm[]>(estibasFromPedido(pedido));
  const [cajas, setCajas] = useState<CajaForm[]>(cajasFromPedido(pedido));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Una vez el pedido avanza más allá de UBICACION_ASIGNADA, reubicar cajas
  // deja de tener sentido operativo (ver nota de `ESTADOS_CON_UBICACION_EDITABLE`).
  const puedeEditarUbicacion = !!pedido && (ESTADOS_CON_UBICACION_EDITABLE as readonly string[]).includes(pedido.estado);

  const [suggestions, setSuggestions] = useState<TiendaOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setForm(formFromPedido(pedido));
      setEstibas(estibasFromPedido(pedido));
      setCajas(cajasFromPedido(pedido));
      setError("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [open, pedido]);

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
    if (saving || !pedido) return;
    setError("");

    if (!form.orden.trim()) { setError("La orden es obligatoria"); return; }
    if (!form.tiendaSeleccionada) { setError("Selecciona una tienda válida de la lista"); return; }
    const cajasEsperadas = parseInt(form.cajasEsperadas, 10);
    if (!Number.isInteger(cajasEsperadas) || cajasEsperadas <= 0) { setError("Cajas esperadas debe ser un entero mayor a 0"); return; }
    const estibasEsperadas = parseInt(form.estibasEsperadas, 10);
    if (!Number.isInteger(estibasEsperadas) || estibasEsperadas <= 0) { setError("Estibas esperadas debe ser un entero mayor a 0"); return; }

    // Se valida la ubicación con la cantidad de cajas del formulario (no la
    // original del pedido): si el usuario está corrigiendo cajasEsperadas en
    // este mismo guardado, la suma por estiba debe cuadrar contra el valor
    // nuevo, no contra el que se está corrigiendo.
    let ubicacionPayload: { estibas: { secuencia: number; ubicacion: string; observacion?: string }[]; cajas: { codigoCaja?: string; numeroSecuencia?: number }[] } | undefined;
    if (puedeEditarUbicacion) {
      const parsed = parseEstibasCajas(estibas, cajas, cajasEsperadas);
      if ("error" in parsed) { setError(parsed.error); return; }
      ubicacionPayload = parsed.data;
    }

    setSaving(true);
    try {
      const putRes = await apiPut<{ data: { updatedAt: string } }>(`/api/cargue-gourmet/${pedido.id}`, {
        orden: form.orden.trim(),
        codigoTienda: form.tiendaSeleccionada.codigo,
        cajasEsperadas,
        estibasEsperadas,
        updatedAt: pedido.updatedAt,
      });

      if (ubicacionPayload) {
        await apiPost(`/api/cargue-gourmet/${pedido.id}/ubicacion`, {
          estibas: ubicacionPayload.estibas,
          cajas: ubicacionPayload.cajas.length > 0 ? ubicacionPayload.cajas : undefined,
          updatedAt: putRes.data.updatedAt,
        });
      }

      toast.success(ubicacionPayload ? "Pedido y ubicación actualizados" : "Pedido actualizado");
      onUpdated();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo guardar la edición"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Editar pedido Gourmet"
      subtitle={pedido ? `${pedido.tipoOrden} ${pedido.orden}` : undefined}
      size="lg"
      footer={
        <>
          <button type="button" onClick={handleClose} className="g-btn g-btn-ghost" disabled={saving}>Cancelar</button>
          <button type="submit" form="editar-pedido-gourmet-form" className="g-btn g-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      }
    >
      <form id="editar-pedido-gourmet-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={label}>Orden</label>
          <input
            required
            value={form.orden}
            onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
            maxLength={100}
            style={inp}
            data-testid="editar-orden-input"
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
            data-testid="editar-codigo-tienda-input"
            autoComplete="off"
          />
          {showSuggestions && form.codigoTiendaQuery && !form.tiendaSeleccionada && (
            <div
              data-testid="editar-tienda-suggestions"
              style={{
                position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4,
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                maxHeight: 200, overflowY: "auto", boxShadow: "var(--shadow-md)",
              }}
            >
              {searchLoading && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>Buscando…</div>}
              {!searchLoading && searchError && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--error)" }}>{searchError}</div>}
              {!searchLoading && !searchError && suggestions.length === 0 && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>Sin coincidencias</div>
              )}
              {!searchLoading && suggestions.map((t) => (
                <button
                  type="button"
                  key={t.codigo}
                  data-testid={`editar-tienda-option-${t.codigo}`}
                  onClick={() => selectTienda(t)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text)" }}
                >
                  <strong>{t.codigo}</strong> — {t.tienda} <span style={{ color: "var(--muted)" }}>({t.ciudad})</span>
                </button>
              ))}
            </div>
          )}
          {form.tiendaSeleccionada && (
            <div data-testid="editar-tienda-resuelta" style={{ marginTop: 6, fontSize: 12, color: "var(--muted2)" }}>
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
              data-testid="editar-cajas-esperadas-input"
            />
          </div>
          <div>
            <label style={label}>Estibas esperadas</label>
            <input
              type="number" min={1} required
              value={form.estibasEsperadas}
              onChange={(e) => setForm((f) => ({ ...f, estibasEsperadas: e.target.value }))}
              style={inp}
              data-testid="editar-estibas-esperadas-input"
            />
          </div>
        </div>

        {puedeEditarUbicacion && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 2 }}>
            <label style={{ ...label, marginBottom: 10 }}>Ubicaciones (estibas y cajas)</label>
            <EstibasCajasFieldset
              estibas={estibas}
              setEstibas={setEstibas}
              cajas={cajas}
              setCajas={setCajas}
              cajasEsperadas={parseInt(form.cajasEsperadas, 10) || null}
            />
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }} data-testid="editar-pedido-error">{error}</p>}
      </form>
    </Modal>
  );
}
