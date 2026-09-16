/* Entrada a Mi calendario: primer arranque, login y cambio de contraseña. */
import { bd, faltanAjustes, cifrarClave, claveCorrecta, crearPase, quienEs } from '../lib/comun.js'

export default async function handler(req, res){
  if (faltanAjustes()){
    return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  }
  const sql = bd()

  try {
    if (req.method === 'GET'){
      const [{ total }] = await sql`select count(*)::int as total from usuarios`
      return res.status(200).json({ hayCuenta: total > 0 })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

    const cuerpo = req.body || {}
    const accion = cuerpo.accion

    /* --- crear la primera cuenta --- */
    if (accion === 'arranque'){
      const nombre = String(cuerpo.nombre || '').trim()
      const correo = String(cuerpo.correo || '').trim().toLowerCase()
      const clave  = String(cuerpo.clave || '')
      const codigo = String(cuerpo.codigo || '').trim().toUpperCase()

      if (!nombre || !correo || clave.length < 8){
        return res.status(400).json({ error: 'Faltan datos, o la contraseña tiene menos de 8 caracteres.' })
      }
      const [{ total }] = await sql`select count(*)::int as total from usuarios`
      if (total > 0) return res.status(403).json({ error: 'La cuenta ya estaba creada.' })

      const valido = await sql`select codigo from arranque where codigo = ${codigo} and usado = false`
      if (!valido.length) return res.status(403).json({ error: 'El código de arranque no es correcto.' })

      const [usuario] = await sql`
        insert into usuarios (correo, nombre, clave)
        values (${correo}, ${nombre}, ${cifrarClave(clave)})
        returning id, correo, nombre`
      await sql`update arranque set usado = true where codigo = ${codigo}`
      return res.status(200).json({ pase: crearPase(usuario), usuario })
    }

    /* --- entrar --- */
    if (accion === 'entrar'){
      const correo = String(cuerpo.correo || '').trim().toLowerCase()
      const clave  = String(cuerpo.clave || '')
      const filas = await sql`select id, correo, nombre, clave from usuarios where correo = ${correo}`
      if (!filas.length || !claveCorrecta(clave, filas[0].clave)){
        return res.status(401).json({ error: 'El correo o la contraseña no son correctos.' })
      }
      const usuario = { id: filas[0].id, correo: filas[0].correo, nombre: filas[0].nombre }
      return res.status(200).json({ pase: crearPase(usuario), usuario })
    }

    /* --- cambiar la contraseña --- */
    if (accion === 'cambiar'){
      const yo = quienEs(req)
      if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
      const actual = String(cuerpo.actual || '')
      const nueva  = String(cuerpo.nueva || '')
      if (nueva.length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener 8 caracteres o más.' })
      const filas = await sql`select clave from usuarios where id = ${yo.id}`
      if (!filas.length || !claveCorrecta(actual, filas[0].clave)){
        return res.status(401).json({ error: 'La contraseña actual no es correcta.' })
      }
      await sql`update usuarios set clave = ${cifrarClave(nueva)} where id = ${yo.id}`
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Petición no reconocida.' })
  } catch (e){
    console.error('acceso:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
