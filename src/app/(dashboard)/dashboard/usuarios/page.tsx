"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { Users, Plus, Pencil, X, Shield, ShieldCheck, ShieldAlert, Truck, Car, Upload, Search, GitMerge, Package } from "lucide-react";
import { SkeletonTable, EmptyState } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { getModuleColor } from "@/lib/moduleTheme";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type Role = "ADMIN" | "GERENTE" | "OPERADOR" | "TRANSPORTISTA" | "INVENTARIO" | "TRANSPORTE" | "SUPERVISOR_INVENTARIO" | "SUPERVISOR_TRANSPORTE" | "TIENDA" | "SUPERVISOR_TIENDA" | "OPERACIONES_MUEBLES" | "OPERACIONES_GOURMET" | "ETIQUETADO" | "SUPERVISOR_ALMACENAMIENTO";

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

interface TransportistaDisponible {
  id: string;
  nombre: string;
  telefono?: string | null;
  vehiculo?: { placa: string; tipo: string; estado: string } | null;
}

interface VehiculoOperativo {
  id: string;
  placa: string;
  tipo: string;
  capacidadKg?: number | null;
  estado: string;
  transportistas?: Array<{ id: string; nombre: string; activo: boolean }>;
}

interface TransportistaOperativo {
  id: string;
  nombre: string;
  telefono?: string | null;
  activo: boolean;
  user?: { id: string; name: string; email: string; active: boolean } | null;
  vehiculo?: { id: string; placa: string; tipo: string; estado: string } | null;
}

const ROLE_META: Record<Role, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN:                  { label: "Administrador",      color: getModuleColor("usuarios"), icon: <ShieldCheck size={13} /> },
  GERENTE:                { label: "Gerente",            color: getModuleColor("centro-control"), icon: <Shield size={13} /> },
  SUPERVISOR_INVENTARIO:  { label: "Sup. Inventario",    color: getModuleColor("inventario"), icon: <Shield size={13} /> },
  SUPERVISOR_TRANSPORTE:  { label: "Sup. Transporte",    color: getModuleColor("transporte"), icon: <Shield size={13} /> },
  INVENTARIO:             { label: "Op. Inventario",     color: "#64748b", icon: <ShieldAlert size={13} /> },
  TRANSPORTE:             { label: "Op. Transporte",     color: "#64748b", icon: <ShieldAlert size={13} /> },
  TIENDA:                 { label: "Op. Tienda",         color: getModuleColor("tienda"), icon: <ShieldAlert size={13} /> },
  SUPERVISOR_TIENDA:      { label: "Sup. Tienda",        color: getModuleColor("tienda"), icon: <Shield size={13} /> },
  OPERADOR:               { label: "Operador (General)", color: "#94a3b8", icon: <ShieldAlert size={13} /> },
  TRANSPORTISTA:          { label: "Transportista",      color: getModuleColor("preoperacional"), icon: <ShieldAlert size={13} /> },
  OPERACIONES_MUEBLES:    { label: "Op. Muebles",        color: getModuleColor("integracion"), icon: <GitMerge size={13} /> },
  OPERACIONES_GOURMET:    { label: "Op. Gourmet",        color: getModuleColor("integracion"), icon: <GitMerge size={13} /> },
  ETIQUETADO:             { label: "Etiquetado",         color: getModuleColor("exportaciones"), icon: <Package size={13} /> },
  SUPERVISOR_ALMACENAMIENTO: { label: "Sup. Almacenamiento", color: getModuleColor("exportaciones"), icon: <Shield size={13} /> },
};

