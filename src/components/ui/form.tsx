"use client";
import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// ═══════════════════════════════════════════════════════════
// FORM — primitivas premium sobre .g-input
// Field envuelve label + hint/error; Input/Select/Textarea
// aplican estados (hover/focus/error) y dark-mode del DS.
// ═══════════════════════════════════════════════════════════
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>
          {label}
          {required && <span style={{ color: "var(--error)" }}> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <span style={{ fontSize: 11, color: "var(--error)" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={`g-input ${error ? "g-input-error" : ""} ${className}`.trim()} {...props} />;
}

export function Select({
  error,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select className={`g-input ${error ? "g-input-error" : ""} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={`g-input g-textarea ${error ? "g-input-error" : ""} ${className}`.trim()}
      {...props}
    />
  );
}
