/* Mis Excel: una nube personal para guardar, ordenar en carpetas y modificar ficheros de Excel.
   Misma cuenta que el calendario. Las tablas se crean solas la primera vez.
   Cada vez que un fichero cambia se guarda como versión nueva y se conservan las anteriores
   (hasta MAX_VERSIONES), para poder volver atrás si un cambio sale mal. */
import { bd, faltanAjustes, quienEs } from '../lib/comun.js'

const MAX_BYTES = 4 * 1024 * 1024      // el servidor no admite envíos de más de ~4,5 MB
const MAX_VERSIONES = 10               // la actual y las 9 anteriores
const TIPOS = ['xlsx', 'xlsm', 'xls', 'csv']

let tablasListas = false
async function prepararTablas(sql){
  if (tablasListas) return
  await sql`create table if not exists excel_carpetas (
    id serial primary key, usuario_id text not null, nombre text not null,
    creado timestamptz not null default now(), unique (usuario_id, nombre))`
  await sql`create table if not exists excel_ficheros (
    id serial primary key, usuario_id text not null,
    carpeta_id integer references excel_carpetas(id) on delete set null,
    nombre text not null, tipo text not null, tamano integer not null,
    creado timestamptz not null default now(), actualizado timestamptz not null default now())`
  await sql`create index if not exists excel_ficheros_usuario on excel_ficheros (usuario_id, actualizado desc)`
  await sql`create table if not exists excel_versiones (
    id serial primary key, fichero_id integer not null references excel_ficheros(id) on delete cascade,
    usuario_id text not null, tamano integer not null, datos bytea not null,
    motivo text not null default '', creado timestamptz not null default now())`
  await sql`create index if not exists excel_versiones_fichero on excel_versiones (fichero_id, id desc)`
  tablasListas = true
}

