// Cuentas con Supabase Auth + backend NestJS con peticiones firmadas.
//
// - Iniciar sesión, registro, Google, verificación de correo y recuperar contraseña: Supabase Auth.
// - Cada petición al backend lleva el JWT de Supabase como Bearer y va FIRMADA con la llave del
//   dispositivo (keys.ts). Justo después de entrar, el dispositivo registra su llave en el backend.
import type { AuthError } from '@supabase/supabase-js'
import { getRemember, setRemember, supabase } from '../lib/supabase'
import { publicJwk, rotateDeviceKeys, signatureHeaders } from './keys'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

export type Rol = 'admin' | 'encargado' | 'recepcion' | 'coach' | 'socio'

export interface Yo {
  id: string
  email: string
  nombre: string | null
  apodo: string | null
  fotoUrl: string | null
  fechaNacimiento: string | null
  sede: { id: string; nombre: string } | null
  roles: { rol: Rol; sedeId: string | null }[]
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/* ---------- Errores de Supabase Auth en español ---------- */

function authError(err: AuthError): ApiError {
  const msg: Record<string, string> = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Confirma tu correo antes de entrar. Revisa tu bandeja (y spam).',
    user_already_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
    email_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
    weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.',
    over_email_send_rate_limit: 'Enviamos demasiados correos. Espera unos minutos e inténtalo de nuevo.',
    over_request_rate_limit: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    same_password: 'La nueva contraseña debe ser distinta a la anterior.',
    otp_expired: 'El enlace ya expiró. Pide uno nuevo.',
    // El correo de prueba de Supabase solo envía a miembros del equipo hasta configurar SMTP propio.
    email_address_not_authorized: 'Por ahora no podemos enviar correos a esa dirección. Inténtalo con Google o más tarde.',
    signup_disabled: 'El registro está cerrado por el momento.',
  }
  return new ApiError(msg[err.code ?? ''] ?? 'Algo salió mal. Inténtalo de nuevo.', err.status ?? 400, err.code)
}

/* ---------- Peticiones firmadas al backend ---------- */

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession() // renueva el JWT si está por vencer
  if (!data.session) throw new ApiError('Inicia sesión para continuar.', 401, 'token_missing')
  return data.session.access_token
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown, bearer?: string): Promise<T> {
  const payload = body === undefined ? '' : JSON.stringify(body)
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(await signatureHeaders(method, path, payload)),
      },
      body: payload || undefined,
    })
  } catch {
    throw new ApiError('No pudimos conectar con el servidor. Inténtalo en unos minutos.', 0)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(' ') : data.message
    throw new ApiError(msg || 'Algo salió mal. Inténtalo de nuevo.', res.status, data.code)
  }
  return data as T
}

const DEVICE_GONE = ['device_unknown', 'device_revoked', 'device_expired', 'device_mismatch', 'perfil_missing']

/** Petición al backend con la sesión actual (Bearer + firma). Si el dispositivo no está registrado, lo registra y reintenta. */
export async function authed<T>(method: Method, path: string, body?: unknown): Promise<T> {
  try {
    try {
      return await request<T>(method, path, body, await accessToken())
    } catch (err) {
      if (err instanceof ApiError && err.code === 'device_unknown') {
        await registrarDispositivo()
        return await request<T>(method, path, body, await accessToken())
      }
      throw err
    }
  } catch (err) {
    // Este dispositivo ya no vale (sesión cerrada, vencida o de otra llave): cerramos sesión local.
    if (err instanceof ApiError && err.code && DEVICE_GONE.includes(err.code)) {
      await supabase.auth.signOut({ scope: 'local' })
    }
    throw err
  }
}

/** Registra la llave de este dispositivo para la sesión actual de Supabase y devuelve el perfil. */
export async function registrarDispositivo(): Promise<Yo> {
  try {
    return await request<Yo>('POST', '/auth/dispositivo', { publicKey: await publicJwk(), remember: getRemember() }, await accessToken())
  } catch (err) {
    if (err instanceof ApiError && err.code && DEVICE_GONE.includes(err.code)) {
      await supabase.auth.signOut({ scope: 'local' })
    }
    throw err
  }
}

/* ---------- Cuenta ---------- */

/** "dolores@recepcion" (usuario de recepción) → correo interno de su cuenta. */
export const aCorreo = (usuario: string) => {
  const v = usuario.trim().toLowerCase()
  return /^[a-z0-9-]+@recepcion$/.test(v) ? `${v}.spartacus.app` : v
}

export async function entrar(email: string, password: string, remember: boolean): Promise<Yo> {
  setRemember(remember)
  const { error } = await supabase.auth.signInWithPassword({ email: aCorreo(email), password })
  if (error) throw authError(error)
  return registrarDispositivo()
}

/**
 * Crea la cuenta. Supabase manda un correo de verificación; hasta confirmarlo no hay sesión.
 * La ubicación viaja en los metadatos para asignar la sede más cercana al primer inicio de sesión.
 */
export async function registrarse(input: {
  nombre: string
  email: string
  password: string
  remember: boolean
  location: { lat: number; lng: number }
}): Promise<'verificar' | Yo> {
  setRemember(input.remember)
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: { full_name: input.nombre.trim(), ubicacion: input.location },
    },
  })
  if (error) throw authError(error)
  // Supabase no revela si el correo ya existe: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    throw new ApiError('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.', 409)
  }
  return data.session ? registrarDispositivo() : 'verificar'
}

export async function entrarConGoogle(remember: boolean, volverA: string) {
  setRemember(remember)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${volverA}`, queryParams: { prompt: 'select_account' } },
  })
  if (error) throw authError(error)
}

export async function reenviarVerificacion(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/login` },
  })
  if (error) throw authError(error)
}

export async function recuperarContrasena(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/restablecer`,
  })
  if (error) throw authError(error)
}

export async function nuevaContrasena(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw authError(error)
}

export const yo = () => authed<Yo>('GET', '/auth/me')

export const asignarSede = (location: { lat: number; lng: number }) => authed<Yo>('PATCH', '/auth/me/sede', { location })

export const actualizarPerfil = (data: { nombre?: string; apodo?: string; fechaNacimiento?: string }) =>
  authed<Yo>('PATCH', '/auth/me', data)

/** Sube la foto a Storage (carpeta de la persona) y la guarda en el perfil. */
export async function subirFoto(file: File): Promise<Yo> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new ApiError('La foto debe ser JPG, PNG o WebP.', 400)
  }
  if (file.size > 2 * 1024 * 1024) throw new ApiError('La foto debe pesar menos de 2 MB.', 400)
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new ApiError('Inicia sesión para continuar.', 401)
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${data.session.user.id}/foto-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new ApiError('No pudimos subir la foto. Inténtalo de nuevo.', 400)
  return authed<Yo>('PATCH', '/auth/me/foto', { path })
}

export async function salir() {
  try {
    await authed<void>('POST', '/auth/logout')
  } catch {
    /* aunque falle el backend, cerramos la sesión local */
  }
  await supabase.auth.signOut({ scope: 'local' })
  setRemember(false)
  await rotateDeviceKeys()
}
