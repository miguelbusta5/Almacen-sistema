import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { assertUsuarioRecepcion, listarDescargadores } from '../../utils/recepcion'

// GET /api/recepcion-contenedores/descargadores - quienes pueden aparecer como
// personas descargando: montacarguistas y operarios de almacenamiento.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const usuarios = await listarDescargadores()
  return {
    success: true,
    data: usuarios.map((u) => ({ id: u.id, nombre: u.name, rol: u.role })),
  }
})
