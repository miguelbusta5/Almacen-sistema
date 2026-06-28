"use client";

// ═══════════════════════════════════════════════════════════
// INVENTARIO MÓVIL — Mobile-first, optimizado para Android
// Objetivo: registrar novedad en < 20 segundos, una sola mano
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import {
  Plus, X, Camera, Search, RefreshCw,
  CheckCircle2, Minus, Package, ChevronDown,
  AlertCircle, ImageOff, Loader,
} from "lucide-react";
import { EmptyState } from "@/components/ui";
import {
  Novedad, EstadoNovedad, TipoNovedad,
  ESTADO_COLOR, estadoLabel, todayISO, fmtFecha,
} from "@/lib/muebles";
import { getModuleCssVars } from "@/lib/moduleTheme";

// ── Paleta de tipos de novedad (compacta para chips) ─────
const CHIP_TIPOS: Array<{ id: TipoNovedad; label: string; color: string }> = [
  { id: "FALTANTE",       label: "Faltante",    color: "var(--error)" },
  { id: "SOBRANTE",       label: "Sobrante",    color: "var(--brand)" },
  { id: "DAÑADO",         label: "Dañado",      color: "var(--warning)" },
  { id: "MAL_UBICADO",    label: "Mal ubicado", color: "var(--muted2)" },
  { id: "ERROR_DESPACHO", label: "Despacho",    color: "var(--error)" },
  { id: "ERROR_SISTEMA",  label: "Sistema",     color: "var(--brand)" },
  { id: "ERROR_PROVEEDOR",label: "Proveedor",   color: "var(--muted2)" },
];

// ── Estado de foto con máquina de estados clara ───────────
type FotoPhase =
  | { phase: "idle" }
  | { phase: "preview"; file: File; dataUrl: string }
  | { phase: "uploading"; file: File; dataUrl: string }
  | { phase: "ready"; file: File; dataUrl: string; url: string }
  | { phase: "error"; file: File; dataUrl: string };


// ═══════════════════════════════════════════════════════════
// COMPONENTES DE APOYO
// ═══════════════════════════════════════════════════════════

/** Chip de tipo — selecionable, táctil */
function TipoChip({ tipo, selected, onToggle }: { tipo: typeof CHIP_TIPOS[0]; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        flexShrink: 0,
        padding: "10px 16px",
        borderRadius: 30,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: `2px solid ${selected ? tipo.color : "var(--border)"}`,
        background: selected ? tipo.color + "18" : "var(--surface2)",
        color: selected ? tipo.color : "var(--muted)",
        transition: "all .15s",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
    >
      {tipo.label}
    </button>
  );
}

