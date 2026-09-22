/* Mi dieta: el PDF de la dieta, los menús de la semana y el control de peso.
   Misma cuenta que el calendario. Las tablas se crean solas la primera vez. */
import { bd, faltanAjustes, quienEs } from '../lib/comun.js'

const COMIDAS = ['desayuno', 'media', 'comida', 'merienda', 'cena']
const MAX_PDF = 3 * 1024 * 1024   // 3 MB: el límite de subida del servidor es algo más de 4

let tablasListas = false
async function prepararTablas(sql){
  if (tablasListas) return
  await sql`create table if not exists dieta_pdf (
    id serial primary key, usuario_id text not null, nombre text not null,
    tamano integer not null, datos bytea not null, subido timestamptz not null default now())`
  await sql`create index if not exists dieta_pdf_usuario on dieta_pdf (usuario_id, subido desc)`
  await sql`create table if not exists dieta_menus (
    usuario_id text not null, dia smallint not null, comida text not null, texto text not null default '',
    primary key (usuario_id, dia, comida))`
  await sql`create table if not exists dieta_pesos (
    id serial primary key, usuario_id text not null, fecha date not null, kg numeric(5,2) not null,
    nota text not null default '', unique (usuario_id, fecha))`
  await sql`create table if not exists dieta_ajustes (
    usuario_id text primary key, objetivo numeric(5,2), inicio numeric(5,2))`
  await sql`create table if not exists dieta_plan (
    usuario_id text primary key, desde date not null, hasta date not null,
    dias jsonb not null, creado timestamptz not null default now())`
  tablasListas = true
}

function numeroKg(v){
  const n = Math.round(Number(String(v ?? '').replace(',', '.')) * 100) / 100
  return (isFinite(n) && n >= 20 && n <= 400) ? n : null
}

async function todo(sql, uid){
  const [menus, pesos, pdfs, ajustes, planes] = await Promise.all([
    sql`select dia, comida, texto from dieta_menus where usuario_id = ${uid}`,
    sql`select id, to_char(fecha,'YYYY-MM-DD') as fecha, kg::float8 as kg, nota
        from dieta_pesos where usuario_id = ${uid} order by fecha desc`,
    sql`select id, nombre, tamano, to_char(subido at time zone 'Europe/Madrid','YYYY-MM-DD') as subido
        from dieta_pdf where usuario_id = ${uid} order by subido desc limit 1`,
    sql`select objetivo::float8 as objetivo, inicio::float8 as inicio from dieta_ajustes where usuario_id = ${uid}`,
    sql`select to_char(desde,'YYYY-MM-DD') as desde, to_char(hasta,'YYYY-MM-DD') as hasta, dias
        from dieta_plan where usuario_id = ${uid}`
  ])
  return {
    menus, pesos,
    pdf: pdfs[0] || null,
    objetivo: ajustes.length ? ajustes[0].objetivo : null,
    inicio: ajustes.length ? ajustes[0].inicio : null,
    plan: planes[0] || null
  }
}

