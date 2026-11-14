/* Mis torneos: torneos de fútbol con equipos, escudos, grupos, normas de clasificación y resultados.
   Misma cuenta que el calendario. La tabla se crea sola la primera vez.
   Cada torneo se guarda entero (equipos, grupos, normas y partidos) en un solo registro;
   las clasificaciones no se guardan: se calculan en pantalla a partir de los resultados.
   Los documentos de cada torneo (normas de la competición en Word o PDF, y el PDF del diseño)
   van aparte, en «torneo_archivos», para que el torneo no pese al guardarse a cada cambio. */
import { bd, faltanAjustes, quienEsVivo } from '../lib/comun.js'

const MAX_BYTES = 3 * 1024 * 1024   // el servidor no admite envíos de más de ~4,5 MB
const MAX_ARCHIVO = 4 * 1024 * 1024
const TIPOS_DOC = { normas: 1, diseno: 1 }

let tablasListas = false
async function prepararTablas(sql){
  if (tablasListas) return
  await sql`create table if not exists torneos (
    id serial primary key, usuario_id text not null, nombre text not null,
    datos jsonb not null default '{}'::jsonb,
    creado timestamptz not null default now(), actualizado timestamptz not null default now())`
  await sql`create index if not exists torneos_usuario on torneos (usuario_id, actualizado desc)`
  await sql`create table if not exists torneo_archivos (
    id serial primary key, usuario_id text not null, torneo_id integer not null, tipo text not null,
    nombre text not null, mime text not null, tamano integer not null, datos bytea not null,
    creado timestamptz not null default now())`
  await sql`create index if not exists torneo_archivos_torneo on torneo_archivos (usuario_id, torneo_id, tipo)`
  tablasListas = true
}

