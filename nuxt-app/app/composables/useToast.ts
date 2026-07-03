export interface ToastMsg { msg: string; err?: boolean }

// Toast compartido entre páginas — se renderiza una sola vez en el layout.
export function useToastState() {
  return useState<ToastMsg | null>('toast', () => null)
}

export function useToast() {
  const toast = useToastState()
  let t: ReturnType<typeof setTimeout>
  function show(msg: string, err = false) {
    toast.value = { msg, err }
    clearTimeout(t)
    t = setTimeout(() => (toast.value = null), 3200)
  }
  return { toast, show }
}
