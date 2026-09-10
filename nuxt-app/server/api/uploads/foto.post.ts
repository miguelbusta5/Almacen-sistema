import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { put } from '@vercel/blob'
import { requireAuth } from '../../utils/auth'
import { getSafePhotoExtension } from '../../utils/fileSecurity'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// POST /api/uploads/foto — port de src/app/api/uploads/foto/route.ts.
//
// Las fotos van a Vercel Blob, que necesita BLOB_READ_WRITE_TOKEN en el proyecto
// de Vercel. Sin esa variable `put` lanzaba y el operario veia un "error de
// servidor" sin mas: en produccion nunca se llego a guardar ni una foto. Ahora
// se comprueba antes y el mensaje dice que falta y a quien avisar.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw createError({
      statusCode: 503,
      statusMessage: 'El almacenamiento de fotos no esta configurado. Avisa al administrador.',
    })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'foto')
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Sin archivo' })

  const ext = getSafePhotoExtension(file.type ?? '')
  if (!ext) throw createError({ statusCode: 400, statusMessage: 'Solo se aceptan imagenes JPG, PNG o WebP' })
  if (file.data.length > MAX_SIZE) throw createError({ statusCode: 400, statusMessage: 'Maximo 5 MB por foto' })

  const filename = `uploads/${Date.now()}-${actor.id.slice(-6)}.${ext}`
  try {
    const blob = await put(filename, file.data, { access: 'public' })
    return { success: true, url: blob.url }
  } catch (error) {
    // Un fallo de Blob (clave caducada, cuota agotada...) no puede llegar como
    // un 500 mudo: se registra entero y al operario se le dice algo accionable.
    console.error('[uploads/foto] fallo al subir a Vercel Blob', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'No se pudo guardar la foto. Intenta de nuevo o avisa al administrador.',
    })
  }
})
