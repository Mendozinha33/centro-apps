/* Mis vídeos: la biblioteca de imágenes (logos, fotos, patrocinadores...) para poner encima de los vídeos.
   Misma cuenta que el calendario. Las tablas se crean solas la primera vez.
   Los vídeos NO pasan por aquí: se preparan en el propio móvil u ordenador. */
import { bd, faltanAjustes, quienEsVivo } from '../lib/comun.js'

const MAX_BYTES = 3 * 1024 * 1024          // el servidor no admite envíos de más de ~4,5 MB
const TIPOS = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif' }

let tablasListas = false
async function prepararTablas(sql){
  if (tablasListas) return
  await sql`create table if not exists video_imagenes (
    id serial primary key, usuario_id text not null, nombre text not null, grupo text not null default '',
    tipo text not null, tamano integer not null, ancho integer not null default 0, alto integer not null default 0,
    datos bytea not null, creado timestamptz not null default now())`
  await sql`create index if not exists video_imagenes_usuario on video_imagenes (usuario_id, creado desc)`
  tablasListas = true
}

function limpiar(t, max, porDefecto){
  return String(t || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || porDefecto
}
function tipoValido(bytes, tipo){
  if (bytes.length < 12) return false
  if (tipo === 'image/png')  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
  if (tipo === 'image/jpeg') return bytes[0] === 0xFF && bytes[1] === 0xD8
  if (tipo === 'image/gif')  return bytes.subarray(0, 3).toString() === 'GIF'
  if (tipo === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  return false
}
async function leerCuerpo(req){
  let ya = null
  try { ya = req.body } catch (e) {}
  if (ya && (Buffer.isBuffer(ya) || ya instanceof Uint8Array)){
    if (ya.length > MAX_BYTES + 1024) throw Object.assign(new Error('grande'), { grande: true })
    return Buffer.from(ya)
  }
  const trozos = []; let total = 0
  for await (const t of req){
    total += t.length
    if (total > MAX_BYTES + 1024) throw Object.assign(new Error('grande'), { grande: true })
    trozos.push(t)
  }
  return Buffer.concat(trozos)
}

async function lista(sql, uid){
  const imagenes = await sql`
    select id, nombre, grupo, tipo, tamano, ancho, alto,
      to_char(creado at time zone 'Europe/Madrid','YYYY-MM-DD') as creado
    from video_imagenes where usuario_id = ${uid} order by creado desc, id desc`
  return { imagenes }
}

export default async function handler(req, res){
  if (faltanAjustes()) return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  const yo = await quienEsVivo(req)
  if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
  const uid = String(yo.id)
  const sql = bd()
  const q = req.query || {}

  try {
    await prepararTablas(sql)

    if (req.method === 'GET'){
      if (q.id){
        const filas = await sql`select tipo, encode(datos,'base64') as datos from video_imagenes
                                where id = ${Number(q.id)} and usuario_id = ${uid}`
        if (!filas.length) return res.status(404).json({ error: 'Esa imagen ya no está.' })
        res.setHeader('Content-Type', filas[0].tipo)
        res.setHeader('Cache-Control', 'private, max-age=604800')
        return res.status(200).send(Buffer.from(filas[0].datos, 'base64'))
      }
      return res.status(200).json(await lista(sql, uid))
    }

    /* subir una imagen (los bytes tal cual; tipo, nombre, grupo y medidas van en la dirección) */
    if (req.method === 'POST' && String(req.headers['content-type'] || '').startsWith('application/octet-stream')){
      const tipo = String(q.tipo || '')
      if (!TIPOS[tipo]) return res.status(400).json({ error: 'Solo se admiten imágenes PNG, JPG, WEBP o GIF.' })
      let bytes
      try { bytes = await leerCuerpo(req) }
      catch (e){
        if (e.grande) return res.status(413).json({ error: 'La imagen pesa más de 3 MB.' })
        throw e
      }
      if (bytes.length > MAX_BYTES) return res.status(413).json({ error: 'La imagen pesa más de 3 MB.' })
      if (!tipoValido(bytes, tipo)) return res.status(400).json({ error: 'Ese archivo no es una imagen válida.' })
      const nombre = limpiar(q.nombre, 120, 'Imagen')
      const grupo = limpiar(q.grupo, 40, '')
      const ancho = Math.max(0, Math.min(20000, Number(q.ancho) || 0))
      const alto = Math.max(0, Math.min(20000, Number(q.alto) || 0))
      const [nueva] = await sql`
        insert into video_imagenes (usuario_id, nombre, grupo, tipo, tamano, ancho, alto, datos)
        values (${uid}, ${nombre}, ${grupo}, ${tipo}, ${bytes.length}, ${ancho}, ${alto}, decode(${bytes.toString('base64')}, 'base64'))
        returning id`
      return res.status(200).json(Object.assign({ nueva: nueva.id }, await lista(sql, uid)))
    }

    /* cambiar el nombre o el grupo */
    if (req.method === 'POST'){
      const c = req.body || {}
      if (c.accion === 'cambiar'){
        const id = Number(c.id)
        await sql`update video_imagenes set nombre = ${limpiar(c.nombre, 120, 'Imagen')}, grupo = ${limpiar(c.grupo, 40, '')}
                  where id = ${id} and usuario_id = ${uid}`
        return res.status(200).json(await lista(sql, uid))
      }
      return res.status(400).json({ error: 'No sé qué hacer con eso.' })
    }

    if (req.method === 'DELETE'){
      const id = Number(q.id)
      if (!id) return res.status(400).json({ error: 'Falta la imagen a borrar.' })
      await sql`delete from video_imagenes where id = ${id} and usuario_id = ${uid}`
      return res.status(200).json(await lista(sql, uid))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('imagenes:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