export default function UsuariosPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as Role | undefined;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [vehiculos, setVehiculos] = useState<VehiculoOperativo[]>([]);
  const [transportistasOperativos, setTransportistasOperativos] = useState<TransportistaOperativo[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "role" | "active">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }

  function toggleSort(col: "name" | "role" | "active") {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } catch { showToast("Error al cargar", true); }
    finally { setLoading(false); }
  }

  async function loadCatalogos() {
    setLoadingCatalogos(true);
    try {
      const [vehiculosRes, transportistasRes] = await Promise.all([
        fetch("/api/users/vehiculos"),
        fetch("/api/users/transportistas-operativos"),
      ]);
      const [vehiculosJson, transportistasJson] = await Promise.all([
        vehiculosRes.json(),
        transportistasRes.json(),
      ]);
      if (vehiculosJson.success) setVehiculos(vehiculosJson.data);
      if (transportistasJson.success) setTransportistasOperativos(transportistasJson.data);
    } catch {
      showToast("Error al cargar conductores y vehículos", true);
    } finally {
      setLoadingCatalogos(false);
    }
  }

  useEffect(() => {
    if (role === "ADMIN") {
      load();
      loadCatalogos();
    } else {
      setLoading(false);
      setLoadingCatalogos(false);
    }
  }, [role]);

  const autoRefresh = useAutoRefresh({
    enabled: role === "ADMIN",
    pause: Boolean(showForm || editing),
    onRefresh: async () => {
      await load();
      await loadCatalogos();
    },
  });

  const filteredUsers = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return [...users]
      .filter((u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_META[u.role].label.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const d = sortDir === "asc" ? 1 : -1;
        if (sortCol === "name")   return d * a.name.localeCompare(b.name);
        if (sortCol === "role")   return d * ROLE_META[a.role].label.localeCompare(ROLE_META[b.role].label);
        if (sortCol === "active") return d * (Number(b.active) - Number(a.active));
        return 0;
      });
  }, [users, searchQ, sortCol, sortDir]);

  if (role && role !== "ADMIN") {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center" }}>
        <ShieldAlert size={40} color="var(--error)" style={{ margin: "0 auto 1rem" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Acceso restringido</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Solo los administradores pueden gestionar usuarios.</div>
      </div>
    );
  }

  const COLOR = getModuleColor("usuarios");

  return (
    <div className="animate-fade-in" style={{ "--module-color": COLOR, display: "grid", gap: 18 } as React.CSSProperties}>
      <section className="op-module-header" style={{ "--module-color": COLOR } as React.CSSProperties}>
        <div className="op-module-kicker">Gobierno del sistema</div>
        <h1 className="op-module-title">Usuarios y operación base</h1>
        <p className="op-module-copy">Administración de cuentas, roles, maestro PLU, vehículos y transportistas operativos sin convertirlo en módulo de logística.</p>
      </section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#6366f115", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={20} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Usuarios</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <AutoRefreshIndicator
            lastUpdatedAt={autoRefresh.lastUpdatedAt}
            refreshing={autoRefresh.refreshing}
            onRefresh={autoRefresh.refreshNow}
          />
          <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 18px rgba(37,99,235,0.20)" }}>
            <Plus size={15} />Nuevo usuario
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <SkeletonTable rows={6} cols={5} />
        </div>
      ) : (
        <>
          {/* Barra de búsqueda */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Buscar por nombre, email o rol…"
                style={{ ...inp, paddingLeft: 32, height: 36, fontSize: 13, fontFamily: "var(--sans)" }}
              />
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
              {filteredUsers.length} de {users.length}
            </span>
          </div>

          {/* Tabla o EmptyState */}
          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="Sin resultados"
              description={searchQ ? `No hay usuarios que coincidan con "${searchQ}".` : "No hay usuarios registrados."}
              action={searchQ ? { label: "Limpiar búsqueda", onClick: () => setSearchQ("") } : undefined}
            />
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                      <th onClick={() => toggleSort("name")} style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: sortCol === "name" ? "#6366f1" : "var(--muted)", cursor: "pointer", userSelect: "none" }}>
                        Nombre{sortCol === "name" ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                      </th>
                      <th style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Email</th>
                      <th onClick={() => toggleSort("role")} style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: sortCol === "role" ? "#6366f1" : "var(--muted)", cursor: "pointer", userSelect: "none" }}>
                        Rol{sortCol === "role" ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                      </th>
                      <th onClick={() => toggleSort("active")} style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: sortCol === "active" ? "#6366f1" : "var(--muted)", cursor: "pointer", userSelect: "none" }}>
                        Estado{sortCol === "active" ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                      </th>
                      <th style={{ padding: "0.7rem 0.9rem" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => {
                      const m = ROLE_META[u.role];
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.7rem 0.9rem", fontWeight: 600 }}>{u.name}</td>
                          <td style={{ padding: "0.7rem 0.9rem", fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted2)" }}>{u.email}</td>
                          <td style={{ padding: "0.7rem 0.9rem" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: m.color + "18", color: m.color }}>
                              {m.icon}{m.label}
                            </span>
                          </td>
                          <td style={{ padding: "0.7rem 0.9rem" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: u.active ? "#ecfdf5" : "#fef2f2", color: u.active ? "#10b981" : "#ef4444" }}>
                              {u.active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td style={{ padding: "0.7rem 0.9rem", textAlign: "right" }}>
                            <button onClick={() => setEditing(u)} title="Editar" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: "var(--muted2)" }}><Pencil size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <CatalogosPreoperacional
        vehiculos={vehiculos}
        transportistas={transportistasOperativos}
        loading={loadingCatalogos}
        onReload={loadCatalogos}
        onToast={showToast}
      />

      {showForm && <FormNuevo onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); loadCatalogos(); showToast("Usuario creado ✓"); }} onError={m => showToast(m, true)} />}
      {editing && <ModalEditar u={editing} selfId={(session?.user as any)?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); showToast("Usuario actualizado ✓"); }} onError={m => showToast(m, true)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10001, background: toast.err ? "var(--error)" : "var(--text)", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-xl)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ════════ FORM NUEVO ════════
