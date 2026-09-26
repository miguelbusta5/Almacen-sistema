import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { canSeeModule } from '@/lib/modulePermissions'
import { minutosTarea, minutosUnicos, necesitaCaso } from '@/lib/garantiasCalc'

const t = (hora: string) => new Date(`2026-09-26T${hora}:00-05:00`)

describe('Garantías', () => {
  it('mantiene la misma lógica en Next y Nitro', () => {
    const leer = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n')
    expect(leer('nuxt-app/server/utils/garantiasCalc.ts')).toBe(leer('src/lib/garantiasCalc.ts'))
  })

  it('restringe el módulo al operario y a gerencia', () => {
    expect(canSeeModule('GARANTIAS', 'garantias')).toBe(true)
    expect(canSeeModule('ADMIN', 'garantias')).toBe(true)
    expect(canSeeModule('GERENTE', 'garantias')).toBe(true)
    expect(canSeeModule('TRANSPORTE', 'garantias')).toBe(false)
    expect(canSeeModule('GARANTIAS', 'indicadores')).toBe(false)
  })

  it('requiere caso para los tres procesos y deja Otras sin caso', () => {
    expect(necesitaCaso('INSPECCION')).toBe(true)
    expect(necesitaCaso('ENTREGA_TRANSPORTE')).toBe(true)
    expect(necesitaCaso('ANALISIS_CASO')).toBe(true)
    expect(necesitaCaso('OTRAS')).toBe(false)
  })

  it('descuenta la pausa en una tarea y no duplica tareas simultáneas', () => {
    const tramos = [{ inicio: t('08:00'), fin: t('09:00') }, { inicio: t('09:30'), fin: t('10:00') }]
    expect(minutosTarea(tramos)).toBe(90)
    expect(minutosUnicos([...tramos, { inicio: t('08:30'), fin: t('09:45') }])).toBe(120)
  })

  it('recorta el trabajo a un turno nocturno que cruza medianoche', () => {
    const turno = { inicio: t('20:00'), fin: new Date('2026-09-27T06:00:00-05:00') }
    const tramos = [
      { inicio: t('19:00'), fin: t('21:00') },
      { inicio: new Date('2026-09-27T05:30:00-05:00'), fin: new Date('2026-09-27T07:00:00-05:00') },
    ]
    expect(minutosUnicos(tramos, turno)).toBe(90)
  })
})
