export interface PausaOperativaDTO {
  id: string
  motivo: 'ALIMENTACION' | 'CAMBIO_BATERIAS'
  inicio: string
  movimientos: string[]
  tareas: string[]
  pendientes: string[]
  recepciones: string[]
  ordenesMuebles: string[]
  lineasMuebles: string[]
}

export function usePausaOperativa() {
  const pausa = useState<PausaOperativaDTO | null>('pausa-operativa', () => null)
  const revision = useState('pausa-revision', () => 0)
  const cargada = useState('pausa-cargada', () => false)
  const ocupada = useState('pausa-ocupada', () => false)
  const version = useState('pausa-version', () => 0)

  async function cargar() {
    const iniciadaEn = version.value
    const res = await $fetch<{ data: PausaOperativaDTO | null }>('/api/pausas-operativas')
    if (iniciadaEn !== version.value) return
    if (pausa.value?.id !== res.data?.id) revision.value++
    pausa.value = res.data
    cargada.value = true
  }
  async function cambiar(motivo?: PausaOperativaDTO['motivo']) {
    if (ocupada.value) return
    ocupada.value = true
    version.value++
    try {
      const res = await $fetch<{ data: PausaOperativaDTO | null }>(
        motivo ? '/api/pausas-operativas' : '/api/pausas-operativas/finalizar',
        { method: 'POST', body: motivo ? { motivo } : { pausaId: pausa.value?.id } },
      )
      version.value++
      pausa.value = res.data
      revision.value++
    } catch (e) {
      // Una respuesta perdida pudo confirmar la operación. Recuperar el estado
      // real permite reintentar sin crear otra pausa ni reanudar la equivocada.
      await cargar().catch(() => {})
      throw e
    } finally { ocupada.value = false }
  }
  return { pausa, revision, cargada, ocupada, cargar, cambiar }
}
