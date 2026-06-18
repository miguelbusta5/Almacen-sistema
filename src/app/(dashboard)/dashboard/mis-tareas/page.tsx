"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CheckSquare, Package, Truck, Store,
  AlertTriangle, Clock, CheckCircle2, Calendar,
} from "lucide-react";
import { SlaEstado, SLA_COLOR, SLA_LABEL, calcSla, diasRestantesSla } from "@/lib/sla";
import { urgencia } from "@/lib/transporte";
import { horasDesde } from "@/lib/tienda";
import { Badge, EmptyState } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import Link from "next/link";
import { getModuleCssVars } from "@/lib/moduleTheme";

interface MisTareas {
  novedades: any[];
  guardados: any[];
  guardadosTiendaPendientes: any[];
  despachosTienda: any[];
  notifNoLeidas: number;
}

// ── Tarjeta de tarea individual ───────────────────────────
function TareaCard({ titulo, sub, badge, badgeColor, href, tiempo, alerta }: {
  titulo: string; sub?: string; badge?: string; badgeColor?: string;
  href: string; tiempo?: string; alerta?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "var(--surface)", border: `1px solid ${alerta ? "rgba(239,68,68,0.3)" : "var(--border)"}`, borderRadius: 10, transition: "box-shadow .12s", cursor: "pointer" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      >
        {alerta && <AlertTriangle size={14} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: (badgeColor ?? "var(--muted)") + "18", color: badgeColor ?? "var(--muted)" }}>{badge}</span>}
          {tiempo && <span style={{ fontSize: 10, color: "var(--faint)", fontFamily: "var(--mono)" }}>{tiempo}</span>}
        </div>
      </div>
    </Link>
  );
}

