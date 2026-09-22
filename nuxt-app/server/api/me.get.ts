import { defineEventHandler } from 'h3'
import { getSessionUser } from '../utils/auth'
import { can } from '../utils/permissions'
import { prisma } from '../utils/prisma'
import { accesoPicking } from '../utils/picking'
import { accesoInventarios, permisosInventarios } from '../utils/inventarios'
import { permisoStretch } from '../utils/stretch'

// Devuelve la sesión actual (o authenticated:false). La UI usa el rol para
// ocultar acciones; el servidor siempre revalida con requireCan.
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) return { authenticated: false }

  // Se lee de la base y no del token: un ADMIN concede o quita este permiso
  // desde Usuarios, y sacarlo del JWT lo dejaria obsoleto hasta el proximo login.
  const extra = await prisma.user
    .findUnique({
      where: { id: user.id },
      select: { puedeResolverNovedades: true, puedeMontarResurtido: true },
    })
    .catch(() => null)

  return {
    authenticated: true,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      can: {
        create: can(user.role, 'create'),
        edit: can(user.role, 'edit'),
        delete: can(user.role, 'delete'),
        // El administrador tiene siempre los permisos por persona.
        resolverNovedades: user.role === 'ADMIN' || (extra?.puedeResolverNovedades ?? false),
        // Montar un resurtido y asignar pendientes: permiso por persona, igual
        // que el de cerrar novedades.
        montarResurtido: user.role === 'ADMIN' || (extra?.puedeMontarResurtido ?? false),
        capacidadPicking: await accesoPicking(user.id).catch(() => false),
        gestionarInventarios: await accesoInventarios(user.id).catch(() => false),
        contarInventarios: (await permisosInventarios(user.id).catch(() => ({ contar: false }))).contar,
        stretch: await permisoStretch(user.id).catch(() => ({ gestionar: false, solicitar: false })),
      },
    },
  }
})
