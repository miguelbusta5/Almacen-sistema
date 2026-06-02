"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { Users, Plus, Pencil, X, Shield, ShieldCheck, ShieldAlert } from "lucide-react";

type Role = "ADMIN" | "GERENTE" | "OPERADOR" | "TRANSPORTISTA" | "INVENTARIO" | "TRANSPORTE" | "SUPERVISOR_INVENTARIO" | "SUPERVISOR_TRANSPORTE";

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

const ROLE_META: Record<Role, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN:                  { label: "Administrador",      color: "#6366f1", icon: <ShieldCheck size={13} /> },
  GERENTE:                { label: "Gerente",            color: "#0ea5e9", icon: <Shield size={13} /> },
  SUPERVISOR_INVENTARIO:  { label: "Sup. Inventario",    color: "#2563eb", icon: <Shield size={13} /> },
  SUPERVISOR_TRANSPORTE:  { label: "Sup. Transporte",    color: "#0e7490", icon: <Shield size={13} /> },
  INVENTARIO:             { label: "Op. Inventario",     color: "#64748b", icon: <ShieldAlert size={13} /> },
  TRANSPORTE:             { label: "Op. Transporte",     color: "#64748b", icon: <ShieldAlert size={13} /> },
  OPERADOR:               { label: "Operador (General)", color: "#94a3b8", icon: <ShieldAlert size={13} /> },
  TRANSPORTISTA:          { label: "Transportista",      color: "#0e7490", icon: <ShieldAlert size={13} /> },
};

export default function UsuariosPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as Role | undefined;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
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
  useEffect(() => { if (role === "ADMIN") load(); else setLoading(false); }, [role]);

  if (role && role !== "ADMIN") {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center" }}>
        <ShieldAlert size={40} color="#ef4444" style={{ margin: "0 auto 1rem" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Acceso restringido</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Solo los administradores pueden gestionar usuarios.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
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
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={15} />Nuevo usuario
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--muted)" }}>Cargando…</div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                  {["Nombre", "Email", "Rol", "Estado", ""].map(h => (
                    <th key={h} style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
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

      {showForm && <FormNuevo onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); showToast("Usuario creado ✓"); }} onError={m => showToast(m, true)} />}
      {editing && <ModalEditar u={editing} selfId={(session?.user as any)?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); showToast("Usuario actualizado ✓"); }} onError={m => showToast(m, true)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, background: toast.err ? "#ef4444" : "#0f172a", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px #0f172a40" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ════════ FORM NUEVO ════════
function FormNuevo({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("OPERADOR");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 8) { onError("Completa los campos (contraseña ≥ 8)"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error al crear");
    } catch { onError("Error de conexión"); }
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
