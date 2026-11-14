/* Mis torneos: torneos de fútbol con equipos, escudos, grupos, normas de clasificación y resultados.
   Misma cuenta que el calendario. La tabla se crea sola la primera vez.
   Cada torneo se guarda entero (equipos, grupos, normas y partidos) en un solo registro;
   las clasificaciones no se guardan: se calculan en pantalla a partir de los resultados. */
import { bd, faltanAjustes, quienEsVivo } from '../lib/comun.js'

const MAX_BYTES = 3 * 1024 * 1024   // el servidor no admite envíos de más de ~4,5 MB

let tablasListas = false
async function prepararTablas(sql){
  if (tablasListas) return
  await sql`create table if not exists torneos (
    id serial primary key, usuario_id text not null, nombre text not null,
    datos jsonb not null default '{}'::jsonb,
    creado timestamptz not null default now(), actualizado timestamptz not null default now())`
  await sql`create index if not exists torneos_usuario on torneos (usuario_id, actualizado desc)`
  tablasListas = true
}

function limpiarNombre(t){
  return String(t || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

async function lista(sql, uid){
  const torneos = await sql`
    select id, nombre,
      coalesce(jsonb_array_length(datos->'equipos'), 0) as equipos,
      coalesce(jsonb_array_length(datos->'grupos'), 0) as grupos,
      coalesce(jsonb_array_length(datos->'partidos'), 0) as partidos,
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
      if (q.id){
        const filas = await sql`select id, nombre, datos from torneos where id = ${Number(q.id)} and usuario_id = ${uid}`
        if (!filas.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
        return res.status(200).json({ torneo: filas[0] })
      }
      return res.status(200).json(await lista(sql, uid))
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

    if (req.method === 'DELETE'){
      const id = Number(q.id)
      if (!id) return res.status(400).json({ error: 'Falta el torneo a borrar.' })
      await sql`delete from torneos where id = ${id} and usuario_id = ${uid}`
      return res.status(200).json(await lista(sql, uid))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('torneos:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
