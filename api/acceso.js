/* Entrada a Apps Mendoza: primer arranque, login, cambio de contraseña y alta/baja de usuarios. */
import { bd, faltanAjustes, cifrarClave, claveCorrecta, crearPase, quienEsVivo, prepararUsuarios, olvidarPersona } from '../lib/comun.js'

export default async function handler(req, res){
  if (faltanAjustes()){
    return res.status(500).json({ error: 'El servidor todavía no tiene puestos sus dos ajustes.' })
  }
  const sql = bd()

  try {
    await prepararUsuarios(sql)
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
      const filas = await sql`select id, correo, nombre, clave, titular from usuarios where correo = ${correo}`
      if (!filas.length || !claveCorrecta(clave, filas[0].clave)){
        return res.status(401).json({ error: 'El correo o la contraseña no son correctos.' })
      }
      const usuario = { id: filas[0].id, correo: filas[0].correo, nombre: filas[0].nombre, titular: filas[0].titular || null }
      return res.status(200).json({ pase: crearPase(usuario), usuario })
    }

    /* --- cambiar la contraseña --- */
    if (accion === 'cambiar'){
      const yo = await quienEsVivo(req)
      if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
      const persona = String(yo.persona || yo.id)
      const actual = String(cuerpo.actual || '')
      const nueva  = String(cuerpo.nueva || '')
      if (nueva.length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener 8 caracteres o más.' })
      const filas = await sql`select clave from usuarios where id::text = ${persona}`
      if (!filas.length || !claveCorrecta(actual, filas[0].clave)){
        return res.status(401).json({ error: 'La contraseña actual no es correcta.' })
      }
      await sql`update usuarios set clave = ${cifrarClave(nueva)} where id::text = ${persona}`
      return res.status(200).json({ ok: true })
    }

    /* --- usuarios: solo el titular puede verlos, darlos de alta y de baja --- */
    if (['usuarios', 'alta', 'baja', 'nuevaClave'].includes(accion)){
      const yo = await quienEsVivo(req)
      if (!yo) return res.status(401).json({ error: 'Vuelve a entrar.' })
      const persona = String(yo.persona || yo.id)
      const [mia] = await sql`select id, titular from usuarios where id::text = ${persona}`
      if (!mia) return res.status(401).json({ error: 'Vuelve a entrar.' })
      if (mia.titular) return res.status(403).json({ error: 'Solo el titular de la cuenta puede dar de alta o de baja a otros usuarios.', noTitular: true })
      const titular = String(mia.id)
      const lista = async function(){
        return await sql`select id::text as id, nombre, correo, (titular is null) as es_titular,
            to_char(alta at time zone 'Europe/Madrid','DD/MM/YYYY') as alta
          from usuarios where id::text = ${titular} or titular = ${titular}
          order by (titular is null) desc, lower(nombre)`
      }

      if (accion === 'usuarios') return res.status(200).json({ usuarios: await lista() })

      if (accion === 'alta'){
        const nombre = String(cuerpo.nombre || '').trim().slice(0, 80)
        const correo = String(cuerpo.correo || '').trim().toLowerCase().slice(0, 160)
        const clave  = String(cuerpo.clave || '')
        if (!nombre) return res.status(400).json({ error: 'Pon el nombre de la persona.' })
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: 'El correo no parece correcto.' })
        if (clave.length < 8) return res.status(400).json({ error: 'La contraseña debe tener 8 caracteres o más.' })
        const ya = await sql`select 1 from usuarios where correo = ${correo}`
        if (ya.length) return res.status(409).json({ error: 'Ya hay un usuario con ese correo.' })
        await sql`insert into usuarios (correo, nombre, clave, titular) values (${correo}, ${nombre}, ${cifrarClave(clave)}, ${titular})`
        return res.status(200).json({ usuarios: await lista() })
      }

      const otro = String(cuerpo.id || '')
      const [u] = await sql`select id from usuarios where id::text = ${otro} and titular = ${titular}`
      if (!u) return res.status(404).json({ error: 'Ese usuario no existe o no se puede tocar.' })

      if (accion === 'baja'){
        await sql`delete from usuarios where id::text = ${otro} and titular = ${titular}`
        olvidarPersona(otro)
        return res.status(200).json({ usuarios: await lista() })
      }
      if (accion === 'nuevaClave'){
        const clave = String(cuerpo.clave || '')
        if (clave.length < 8) return res.status(400).json({ error: 'La contraseña debe tener 8 caracteres o más.' })
        await sql`update usuarios set clave = ${cifrarClave(clave)} where id::text = ${otro} and titular = ${titular}`
        return res.status(200).json({ usuarios: await lista() })
      }
    }

    return res.status(400).json({ error: 'Petición no reconocida.' })
  } catch (e){
    console.error('acceso:', e.message)
    return res.status(500).json({ error: 'No se ha podido completar la operación.' })
  }
}
