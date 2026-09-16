/* Las citas del calendario: listar, crear, modificar y borrar. */
import { bd, faltanAjustes, quienEs } from '../lib/comun.js'

const TIPOS = ['salud','cumple','casa','papeleo','plan','trabajo']
const REPITES = ['no','anual','mensual']

function limpiar(c){
  const fecha = String(c.fecha || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const titulo = String(c.titulo || '').trim().slice(0, 200)
  if (!titulo) return null
  const hora = /^\d{2}:\d{2}$/.test(String(c.hora || '')) ? String(c.hora) : null
  return {
    fecha, titulo, hora,
    tipo: TIPOS.includes(c.tipo) ? c.tipo : 'plan',
    nota: String(c.nota || '').trim().slice(0, 1000),
    repite: REPITES.includes(c.repite) ? c.repite : 'no'
  }
}

export default async function handler(req, res){
  if (faltanAjustes()) return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  const yo = quienEs(req)
  if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
  const sql = bd()

  try {
    if (req.method === 'GET'){
      const filas = await sql`
        select id, to_char(fecha,'YYYY-MM-DD') as fecha, hora, titulo, tipo, nota, repite
        from citas where usuario_id = ${yo.id} order by fecha, hora nulls first`
      return res.status(200).json({ citas: filas })
    }

    if (req.method === 'POST'){
      const c = limpiar(req.body || {})
      if (!c) return res.status(400).json({ error: 'Hace falta al menos qué es y qué día.' })
      const [fila] = await sql`
        insert into citas (usuario_id, fecha, hora, titulo, tipo, nota, repite)
        values (${yo.id}, ${c.fecha}, ${c.hora}, ${c.titulo}, ${c.tipo}, ${c.nota}, ${c.repite})
        returning id, to_char(fecha,'YYYY-MM-DD') as fecha, hora, titulo, tipo, nota, repite`
      return res.status(200).json({ cita: fila })
    }

    if (req.method === 'PUT'){
      const id = Number((req.body || {}).id)
      const c = limpiar(req.body || {})
      if (!id || !c) return res.status(400).json({ error: 'Datos incompletos.' })
      const filas = await sql`
        update citas set fecha = ${c.fecha}, hora = ${c.hora}, titulo = ${c.titulo},
               tipo = ${c.tipo}, nota = ${c.nota}, repite = ${c.repite}, actualizado = now()
        where id = ${id} and usuario_id = ${yo.id}
        returning id, to_char(fecha,'YYYY-MM-DD') as fecha, hora, titulo, tipo, nota, repite`
      if (!filas.length) return res.status(404).json({ error: 'Esa cita ya no existe.' })
      return res.status(200).json({ cita: filas[0] })
    }

    if (req.method === 'DELETE'){
      const id = Number(req.query.id || (req.body || {}).id)
      if (!id) return res.status(400).json({ error: 'Falta la cita a borrar.' })
      await sql`delete from citas where id = ${id} and usuario_id = ${yo.id}`
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('citas:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