function limpiarNombre(n, porDefecto){
  return String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || porDefecto
}
function tipoDe(nombre){
  const m = /\.([a-z0-9]+)$/i.exec(nombre)
  return m ? m[1].toLowerCase() : ''
}
function contenidoValido(bytes, tipo){
  if (bytes.length < 4) return false
  if (tipo === 'xlsx' || tipo === 'xlsm') return bytes[0] === 0x50 && bytes[1] === 0x4B   // PK (zip)
  if (tipo === 'xls') return bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0
  if (tipo === 'csv') return !bytes.subarray(0, 4096).includes(0)
  return false
}
async function leerCuerpo(req){
  // el servidor suele entregar ya el fichero entero en req.body; si no, se lee poco a poco
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

async function todo(sql, uid){
  const [carpetas, ficheros, [espacio]] = await Promise.all([
    sql`select id, nombre from excel_carpetas where usuario_id = ${uid} order by lower(nombre)`,
    sql`select f.id, f.nombre, f.tipo, f.tamano, f.carpeta_id,
          to_char(f.actualizado at time zone 'Europe/Madrid','YYYY-MM-DD"T"HH24:MI') as actualizado,
          (select count(*)::int from excel_versiones v where v.fichero_id = f.id) as versiones,
          (select max(v.id) from excel_versiones v where v.fichero_id = f.id) as version
        from excel_ficheros f where f.usuario_id = ${uid} order by f.actualizado desc`,
    sql`select coalesce(sum(tamano),0)::bigint as bytes from excel_versiones where usuario_id = ${uid}`
  ])
  return { carpetas, ficheros, espacio: Number(espacio.bytes) }
}

async function carpetaMia(sql, uid, id){
  if (id === null) return true
  const f = await sql`select 1 from excel_carpetas where id = ${id} and usuario_id = ${uid}`
  return f.length > 0
}
function idCarpeta(v){
  if (v === '' || v === null || v === undefined || v === 'null') return null
  const n = Number(v); return Number.isInteger(n) && n > 0 ? n : NaN
}

/* guarda una versión nueva y quita las que sobran */
async function nuevaVersion(sql, uid, ficheroId, bytes, motivo){
  const [v] = await sql`
    insert into excel_versiones (fichero_id, usuario_id, tamano, datos, motivo)
    values (${ficheroId}, ${uid}, ${bytes.length}, decode(${bytes.toString('base64')}, 'base64'), ${motivo})
    returning id`
  await sql`update excel_ficheros set tamano = ${bytes.length}, actualizado = now() where id = ${ficheroId}`
  await sql`delete from excel_versiones where fichero_id = ${ficheroId}
            and id not in (select id from excel_versiones where fichero_id = ${ficheroId} order by id desc limit ${MAX_VERSIONES})`
  return v.id
}

export default async function handler(req, res){
  if (faltanAjustes()) return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  const yo = quienEs(req)
  if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
  const uid = String(yo.id)
  const sql = bd()
  const q = req.query || {}

  try {
    await prepararTablas(sql)

    /* ------------------------------ consultar ------------------------------ */
    if (req.method === 'GET'){
      if (q.que === 'fichero'){
        const id = Number(q.id), version = q.version ? Number(q.version) : null
        const filas = version
          ? await sql`select f.nombre, encode(v.datos,'base64') as datos from excel_ficheros f
                      join excel_versiones v on v.fichero_id = f.id
                      where f.id = ${id} and f.usuario_id = ${uid} and v.id = ${version}`
          : await sql`select f.nombre, encode(v.datos,'base64') as datos from excel_ficheros f
                      join excel_versiones v on v.fichero_id = f.id
                      where f.id = ${id} and f.usuario_id = ${uid} order by v.id desc limit 1`
        if (!filas.length) return res.status(404).json({ error: 'Ese fichero ya no está.' })
        const nombre = filas[0].nombre
        const ascii = nombre.replace(/[^\w.\- ]/g, '_')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(nombre))
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).send(Buffer.from(filas[0].datos, 'base64'))
      }
      if (q.que === 'versiones'){
        const id = Number(q.id)
        const versiones = await sql`
          select v.id, v.tamano, v.motivo,
            to_char(v.creado at time zone 'Europe/Madrid','YYYY-MM-DD"T"HH24:MI') as creado
          from excel_versiones v join excel_ficheros f on f.id = v.fichero_id
          where f.id = ${id} and f.usuario_id = ${uid} order by v.id desc`
        return res.status(200).json({ versiones })
      }
      return res.status(200).json(await todo(sql, uid))
    }

    /* ------------------------------ subir o guardar un fichero (bytes tal cual) ------------------------------ */
    if (req.method === 'POST' && String(req.headers['content-type'] || '').startsWith('application/octet-stream')){
      let bytes
      try { bytes = await leerCuerpo(req) }
      catch (e){
        if (e.grande) return res.status(413).json({ error: 'El fichero pesa más de 4 MB.' })
        throw e
      }
      if (bytes.length > MAX_BYTES) return res.status(413).json({ error: 'El fichero pesa más de 4 MB.' })
      const ficheroId = q.fichero ? Number(q.fichero) : null

      /* versión nueva de un fichero que ya existe */
      if (ficheroId){
        const [f] = await sql`select id, tipo from excel_ficheros where id = ${ficheroId} and usuario_id = ${uid}`
        if (!f) return res.status(404).json({ error: 'Ese fichero ya no está.' })
        if (!contenidoValido(bytes, f.tipo)) return res.status(400).json({ error: 'Ese archivo no es un Excel del mismo tipo (.' + f.tipo + ').' })
        if (q.base){
          const [ult] = await sql`select max(id) as id from excel_versiones where fichero_id = ${ficheroId}`
          if (Number(ult.id) !== Number(q.base)){
            return res.status(409).json({ error: 'Este fichero ha cambiado desde que lo abriste (quizá desde otro dispositivo). Ciérralo y vuelve a abrirlo antes de guardar.' })
          }
        }
        const motivo = q.motivo === 'app' ? 'Modificado en la app' : 'Versión nueva subida'
        const version = await nuevaVersion(sql, uid, ficheroId, bytes, motivo)
        return res.status(200).json({ fichero: ficheroId, version, ...(await todo(sql, uid)) })
      }

      /* fichero nuevo */
      const nombre = limpiarNombre(q.nombre, '')
      const tipo = tipoDe(nombre)
      if (!nombre || !TIPOS.includes(tipo)) return res.status(400).json({ error: 'Solo se pueden guardar ficheros .xlsx, .xlsm, .xls o .csv.' })
      if (!contenidoValido(bytes, tipo)) return res.status(400).json({ error: 'El archivo «' + nombre + '» no parece un Excel de verdad.' })
      const carpeta = idCarpeta(q.carpeta)
      if (Number.isNaN(carpeta) || !(await carpetaMia(sql, uid, carpeta))) return res.status(400).json({ error: 'Esa carpeta ya no existe.' })
      const [f] = await sql`
        insert into excel_ficheros (usuario_id, carpeta_id, nombre, tipo, tamano)
        values (${uid}, ${carpeta}, ${nombre}, ${tipo}, ${bytes.length}) returning id`
      const version = await nuevaVersion(sql, uid, f.id, bytes, q.motivo === 'nuevo' ? 'Creado en la app' : q.motivo === 'pdf' ? 'Convertido desde un PDF' : 'Subido')
      return res.status(200).json({ fichero: f.id, version, ...(await todo(sql, uid)) })
    }

    /* ------------------------------ carpetas, nombres, mover y recuperar ------------------------------ */
    if (req.method === 'POST'){
      const c = req.body || {}

      if (c.accion === 'carpeta_nueva' || c.accion === 'carpeta_renombrar'){
        const nombre = limpiarNombre(c.nombre, '').slice(0, 60)
        if (!nombre) return res.status(400).json({ error: 'Ponle un nombre a la carpeta.' })
        const repe = await sql`select id from excel_carpetas where usuario_id = ${uid} and lower(nombre) = lower(${nombre})`
        if (repe.length && Number(repe[0].id) !== Number(c.id)) return res.status(400).json({ error: 'Ya tienes una carpeta con ese nombre.' })
        if (c.accion === 'carpeta_nueva'){
          const [n] = await sql`insert into excel_carpetas (usuario_id, nombre) values (${uid}, ${nombre}) returning id`
          return res.status(200).json({ carpeta: n.id, ...(await todo(sql, uid)) })
        }
        await sql`update excel_carpetas set nombre = ${nombre} where id = ${Number(c.id)} and usuario_id = ${uid}`
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'renombrar'){
        const [f] = await sql`select tipo from excel_ficheros where id = ${Number(c.id)} and usuario_id = ${uid}`
        if (!f) return res.status(404).json({ error: 'Ese fichero ya no está.' })
        let nombre = limpiarNombre(c.nombre, '')
        if (!nombre) return res.status(400).json({ error: 'Ponle un nombre al fichero.' })
        if (tipoDe(nombre) !== f.tipo) nombre = nombre.replace(/\.[a-z0-9]{2,4}$/i, '') + '.' + f.tipo
        await sql`update excel_ficheros set nombre = ${nombre} where id = ${Number(c.id)} and usuario_id = ${uid}`
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'mover'){
        const carpeta = idCarpeta(c.carpeta)
        if (Number.isNaN(carpeta) || !(await carpetaMia(sql, uid, carpeta))) return res.status(400).json({ error: 'Esa carpeta ya no existe.' })
        await sql`update excel_ficheros set carpeta_id = ${carpeta} where id = ${Number(c.id)} and usuario_id = ${uid}`
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'recuperar'){
        const [v] = await sql`
          select encode(v.datos,'base64') as datos, to_char(v.creado at time zone 'Europe/Madrid','DD/MM/YYYY HH24:MI') as cuando
          from excel_versiones v join excel_ficheros f on f.id = v.fichero_id
          where v.id = ${Number(c.version)} and f.id = ${Number(c.id)} and f.usuario_id = ${uid}`
        if (!v) return res.status(404).json({ error: 'Esa versión ya no está guardada.' })
        await nuevaVersion(sql, uid, Number(c.id), Buffer.from(v.datos, 'base64'), 'Recuperada la versión del ' + v.cuando)
        return res.status(200).json(await todo(sql, uid))
      }

      return res.status(400).json({ error: 'No sé qué hacer con eso.' })
    }

    /* ------------------------------ borrar ------------------------------ */
    if (req.method === 'DELETE'){
      const id = Number(q.id)
      if (!id) return res.status(400).json({ error: 'Falta qué borrar.' })
      if (q.que === 'carpeta'){
        // los ficheros de dentro no se borran: pasan a «Sin carpeta»
        await sql`update excel_ficheros set carpeta_id = null where carpeta_id = ${id} and usuario_id = ${uid}`
        await sql`delete from excel_carpetas where id = ${id} and usuario_id = ${uid}`
        return res.status(200).json(await todo(sql, uid))
      }
      await sql`delete from excel_ficheros where id = ${id} and usuario_id = ${uid}`
      return res.status(200).json(await todo(sql, uid))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('excel:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