// ── Sección colapsable ────────────────────────────────────
function Seccion({ icon, title, count, color, children }: {
  icon: React.ReactNode; title: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: color + "14", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>{icon}</div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: count > 0 ? color + "18" : "var(--surface2)", color: count > 0 ? color : "var(--muted)", fontFamily: "var(--mono)" }}>{count}</span>
      </div>
      {count === 0 ? (
        <div style={{ padding: "12px 16px", background: "var(--surface2)", borderRadius: 10, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
          <CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Sin tareas pendientes
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
      )}
    </div>
  );
}

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function MisTareasPage() {
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? "";

  const [data, setData] = useState<MisTareas | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/mis-tareas");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const autoRefresh = useAutoRefresh({
    onRefresh: () => load(),
  });

  // ── Calcular KPIs ─────────────────────────────────────────
  const kpis = data ? {
    total: data.novedades.length + data.guardados.length + data.guardadosTiendaPendientes.length + data.despachosTienda.length,
    vencidas: [
      ...data.novedades.filter((n) => calcSla(n.fechaCompromiso) === "VENCIDO"),
    ].length,
    proximas: [
      ...data.novedades.filter((n) => calcSla(n.fechaCompromiso) === "PROXIMO"),
      ...data.guardados.filter((g) => { const u = urgencia(g); return u?.tipo === "proxima"; }),
      ...data.despachosTienda.filter((d) => { if (!d.fechaEntregaComprometida) return false; return calcSla(d.fechaEntregaComprometida) === "PROXIMO"; }),
    ].length,
  } : { total: 0, vencidas: 0, proximas: 0 };

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos dias" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="animate-fade-in" style={{ ...getModuleCssVars("mis-tareas"), maxWidth: 720 } as React.CSSProperties}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckSquare size={16} color="var(--brand)" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>Mis Tareas</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {saludo}{userName ? `, ${userName}` : ""} / {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <AutoRefreshIndicator
          lastUpdatedAt={autoRefresh.lastUpdatedAt}
          refreshing={autoRefresh.refreshing || loading}
          onRefresh={autoRefresh.refreshNow}
        />
      </div>

      {/* ── KPIs flotantes ── */}
      {!loading && data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 28, padding: "0 2px" }}>
          <div className="ds-stat">
            <div className="ds-stat-value" style={{ color: "var(--text)" }}>{kpis.total}</div>
            <div className="ds-stat-label">Tareas pendientes</div>
          </div>
          <div className="ds-stat">
            <div className="ds-stat-value" style={{ color: kpis.vencidas > 0 ? "var(--error)" : "var(--muted)" }}>{kpis.vencidas}</div>
            <div className="ds-stat-label">SLA vencidas</div>
          </div>
          <div className="ds-stat">
            <div className="ds-stat-value" style={{ color: kpis.proximas > 0 ? "var(--warning)" : "var(--muted)" }}>{kpis.proximas}</div>
            <div className="ds-stat-label">Proximas a vencer</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
        </div>
      ) : !data ? (
        <EmptyState icon={<CheckSquare size={22} />} title="Error al cargar" description="Intenta actualizar." />
      ) : (
        <>
          {/* ── INVENTARIO: Novedades ──────────────────────── */}
          {data.novedades.length > 0 && (
            <Seccion icon={<Package size={15} />} title="Novedades asignadas" count={data.novedades.length} color="#2563EB">
              {data.novedades.slice(0, 10).map((n: any) => {
                const sla = calcSla(n.fechaCompromiso);
                const dias = diasRestantesSla(n.fechaCompromiso);
                return (
                  <TareaCard
                    key={n.id}
                    href="/dashboard/inventario"
                    titulo={`PLU ${n.plu} / ${n.posicion}`}
                    sub={n.fabricante ?? n.estado}
                    badge={n.fechaCompromiso ? (sla === "VENCIDO" ? `Vencido ${Math.abs(dias!)}d` : sla === "PROXIMO" ? `${dias}d restantes` : SLA_LABEL[sla]) : n.estado}
                    badgeColor={SLA_COLOR[sla]}
                    alerta={sla === "VENCIDO"}
                    tiempo={n.esPropio ? "mia" : n.asignadoA ?? undefined}
                  />
                );
              })}
              {data.novedades.length > 10 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>+{data.novedades.length - 10} mas en <Link href="/dashboard/inventario" style={{ color: "var(--brand)" }}>Novedades</Link></div>}
            </Seccion>
          )}

          {/* ── TRANSPORTE: Guardados ─────────────────────── */}
          {data.guardados.length > 0 && (
            <Seccion icon={<Truck size={15} />} title="Guardados pendientes" count={data.guardados.length} color="var(--brand)">
              {data.guardados.slice(0, 8).map((g: any) => {
                const u = urgencia(g);
                const alerta = u?.tipo === "vencida";
                return (
                  <TareaCard
                    key={g.clientId}
                    href="/dashboard/transporte"
                    titulo={g.documento}
                    sub={`${g.ubicacion} / ${g.tipo ?? ""}`}
                    badge={alerta ? `Entrega vencida ${u!.dias}d` : u?.tipo === "proxima" ? `${u.dias}d para entrega` : "Pendiente"}
                    badgeColor={alerta ? "var(--error)" : u?.tipo === "proxima" ? "var(--warning)" : "var(--muted)"}
                    alerta={alerta}
                    tiempo={fmtFecha(g.fecha)}
                  />
                );
              })}
              {data.guardados.length > 8 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>+{data.guardados.length - 8} mas en <Link href="/dashboard/transporte" style={{ color: "var(--brand)" }}>Transporte</Link></div>}
            </Seccion>
          )}

          {data.guardadosTiendaPendientes.length > 0 && (
            <Seccion icon={<Truck size={15} />} title="Despachos de tienda por guardar" count={data.guardadosTiendaPendientes.length} color="var(--brand)">
              {data.guardadosTiendaPendientes.slice(0, 8).map((p: any) => (
                <TareaCard
                  key={p.id}
                  href="/dashboard/transporte"
                  titulo={`${p.documento} / ${p.clienteNombre}`}
                  sub={`${p.centroCostos}${p.numeroCajas ? ` / ${p.numeroCajas} cajas` : ""}`}
                  badge="Pendiente por guardar"
                  badgeColor="var(--brand)"
                  tiempo={new Date(p.createdAt).toLocaleDateString("es-CO")}
                />
              ))}
            </Seccion>
          )}

          {/* ── TIENDA: Despachos pendientes ──────────────── */}
          {data.despachosTienda.length > 0 && (
            <Seccion icon={<Store size={15} />} title="Despachos tienda pendientes" count={data.despachosTienda.length} color="var(--brand)">
              {data.despachosTienda.slice(0, 8).map((d: any) => {
                const horas = horasDesde(d.createdAt);
                const critico = horas >= 24;
                const slaDespach = d.fechaEntregaComprometida ? calcSla(d.fechaEntregaComprometida) : null;
                return (
                  <TareaCard
                    key={d.id}
                    href="/dashboard/tienda"
                    titulo={`${d.numeroDocumento} / ${d.clienteNombre}`}
                    sub={`${d.centroCostos} / ${d.estado}`}
                    badge={critico ? `${horas}h pendiente` : slaDespach ? SLA_LABEL[slaDespach] : d.estado}
                    badgeColor={critico ? "var(--error)" : slaDespach ? SLA_COLOR[slaDespach] : "var(--muted)"}
                    alerta={critico || slaDespach === "VENCIDO"}
                    tiempo={fmtFecha(d.fechaCreacion)}
                  />
                );
              })}
              {data.despachosTienda.length > 8 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>+{data.despachosTienda.length - 8} mas en <Link href="/dashboard/tienda" style={{ color: "var(--brand)" }}>Tienda</Link></div>}
            </Seccion>
          )}

          {/* Estado vacío total */}
          {kpis.total === 0 && (
            <EmptyState
              icon={<CheckSquare size={22} />}
              title="Todo al dia"
              description="No tienes tareas pendientes en este momento. Buen trabajo."
            />
          )}
        </>
      )}
    </div>
  );
}
