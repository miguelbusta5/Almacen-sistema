"use client";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// MODAL — modal premium único y reutilizable
// Portal + backdrop con blur + cierre con Esc + lock de scroll.
// Para detalle/lectura usar SlidePanel; este modal es para
// confirmaciones y formularios crear/editar.
// ═══════════════════════════════════════════════════════════
type Size = "sm" | "md" | "lg";
const WIDTHS: Record<Size, number> = { sm: 420, md: 560, lg: 760 };

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: Size;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size = "md", footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="g-modal-overlay" onClick={onClose}>
      <div
        className="g-modal animate-scale-in"
        style={{ maxWidth: WIDTHS[size] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {(title || subtitle) && (
          <div className="g-modal-head">
            <div style={{ minWidth: 0 }}>
              {title && <h2 className="g-modal-title">{title}</h2>}
              {subtitle && <p className="g-modal-sub">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="g-btn g-btn-ghost g-btn-icon g-btn-sm"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="g-modal-body">{children}</div>
        {footer && <div className="g-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ─── Confirmación (destructivos / acciones críticas) ──────────
export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="g-btn g-btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`g-btn ${tone === "danger" ? "g-btn-danger" : "g-btn-primary"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && (
        <div style={{ fontSize: 14, color: "var(--muted2)", lineHeight: 1.55 }}>{message}</div>
      )}
    </Modal>
  );
}
