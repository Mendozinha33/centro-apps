/* Mis gastos: listar, crear, modificar y borrar movimientos de un mes. */
import { bd, faltanAjustes, quienEs } from '../lib/comun.js'

const CATEGORIAS_GASTO = ['casa','comida','coche','ocio','salud','compras','recibos','otros']
const CATEGORIAS_INGRESO = ['nomina','extra','otros']

function limpiar(m){
  const fecha = String(m.fecha || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const concepto = String(m.concepto || '').trim().slice(0, 200)
  if (!concepto) return null
  const importe = Math.round(Number(String(m.importe).replace(',', '.')) * 100) / 100
  if (!isFinite(importe) || importe <= 0 || importe > 99999999) return null
  const tipo = m.tipo === 'ingreso' ? 'ingreso' : 'gasto'
  const permitidas = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
  return {
    fecha, concepto, importe, tipo,
    categoria: permitidas.includes(m.categoria) ? m.categoria : 'otros',
    nota: String(m.nota || '').trim().slice(0, 500)
  }
}

export default async function handler(req, res){
  if (faltanAjustes()) return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  const yo = quienEs(req)
  if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
  const sql = bd()

  try {
    if (req.method === 'GET'){
      const mes = String(req.query.mes || '')
      if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: 'Mes no válido.' })
      const desde = mes + '-01'
      const movimientos = await sql`
        select id, to_char(fecha,'YYYY-MM-DD') as fecha, tipo, importe::float8 as importe,
               categoria, concepto, nota
        from movimientos
        where usuario_id = ${yo.id}
          and fecha >= ${desde}::date and fecha < (${desde}::date + interval '1 month')
        order by fecha desc, id desc`
      const ajustes = await sql`select tope::float8 as tope from ajustes where usuario_id = ${yo.id}`
      return res.status(200).json({ movimientos, tope: ajustes.length ? ajustes[0].tope : 0 })
    }

    if (req.method === 'POST'){
      const m = limpiar(req.body || {})
      if (!m) return res.status(400).json({ error: 'Faltan datos: concepto, día e importe mayor que cero.' })
      const [fila] = await sql`
        insert into movimientos (usuario_id, fecha, tipo, importe, categoria, concepto, nota)
        values (${yo.id}, ${m.fecha}, ${m.tipo}, ${m.importe}, ${m.categoria}, ${m.concepto}, ${m.nota})
        returning id, to_char(fecha,'YYYY-MM-DD') as fecha, tipo, importe::float8 as importe,
                  categoria, concepto, nota`
      return res.status(200).json({ movimiento: fila })
    }

    if (req.method === 'PUT'){
      const cuerpo = req.body || {}
      if (cuerpo.accion === 'tope'){
        const tope = Math.round(Number(String(cuerpo.tope).replace(',', '.')) * 100) / 100
        if (!isFinite(tope) || tope < 0) return res.status(400).json({ error: 'El tope no es válido.' })
        await sql`
          insert into ajustes (usuario_id, tope) values (${yo.id}, ${tope})
          on conflict (usuario_id) do update set tope = excluded.tope`
        return res.status(200).json({ tope })
      }
      const id = Number(cuerpo.id)
      const m = limpiar(cuerpo)
      if (!id || !m) return res.status(400).json({ error: 'Datos incompletos.' })
      const filas = await sql`
        update movimientos set fecha = ${m.fecha}, tipo = ${m.tipo}, importe = ${m.importe},
               categoria = ${m.categoria}, concepto = ${m.concepto}, nota = ${m.nota}, actualizado = now()
        where id = ${id} and usuario_id = ${yo.id}
        returning id, to_char(fecha,'YYYY-MM-DD') as fecha, tipo, importe::float8 as importe,
                  categoria, concepto, nota`
      if (!filas.length) return res.status(404).json({ error: 'Ese apunte ya no existe.' })
      return res.status(200).json({ movimiento: filas[0] })
    }

    if (req.method === 'DELETE'){
      const id = Number(req.query.id || (req.body || {}).id)
      if (!id) return res.status(400).json({ error: 'Falta el apunte a borrar.' })
      await sql`delete from movimientos where id = ${id} and usuario_id = ${yo.id}`
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método no permitido' })
  } catch (e){
    console.error('movimientos:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
