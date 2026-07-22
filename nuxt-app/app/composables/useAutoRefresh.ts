export function useAutoRefresh(opts: {
  enabled?: boolean
  intervalMs?: number
  pause?: boolean
  onRefresh: () => void | Promise<void>
}) {
  const enabled = opts.enabled ?? true
  const intervalMs = opts.intervalMs ?? 60_000
  const pause = opts.pause ?? false
  const refreshing = ref(false)
  const lastUpdatedAt = ref<Date | null>(null)

  const refreshNow = async () => {
    if (!enabled || pause || document.visibilityState === 'hidden') return
    refreshing.value = true
    try {
      await opts.onRefresh()
      lastUpdatedAt.value = new Date()
    } finally {
      refreshing.value = false
    }
  }

  onMounted(() => {
    if (!enabled || pause) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refreshNow()
    }, intervalMs)
    onUnmounted(() => window.clearInterval(id))
  })

  return { refreshing, lastUpdatedAt, refreshNow }
}

export function formatLastUpdated(date: Date | null) {
  if (!date) return 'Esperando actualización'
  return `Actualizado ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}