function CatalogosPreoperacional({
  vehiculos,
  transportistas,
  loading,
  onReload,
  onToast,
}: {
  vehiculos: VehiculoOperativo[];
  transportistas: TransportistaOperativo[];
  loading: boolean;
  onReload: () => void;
  onToast: (m: string, err?: boolean) => void;
}) {
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState("CAMION");
  const [capacidadKg, setCapacidadKg] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [savingVehiculo, setSavingVehiculo] = useState(false);
  const [savingTransportista, setSavingTransportista] = useState(false);
  const [importandoMaestro, setImportandoMaestro] = useState(false);
  const [resultadoMaestro, setResultadoMaestro] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function crearVehiculo() {
    if (!placa.trim() || !tipo.trim()) {
      onToast("Completa placa y tipo", true);
      return;
    }
    setSavingVehiculo(true);
    try {
      const res = await fetch("/api/users/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa, tipo, capacidadKg: capacidadKg ? Number(capacidadKg) : null, estado: "ACTIVO" }),
      });
      const json = await res.json();
      if (!json.success) {
        onToast(json.error || "Error al crear vehículo", true);
        return;
      }
      setPlaca("");
      setTipo("CAMION");
      setCapacidadKg("");
      onReload();
      onToast("Vehículo creado");
    } catch {
      onToast("Error de conexión", true);
    } finally {
      setSavingVehiculo(false);
    }
  }

  async function crearTransportista() {
    if (!nombre.trim()) {
      onToast("Completa el nombre del transportista", true);
      return;
    }
    setSavingTransportista(true);
    try {
      const res = await fetch("/api/users/transportistas-operativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono: telefono || null, vehiculoId: vehiculoId || null }),
      });
      const json = await res.json();
      if (!json.success) {
        onToast(json.error || "Error al crear transportista", true);
        return;
      }
      setNombre("");
      setTelefono("");
      setVehiculoId("");
      onReload();
      onToast("Transportista operativo creado");
    } catch {
      onToast("Error de conexión", true);
    } finally {
      setSavingTransportista(false);
    }
  }

  async function asignarVehiculo(transportistaId: string, nextVehiculoId: string) {
    setUpdatingId(transportistaId);
    try {
      const res = await fetch("/api/users/transportistas-operativos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transportistaId, vehiculoId: nextVehiculoId || null }),
      });
      const json = await res.json();
      if (!json.success) {
        onToast(json.error || "Error al asignar vehículo", true);
        return;
      }
      onReload();
      onToast("Vehículo asignado");
    } catch {
      onToast("Error de conexión", true);
    } finally {
      setUpdatingId(null);
    }
  }

  async function importarMaestro(file: File | null) {
    if (!file) return;
    setImportandoMaestro(true);
    setResultadoMaestro(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/productos-maestro/importar", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        onToast(json.error || "Error al importar maestro", true);
        return;
      }
      const data = json.data;
      setResultadoMaestro(`${data.importados} importados, ${data.actualizados} actualizados, ${data.ignorados} ignorados`);
      onToast("Maestro PLU importado");
    } catch {
      onToast("Error de conexión", true);
    } finally {
      setImportandoMaestro(false);
    }
  }

  return (
    <section style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      <div style={{ gridColumn: "1/-1", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Upload size={18} color="#6366f1" />
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Maestro PLU</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Importa MAESTRO.xlsx para autollenar descripción, fabricante, marca y precio.</p>
            {resultadoMaestro && <p style={{ fontSize: 12, color: "#10b981", marginTop: 4, fontWeight: 800 }}>{resultadoMaestro}</p>}
          </div>
        </div>
        <label style={{ ...btnPri, flex: "0 0 auto", background: "#6366f1", minWidth: 160, textAlign: "center", opacity: importandoMaestro ? 0.7 : 1 }}>
          {importandoMaestro ? "Importando..." : "Importar Excel"}
          <input type="file" accept=".xlsx" disabled={importandoMaestro} onChange={(e) => importarMaestro(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
        </label>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
          <Car size={18} color="#0e7490" />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Vehículos</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          <Field label="Placa"><input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} style={inp} placeholder="ABC123" /></Field>
          <Field label="Tipo">
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={inp}>
              <option value="CAMION">Camión</option>
              <option value="FURGON">Furgón</option>
              <option value="VAN">Van</option>
              <option value="MOTO">Moto</option>
            </select>
          </Field>
          <Field label="Capacidad kg"><input type="number" min={1} value={capacidadKg} onChange={e => setCapacidadKg(e.target.value)} style={inp} placeholder="Opcional" /></Field>
          <button onClick={crearVehiculo} disabled={savingVehiculo} style={{ ...btnPri, alignSelf: "end", background: "#0e7490" }}>
            {savingVehiculo ? "Creando..." : "Crear vehículo"}
          </button>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? <div style={{ color: "var(--muted)", fontSize: 12 }}>Cargando vehículos...</div> : vehiculos.map(v => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800 }}>{v.placa} <span style={{ color: "var(--muted)", fontWeight: 600 }}>{v.tipo}</span></span>
              <span style={{ color: v.estado === "ACTIVO" ? "#10b981" : "#f59e0b", fontWeight: 800 }}>{v.estado}</span>
            </div>
          ))}
          {!loading && vehiculos.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12 }}>No hay vehículos registrados. Crea uno para habilitar usuarios transportistas.</div>}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
          <Truck size={18} color="#0e7490" />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Transportistas operativos</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end" }}>
          <Field label="Nombre"><input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} placeholder="Nombre conductor" /></Field>
          <Field label="Teléfono"><input value={telefono} onChange={e => setTelefono(e.target.value)} style={inp} placeholder="Opcional" /></Field>
          <Field label="Vehículo">
            <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} style={inp}>
              <option value="">Sin vehículo</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.tipo}</option>)}
            </select>
          </Field>
          <button onClick={crearTransportista} disabled={savingTransportista} style={{ ...btnPri, background: "#0e7490", minWidth: 120 }}>
            {savingTransportista ? "Creando..." : "Crear"}
          </button>
        </div>

        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Nombre</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Usuario</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Vehículo</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {transportistas.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem", fontWeight: 800 }}>{t.nombre}</td>
                  <td style={{ padding: "0.5rem", color: "var(--muted2)" }}>{t.user ? t.user.email : "Sin usuario"}</td>
                  <td style={{ padding: "0.5rem", minWidth: 150 }}>
                    <select
                      value={t.vehiculo?.id || ""}
                      onChange={e => asignarVehiculo(t.id, e.target.value)}
                      disabled={updatingId === t.id}
                      style={{ ...inp, padding: "0.4rem 0.55rem", fontSize: 12 }}
                    >
                      <option value="">Sin vehículo</option>
                      {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.tipo}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "0.5rem", color: t.activo ? "#10b981" : "#ef4444", fontWeight: 800 }}>{t.activo ? "Activo" : "Inactivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && transportistas.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12, paddingTop: 10 }}>No hay transportistas operativos. Crea uno y asígnale vehículo antes de vincular usuario.</div>}
        </div>
      </div>
    </section>
  );
}

