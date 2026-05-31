"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Navigation, MapPin, CheckCircle2, XCircle, RefreshCw, Camera, Route } from "lucide-react";
import {
  Ruta, Parada, PARADA_ESTADO_COLOR, PARADA_ESTADO_LABEL, RUTA_ESTADO_LABEL, RUTA_ESTADO_COLOR, fmtFecha, navUrl,
} from "@/lib/logistica";
import { createPortal } from "react-dom";

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: color + "18", color }}>{label}</span>;
}

const COLOR = "#7c3aed";
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.55rem 0.85rem", fontSize: 13, outline: "none", background: "var(--bg)", width: "100%", boxSizing: "border-box" };

export default function MiRutaPage() {
  const { data: session } = useSession();
  const nombre = (session?.user as { name?: string } | undefined)?.name ?? "Conductor";
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [confirmando, setConfirmando] = useState<Parada | null>(null);
  const [gpsEnvio, setGpsEnvio] = useState<"idle" | "ok" | "err">("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500); }

  async function loadRuta() {
    setLoading(true);
    try {
      const res = await fetch("/api/logistica/rutas?mia=1");
      const json = await res.json();
      if (json.success && json.data.length > 0) setRuta(json.data[0]);
      else setRuta(null);
    } catch { showToast("Error al cargar", true); }
    finally { setLoading(false); }
  }

  async function enviarGps(rutaId?: string) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetch("/api/logistica/gps", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, rutaId: rutaId ?? null }),
          });
          setGpsEnvio("ok");
          setTimeout(() => setGpsEnvio("idle"), 3000);
        } catch { setGpsEnvio("err"); }
      },
      () => setGpsEnvio("err")
    );
  }

  useEffect(() => {
    loadRuta();
  }, []);

  useEffect(() => {
    if (!ruta || ruta.estado !== "EN_CURSO") return;
    enviarGps(ruta.id);
    intervalRef.current = setInterval(() => enviarGps(ruta.id), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [ruta?.id, ruta?.estado]);

  function paradaActualizada(paradaId: string, estado: Parada["estado"]) {
    if (!ruta) return;
    setRuta({ ...ruta, paradas: ruta.paradas.map((p) => p.id === paradaId ? { ...p, estado } : p) });
    setConfirmando(null);
  }

  if (loading) return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)}
      </div>
    </div>
  );

  if (!ruta) return (
    <div className="animate-fade-in" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center" }}>
      <Route size={40} color={COLOR} style={{ margin: "0 auto 1rem" }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Sin ruta asignada</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>No tienes ninguna ruta activa para hoy.</div>
      <button onClick={loadRuta} style={{ marginTop: "1.25rem", display: "inline-flex", alignItems: "center", gap: 6, padding: "0.6rem 1.2rem", background: COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}><RefreshCw size={14} />Actualizar</button>
    </div>
  );

  const pendientes = ruta.paradas.filter((p) => p.estado === "PENDIENTE").length;
  const entregadas = ruta.paradas.filter((p) => p.estado === "ENTREGADO").length;
  const prog = ruta.paradas.length > 0 ? Math.round(entregadas / ruta.paradas.length * 100) : 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem 1.4rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: COLOR + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Route size={18} color={COLOR} /></div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{ruta.nombre}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Hola, {nombre} · {fmtFecha(ruta.fecha)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge label={RUTA_ESTADO_LABEL[ruta.estado as keyof typeof RUTA_ESTADO_LABEL]} color={RUTA_ESTADO_COLOR[ruta.estado as keyof typeof RUTA_ESTADO_COLOR]} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{entregadas}/{ruta.paradas.length} entregadas · {pendientes} pendientes</span>
              <span style={{ fontSize: 11, color: gpsEnvio === "ok" ? "#10b981" : gpsEnvio === "err" ? "#ef4444" : "var(--muted)", fontFamily: "var(--mono)" }}>
                {gpsEnvio === "ok" ? "📍 GPS enviado" : gpsEnvio === "err" ? "⚠ GPS no disponible" : "📍 GPS activo"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => enviarGps(ruta.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "0.5rem 0.85rem", background: COLOR + "15", color: COLOR, border: `1px solid ${COLOR}40`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><MapPin size={13} />Mi ubicación</button>
            <button onClick={loadRuta} style={{ padding: "0.5rem 0.75rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, cursor: "pointer", color: "var(--muted2)", display: "flex" }}><RefreshCw size={15} /></button>
          </div>
        </div>
        {/* Barra de progreso */}
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>
            <span>Progreso</span><span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: prog === 100 ? "#10b981" : COLOR }}>{prog}%</span>
          </div>
          <div style={{ height: 8, background: "var(--border)", borderRadius: 4 }}>
            <div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? "#10b981" : COLOR, borderRadius: 4, transition: "width .4s" }} />
          </div>
        </div>
      </div>

      {/* Lista de paradas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ruta.paradas.map((p, i) => (
          <ParadaCard
            key={p.id}
            parada={p}
            numero={i + 1}
            onConfirmar={() => setConfirmando(p)}
            enCurso={ruta.estado === "EN_CURSO"}
          />
        ))}
      </div>

      {/* Modal confirmación */}
      {confirmando && (
        <ModalConfirmar
          parada={confirmando}
          onClose={() => setConfirmando(null)}
          onConfirmado={(id, estado) => { paradaActualizada(id, estado); showToast(estado === "ENTREGADO" ? "Entrega registrada ✓" : "Marcado como no entregado"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, background: toast.err ? "#ef4444" : "#0f172a", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px #0f172a40" }}>{toast.msg}</div>}
    </div>
  );
}

// ── Tarjeta de parada ─────────────────────────────────────────
function ParadaCard({ parada: p, numero, onConfirmar, enCurso }: {
  parada: Parada; numero: number; onConfirmar: () => void; enCurso: boolean;
}) {
  const color = PARADA_ESTADO_COLOR[p.estado as keyof typeof PARADA_ESTADO_COLOR];
  const entregado = p.estado === "ENTREGADO";
  const noEntregado = p.estado === "NO_ENTREGADO";

  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${entregado ? "#10b98130" : noEntregado ? "#ef444430" : "var(--border)"}`, borderRadius: 14, padding: "1rem 1.2rem", opacity: entregado ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Número */}
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: entregado ? "#10b98120" : COLOR + "15", color: entregado ? "#10b981" : COLOR, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
          {entregado ? <CheckCircle2 size={18} /> : noEntregado ? <XCircle size={18} color="#ef4444" /> : numero}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 3 }}>{p.direccion}</div>
          {p.pedidoId && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>Pedido: {p.pedidoId}</div>}
          {p.observaciones && <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 3 }}>{p.observaciones}</div>}
          {p.entregadoAt && <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>Entregado a las {new Date(p.entregadoAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>

        {/* Badge estado */}
        <Badge label={PARADA_ESTADO_LABEL[p.estado as keyof typeof PARADA_ESTADO_LABEL]} color={color} />
      </div>

      {/* Botones */}
      {!entregado && !noEntregado && (
        <div style={{ display: "flex", gap: 8, marginTop: "0.85rem", flexWrap: "wrap" }}>
          <a href={navUrl(p)} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", background: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f640", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none", flex: 1, justifyContent: "center" }}>
            <Navigation size={14} />Iniciar navegación
          </a>
          {enCurso && (
            <button onClick={onConfirmar} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", background: COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", flex: 1, justifyContent: "center" }}>
              <CheckCircle2 size={14} />Confirmar entrega
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal confirmación de entrega ─────────────────────────────
function ModalConfirmar({ parada, onClose, onConfirmado, onError }: {
  parada: Parada; onClose: () => void;
  onConfirmado: (id: string, estado: Parada["estado"]) => void;
  onError: (m: string) => void;
}) {
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  async function confirmar(estado: "ENTREGADO" | "NO_ENTREGADO") {
    setSaving(true);
    let lat: number | null = null, lng: number | null = null;
    if (estado === "ENTREGADO" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* continúa sin GPS */ }
    }
    const res = await fetch(`/api/logistica/paradas/${parada.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, observaciones: obs.trim() || null, fotoTomada: foto, latEntrega: lat, lngEntrega: lng }),
    });
    const json = await res.json();
    if (json.success) onConfirmado(parada.id, estado); else onError(json.error || "Error");
    setSaving(false);
  }

  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 9999, padding: "0 0 0" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 520, padding: "1.5rem", boxShadow: "0 -12px 40px #0f172a30" }}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 1.25rem" }} />
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Confirmar parada</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: "1.25rem" }}>{parada.direccion}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observaciones (opcional)…" rows={2} style={{ ...inp, resize: "none" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={foto} onChange={(e) => setFoto(e.target.checked)} style={{ width: 18, height: 18 }} />
            <Camera size={16} style={{ color: "var(--muted)" }} />
            Foto de evidencia tomada
          </label>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => confirmar("ENTREGADO")} disabled={saving} style={{ flex: 2, padding: "0.85rem", background: "#10b981", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CheckCircle2 size={18} />{saving ? "…" : "Entregado"}
          </button>
          <button onClick={() => confirmar("NO_ENTREGADO")} disabled={saving} style={{ flex: 1, padding: "0.85rem", background: "#ef444415", color: "#ef4444", border: "1px solid #ef444440", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            No entregado
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
