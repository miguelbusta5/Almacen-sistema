"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Navigation, MapPin, CheckCircle2, XCircle, RefreshCw, Camera, Route, ImageIcon } from "lucide-react";
import {
  Ruta, Parada, PARADA_ESTADO_COLOR, PARADA_ESTADO_LABEL, RUTA_ESTADO_LABEL, RUTA_ESTADO_COLOR, fmtFecha, navUrl,
} from "@/lib/logistica";
import { createPortal } from "react-dom";

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: color + "18", color }}>{label}</span>;
}

const COLOR = "#7c3aed";
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.55rem 0.85rem", fontSize: 13, outline: "none", background: "var(--bg)", width: "100%", boxSizing: "border-box" };

type GpsStatus = "idle" | "ok" | "err" | "sin-permiso" | "sin-soporte";

export default function MiRutaPage() {
  const { data: session } = useSession();
  const nombre = (session?.user as { name?: string } | undefined)?.name ?? "Conductor";
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [confirmando, setConfirmando] = useState<Parada | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [ultimaPos, setUltimaPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const rutaIdRef = useRef<string | undefined>(undefined);

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500); }

  async function enviarPosicion(lat: number, lng: number) {
    try {
      await fetch("/api/logistica/gps", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, rutaId: rutaIdRef.current ?? null }),
      });
      setGpsStatus("ok");
      setUltimaPos({ lat, lng });
    } catch { /* silencioso, no cortar el watchPosition */ }
  }

  function iniciarGps(rutaId: string) {
    if (!navigator.geolocation) { setGpsStatus("sin-soporte"); return; }
    rutaIdRef.current = rutaId;

    // Detener watch anterior si existe
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { enviarPosicion(pos.coords.latitude, pos.coords.longitude); },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsStatus("sin-permiso");
        else setGpsStatus("err");
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    setGpsStatus("ok");
  }

  async function solicitarGpsManual() {
    if (!navigator.geolocation) { setGpsStatus("sin-soporte"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { enviarPosicion(pos.coords.latitude, pos.coords.longitude); if (ruta?.id) iniciarGps(ruta.id); },
      (err) => { setGpsStatus(err.code === err.PERMISSION_DENIED ? "sin-permiso" : "err"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

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

  useEffect(() => { loadRuta(); }, []);

  useEffect(() => {
    if (!ruta || ruta.estado !== "EN_CURSO") return;
    iniciarGps(ruta.id);
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <span style={{ fontSize: 11, color: gpsStatus === "ok" ? "#10b981" : gpsStatus === "sin-permiso" || gpsStatus === "err" ? "#ef4444" : "var(--muted)", fontFamily: "var(--mono)" }}>
                {gpsStatus === "ok" ? `📍 GPS activo${ultimaPos ? ` · ${ultimaPos.lat.toFixed(4)}, ${ultimaPos.lng.toFixed(4)}` : ""}` : gpsStatus === "sin-permiso" ? "⚠ Permiso GPS denegado" : gpsStatus === "sin-soporte" ? "⚠ GPS no disponible" : gpsStatus === "err" ? "⚠ Error GPS" : "📍 Iniciando GPS…"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={solicitarGpsManual} style={{ display: "flex", alignItems: "center", gap: 5, padding: "0.5rem 0.85rem", background: COLOR + "15", color: COLOR, border: `1px solid ${COLOR}40`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><MapPin size={13} />{gpsStatus === "sin-permiso" ? "Activar GPS" : "Mi ubicación"}</button>
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
          {p.fotoUrl && (
            <a href={p.fotoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6 }}>
              <img src={p.fotoUrl} alt="Evidencia" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
            </a>
          )}
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
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const handleFoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFotoFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setFotoPreview(url);
    } else {
      setFotoPreview(null);
    }
  }, []);

  async function confirmar(estado: "ENTREGADO" | "NO_ENTREGADO") {
    setSaving(true);

    // 1. GPS
    let lat: number | null = null, lng: number | null = null;
    if (estado === "ENTREGADO" && navigator.geolocation) {
      try {
        setSavingStep("Obteniendo ubicación…");
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* continúa sin GPS */ }
    }

    // 2. Subir foto si la hay
    let fotoUrl: string | null = null;
    if (fotoFile && estado === "ENTREGADO") {
      try {
        setSavingStep("Subiendo foto…");
        const form = new FormData();
        form.append("foto", fotoFile);
        const uploadRes = await fetch("/api/logistica/foto", { method: "POST", body: form });
        const uploadJson = await uploadRes.json();
        if (uploadJson.success) fotoUrl = uploadJson.url;
        else onError("No se pudo subir la foto, pero se registrará la entrega");
      } catch { /* foto falla silenciosamente, entrega continúa */ }
    }

    // 3. Confirmar parada
    setSavingStep("Guardando…");
    const res = await fetch(`/api/logistica/paradas/${parada.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado, observaciones: obs.trim() || null,
        fotoTomada: !!fotoFile, fotoUrl,
        latEntrega: lat, lngEntrega: lng,
      }),
    });
    const json = await res.json();
    if (json.success) onConfirmado(parada.id, estado); else onError(json.error || "Error");
    setSaving(false);
    setSavingStep("");
  }

  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 9999 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 520, padding: "1.5rem", boxShadow: "0 -12px 40px #0f172a30" }}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 1.25rem" }} />
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Confirmar parada</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: "1.25rem" }}>{parada.direccion}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observaciones (opcional)…" rows={2} style={{ ...inp, resize: "none" }} />

          {/* Captura de foto */}
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: "none" }} />
            {fotoPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src={fotoPreview} alt="Vista previa" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>Foto lista para subir</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{fotoFile?.name}</div>
                  <button onClick={() => { setFotoFile(null); setFotoPreview(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ marginTop: 4, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Quitar foto</button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "0.7rem", background: "var(--surface2)", border: "1px dashed var(--border)", borderRadius: 10, fontSize: 13, color: "var(--muted2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Camera size={16} />Tomar foto de evidencia (opcional)
              </button>
            )}
          </div>
        </div>

        {saving && savingStep && (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginBottom: "0.75rem" }}>{savingStep}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => confirmar("ENTREGADO")} disabled={saving} style={{ flex: 2, padding: "0.85rem", background: saving ? "#94a3b8" : "#10b981", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CheckCircle2 size={18} />{saving ? savingStep || "…" : "Entregado"}
          </button>
          <button onClick={() => confirmar("NO_ENTREGADO")} disabled={saving} style={{ flex: 1, padding: "0.85rem", background: "#ef444415", color: "#ef4444", border: "1px solid #ef444440", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
            No entregado
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
