import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), acceso: vi.fn(), multipart: vi.fn(), workbook: vi.fn(), rows: vi.fn(), tx: vi.fn(), cronograma: { findUnique: vi.fn(), create: vi.fn() }, versiones: { findFirst: vi.fn(), create: vi.fn() }, productos: { createMany: vi.fn() }, log: { create: vi.fn() }, lock: vi.fn() }))
vi.mock('../../nuxt-app/server/utils/auth', () => ({ requireAuth: mocks.auth }))
vi.mock('../../nuxt-app/server/utils/inventarios', () => ({ exigirInventarios: mocks.acceso }))
vi.mock('../../nuxt-app/server/utils/prisma', () => ({ prisma: { $transaction: mocks.tx } }))
vi.mock('../../nuxt-app/server/utils/excel', () => ({ readWorkbook: mocks.workbook, worksheetRows: mocks.rows }))
vi.mock('../../nuxt-app/node_modules/h3/dist/index.mjs', async () => {
  // Use the same h3 resolved by the handlers under nuxt-app.
  return { defineEventHandler: (f: unknown) => f, readMultipartFormData: mocks.multipart, createError: (data: object) => Object.assign(new Error(), data) }
})
import guardar from '../../nuxt-app/server/api/inventarios/guardar.post'
const event = {} as Parameters<typeof guardar>[0]
function parts(fields: Record<string, string>) {
  return [{ name: 'archivo', filename: 'maestro.xlsx', data: Buffer.from('excel') }, ...Object.entries(fields).map(([name, value]) => ({ name, data: Buffer.from(value) }))]
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ id: 'carlos', name: 'Carlos Moreno', role: 'GERENTE' })
  mocks.workbook.mockResolvedValue({ worksheets: [{}] })
  mocks.rows.mockReturnValue([['Referencia Original', 'Nombre para mostrar', 'Fabricante', 'Código UPC', 'Precio unitario', 'MARCAS', 'GRUPO'], ['1', 'Plato', 'Proveedor', '0001', 25, 'Gourmet', 'Mesa']])
  mocks.tx.mockImplementation(callback => callback({ $executeRaw: mocks.lock, inventarioCronograma: mocks.cronograma, inventarioMaestroVersion: mocks.versiones, inventarioProductoPvp: mocks.productos, activityLog: mocks.log }))
  mocks.cronograma.findUnique.mockResolvedValue({ id: 'cronograma', estado: 'ABIERTO' })
  mocks.versiones.findFirst.mockResolvedValue({ numero: 1, hash: 'anterior' })
  mocks.versiones.create.mockResolvedValue({ id: 'version2', numero: 2, total: 1, archivo: 'maestro.xlsx' })
})
describe('API de cronogramas y maestro PVP', () => {
  it('exige permiso antes de leer el archivo', async () => {
    mocks.acceso.mockRejectedValue(Object.assign(new Error(), { statusCode: 403 }))
    await expect(guardar(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.multipart).not.toHaveBeenCalled()
  })
  it('revisa sin escribir datos', async () => {
    mocks.multipart.mockResolvedValue(parts({ accion: 'revisar' }))
    await expect(guardar(event)).resolves.toMatchObject({ resumen: { total: 1 } })
    expect(mocks.tx).not.toHaveBeenCalled()
  })
  it('rechaza cambios simultáneos sin insertar otra versión', async () => {
    mocks.multipart.mockResolvedValue(parts({ accion: 'guardar', cronogramaId: 'cronograma', version: '0' }))
    await expect(guardar(event)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.lock).toHaveBeenCalledOnce()
    expect(mocks.versiones.create).not.toHaveBeenCalled()
  })
  it('guarda una nueva versión y su auditoría en la misma transacción', async () => {
    mocks.multipart.mockResolvedValue(parts({ accion: 'guardar', cronogramaId: 'cronograma', version: '1' }))
    await expect(guardar(event)).resolves.toMatchObject({ id: 'cronograma', version: 2 })
    expect(mocks.versiones.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ numero: 2, autorId: 'carlos' }) }))
    expect(mocks.productos.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ versionId: 'version2', plu: '1', upc: '0001' })] })
    expect(mocks.log.create).toHaveBeenCalledOnce()
  })
  it('no modifica cronogramas cerrados', async () => {
    mocks.cronograma.findUnique.mockResolvedValue({ id: 'cronograma', estado: 'CERRADO' })
    mocks.multipart.mockResolvedValue(parts({ accion: 'guardar', cronogramaId: 'cronograma', version: '1' }))
    await expect(guardar(event)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.versiones.create).not.toHaveBeenCalled()
  })
  it('no crea cronogramas si la fecha o duración no son válidas', async () => {
    mocks.multipart.mockResolvedValue(parts({ accion: 'guardar', solicitudId: '11111111-1111-4111-8111-111111111111', nombre: 'Septiembre', inicio: '2026-02-30', dias: '2' }))
    await expect(guardar(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.tx).not.toHaveBeenCalled()
  })
})
