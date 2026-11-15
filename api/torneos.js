/* Mis torneos: torneos de fútbol con equipos, escudos, grupos, normas de clasificación y resultados.
   Misma cuenta que el calendario. La tabla se crea sola la primera vez.
   Cada torneo se guarda entero (equipos, grupos, normas y partidos) en un solo registro;
   las clasificaciones no se guardan: se calculan en pantalla a partir de los resultados.
   Los documentos de cada torneo (normas de la competición en Word o PDF, y el PDF del diseño)
   van aparte, en «torneo_archivos», para que el torneo no pese al guardarse a cada cambio. */
import { bd, faltanAjustes, quienEs, quienEsVivo, cifrarClave, claveCorrecta, crearPaseInvitado } from '../lib/comun.js'

/* Invitados: personas que el titular da de alta solo para esta app, con permisos por apartado:
   'no' (no lo ven), 'ver' (solo mirar) o 'editar' (ver y cambiar), y los torneos que pueden ver. */
const PESTANAS = ['clasificacion','partidos','final','equipos','grupos','normas','reglamento','diseno']
const DATOS_DE = { partidos: ['partidos','manual'], final: ['faseFinal','eliminatoria'], equipos: ['equipos'],
                   grupos: ['grupos'], normas: ['reglas'], diseno: ['diseno','proyeccion'] }
const PESTANA_DOC = { normas: 'reglamento', diseno: 'diseno' }
const NIVEL = { no: 0, ver: 1, editar: 2 }

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
  await sql`create table if not exists torneo_invitados (
    id serial primary key, titular text not null, nombre text not null, correo text not null unique,
    clave text not null, permisos jsonb not null default '{}'::jsonb, torneos jsonb not null default '"todos"'::jsonb,
    creado timestamptz not null default now())`
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
async function listaArchivos(sql, uid, torneoId, quien){
  const todos = await sql`select id, tipo, nombre, mime, tamano,
      to_char(creado at time zone 'Europe/Madrid','YYYY-MM-DD') as creado
    from torneo_archivos where usuario_id = ${uid} and torneo_id = ${torneoId} order by creado desc, id desc`
  const archivos = quien ? todos.filter(function(a){ return puede(quien, PESTANA_DOC[a.tipo], 'ver') }) : todos
  return { archivos }
}

function limpiarPermisos(p){
  const res = {}
  PESTANAS.forEach(function(k){ const v = p && p[k]; res[k] = NIVEL[v] !== undefined ? v : 'no' })
  return res
}
function limpiarTorneos(t){
  if (t === 'todos') return 'todos'
  return Array.isArray(t) ? Array.from(new Set(t.map(Number).filter(function(n){ return n > 0 }))) : []
}
function puede(quien, pestana, nivel){
  if (!quien.invitado) return true
  return (NIVEL[quien.invitado.permisos[pestana]] || 0) >= NIVEL[nivel]
}
function veTorneo(quien, id){
  if (!quien.invitado) return true
  const t = quien.invitado.torneos
  return t === 'todos' || (Array.isArray(t) && t.indexOf(Number(id)) >= 0)
}
function puedeEditarAlgo(quien){
  return !quien.invitado || Object.keys(DATOS_DE).some(function(k){ return puede(quien, k, 'editar') })
}
/* quién llama: el titular, un usuario completo de Apps Mendoza o un invitado de torneos */
async function quienLlama(req, sql){
  const yo = quienEs(req)
  if (!yo) return null
  if (yo.invitado){
    const id = Number(String(yo.persona || '').replace(/^inv/, ''))
    if (!id) return null
    const f = await sql`select id, nombre, correo, permisos, torneos from torneo_invitados where id = ${id} and titular = ${String(yo.id)}`
    if (!f.length) return null
    return { uid: String(yo.id), rol: 'invitado', nombre: f[0].nombre,
             invitado: { id: f[0].id, permisos: limpiarPermisos(f[0].permisos), torneos: limpiarTorneos(f[0].torneos) } }
  }
  const vivo = await quienEsVivo(req)
  if (!vivo) return null
  return { uid: String(vivo.id), rol: vivo.titular === false ? 'usuario' : 'titular', nombre: vivo.nombre, invitado: null }
}
async function listaInvitados(sql, uid){
  const invitados = await sql`select id, nombre, correo, permisos, torneos,
      to_char(creado at time zone 'Europe/Madrid','DD/MM/YYYY') as alta
    from torneo_invitados where titular = ${uid} order by lower(nombre)`
  return { invitados: invitados.map(function(i){ return Object.assign(i, { permisos: limpiarPermisos(i.permisos), torneos: limpiarTorneos(i.torneos) }) }) }
}

