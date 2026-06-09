"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ScrollText, ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";
import { SkeletonTable } from "@/components/ui";

type Role = "ADMIN" | "GERENTE" | "OPERADOR";

interface LogUser { id: string; name: string; email: string; }
interface LogItem {
  id: string;
  action: string;
  module: string;
  recordId: string;
  details: string | null;
  createdAt: string;
  user: LogUser | null;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE: { label: "Creó", color: "#10b981" },
  UPDATE: { label: "Editó", color: "#0ea5e9" },
  DELETE: { label: "Eliminó", color: "#ef4444" },
};
const MODULE_META: Record<string, { label: string; color: string }> = {
  muebles: { label: "Muebles", color: "#0ea5e9" },
  transporte: { label: "Transporte", color: "#f97316" },
  users: { label: "Usuarios", color: "#6366f1" },
};

const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.7rem",
  fontSize: 12, fontFamily: "var(--mono)", outline: "none", background: "var(--surface)", color: "var(--text)",
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditoriaPage() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const role = (session?.user as { role?: Role } | undefined)?.role;

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [users, setUsers] = useState<LogUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // filtros
  const [fModule, setFModule] = useState("");
  const [fAction, setFAction] = useState("");
  const [fUser, setFUser] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fq, setFq] = useState("");

  // sort + page-jump
  const [logSortCol, setLogSortCol] = useState<"createdAt" | "userName">("createdAt");
  const [logSortDir, setLogSortDir] = useState<"asc" | "desc">("desc");
  const [jumpInput, setJumpInput] = useState("");

  const load = useCallback(async (toPage = page) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (fModule) p.set("module", fModule);
      if (fAction) p.set("action", fAction);
      if (fUser) p.set("userId", fUser);
      if (fFrom) p.set("from", fFrom);
      if (fTo) p.set("to", fTo);
      if (fq.trim()) p.set("q", fq.trim());
      p.set("page", String(toPage));
      p.set("pageSize", "25");
      const res = await fetch(`/api/activity?${p.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setUsers(json.users || []);
        setTotal(json.total);
        setPages(json.pages);
        setPage(json.page);
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [fModule, fAction, fUser, fFrom, fTo, fq, page]);

  // Recargar al cambiar filtros (vuelve a página 1)
  useEffect(() => {
    if (role !== "ADMIN") { setLoading(false); return; }
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fModule, fAction, fUser, fFrom, fTo, fq, role]);

  async function doExportCsv() {
    const p = new URLSearchParams();
    if (fModule) p.set("module", fModule);
    if (fAction) p.set("action", fAction);
    if (fUser) p.set("userId", fUser);
    if (fFrom) p.set("from", fFrom);
    if (fTo) p.set("to", fTo);
    if (fq.trim()) p.set("q", fq.trim());
    p.set("export", "csv");
    const res = await fetch(`/api/activity?${p.toString()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setFModule(""); setFAction(""); setFUser(""); setFFrom(""); setFTo(""); setFq("");
  }

  function toggleLogSort(col: "createdAt" | "userName") {
    if (logSortCol === col) setLogSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setLogSortCol(col); setLogSortDir("asc"); }
  }

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const d = logSortDir === "asc" ? 1 : -1;
      if (logSortCol === "createdAt") return d * a.createdAt.localeCompare(b.createdAt);
      if (logSortCol === "userName")  return d * ((a.user?.name ?? "").localeCompare(b.user?.name ?? ""));
      return 0;
    });
  }, [logs, logSortCol, logSortDir]);

  if (role && role !== "ADMIN") {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center" }}>
        <ShieldAlert size={40} color="#ef4444" style={{ margin: "0 auto 1rem" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Acceso restringido</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Solo los administradores pueden ver la auditoría.</div>
      </div>
    );
  }

  const hasFilters = fModule || fAction || fUser || fFrom || fTo || fq;

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#6366f115", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ScrollText size={20} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Auditoría</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{total} evento{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={doExportCsv} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "#2563eb15", color: "#2563eb", border: "1px solid #2563eb40", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Download size={14} />Exportar CSV
          </button>
          <button onClick={() => load(page)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <RefreshCw size={14} />Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
        <input value={fq} onChange={e => setFq(e.target.value)} placeholder="Buscar en detalle o registro…" style={{ ...inp, flex: 1, minWidth: isMobile ? 120 : 180, width: isMobile ? "100%" : undefined }} />
        <select value={fModule} onChange={e => setFModule(e.target.value)} style={inp}>
          <option value="">Todos los módulos</option>
          <option value="muebles">Muebles</option>
          <option value="transporte">Transporte</option>
          <option value="users">Usuarios</option>
        </select>
        <select value={fAction} onChange={e => setFAction(e.target.value)} style={inp}>
          <option value="">Todas las acciones</option>
          <option value="CREATE">Creó</option>
          <option value="UPDATE">Editó</option>
          <option value="DELETE">Eliminó</option>
        </select>
        <select value={fUser} onChange={e => setFUser(e.target.value)} style={inp}>
          <option value="">Todos los usuarios</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} title="Desde" style={inp} />
        <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} title="Hasta" style={inp} />
        {hasFilters && <button onClick={clearFilters} style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}>Limpiar</button>}
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <SkeletonTable rows={8} cols={6} />
        </div>
      ) : logs.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center", color: "var(--muted)" }}>
          Sin eventos que coincidan con los filtros.
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                  <th onClick={() => toggleLogSort("createdAt")} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: logSortCol === "createdAt" ? "#6366f1" : "var(--muted)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                    Fecha y hora{logSortCol === "createdAt" ? (logSortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                  </th>
                  <th onClick={() => toggleLogSort("userName")} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: logSortCol === "userName" ? "#6366f1" : "var(--muted)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                    Usuario{logSortCol === "userName" ? (logSortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                  </th>
                  {["Acción", "Módulo", "Registro", "Detalle"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map(l => {
                  const am = ACTION_META[l.action] || { label: l.action, color: "#64748b" };
                  const mm = MODULE_META[l.module] || { label: l.module, color: "#64748b" };
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover-row">
                      <td style={{ padding: "0.6rem 0.85rem", fontFamily: "var(--mono)", whiteSpace: "nowrap", color: "var(--muted2)" }}>{fmtDateTime(l.createdAt)}</td>
                      <td style={{ padding: "0.6rem 0.85rem" }}>
                        {l.user ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{l.user.name}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{l.user.email}</div>
                          </>
                        ) : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: am.color + "18", color: am.color }}>{am.label}</span>
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: mm.color + "18", color: mm.color }}>{mm.label}</span>
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem", fontFamily: "var(--mono)", color: "var(--muted2)" }}>{l.recordId}</td>
                      <td style={{ padding: "0.6rem 0.85rem", color: "var(--muted2)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.details || ""}>{l.details || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación */}
      {!loading && logs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", fontSize: 12, color: "var(--muted)" }}>
          <span>Página {page} de {pages}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button disabled={page <= 1} onClick={() => load(page - 1)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.4rem 0.8rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1, color: "var(--muted2)" }}><ChevronLeft size={14} />Anterior</button>
            <input
              type="number" min={1} max={pages}
              value={jumpInput !== "" ? jumpInput : page}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(jumpInput);
                  if (!isNaN(n) && n >= 1 && n <= pages) load(n);
                  setJumpInput("");
                }
              }}
              onBlur={() => setJumpInput("")}
              title={`Ir a página (1–${pages})`}
              style={{ width: 52, textAlign: "center", border: "1px solid var(--border)", borderRadius: 8, padding: "0.35rem 0.5rem", fontSize: 12, fontFamily: "var(--mono)", background: "var(--surface)", color: "var(--text)", outline: "none" }}
            />
            <button disabled={page >= pages} onClick={() => load(page + 1)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.4rem 0.8rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.5 : 1, color: "var(--muted2)" }}>Siguiente<ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