function FormNuevo({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("OPERADOR");
  const [transportistaId, setTransportistaId] = useState("");
  const [transportistas, setTransportistas] = useState<TransportistaDisponible[]>([]);
  const [loadingTransportistas, setLoadingTransportistas] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role !== "TRANSPORTISTA") {
      setTransportistaId("");
      setFormError(null);
      return;
    }

    let cancelled = false;
    setLoadingTransportistas(true);
    fetch("/api/users/transportistas-disponibles")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setTransportistas(json.success ? json.data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setTransportistas([]);
          setFormError("No se pudieron cargar transportistas disponibles");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTransportistas(false);
      });

    return () => { cancelled = true; };
  }, [role]);

  async function submit() {
    setFormError(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      const msg = "Completa los campos (contrasena minimo 8)";
      setFormError(msg);
      onError(msg);
      return;
    }
    if (role === "TRANSPORTISTA" && !transportistaId) {
      const msg = "Selecciona el transportista operativo a vincular";
      setFormError(msg);
      onError(msg);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          transportistaId: role === "TRANSPORTISTA" ? transportistaId : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) onSaved(); else {
        const msg = json.error || "Error al crear";
        setFormError(msg);
        onError(msg);
      }
    } catch {
      setFormError("Error de conexión");
      onError("Error de conexión");
    }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Nombre"><input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Nombre completo" /></Field>
        <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="usuario@almacen.com" /></Field>
        <Field label="Contraseña (mín. 8)"><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="••••••••" /></Field>
        <Field label="Rol"><select value={role} onChange={e => setRole(e.target.value as Role)} style={inp}><optgroup label="Área Inventario">
                <option value="INVENTARIO">Operario Inventario</option>
                <option value="SUPERVISOR_INVENTARIO">Supervisor Inventario</option>
              </optgroup>
              <optgroup label="Área Tienda">
                <option value="TIENDA">Operario Tienda</option>
                <option value="SUPERVISOR_TIENDA">Supervisor Tienda</option>
              </optgroup>
              <optgroup label="Área Operaciones">
                <option value="OPERACIONES_MUEBLES">Operaciones Muebles</option>
                <option value="OPERACIONES_GOURMET">Operaciones Gourmet</option>
                <option value="ETIQUETADO">Etiquetado</option>
                <option value="SUPERVISOR_ALMACENAMIENTO">Supervisor Almacenamiento</option>
              </optgroup>
              <optgroup label="Área Transporte">
                <option value="TRANSPORTE">Operario Transporte</option>
                <option value="TRANSPORTISTA">Transportista (Conductor)</option>
                <option value="SUPERVISOR_TRANSPORTE">Supervisor Transporte</option>
              </optgroup>
              <optgroup label="Gerencia / Admin">
                <option value="OPERADOR">Operador (General - Legado)</option>
                <option value="GERENTE">Gerente</option>
                <option value="ADMIN">Administrador</option>
              </optgroup></select></Field>
        {role === "TRANSPORTISTA" && (
          <Field label="Transportista operativo">
            <select
              value={transportistaId}
              onChange={e => setTransportistaId(e.target.value)}
              disabled={loadingTransportistas || transportistas.length === 0}
              style={{ ...inp, opacity: loadingTransportistas || transportistas.length === 0 ? 0.65 : 1 }}
            >
              <option value="">{loadingTransportistas ? "Cargando transportistas..." : "Seleccionar transportista"}</option>
              {transportistas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}{t.vehiculo ? ` - ${t.vehiculo.placa} (${t.vehiculo.tipo})` : " - sin vehículo"}
                </option>
              ))}
            </select>
            {!loadingTransportistas && transportistas.length === 0 && (
              <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                No hay transportistas activos con vehículo y sin usuario asignado.
              </p>
            )}
          </Field>
        )}
        {formError && (
          <div style={{ border: "1px solid #ef444455", background: "#ef444418", color: "#fca5a5", borderRadius: 8, padding: "0.6rem 0.75rem", fontSize: 12, fontWeight: 700 }}>
            {formError}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={submit} disabled={saving} style={{ ...btnPri, background: "#6366f1" }}>{saving ? "Creando…" : "Crear usuario"}</button>
      </div>
    </Modal>
  );
}