/** Card de novedad en la lista */
function NovedadCard({ item, onTap }: { item: Novedad; onTap: () => void }) {
  const diasAgo = Math.floor((Date.now() - new Date(item.fecha + "T00:00:00").getTime()) / 86_400_000);
  const isOld = diasAgo > 7;
  const color = ESTADO_COLOR[item.estado];

  return (
    <button
      onClick={onTap}
      style={{
        width: "100%", textAlign: "left",
        padding: "14px 16px",
        background: "var(--surface)",
        border: "none", borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        WebkitTapHighlightColor: "transparent",
        transition: "background .08s",
      }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
      onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
      onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
    >
      {/* Estado dot */}
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
            {item.plu}
          </span>
          {item.imagenUrl && (
            <Camera size={12} color="var(--muted)" />
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.posicion} {item.fabricante ? `· ${item.fabricante}` : ""}
        </div>
        {isOld && item.estado !== "SOLUCIONADO" && (
          <div style={{ fontSize: 11, color: "var(--error)", marginTop: 2, fontWeight: 600 }}>
            {diasAgo} días sin resolver
          </div>
        )}
      </div>

      {/* Cantidad */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 800, fontFamily: "var(--mono)",
          color: item.cantidad > 0 ? "var(--brand)" : item.cantidad < 0 ? "var(--error)" : "var(--muted)",
        }}>
          {item.cantidad > 0 ? "+" : ""}{item.cantidad}
        </div>
        <div style={{ fontSize: 11, color: color, fontWeight: 700 }}>
          {estadoLabel(item.estado)}
        </div>
      </div>
    </button>
  );
}

/** Sugerencias de autocomplete */
function AutocompleteList({ suggestions, onSelect }: { suggestions: string[]; onSelect: (s: string) => void }) {
  if (suggestions.length === 0) return null;
  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, marginTop: 4, overflow: "hidden",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      maxHeight: 180, overflowY: "auto",
    }}>
      {suggestions.slice(0, 6).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          style={{
            width: "100%", textAlign: "left",
            padding: "12px 16px", background: "none", border: "none",
            borderBottom: "1px solid var(--border)", fontSize: 14,
            fontFamily: "var(--mono)", color: "var(--text)", cursor: "pointer",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BOTTOM SHEET BASE
// ═══════════════════════════════════════════════════════════
function BottomSheet({ onClose, children, title }: {
  onClose: () => void; children: React.ReactNode; title?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Bloquear scroll del body
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); };
  }, []);

  useEffect(() => {
    if (mounted) { requestAnimationFrame(() => setVisible(true)); }
  }, [mounted]);

  function close() {
    setVisible(false);
    document.body.style.overflow = "";
    setTimeout(onClose, 320);
  }

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      {/* Overlay */}
      <div
        onClick={close}
        style={{
          position: "absolute", inset: 0,
          background: "var(--overlay)",
          backdropFilter: "blur(2px)",
          opacity: visible ? 1 : 0,
          transition: "opacity .25s",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "var(--surface)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "92dvh",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform .32s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
        }}
      >
        {/* Handle + header */}
        <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 16px" }} />
          {title && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
                {title}
              </h2>
              <button
                onClick={close}
                style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={16} color="var(--muted)" />
              </button>
            </div>
          )}
        </div>
        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════
