"use client";

import { createContext, useCallback, useContext, useReducer, useRef } from "react";
import { Toast, type ToastVariant } from "@/components/ui";

export interface ToastShowOptions {
  message: string;
  type?: ToastVariant;
  duration?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastVariant;
  duration: number;
}

export type ToastAction =
  | { type: "ADD"; item: ToastItem }
  | { type: "REMOVE"; id: string };

/**
 * Reducer puro — sin dependencias de React/DOM, testeable directamente.
 * ADD agrega una toast al final de la pila; REMOVE la quita por id
 * (usado tanto por el auto-dismiss por timeout como por el cierre manual).
 */
export function toastReducer(items: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case "ADD":
      return [...items, action.item];
    case "REMOVE":
      return items.filter((t) => t.id !== action.id);
    default:
      return items;
  }
}

export function createToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_DURATION = 3000;
const noop = () => {};

interface ToastApi {
  show: (options: ToastShowOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi>({
  show: noop,
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
});

/** Nunca lanza, incluso si se llama fuera de un `ToastProvider` (mismo patrón que useCommandPalette). */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(toastReducer, [] as ToastItem[]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(({ message, type = "success", duration = DEFAULT_DURATION }: ToastShowOptions) => {
    const id = createToastId();
    dispatch({ type: "ADD", item: { id, message, type, duration } });
    const timer = setTimeout(() => remove(id), duration);
    timers.current.set(id, timer);
  }, [remove]);

  const success = useCallback((message: string, duration?: number) => show({ message, type: "success", duration }), [show]);
  const error = useCallback((message: string, duration?: number) => show({ message, type: "error", duration }), [show]);
  const info = useCallback((message: string, duration?: number) => show({ message, type: "info", duration }), [show]);
  const warning = useCallback((message: string, duration?: number) => show({ message, type: "warning", duration }), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        {items.map((item) => (
          <Toast
            key={item.id}
            message={item.message}
            variant={item.type}
            stacked
            onClose={() => remove(item.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