async function lista(sql, uid, quien){
  const torneos = await sql`
    select id, nombre,
      coalesce(jsonb_array_length(datos->'equipos'), 0) as equipos,
      coalesce(jsonb_array_length(datos->'grupos'), 0) as grupos,
      coalesce(jsonb_array_length(datos->'partidos'), 0) as partidos,
      coalesce(datos->'diseno'->>'color', '') as color,
      to_char(actualizado at time zone 'Europe/Madrid','YYYY-MM-DD') as actualizado
    from torneos where usuario_id = ${uid} order by actualizado desc, id desc`
  const visibles = quien ? torneos.filter(function(t){ return veTorneo(quien, t.id) }) : torneos
  return { torneos: visibles, yo: quien ? { rol: quien.rol, nombre: quien.nombre, permisos: quien.invitado ? quien.invitado.permisos : null } : undefined }
}

export default async function handler(req, res){
  if (faltanAjustes()) return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  const sql = bd()
  const q = req.query || {}

  try {
    await prepararTablas(sql)

    /* entrada de un invitado (no lleva pase todavía) */
    if (req.method === 'POST' && (req.body || {}).accion === 'entrar'){
      const correo = String(req.body.correo || '').trim().toLowerCase(), clave = String(req.body.clave || '')
      const f = await sql`select id, titular, nombre, correo, clave from torneo_invitados where correo = ${correo}`
      if (!f.length || !claveCorrecta(clave, f[0].clave)) return res.status(401).json({ error: 'El correo o la contraseña no son correctos.' })
      return res.status(200).json({ pase: crearPaseInvitado(f[0]), usuario: { nombre: f[0].nombre, correo: f[0].correo } })
    }

    const quien = await quienLlama(req, sql)
    if (!quien) return res.status(401).json({ error: 'Vuelve a entrar.' })
    const uid = quien.uid
    const inv = quien.invitado
    const prohibido = function(){ return res.status(403).json({ error: 'No tienes permiso para esto. Pídeselo al administrador.' }) }

    if (req.method === 'GET'){
      if (q.archivo){
        const filas = await sql`select nombre, mime, tipo, torneo_id, encode(datos,'base64') as datos from torneo_archivos
                                where id = ${Number(q.archivo)} and usuario_id = ${uid}`
        if (!filas.length) return res.status(404).json({ error: 'Ese documento ya no está.' })
        if (!veTorneo(quien, filas[0].torneo_id) || !puede(quien, PESTANA_DOC[filas[0].tipo], 'ver')) return prohibido()
        res.setHeader('Content-Type', filas[0].mime)
        res.setHeader('Content-Disposition', "inline; filename*=UTF-8''" + encodeURIComponent(filas[0].nombre))
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).send(Buffer.from(filas[0].datos, 'base64'))
      }
      if (q.archivos){
        if (!veTorneo(quien, q.archivos)) return prohibido()
        return res.status(200).json(await listaArchivos(sql, uid, Number(q.archivos), quien))
      }
      if (q.id){
        if (!veTorneo(quien, q.id)) return res.status(404).json({ error: 'Ese torneo ya no está.' })
        const filas = await sql`select id, nombre, datos from torneos where id = ${Number(q.id)} and usuario_id = ${uid}`
        if (!filas.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
        if (inv && !puede(quien, 'final', 'ver')){ delete filas[0].datos.faseFinal; delete filas[0].datos.eliminatoria }
        return res.status(200).json({ torneo: filas[0] })
      }
      if (q.invitados){
        if (quien.rol !== 'titular') return prohibido()
        return res.status(200).json(await listaInvitados(sql, uid))
      }
      return res.status(200).json(await lista(sql, uid, quien))
    }

    /* subir un documento (los bytes tal cual; torneo, tipo y nombre van en la dirección) */
    if (req.method === 'POST' && String(req.headers['content-type'] || '').startsWith('application/octet-stream')){
      const torneoId = Number(q.torneo), tipo = String(q.tipo || '')
      if (!torneoId || !TIPOS_DOC[tipo]) return res.status(400).json({ error: 'Falta el torneo o el apartado.' })
      if (!veTorneo(quien, torneoId) || !puede(quien, PESTANA_DOC[tipo], 'editar')) return prohibido()
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
      return res.status(200).json(await listaArchivos(sql, uid, torneoId, quien))
    }

    if (req.method === 'POST'){
      const c = req.body || {}

      /* invitados: solo el titular los da de alta, les cambia permisos y contraseña o los da de baja */
      if (['altaInvitado','editarInvitado','claveInvitado','bajaInvitado'].indexOf(c.accion) >= 0){
        if (quien.rol !== 'titular') return res.status(403).json({ error: 'Solo el administrador puede gestionar los usuarios de torneos.' })
        if (c.accion === 'altaInvitado'){
          const nombre = limpiarNombre(c.nombre).slice(0, 80), correo = String(c.correo || '').trim().toLowerCase().slice(0, 160), clave = String(c.clave || '')
          if (!nombre) return res.status(400).json({ error: 'Pon el nombre de la persona.' })
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: 'El correo no parece correcto.' })
          if (clave.length < 8) return res.status(400).json({ error: 'La contraseña debe tener 8 caracteres o más.' })
          const ya1 = await sql`select 1 from torneo_invitados where correo = ${correo}`
          let ya2 = []
          try { ya2 = await sql`select 1 from usuarios where correo = ${correo}` } catch (e) {}
          if (ya1.length || ya2.length) return res.status(409).json({ error: 'Ya hay un usuario con ese correo.' })
          await sql`insert into torneo_invitados (titular, nombre, correo, clave, permisos, torneos)
                    values (${uid}, ${nombre}, ${correo}, ${cifrarClave(clave)}, ${JSON.stringify(limpiarPermisos(c.permisos))}::jsonb, ${JSON.stringify(limpiarTorneos(c.torneos))}::jsonb)`
          return res.status(200).json(await listaInvitados(sql, uid))
        }
        const id = Number(c.id)
        const f = await sql`select id from torneo_invitados where id = ${id} and titular = ${uid}`
        if (!f.length) return res.status(404).json({ error: 'Ese usuario ya no existe.' })
        if (c.accion === 'editarInvitado'){
          const nombre = limpiarNombre(c.nombre).slice(0, 80)
          if (!nombre) return res.status(400).json({ error: 'Pon el nombre de la persona.' })
          await sql`update torneo_invitados set nombre = ${nombre}, permisos = ${JSON.stringify(limpiarPermisos(c.permisos))}::jsonb,
                    torneos = ${JSON.stringify(limpiarTorneos(c.torneos))}::jsonb where id = ${id}`
        }
        if (c.accion === 'claveInvitado'){
          const clave = String(c.clave || '')
          if (clave.length < 8) return res.status(400).json({ error: 'La contraseña debe tener 8 caracteres o más.' })
          await sql`update torneo_invitados set clave = ${cifrarClave(clave)} where id = ${id}`
        }
        if (c.accion === 'bajaInvitado') await sql`delete from torneo_invitados where id = ${id}`
        return res.status(200).json(await listaInvitados(sql, uid))
      }

      if (c.accion === 'crear'){
        if (inv) return prohibido()
        const nombre = limpiarNombre(c.nombre)
        if (!nombre) return res.status(400).json({ error: 'Ponle un nombre al torneo.' })
        const datos = (c.datos && typeof c.datos === 'object') ? c.datos : {}
        const texto = JSON.stringify(datos)
        if (Buffer.byteLength(texto) > MAX_BYTES) return res.status(400).json({ error: 'El torneo ocupa demasiado.' })
        const filas = await sql`insert into torneos (usuario_id, nombre, datos)
                                values (${uid}, ${nombre}, ${texto}::jsonb) returning id`
        return res.status(200).json({ id: filas[0].id, ...(await lista(sql, uid, quien)) })
      }

      if (c.accion === 'guardar'){
        const id = Number(c.id)
        const nombre = limpiarNombre(c.nombre)
        if (!id || !nombre) return res.status(400).json({ error: 'Falta el torneo o su nombre.' })
        if (!c.datos || typeof c.datos !== 'object' || Array.isArray(c.datos)){
          return res.status(400).json({ error: 'Los datos del torneo no son válidos.' })
        }
        let datos = c.datos, nombreFinal = nombre
        if (inv){
          /* un invitado solo cambia los apartados en los que puede «ver y cambiar»; lo demás se queda como estaba */
          if (!veTorneo(quien, id) || !puedeEditarAlgo(quien)) return prohibido()
          const f = await sql`select nombre, datos from torneos where id = ${id} and usuario_id = ${uid}`
          if (!f.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
          datos = f[0].datos || {}; nombreFinal = f[0].nombre
          Object.keys(DATOS_DE).forEach(function(k){
            if (!puede(quien, k, 'editar')) return
            DATOS_DE[k].forEach(function(campo){ if (campo in c.datos) datos[campo] = c.datos[campo]; else delete datos[campo] })
          })
        }
        const texto = JSON.stringify(datos)
        if (Buffer.byteLength(texto) > MAX_BYTES){
          return res.status(400).json({ error: 'El torneo ocupa demasiado. Prueba con escudos más pequeños.' })
        }
        const filas = await sql`update torneos set nombre = ${nombreFinal}, datos = ${texto}::jsonb, actualizado = now()
                                where id = ${id} and usuario_id = ${uid} returning id`
        if (!filas.length) return res.status(404).json({ error: 'Ese torneo ya no está.' })
        return res.status(200).json({ ok: true })
      }

      return res.status(400).json({ error: 'No sé qué hacer con eso.' })
    }

    if (req.method === 'DELETE' && q.archivo){
      const a = await sql`select tipo, torneo_id from torneo_archivos where id = ${Number(q.archivo)} and usuario_id = ${uid}`
      if (!a.length) return res.status(404).json({ error: 'Ese documento ya no está.' })
      if (!veTorneo(quien, a[0].torneo_id) || !puede(quien, PESTANA_DOC[a[0].tipo], 'editar')) return prohibido()
      await sql`delete from torneo_archivos where id = ${Number(q.archivo)} and usuario_id = ${uid}`
      return res.status(200).json(await listaArchivos(sql, uid, a[0].torneo_id, quien))
    }

    if (req.method === 'DELETE'){
      if (inv) return prohibido()
      const id = Number(q.id)
      if (!id) return res.status(400).json({ error: 'Falta el torneo a borrar.' })
      await sql`delete from torneos where id = ${id} and usuario_id = ${uid}`
      await sql`delete from torneo_archivos where torneo_id = ${id} and usuario_id = ${uid}`
      return res.status(200).json(await lista(sql, uid, quien))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('torneos:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
