"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal, ConfirmModal } from "./Modal";

// ════════════════════════════════════════════════════════════════════
// Hooks de diálogo basados en promesas — reemplazan a los nativos
// `window.confirm()` y `prompt()` por el Modal del design system.
// Uso:
//   const { confirm, confirmModal } = useConfirm();
//   if (await confirm({ title: "Borrar", message: "¿Seguro?" })) { ... }
//   // ...y renderizar {confirmModal} una vez en el árbol.
// ════════════════════════════════════════════════════════════════════

interface ConfirmOpts {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const confirmModal = opts ? (
    <ConfirmModal
      open
      title={opts.title}
      message={opts.message}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      tone={opts.tone}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, confirmModal };
}

interface PromptOpts {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  multiline?: boolean;
  /** Si true, no permite confirmar con el campo vacío. */
  required?: boolean;
}

export function usePrompt() {
  const [opts, setOpts] = useState<PromptOpts | null>(null);
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const settle = (v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const promptModal = opts ? (
    <PromptModal opts={opts} onCancel={() => settle(null)} onSubmit={(v) => settle(v)} />
  ) : null;

  return { prompt, promptModal };
}

function PromptModal({
  opts,
  onCancel,
  onSubmit,
}: {
  opts: PromptOpts;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(opts.defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const disabled = opts.required ? value.trim() === "" : false;

  const submit = () => {
    if (disabled) return;
    onSubmit(value);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={opts.title}
      size="sm"
      footer={
        <>
          <button type="button" className="g-btn g-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="g-btn g-btn-primary" onClick={submit} disabled={disabled}>
            {opts.confirmLabel ?? "Aceptar"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {opts.label && (
          <label style={{ fontSize: 13, color: "var(--muted2)", fontWeight: 600 }}>{opts.label}</label>
        )}
        {opts.multiline ? (
          <textarea
            ref={inputRef}
            autoFocus
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            className="ds-input"
            style={{ minWidth: 0, width: "100%", height: "auto", padding: 10, resize: "vertical" }}
          />
        ) : (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => setValue(e.target.value)}
            className="ds-input"
            style={{ minWidth: 0, width: "100%" }}
          />
        )}
      </form>
    </Modal>
  );
}