function limpiarNombre(t){
  return String(t || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

/* qué es el fichero mirando sus primeros bytes (no nos fiamos del nombre) */
function reconocer(b){
  if (b.length < 8) return null
  if (b.subarray(0, 5).toString() === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }
  if (b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04)
    return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' }
  if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return { mime: 'application/msword', ext: 'doc' }
  return null
}
async function leerCuerpo(req){
  let ya = null
  try { ya = req.body } catch (e) {}
  if (ya && (Buffer.isBuffer(ya) || ya instanceof Uint8Array)){
    if (ya.length > MAX_ARCHIVO + 1024) throw Object.assign(new Error('grande'), { grande: true })
    return Buffer.from(ya)
  }
  const trozos = []; let total = 0
  for await (const t of req){
    total += t.length
    if (total > MAX_ARCHIVO + 1024) throw Object.assign(new Error('grande'), { grande: true })
    trozos.push(t)
  }
  return Buffer.concat(trozos)
}
async function listaArchivos(sql, uid, torneoId){
  const archivos = await sql`select id, tipo, nombre, mime, tamano,
      to_char(creado at time zone 'Europe/Madrid','YYYY-MM-DD') as creado
    from torneo_archivos where usuario_id = ${uid} and torneo_id = ${torneoId} order by creado desc, id desc`
  return { archivos }
}

async function lista(sql, uid){
  const torneos = await sql`
    select id, nombre,
      coalesce(jsonb_array_length(datos->'equipos'), 0) as equipos,
      coalesce(jsonb_array_length(datos->'grupos'), 0) as grupos,
      coalesce(jsonb_array_length(datos->'partidos'), 0) as partidos,
      coalesce(datos->'diseno'->>'color', '') as color,
      to_char(actualizado at time zone 'Europe/Madrid','YYYY-MM-DD') as actualizado
    from torneos where usuario_id = ${uid} order by actualizado desc, id desc`
  return { torneos }
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
      if (q.archivo){
        const filas = await sql`select nombre, mime, encode(datos,'base64') as datos from torneo_archivos
                                where id = ${Number(q.archivo)} and usuario_id = ${uid}`
        if (!filas.length) return res.status(404).json({ error: 'Ese documento ya no está.' })
        res.setHeader('Content-Type', filas[0].mime)
        res.setHeader('Content-Disposition', "inline; filename*=UTF-8''" + encodeURIComponent(filas[0].nombre))
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).send(Buffer.from(filas[0].datos, 'base64'))
      }
      if (q.archivos) return res.status(200).json(await listaArchivos(sql, uid, Number(q.archivos)))
      if (q.id){
        const filas = await sql`select id, nombre, datos from torneos where id = ${Number(q.id)} and usuario_id = ${uid}`
        if (!filas.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
        return res.status(200).json({ torneo: filas[0] })
      }
      return res.status(200).json(await lista(sql, uid))
    }

    /* subir un documento (los bytes tal cual; torneo, tipo y nombre van en la dirección) */
    if (req.method === 'POST' && String(req.headers['content-type'] || '').startsWith('application/octet-stream')){
      const torneoId = Number(q.torneo), tipo = String(q.tipo || '')
      if (!torneoId || !TIPOS_DOC[tipo]) return res.status(400).json({ error: 'Falta el torneo o el apartado.' })
      const t = await sql`select 1 from torneos where id = ${torneoId} and usuario_id = ${uid}`
      if (!t.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
      let bytes
      try { bytes = await leerCuerpo(req) }
      catch (e){ if (e.grande) return res.status(413).json({ error: 'El documento pasa de 4 MB. Prueba a guardarlo más pequeño.' }); throw e }
      const clase = reconocer(bytes)
      if (!clase) return res.status(400).json({ error: 'Solo se admiten documentos PDF o Word.' })
      if (tipo === 'diseno' && clase.ext !== 'pdf') return res.status(400).json({ error: 'El diseño tiene que ser un PDF.' })
      let nombre = limpiarNombre(q.nombre) || ('documento.' + clase.ext)
      if (!new RegExp('\\.' + clase.ext + '$', 'i').test(nombre)) nombre = nombre.replace(/\.[a-z0-9]{1,5}$/i, '') + '.' + clase.ext
      await sql`insert into torneo_archivos (usuario_id, torneo_id, tipo, nombre, mime, tamano, datos)
                values (${uid}, ${torneoId}, ${tipo}, ${nombre}, ${clase.mime}, ${bytes.length}, ${bytes})`
      return res.status(200).json(await listaArchivos(sql, uid, torneoId))
    }

    if (req.method === 'POST'){
      const c = req.body || {}

      if (c.accion === 'crear'){
        const nombre = limpiarNombre(c.nombre)
        if (!nombre) return res.status(400).json({ error: 'Ponle un nombre al torneo.' })
        const datos = (c.datos && typeof c.datos === 'object') ? c.datos : {}
        const texto = JSON.stringify(datos)
        if (Buffer.byteLength(texto) > MAX_BYTES) return res.status(400).json({ error: 'El torneo ocupa demasiado.' })
        const filas = await sql`insert into torneos (usuario_id, nombre, datos)
                                values (${uid}, ${nombre}, ${texto}::jsonb) returning id`
        return res.status(200).json({ id: filas[0].id, ...(await lista(sql, uid)) })
      }

      if (c.accion === 'guardar'){
        const id = Number(c.id)
        const nombre = limpiarNombre(c.nombre)
        if (!id || !nombre) return res.status(400).json({ error: 'Falta el torneo o su nombre.' })
        if (!c.datos || typeof c.datos !== 'object' || Array.isArray(c.datos)){
          return res.status(400).json({ error: 'Los datos del torneo no son válidos.' })
        }
        const texto = JSON.stringify(c.datos)
        if (Buffer.byteLength(texto) > MAX_BYTES){
          return res.status(400).json({ error: 'El torneo ocupa demasiado. Prueba con escudos más pequeños.' })
        }
        const filas = await sql`update torneos set nombre = ${nombre}, datos = ${texto}::jsonb, actualizado = now()
                                where id = ${id} and usuario_id = ${uid} returning id`
        if (!filas.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
        return res.status(200).json({ ok: true })
      }

      return res.status(400).json({ error: 'No sé qué hacer con eso.' })
    }

    if (req.method === 'DELETE' && q.archivo){
      const filas = await sql`delete from torneo_archivos where id = ${Number(q.archivo)} and usuario_id = ${uid} returning torneo_id`
      if (!filas.length) return res.status(404).json({ error: 'Ese documento ya no está.' })
      return res.status(200).json(await listaArchivos(sql, uid, filas[0].torneo_id))
    }

    if (req.method === 'DELETE'){
      const id = Number(q.id)
      if (!id) return res.status(400).json({ error: 'Falta el torneo a borrar.' })
      await sql`delete from torneos where id = ${id} and usuario_id = ${uid}`
      await sql`delete from torneo_archivos where torneo_id = ${id} and usuario_id = ${uid}`
      return res.status(200).json(await lista(sql, uid))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('torneos:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
