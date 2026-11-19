import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react'

// Íconos de la interfaz (navegación y pestañas). Trazo de 2px, mismo lenguaje que los de productos.
const UI = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  sede: 'M4 21V6l8-3 8 3v15M2 21h20M9 21v-5h6v5M8 9h2M14 9h2M8 13h2M14 13h2',
  planes: 'M3 6h18v12H3zM8 6v12M12 10h5M12 14h3',
  productos: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9',
  promociones: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  recepcion: 'M3 18h18M5 18a7 7 0 0 1 14 0M12 11V8M10 8h4',
  coaches: 'M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12',
  bitacora: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 11h6M9 15h4',
  socios: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18.5 14.5A6 6 0 0 1 22 21',
  venta: 'M3 4h2l2.4 11h10.8L21 7H6.2M9 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  solicitudes: 'M3 13 6 5h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  alta: 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21a7 7 0 0 1 14 0M19 8v6M16 11h6',
  inventario: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 14l2 2 4-4',
  corte: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9.5v.01M18 14.5v.01',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  membresia: 'M3 5h18v14H3zM3 10h18M7 15h4',
  salir: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12',
  izquierda: 'M15 18l-6-6 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  inicio: 'M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10',
  nutricion: 'M12 7c-2-3-7-2.5-7 2.5C5 15 8.5 21 12 21s7-6 7-11.5C19 4.5 14 4 12 7zM12 7c0-2 1-3.5 3-4',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  operar: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  abajo: 'M6 9l6 6 6-6',
  cerrar: 'M6 6l12 12M18 6 6 18',
  candado: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  derecha: 'M9 18l6-6-6-6',
} as const

export type IconoUI = keyof typeof UI

export function IconoNav({ nombre, size = 20 }: { nombre: IconoUI; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={UI[nombre]} />
    </svg>
  )
}

export interface Pestana<T extends string> {
  id: T
  texto: string
  icono: IconoUI
  /** número pequeño junto al texto (p. ej. pendientes) */
  aviso?: number
  /** en celular va en la barra inferior; las demás quedan en el menú lateral */
  principal?: boolean
}

/** Las pestañas de la pantalla actual, para que la barra inferior del celular y el menú lateral las usen. */
export interface RegistroPestanas {
  items: Pestana<string>[]
  valor: string
  onCambio: (t: string) => void
}
export const NavPanelCtx = createContext<{ registrar: (r: RegistroPestanas | null) => void } | null>(null)

/**
 * Barra de pestañas de los paneles. Nunca se sale de la pantalla: si no caben, se desplaza
 * horizontalmente (con sombra en el borde que indica que hay más) y la activa siempre queda a la vista.
 * Teclado: flechas, Inicio y Fin.
 */