export default async function handler(req, res){
  if (faltanAjustes()) return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  const yo = quienEs(req)
  if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
  const uid = String(yo.id)
  const sql = bd()

  try {
    await prepararTablas(sql)

    if (req.method === 'GET'){
      if (req.query.que === 'pdf'){
        const filas = await sql`
          select nombre, encode(datos,'base64') as datos from dieta_pdf
          where usuario_id = ${uid} order by subido desc limit 1`
        if (!filas.length) return res.status(404).json({ error: 'Todavía no has subido ninguna dieta.' })
        const nombre = filas[0].nombre.replace(/[^\w.\- ]/g, '_')
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'inline; filename="' + nombre + '"')
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).send(Buffer.from(filas[0].datos, 'base64'))
      }
      return res.status(200).json(await todo(sql, uid))
    }

    if (req.method === 'POST'){
      const c = req.body || {}

      if (c.accion === 'pdf'){
        const datos = String(c.datos || '').replace(/^data:[^,]*,/, '')
        const bytes = Buffer.from(datos, 'base64')
        if (bytes.length < 100 || bytes.subarray(0, 5).toString() !== '%PDF-'){
          return res.status(400).json({ error: 'El archivo no es un PDF.' })
        }
        if (bytes.length > MAX_PDF) return res.status(400).json({ error: 'El PDF pesa más de 3 MB.' })
        let nombre = String(c.nombre || 'dieta.pdf').trim().slice(0, 150) || 'dieta.pdf'
        if (!/\.pdf$/i.test(nombre)) nombre += '.pdf'
        await sql`
          insert into dieta_pdf (usuario_id, nombre, tamano, datos)
          values (${uid}, ${nombre}, ${bytes.length}, decode(${bytes.toString('base64')}, 'base64'))`
        // solo se guarda la última dieta: las anteriores se quitan para no llenar la base de datos
        await sql`delete from dieta_pdf where usuario_id = ${uid}
                  and id not in (select id from dieta_pdf where usuario_id = ${uid} order by subido desc, id desc limit 1)`
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'plan'){
        // la dieta día a día para el tiempo que se haya indicado (máximo 3 meses)
        const lista = Array.isArray(c.dias) ? c.dias : []
        if (!lista.length || lista.length > 92) return res.status(400).json({ error: 'El tiempo tiene que ser de 1 a 92 días.' })
        const dias = []
        for (const d of lista){
          const fecha = String(d.fecha || '')
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Hay un día con la fecha mal puesta.' })
          const dia = { fecha }
          for (const k of COMIDAS) dia[k] = String(d[k] || '').slice(0, 800)
          dias.push(dia)
        }
        dias.sort((a, b) => a.fecha < b.fecha ? -1 : 1)
        const desde = dias[0].fecha, hasta = dias[dias.length - 1].fecha
        await sql`
          insert into dieta_plan (usuario_id, desde, hasta, dias, creado)
          values (${uid}, ${desde}, ${hasta}, ${JSON.stringify(dias)}::jsonb, now())
          on conflict (usuario_id) do update set desde = excluded.desde, hasta = excluded.hasta,
            dias = excluded.dias, creado = now()`
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'menus'){
        const lista = Array.isArray(c.menus) ? c.menus : []
        for (const m of lista){
          const dia = Number(m.dia)
          if (!(dia >= 1 && dia <= 7) || !COMIDAS.includes(m.comida)) continue
          const texto = String(m.texto || '').trim().slice(0, 1500)
          await sql`
            insert into dieta_menus (usuario_id, dia, comida, texto) values (${uid}, ${dia}, ${m.comida}, ${texto})
            on conflict (usuario_id, dia, comida) do update set texto = excluded.texto`
        }
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'peso'){
        const fecha = String(c.fecha || '')
        const kg = numeroKg(c.kg)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || kg === null){
          return res.status(400).json({ error: 'Pon el día y un peso entre 20 y 400 kg.' })
        }
        const nota = String(c.nota || '').trim().slice(0, 300)
        await sql`
          insert into dieta_pesos (usuario_id, fecha, kg, nota) values (${uid}, ${fecha}, ${kg}, ${nota})
          on conflict (usuario_id, fecha) do update set kg = excluded.kg, nota = excluded.nota`
        return res.status(200).json(await todo(sql, uid))
      }

      if (c.accion === 'objetivo'){
        const objetivo = c.objetivo === '' || c.objetivo == null ? null : numeroKg(c.objetivo)
        const inicio = c.inicio === '' || c.inicio == null ? null : numeroKg(c.inicio)
        if ((c.objetivo && objetivo === null) || (c.inicio && inicio === null)){
          return res.status(400).json({ error: 'Los pesos tienen que estar entre 20 y 400 kg.' })
        }
        await sql`
          insert into dieta_ajustes (usuario_id, objetivo, inicio) values (${uid}, ${objetivo}, ${inicio})
          on conflict (usuario_id) do update set objetivo = excluded.objetivo, inicio = excluded.inicio`
        return res.status(200).json(await todo(sql, uid))
      }

      return res.status(400).json({ error: 'No sé qué hacer con eso.' })
    }

    if (req.method === 'DELETE'){
      if (req.query.que === 'plan'){
        await sql`delete from dieta_plan where usuario_id = ${uid}`
        return res.status(200).json(await todo(sql, uid))
      }
      if (req.query.que === 'pdf'){
        await sql`delete from dieta_pdf where usuario_id = ${uid}`
        return res.status(200).json(await todo(sql, uid))
      }
      const id = Number(req.query.id)
      if (!id) return res.status(400).json({ error: 'Falta el peso a borrar.' })
      await sql`delete from dieta_pesos where id = ${id} and usuario_id = ${uid}`
      return res.status(200).json(await todo(sql, uid))
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('dieta:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