// SHEET: NUEVA NOVEDAD (flujo rápido < 20s)
// ═══════════════════════════════════════════════════════════
function NuevaNovedadSheet({ onClose, onCreada, existingPlus, existingPosiciones }: {
  onClose: () => void;
  onCreada: (n: Novedad) => void;
  existingPlus: string[];
  existingPosiciones: string[];
}) {
  const [plu, setPlu] = useState("");
  const [posicion, setPosicion] = useState("");
  const [cantidad, setCantidad] = useState(-1);   // -1 = faltante (más común)
  const [tipo, setTipo] = useState<TipoNovedad>("FALTANTE");  // preseleccionado
  const [foto, setFoto] = useState<FotoPhase>({ phase: "idle" });
  const [saving, setSaving] = useState(false);
  const [pluSugg, setPluSugg] = useState<string[]>([]);
  const [posSugg, setPosSugg] = useState<string[]>([]);

  const pluRef   = useRef<HTMLInputElement>(null);
  const posRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Auto-focus PLU al abrir
  useEffect(() => { setTimeout(() => pluRef.current?.focus(), 400); }, []);

  // Sugerencias PLU
  function onPluChange(v: string) {
    setPlu(v);
    if (v.length >= 2) {
      const q = v.toLowerCase();
      setPluSugg(existingPlus.filter((p) => p.toLowerCase().includes(q)).slice(0, 6));
    } else {
      setPluSugg([]);
    }
  }

  // Sugerencias posición
  function onPosChange(v: string) {
    setPosicion(v);
    if (v.length >= 1) {
      const q = v.toLowerCase();
      setPosSugg(existingPosiciones.filter((p) => p.toLowerCase().includes(q)).slice(0, 6));
    } else {
      setPosSugg([]);
    }
  }

  // Captura de foto → upload inmediato al blob
  async function onFotoCapturada(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setFoto({ phase: "uploading", file, dataUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);

    try {
      const fd = new FormData();
      fd.append("foto", file);
      const r = await fetch("/api/uploads/foto", { method: "POST", body: fd });
      const j = await r.json();
      if (j.success && j.url) {
        setFoto((prev) =>
          prev.phase !== "idle"
            ? { phase: "ready", file: prev.file, dataUrl: prev.dataUrl, url: j.url }
            : prev
        );
      } else {
        setFoto((prev) =>
          prev.phase !== "idle"
            ? { phase: "error", file: prev.file, dataUrl: prev.dataUrl }
            : prev
        );
      }
    } catch {
      setFoto((prev) =>
        prev.phase !== "idle"
          ? { phase: "error", file: prev.file, dataUrl: prev.dataUrl }
          : prev
      );
    }
  }

  // Reintentar upload de foto
  async function retryFoto() {
    if (foto.phase !== "error") return;
    setFoto({ phase: "uploading", file: foto.file, dataUrl: foto.dataUrl });
    await onFotoCapturada(foto.file);
  }

  // Validación y envío
  async function submit() {
    if (!plu.trim())      { alert("PLU es requerido"); pluRef.current?.focus(); return; }
    if (!posicion.trim()) { alert("Posición es requerida"); posRef.current?.focus(); return; }
    if (foto.phase === "uploading") { return; } // Esperar upload

    setSaving(true);
    try {
      // 1. Crear la novedad
      const r = await fetch("/api/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plu: plu.trim().toUpperCase(),
          posicion: posicion.trim().toUpperCase(),
          fecha: todayISO(),
          cantidad,
          estado: "PENDIENTE",
          tipoNovedad: tipo,
        }),
      });
      const j = await r.json();
      if (!j.success) { alert(j.error || "Error al registrar"); return; }

      // 2. Agregar foto si está lista
      if (foto.phase === "ready" && foto.url) {
        await fetch(`/api/novedades/${j.data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenUrl: foto.url }),
        });
        j.data.imagenUrl = foto.url;
      }

      onCreada(j.data);
    } finally {
      setSaving(false);
    }
  }

  const cantidadAbs = Math.abs(cantidad);
  const uploadingFoto = foto.phase === "uploading";

  return (
    <BottomSheet onClose={onClose} title="Nueva novedad">
      <div style={{ padding: "0 20px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── PLU ── */}
        <div style={{ position: "relative" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
            PLU / Código *
          </label>
          <input
            ref={pluRef}
            value={plu}
            onChange={(e) => onPluChange(e.target.value)}
            onBlur={() => setTimeout(() => setPluSugg([]), 200)}
            placeholder="Ej: 7896789"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            className="ds-input ds-input-lg" style={{ WebkitAppearance: "none" }}
          />
          <AutocompleteList suggestions={pluSugg} onSelect={(s) => { setPlu(s); setPluSugg([]); posRef.current?.focus(); }} />
        </div>

        {/* ── Posición ── */}
        <div style={{ position: "relative" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
            Posición *
          </label>
          <input
            ref={posRef}
            value={posicion}
            onChange={(e) => onPosChange(e.target.value)}
            onBlur={() => setTimeout(() => setPosSugg([]), 200)}
            placeholder="Ej: A-01-03"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            className="ds-input ds-input-lg" style={{ WebkitAppearance: "none" }}
          />
          <AutocompleteList suggestions={posSugg} onSelect={(s) => { setPosicion(s); setPosSugg([]); }} />
        </div>

        {/* ── Cantidad ── */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
            Cantidad
          </label>
          {/* Toggle faltante / sobrante */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[{ val: -1, label: "Faltante (-)", color: "var(--error)" }, { val: 1, label: "Sobrante (+)", color: "var(--brand)" }].map(({ val, label, color }) => (
              <button
                key={val}
                type="button"
                onClick={() => setCantidad(val * cantidadAbs || val)}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: `2px solid ${Math.sign(cantidad) === val || (cantidad === 0 && val === -1) ? color : "var(--border)"}`,
                  background: Math.sign(cantidad) === val || (cantidad === 0 && val === -1) ? color + "14" : "var(--surface2)",
                  color: Math.sign(cantidad) === val || (cantidad === 0 && val === -1) ? color : "var(--muted)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stepper de cantidad */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={() => setCantidad((c) => { const abs = Math.abs(c); const sign = c <= 0 ? -1 : 1; return sign * Math.max(1, abs - 1); })}
              style={{ width: 64, height: 64, borderRadius: 16, border: "2px solid var(--border)", background: "var(--surface2)", fontSize: 28, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <Minus size={22} />
            </button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "var(--mono)", letterSpacing: "-0.04em", color: cantidad < 0 ? "var(--error)" : "var(--brand)", lineHeight: 1 }}>
                {cantidad > 0 ? "+" : ""}{cantidad}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>unidades</div>
            </div>
            <button
              type="button"
              onClick={() => setCantidad((c) => { const abs = Math.abs(c); const sign = c <= 0 ? -1 : 1; return sign * (abs + 1); })}
              style={{ width: 64, height: 64, borderRadius: 16, border: "2px solid var(--border)", background: "var(--surface2)", fontSize: 28, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <Plus size={22} />
            </button>
          </div>
        </div>

        {/* ── Tipo de novedad (chips) ── */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            Tipo de novedad
          </label>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
            {CHIP_TIPOS.map((t) => (
              <TipoChip
                key={t.id}
                tipo={t}
                selected={tipo === t.id}
                onToggle={() => setTipo(t.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Foto ── */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            Evidencia fotográfica
          </label>

          {foto.phase === "idle" ? (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              style={{ width: "100%", height: 80, borderRadius: 14, border: "2px dashed var(--border)", background: "var(--surface2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--muted)" }}
            >
              <Camera size={24} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Tomar foto con cámara</span>
            </button>
          ) : (
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
              <img
                src={foto.dataUrl}
                alt="Vista previa"
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
              {/* Estado del upload */}
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                {foto.phase === "uploading" && (
                  <span style={{ padding: "4px 10px", background: "rgba(0,0,0,.7)", borderRadius: 20, fontSize: 11, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader size={10} style={{ animation: "spin .8s linear infinite" }} />
                    Subiendo…
                  </span>
                )}
                {foto.phase === "ready" && (
                  <span style={{ padding: "4px 10px", background: "rgba(16,185,129,.9)", borderRadius: 20, fontSize: 11, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={10} />
                    Lista
                  </span>
                )}
                {foto.phase === "error" && (
                  <button type="button" onClick={retryFoto} style={{ padding: "4px 10px", background: "rgba(239,68,68,.9)", borderRadius: 20, fontSize: 11, color: "#fff", border: "none", cursor: "pointer" }}>
                    Reintentar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFoto({ phase: "idle" })}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={13} color="#fff" />
                </button>
              </div>
            </div>
          )}

          {/* Input de cámara oculto */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFotoCapturada(file);
              e.target.value = ""; // reset para permitir retomar misma foto
            }}
          />
        </div>

        {/* ── Botón REGISTRAR ── */}
        <button
          type="button"
          onClick={submit}
          disabled={saving || uploadingFoto || !plu.trim() || !posicion.trim()}
          style={{
            width: "100%", height: 58,
            borderRadius: 16,
            background: saving || uploadingFoto || !plu.trim() || !posicion.trim()
              ? "var(--border)"
              : "var(--brand)",
            color: saving || uploadingFoto || !plu.trim() || !posicion.trim()
              ? "var(--muted)"
              : "#fff",
            border: "none",
            fontSize: 16, fontWeight: 800,
            cursor: saving || uploadingFoto ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            letterSpacing: "-0.01em",
            transition: "background .15s",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {saving ? (
            <>
              <Loader size={16} style={{ animation: "spin .8s linear infinite" }} />
              Registrando…
            </>
          ) : uploadingFoto ? (
            <>
              <Loader size={16} style={{ animation: "spin .8s linear infinite" }} />
              Subiendo foto…
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              Registrar novedad
            </>
          )}
        </button>
      </div>
    </BottomSheet>
  );
}

// ═══════════════════════════════════════════════════════════
// SHEET: DETALLE DE NOVEDAD (acciones rápidas)
// ═══════════════════════════════════════════════════════════
function DetalleSheet({ item, onClose, onUpdated, canEdit }: {
  item: Novedad;
  onClose: () => void;
  onUpdated: (n: Novedad) => void;
  canEdit: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [fotoPhase, setFotoPhase] = useState<"idle" | "uploading">("idle");
  const cameraRef = useRef<HTMLInputElement>(null);

  async function cambiarEstado(estado: EstadoNovedad) {
    setSaving(true);
    try {
      const r = await fetch(`/api/novedades/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const j = await r.json();
      if (j.success) {
        onUpdated({ ...item, estado, resueltoAt: estado === "SOLUCIONADO" ? new Date().toISOString() : item.resueltoAt });
        onClose();
      }
    } finally { setSaving(false); }
  }

  async function agregarFoto(file: File) {
    setFotoPhase("uploading");
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const r = await fetch("/api/uploads/foto", { method: "POST", body: fd });
      const j = await r.json();
      if (j.success && j.url) {
        await fetch(`/api/novedades/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenUrl: j.url }),
        });
        onUpdated({ ...item, imagenUrl: j.url });
        onClose();
      }
    } finally { setFotoPhase("idle"); }
  }

  const tipoColor = item.tipoNovedad
    ? CHIP_TIPOS.find((t) => t.id === item.tipoNovedad)?.color
    : undefined;

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ padding: "0 20px 40px" }}>

        {/* Encabezado del detalle */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 26, color: "var(--text)", letterSpacing: "-0.03em" }}>
              {item.plu}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: ESTADO_COLOR[item.estado] + "18", color: ESTADO_COLOR[item.estado] }}>
              {estadoLabel(item.estado)}
            </span>
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            {item.posicion}
            {item.fabricante ? ` · ${item.fabricante}` : ""}
            {" · "}{fmtFecha(item.fecha)}
          </div>
          {item.tipoNovedad && tipoColor && (
            <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: tipoColor + "14", color: tipoColor }}>
              {CHIP_TIPOS.find((t) => t.id === item.tipoNovedad)?.label}
            </span>
          )}
        </div>

        {/* Foto si existe */}
        {item.imagenUrl && (
          <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
            <a href={item.imagenUrl} target="_blank" rel="noreferrer">
              <img src={item.imagenUrl} alt="Evidencia" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
            </a>
          </div>
        )}

        {/* Cantidad grande */}
        <div style={{ textAlign: "center", marginBottom: 24, padding: "16px", background: "var(--surface2)", borderRadius: 14 }}>
          <div style={{
            fontSize: 52, fontWeight: 900, fontFamily: "var(--mono)",
            letterSpacing: "-0.04em", lineHeight: 1,
            color: item.cantidad < 0 ? "var(--error)" : "var(--brand)",
          }}>
            {item.cantidad > 0 ? "+" : ""}{item.cantidad}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>unidades</div>
        </div>

        {/* Acciones rápidas */}
        {canEdit && item.estado !== "SOLUCIONADO" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {item.estado !== "EN PROCESO" && (
              <button
                type="button"
                onClick={() => cambiarEstado("EN PROCESO")}
                disabled={saving}
                style={{ height: 52, borderRadius: 14, border: "2px solid var(--border)", background: "var(--surface3)", color: "var(--muted2)", fontSize: 15, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
              >
                En proceso
              </button>
            )}
            <button
              type="button"
              onClick={() => cambiarEstado("SOLUCIONADO")}
              disabled={saving}
              style={{ height: 58, borderRadius: 14, border: "none", background: "var(--brand)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, WebkitTapHighlightColor: "transparent" }}
            >
              <CheckCircle2 size={18} />
              Marcar como solucionado
            </button>
          </div>
        )}

        {/* Agregar foto si no tiene */}
        {canEdit && !item.imagenUrl && (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={fotoPhase === "uploading"}
              style={{ width: "100%", height: 48, borderRadius: 14, border: "2px dashed var(--border)", background: "var(--surface2)", color: "var(--muted)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, WebkitTapHighlightColor: "transparent" }}
            >
              {fotoPhase === "uploading" ? (
                <><Loader size={16} style={{ animation: "spin .8s linear infinite" }} /> Subiendo foto…</>
              ) : (
                <><Camera size={16} /> Agregar foto de evidencia</>
              )}
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) agregarFoto(f); e.target.value = ""; }}
            />
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Mobile-first
// ═══════════════════════════════════════════════════════════
export default function InventarioMobilePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = can(role, "edit");
  const canCreate = can(role, "create");

  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"" | EstadoNovedad>("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheet, setSheet] = useState<"nueva" | "detalle" | null>(null);
  const [selected, setSelected] = useState<Novedad | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok?: boolean } | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await fetch("/api/novedades?pageSize=500");
      const j = await r.json();
      if (j.success) setNovedades(j.data ?? []);
    } catch { /* noop */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const autoRefresh = useAutoRefresh({
    pause: Boolean(sheet),
    onRefresh: () => load(true),
  });

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  // Lista filtrada
  const filtered = useMemo(() => {
    let list = [...novedades];
    if (filter) list = list.filter((n) => n.estado === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.plu.toLowerCase().includes(q) ||
        n.posicion.toLowerCase().includes(q) ||
        (n.fabricante ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      // Pendientes primero, luego más antiguos
      if (a.estado !== b.estado) {
        const order = ["PENDIENTE", "EN PROCESO", "SOLUCIONADO"];
        return order.indexOf(a.estado) - order.indexOf(b.estado);
      }
      return a.fecha.localeCompare(b.fecha);
    });
  }, [novedades, filter, search]);

  // Datos para autocomplete
  const existingPlus = useMemo(() => [...new Set(novedades.map((n) => n.plu))], [novedades]);
  const existingPosiciones = useMemo(() => [...new Set(novedades.map((n) => n.posicion))], [novedades]);

  // Contadores para chips de filtro
  const counts = useMemo(() => ({
    "": novedades.length,
    "PENDIENTE":  novedades.filter((n) => n.estado === "PENDIENTE").length,
    "EN PROCESO": novedades.filter((n) => n.estado === "EN PROCESO").length,
    "SOLUCIONADO":novedades.filter((n) => n.estado === "SOLUCIONADO").length,
  }), [novedades]);

  const FILTROS: Array<{ val: "" | EstadoNovedad; label: string }> = [
    { val: "",            label: `Todas (${counts[""]})` },
    { val: "PENDIENTE",   label: `Pendientes (${counts["PENDIENTE"]})` },
    { val: "EN PROCESO",  label: `En proceso (${counts["EN PROCESO"]})` },
    { val: "SOLUCIONADO", label: `Resueltas (${counts["SOLUCIONADO"]})` },
  ];

  return (
    <div style={{
      ...getModuleCssVars("inventario"),
      display: "flex", flexDirection: "column",
      height: "100dvh", // dynamic viewport height (Android-friendly)
      overflow: "hidden",
      background: "var(--bg)",
      position: "relative",
    } as React.CSSProperties}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="inventory-neon-header" style={{
        flexShrink: 0,
        padding: "16px 16px 0",
        background: "var(--module-hero-gradient)",
        borderBottom: "1px solid color-mix(in srgb, var(--module-color) 34%, transparent)",
      }}>
        {searchOpen ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar PLU, posición…"
              className="ds-input ds-input-lg" style={{ flex: 1, height: 40, WebkitAppearance: "none" }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearch(""); }}
              style={{ flexShrink: 0, background: "var(--surface2)", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "var(--muted)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#F8FBFF", margin: 0, letterSpacing: "-0.03em" }}>
                Inventario
              </h1>
              <div style={{ fontSize: 12, color: "rgba(226,232,240,0.76)", marginTop: 2 }}>
                {loading ? "Cargando…" : `${filtered.length} novedad${filtered.length !== 1 ? "es" : ""}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => load(true)}
                disabled={refreshing || autoRefresh.refreshing}
                style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <RefreshCw size={16} color="var(--muted)" style={{ animation: (refreshing || autoRefresh.refreshing) ? "spin .8s linear infinite" : "none" }} />
              </button>
              <button
                onClick={() => setSearchOpen(true)}
                style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Search size={16} color="var(--muted)" />
              </button>
            </div>
          </div>
        )}

        {/* Filtros horizontales */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
          {FILTROS.map(({ val, label }) => {
            const isActive = filter === val;
            const color = val === "" ? "var(--brand)" : val === "PENDIENTE" ? "var(--error)" : val === "EN PROCESO" ? "var(--muted2)" : "var(--brand)";
            return (
              <button
                key={val}
                onClick={() => setFilter(val)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  border: `2px solid ${isActive ? color : "var(--border)"}`,
                  background: isActive ? color + "14" : "var(--surface2)",
                  color: isActive ? color : "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {loading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 1 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 0, marginBottom: 1 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32 }}>
            <EmptyState
              icon={<Package size={36} />}
              title={search || filter ? "Sin resultados" : "Sin novedades"}
              description={search || filter ? "No hay registros para estos filtros." : "Registra la primera novedad del día."}
              action={canCreate && !search && !filter ? { label: "Registrar novedad", onClick: () => setSheet("nueva") } : undefined}
            />
          </div>
        ) : (
          <>
            {filtered.map((item) => (
              <NovedadCard
                key={item.id}
                item={item}
                onTap={() => { setSelected(item); setSheet("detalle"); }}
              />
            ))}
            {/* Espacio extra para que el FAB no tape el último item */}
            <div style={{ height: 100 }} />
          </>
        )}
      </div>

      {/* ── FAB (Floating Action Button) ─────────────────── */}
      {canCreate && (
        <button
          onClick={() => setSheet("nueva")}
          style={{
            position: "absolute",
            bottom: 24, right: 20,
            width: 64, height: 64,
            borderRadius: "50%",
            background: "var(--brand)",
            border: "none",
            boxShadow: "0 4px 20px rgba(37,99,235,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            zIndex: 100,
          }}
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </button>
      )}

      {/* ── Sheets ───────────────────────────────────────── */}
      {sheet === "nueva" && (
        <NuevaNovedadSheet
          onClose={() => setSheet(null)}
          onCreada={(n) => {
            setNovedades((prev) => [n, ...prev]);
            setSheet(null);
            showToast("Novedad registrada ✓");
          }}
          existingPlus={existingPlus}
          existingPosiciones={existingPosiciones}
        />
      )}

      {sheet === "detalle" && selected && (
        <DetalleSheet
          item={selected}
          onClose={() => { setSheet(null); setSelected(null); }}
          onUpdated={(updated) => {
            setNovedades((prev) => prev.map((n) => n.id === updated.id ? updated : n));
            setSelected(updated);
          }}
          canEdit={canEdit}
        />
      )}

      {/* ── Toast ────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 100, left: 20, right: 20,
          zIndex: 10000,
          padding: "14px 20px",
          background: toast.ok ? "#0F0F10" : "var(--error)",
          color: "#fff",
          borderRadius: 14,
          fontSize: 15, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          animation: "fade-up .2s ease",
        }}>
          {toast.ok && <CheckCircle2 size={16} />}
          {!toast.ok && <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