export function Pestanas<T extends string>({ items, valor, onCambio, etiqueta }: { items: Pestana<T>[]; valor: T; onCambio: (t: T) => void; etiqueta: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [bordes, setBordes] = useState({ izq: false, der: false })

  // Registra estas pestañas en el layout (barra inferior y menú lateral en celular).
  const ctx = useContext(NavPanelCtx)
  const ultimo = useRef({ items, valor, onCambio })
  useEffect(() => {
    ultimo.current = { items, valor, onCambio }
  })
  const firma = items.map((i) => `${i.id}:${i.texto}:${i.icono}:${i.aviso ?? ''}:${i.principal ? 1 : 0}`).join('|') + '#' + valor
  useEffect(() => {
    ctx?.registrar({ items: items as Pestana<string>[], valor, onCambio: (t) => ultimo.current.onCambio(t as T) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, firma])
  useEffect(() => () => ctx?.registrar(null), [ctx])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setBordes({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    medir()
    // Con mouse: la rueda vertical desplaza la barra horizontalmente (si hay pestañas ocultas).
    const rueda = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('scroll', medir, { passive: true })
    el.addEventListener('wheel', rueda, { passive: false })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', medir)
      el.removeEventListener('wheel', rueda)
      ro.disconnect()
    }
  }, [items.length])

  // La pestaña activa siempre visible (sin mover la página en vertical).
  useEffect(() => {
    const el = ref.current
    const act = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el || !act) return
    // margen para que no quede debajo de la sombra ni de las flechas
    const izq = act.offsetLeft - 64
    const der = act.offsetLeft + act.offsetWidth + 64 - el.clientWidth
    if (izq < el.scrollLeft) el.scrollTo({ left: izq, behavior: 'smooth' })
    else if (der > el.scrollLeft) el.scrollTo({ left: der, behavior: 'smooth' })
  }, [valor])

  const teclas = (e: KeyboardEvent) => {
    const i = items.findIndex((x) => x.id === valor)
    const sig = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null
    if (sig === null) return
    e.preventDefault()
    const n = items[(sig + items.length) % items.length]
    onCambio(n.id)
    ref.current?.querySelector<HTMLElement>(`[data-tab="${n.id}"]`)?.focus()
  }

  const desplazar = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={`ptabs glass ${bordes.izq ? 'ptabs--izq' : ''} ${bordes.der ? 'ptabs--der' : ''}`}>
      {bordes.izq && (
        <button type="button" className="ptabs__flecha ptabs__flecha--izq" aria-label="Ver pestañas anteriores" tabIndex={-1} onClick={() => desplazar(-1)}>
          <IconoNav nombre="izquierda" size={18} />
        </button>
      )}
      {bordes.der && (
        <button type="button" className="ptabs__flecha ptabs__flecha--der" aria-label="Ver más pestañas" tabIndex={-1} onClick={() => desplazar(1)}>
          <IconoNav nombre="derecha" size={18} />
        </button>
      )}
      <div ref={ref} className="ptabs__scroll" role="tablist" aria-label={etiqueta} onKeyDown={teclas}>
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            aria-selected={valor === t.id}
            tabIndex={valor === t.id ? 0 : -1}
            className={`ptab ${valor === t.id ? 'is-active' : ''}`}
            onClick={() => onCambio(t.id)}
          >
            <IconoNav nombre={t.icono} />
            <span className="ptab__texto">{t.texto}</span>
            {!!t.aviso && <span className="ptab__aviso" aria-label={`${t.aviso} pendientes`}>{t.aviso}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- Avisos emergentes (confirmación / error) ---------- */

type Aviso = { id: number; tipo: 'ok' | 'error'; texto: string }
let oyente: ((a: Aviso) => void) | null = null
let sig = 0

/** Muestra un aviso emergente; lo pinta <Avisos/> (montado una vez en PanelLayout). */
export const avisar = (tipo: Aviso['tipo'], texto: string) => oyente?.({ id: ++sig, tipo, texto })

/** Refleja en avisos emergentes los estados ok/error que ya maneja una pantalla. */
export function useEspejo(ok: string | null | undefined, error: string | null | undefined) {
  useEffect(() => {
    if (ok) avisar('ok', ok)
  }, [ok])
  useEffect(() => {
    if (error) avisar('error', error)
  }, [error])
}

export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([])
  useEffect(() => {
    oyente = (a) => {
      setLista((l) => [...l.slice(-2), a])
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), a.tipo === 'error' ? 8000 : 5000)
    }
    return () => {
      oyente = null
    }
  }, [])
  return (
    <div className="avisos" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`aviso aviso--${a.tipo}`} role={a.tipo === 'error' ? 'alert' : 'status'}>
          <span className="aviso__icono" aria-hidden="true">{a.tipo === 'ok' ? '✓' : '!'}</span>
          <p>{a.texto}</p>
          <button type="button" className="aviso__cerrar" aria-label="Cerrar aviso" onClick={() => setLista((l) => l.filter((x) => x.id !== a.id))}>
            <IconoNav nombre="cerrar" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