// ════════ MODAL EDITAR ════════
function ModalEditar({ u, selfId, onClose, onSaved, onError }: { u: User; selfId?: string; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(u.name);
  const [role, setRole] = useState<Role>(u.role);
  const [active, setActive] = useState(u.active);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const isSelf = u.id === selfId;

  async function save() {
    setSaving(true);
    const body: any = { name: name.trim(), role, active };
    if (password) body.password = password;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error al actualizar");
    } catch { onError("Error de conexión"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Editar usuario" sub={u.email} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Nombre"><input value={name} onChange={e => setName(e.target.value)} style={inp} /></Field>
        <Field label="Rol"><select value={role} onChange={e => setRole(e.target.value as Role)} disabled={isSelf} style={{ ...inp, opacity: isSelf ? 0.5 : 1 }}><optgroup label="Área Inventario">
                <option value="INVENTARIO">Operario Inventario</option>
                <option value="SUPERVISOR_INVENTARIO">Supervisor Inventario</option>
              </optgroup>
              <optgroup label="Área Tienda">
                <option value="TIENDA">Operario Tienda</option>
                <option value="SUPERVISOR_TIENDA">Supervisor Tienda</option>
              </optgroup>
              <optgroup label="Área Operaciones">
                <option value="OPERACIONES_MUEBLES">Operaciones Muebles</option>
                <option value="OPERACIONES_GOURMET">Operaciones Gourmet</option>
                <option value="ETIQUETADO">Etiquetado</option>
                <option value="SUPERVISOR_ALMACENAMIENTO">Supervisor Almacenamiento</option>
              </optgroup>
              <optgroup label="Área Transporte">
                <option value="TRANSPORTE">Operario Transporte</option>
                <option value="TRANSPORTISTA">Transportista (Conductor)</option>
                <option value="SUPERVISOR_TRANSPORTE">Supervisor Transporte</option>
              </optgroup>
              <optgroup label="Gerencia / Admin">
                <option value="OPERADOR">Operador (General - Legado)</option>
                <option value="GERENTE">Gerente</option>
                <option value="ADMIN">Administrador</option>
              </optgroup></select></Field>
        <Field label="Nueva contraseña (opcional)"><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="Dejar vacío para no cambiar" /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: isSelf ? "not-allowed" : "pointer", opacity: isSelf ? 0.5 : 1 }}>
          <input type="checkbox" checked={active} disabled={isSelf} onChange={e => setActive(e.target.checked)} />
          Usuario activo
        </label>
        {isSelf && <p style={{ fontSize: 11, color: "var(--muted)" }}>No puedes cambiar tu propio rol ni desactivarte.</p>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={save} disabled={saving} style={{ ...btnPri, background: "#6366f1" }}>{saving ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </Modal>
  );
}

// ════════ helpers ════════
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, sub, children, onClose }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px #0f172a40" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{title}</h3>
            {sub && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, fontFamily: "var(--mono)" }}>{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--muted2)", display: "flex" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.85rem", fontSize: 13, fontFamily: "var(--mono)", outline: "none", background: "var(--bg)", width: "100%", boxSizing: "border-box" };
const btnSec: React.CSSProperties = { flex: 1, padding: "0.65rem", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnPri: React.CSSProperties = { flex: 1, padding: "0.65rem", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" };
