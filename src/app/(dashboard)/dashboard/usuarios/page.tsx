"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Plus, Shield, ShieldCheck, ShieldAlert, Truck, Car, Upload, Search, GitMerge, Package } from "lucide-react";
import { SkeletonTable, EmptyState, ModuleHero } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useApi } from "@/hooks/useApi";
import { apiGet, apiPost, apiPut, apiPatch, apiUpload } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/contexts/ToastContext";
import { UsuariosTable, TransportistasOperativosTable } from "./_components";

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
  const role = (session?.user as { role?: Role } | undefined)?.role;

  const isAdmin = role === "ADMIN";
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const toastCtx = useToast();

  // ── Lecturas SWR (solo ADMIN; key null desactiva la petición) ──────────────
  const { data: usersData, isLoading: loading, mutate: mutateUsers } = useApi<{ data: User[] }>(isAdmin ? "/api/users" : null);
  const users = useMemo(() => usersData?.data ?? [], [usersData]);
  const { data: vehData, isLoading: loadingVeh, mutate: mutateVeh } = useApi<{ data: VehiculoOperativo[] }>(isAdmin ? "/api/users/vehiculos" : null);
  const vehiculos = useMemo(() => vehData?.data ?? [], [vehData]);
  const { data: transData, isLoading: loadingTrans, mutate: mutateTrans } = useApi<{ data: TransportistaOperativo[] }>(isAdmin ? "/api/users/transportistas-operativos" : null);
  const transportistasOperativos = useMemo(() => transData?.data ?? [], [transData]);
  const loadingCatalogos = loadingVeh || loadingTrans;
  const load = useCallback(() => { void mutateUsers(); }, [mutateUsers]);
  const loadCatalogos = useCallback(() => { void mutateVeh(); void mutateTrans(); }, [mutateVeh, mutateTrans]);
  const [searchQ, setSearchQ] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "role" | "active">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [debugTable, setDebugTable] = useState(false);

  // Modo debug de tabla: /dashboard/usuarios?debugTable=1 (diagnóstico de mapeo de columnas).
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  function showToast(msg: string, err = false) {
    err ? toastCtx.error(msg) : toastCtx.success(msg);
  }

  function toggleSort(col: "name" | "role" | "active") {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const autoRefresh = useAutoRefresh({
    enabled: isAdmin,
    pause: Boolean(showForm || editing),
    onRefresh: () => { load(); loadCatalogos(); },
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
      <div className="g-panel g-empty animate-fade-in">
        <div className="g-empty-icon" style={{ color: "var(--error)" }}><ShieldAlert size={22} /></div>
        <h3>Acceso restringido</h3>
        <p>Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  const COLOR = getModuleColor("usuarios");

  return (
    <div className="animate-fade-in" style={{ ...getModuleCssVars("usuarios"), "--module-color": COLOR, display: "grid", gap: 18 } as React.CSSProperties}>
      <ModuleHero
        moduleKey="usuarios"
        kicker="Gobierno del sistema"
        title="Usuarios y operación base"
        description={`${users.length} usuario${users.length !== 1 ? "s" : ""} registrado${users.length !== 1 ? "s" : ""} · cuentas, roles, maestro PLU, vehículos y transportistas operativos.`}
        actions={
          <>
            <AutoRefreshIndicator
              lastUpdatedAt={autoRefresh.lastUpdatedAt}
              refreshing={autoRefresh.refreshing}
              onRefresh={autoRefresh.refreshNow}
            />
            <button onClick={() => setShowForm(true)} className="g-btn g-btn-primary">
              <Plus size={15} />Nuevo usuario
            </button>
          </>
        }
      />

      {loading ? (
        <div className="g-table-wrap">
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
            <div className="g-table-wrap">
              <UsuariosTable
                users={filteredUsers}
                roleMeta={ROLE_META}
                sortCol={sortCol}
                sortDir={sortDir}
                onToggleSort={toggleSort}
                onEdit={(u) => setEditing(u)}
                debug={debugTable}
              />
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
        debugTable={debugTable}
      />

      {showForm && <FormNuevo onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); loadCatalogos(); showToast("Usuario creado ✓"); }} onError={m => showToast(m, true)} />}
      {editing && <ModalEditar u={editing} selfId={(session?.user as { id?: string } | undefined)?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); showToast("Usuario actualizado ✓"); }} onError={m => showToast(m, true)} />}
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
  debugTable = false,
}: {
  vehiculos: VehiculoOperativo[];
  transportistas: TransportistaOperativo[];
  loading: boolean;
  onReload: () => void;
  onToast: (m: string, err?: boolean) => void;
  debugTable?: boolean;
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
      await apiPost("/api/users/vehiculos", { placa, tipo, capacidadKg: capacidadKg ? Number(capacidadKg) : null, estado: "ACTIVO" });
      setPlaca("");
      setTipo("CAMION");
      setCapacidadKg("");
      onReload();
      onToast("Vehículo creado");
    } catch (e) {
      onToast(getErrorMessage(e, "Error al crear vehículo"), true);
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
      await apiPost("/api/users/transportistas-operativos", { nombre, telefono: telefono || null, vehiculoId: vehiculoId || null });
      setNombre("");
      setTelefono("");
      setVehiculoId("");
      onReload();
      onToast("Transportista operativo creado");
    } catch (e) {
      onToast(getErrorMessage(e, "Error al crear transportista"), true);
    } finally {
      setSavingTransportista(false);
    }
  }

  async function asignarVehiculo(transportistaId: string, nextVehiculoId: string) {
    setUpdatingId(transportistaId);
    try {
      await apiPatch("/api/users/transportistas-operativos", { id: transportistaId, vehiculoId: nextVehiculoId || null });
      onReload();
      onToast("Vehículo asignado");
    } catch (e) {
      onToast(getErrorMessage(e, "Error al asignar vehículo"), true);
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
      const json = await apiUpload<{ data: { importados: number; actualizados: number; ignorados: number } }>("/api/productos-maestro/importar", form);
      const data = json.data;
      setResultadoMaestro(`${data.importados} importados, ${data.actualizados} actualizados, ${data.ignorados} ignorados`);
      onToast("Maestro PLU importado");
    } catch (e) {
      onToast(getErrorMessage(e, "Error al importar maestro"), true);
    } finally {
      setImportandoMaestro(false);
    }
  }

  return (
    <section style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      <div style={{ gridColumn: "1/-1", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Upload size={18} color="var(--brand)" />
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Maestro PLU</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Importa MAESTRO.xlsx para autollenar descripción, fabricante, marca y precio.</p>
            {resultadoMaestro && <p style={{ fontSize: 12, color: "var(--brand)", marginTop: 4, fontWeight: 800 }}>{resultadoMaestro}</p>}
          </div>
        </div>
        <label style={{ ...btnPri, flex: "0 0 auto", background: "var(--brand)", minWidth: 160, textAlign: "center", opacity: importandoMaestro ? 0.7 : 1 }}>
          {importandoMaestro ? "Importando..." : "Importar Excel"}
          <input type="file" accept=".xlsx" disabled={importandoMaestro} onChange={(e) => importarMaestro(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
        </label>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
          <Car size={18} color="var(--brand)" />
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
          <button onClick={crearVehiculo} disabled={savingVehiculo} style={{ ...btnPri, alignSelf: "end", background: "var(--brand)" }}>
            {savingVehiculo ? "Creando..." : "Crear vehículo"}
          </button>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? <div style={{ color: "var(--muted)", fontSize: 12 }}>Cargando vehículos...</div> : vehiculos.map(v => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800 }}>{v.placa} <span style={{ color: "var(--muted)", fontWeight: 600 }}>{v.tipo}</span></span>
              <span style={{ color: v.estado === "ACTIVO" ? "var(--brand)" : "var(--muted2)", fontWeight: 800 }}>{v.estado}</span>
            </div>
          ))}
          {!loading && vehiculos.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12 }}>No hay vehículos registrados. Crea uno para habilitar usuarios transportistas.</div>}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
          <Truck size={18} color="var(--brand)" />
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
          <button onClick={crearTransportista} disabled={savingTransportista} style={{ ...btnPri, background: "var(--brand)", minWidth: 120 }}>
            {savingTransportista ? "Creando..." : "Crear"}
          </button>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <TransportistasOperativosTable
            transportistas={transportistas}
            vehiculos={vehiculos}
            loading={loading}
            updatingId={updatingId}
            onAsignarVehiculo={asignarVehiculo}
            debug={debugTable}
          />
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
    apiGet<{ data: TransportistaDisponible[] }>("/api/users/transportistas-disponibles")
      .then((json) => {
        if (!cancelled) setTransportistas(json.data ?? []);
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
      await apiPost("/api/users", {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        transportistaId: role === "TRANSPORTISTA" ? transportistaId : undefined,
      });
      onSaved();
    } catch (e) {
      const msg = getErrorMessage(e, "Error al crear");
      setFormError(msg);
      onError(msg);
    }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo usuario"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="g-btn g-btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving} className="g-btn g-btn-primary">{saving ? "Creando…" : "Crear usuario"}</button>
        </>
      }
    >
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
              <p style={{ fontSize: 11, color: "var(--muted2)", marginTop: 4 }}>
                No hay transportistas activos con vehículo y sin usuario asignado.
              </p>
            )}
          </Field>
        )}
        {formError && (
          <div style={{ border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)", background: "var(--error-tint)", color: "var(--error)", borderRadius: 8, padding: "0.6rem 0.75rem", fontSize: 12, fontWeight: 700 }}>
            {formError}
          </div>
        )}
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
    const body: Record<string, unknown> = { name: name.trim(), role, active };
    if (password) body.password = password;
    try {
      await apiPut(`/api/users/${u.id}`, body);
      onSaved();
    } catch (e) { onError(getErrorMessage(e, "Error al actualizar")); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar usuario"
      subtitle={u.email}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="g-btn g-btn-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="g-btn g-btn-primary">{saving ? "Guardando…" : "Guardar cambios"}</button>
        </>
      }
    >
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

const inp: React.CSSProperties = { border: "1px solid var(--border-strong)", borderRadius: "var(--r)", padding: "0 12px", height: 36, fontSize: 13, fontFamily: "var(--sans)", outline: "none", background: "var(--surface)", color: "var(--text)", width: "100%", boxSizing: "border-box" };
const btnPri: React.CSSProperties = { flex: 1, padding: "0.65rem", background: "var(--brand)", color: "var(--text-on-accent)", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" };
