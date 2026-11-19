import { createClient, type SupportedStorage } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

/* ---------- "Recordarme" ----------
 * Marcado: la sesión de Supabase vive en localStorage (sobrevive a cerrar el navegador).
 * Sin marcar: en sessionStorage (se pierde al cerrar la pestaña). El backend además corta
 * los dispositivos sin "Recordarme" a las 12 horas.
 */
const REMEMBER = 'spartacus.remember'

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const getRemember = () => safe(() => localStorage.getItem(REMEMBER) === '1', false)
export const setRemember = (v: boolean) => safe(() => localStorage.setItem(REMEMBER, v ? '1' : '0'), undefined)

const rememberStorage: SupportedStorage = {
  getItem: (key) => safe(() => localStorage.getItem(key) ?? sessionStorage.getItem(key), null),
  setItem: (key, value) =>
    safe(() => {
      const keep = getRemember()
      ;(keep ? localStorage : sessionStorage).setItem(key, value)
      ;(keep ? sessionStorage : localStorage).removeItem(key)
    }, undefined),
  removeItem: (key) =>
    safe(() => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }, undefined),
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    flowType: 'pkce',
    storage: rememberStorage,
    storageKey: 'spartacus.auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
