/* Piezas compartidas por las funciones de /api: base de datos, contraseñas y pases. */
import { neon } from '@neondatabase/serverless'
import crypto from 'node:crypto'

export function faltanAjustes(){
  return !process.env.DATABASE_URL || !process.env.CLAVE_FIRMA
}

let _sql = null
export function bd(){
  if (!_sql) _sql = neon(process.env.DATABASE_URL)
  return _sql
}

/* --- contraseñas --- */
export function cifrarClave(clave){
  const sal = crypto.randomBytes(16).toString('hex')
  return 'scrypt$' + sal + '$' + crypto.scryptSync(clave, sal, 64).toString('hex')
}
export function claveCorrecta(clave, guardada){
  const p = String(guardada).split('$')
  if (p.length !== 3) return false
  const calculada = Buffer.from(crypto.scryptSync(clave, p[1], 64).toString('hex'), 'hex')
  const esperada = Buffer.from(p[2], 'hex')
  return calculada.length === esperada.length && crypto.timingSafeEqual(calculada, esperada)
}

/* --- pases de sesión (válidos 30 días) --- */
function firmar(texto){
  return crypto.createHmac('sha256', process.env.CLAVE_FIRMA).update(texto).digest('base64url')
}
export function crearPase(usuario){
  const cuerpo = Buffer.from(JSON.stringify({
    id: usuario.id, correo: usuario.correo, nombre: usuario.nombre,
    expira: Date.now() + 1000 * 60 * 60 * 24 * 30
  })).toString('base64url')
  return cuerpo + '.' + firmar(cuerpo)
}
export function quienEs(req){
  const cabecera = req.headers.authorization || ''
  const pase = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  const trozos = pase.split('.')
  if (trozos.length !== 2) return null
  const esperada = firmar(trozos[0])
  if (trozos[1].length !== esperada.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(trozos[1]), Buffer.from(esperada))) return null
  try {
    const datos = JSON.parse(Buffer.from(trozos[0], 'base64url').toString())
    return (datos.expira && datos.expira > Date.now()) ? datos : null
  } catch { return null }
}
