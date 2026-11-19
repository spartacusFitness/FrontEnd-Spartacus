import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import Background from '../Background'
import { ApiError, salir, yo as cargarYo, type Rol, type Yo } from '../auth/api'
import { supabase } from '../lib/supabase'
import '../auth/auth.css'
import { IconoNav, NavPanelCtx, type IconoUI, type Pestana, type RegistroPestanas } from './Navegacion'
import './panel.css'

export const tiene = (yo: Yo, ...roles: Rol[]) => yo.roles.some((r) => roles.includes(r.rol))

/** Sedes donde la persona tiene alguno de esos roles; null = todas (admin). */
export function sedesDe(yo: Yo, ...roles: Rol[]): string[] | null {
  if (roles.includes('admin') && yo.roles.some((r) => r.rol === 'admin')) return null
  return [...new Set(yo.roles.filter((r) => roles.includes(r.rol) && r.sedeId).map((r) => r.sedeId!))]
}

type Estado = { tipo: 'cargando' } | { tipo: 'sin-sesion' } | { tipo: 'error'; msg: string } | { tipo: 'listo'; yo: Yo }

function useYo(): Estado {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return vivo && setEstado({ tipo: 'sin-sesion' })
      try {
        const yo = await cargarYo()
        if (vivo) setEstado({ tipo: 'listo', yo })
      } catch (err) {
        if (!vivo) return
        if (err instanceof ApiError && err.status === 401) setEstado({ tipo: 'sin-sesion' })
        else setEstado({ tipo: 'error', msg: err instanceof ApiError ? err.message : 'No pudimos cargar tu cuenta.' })
      }
    })
    return () => {
      vivo = false
    }
  }, [])
  return estado
}

interface Seccion {
  to: string
  texto: string
  corto: string
  icono: IconoUI
}

/**
 * Secciones de la persona. "Propias" = las de su rol. "Operar como" = las que puede abrir por ser
 * admin/encargado (cubrir recepción, armar una rutina) pero que no son su trabajo diario.
 */
function secciones(yo: Yo): { propias: Seccion[]; operar: Seccion[] } {
  const gestion = tiene(yo, 'admin', 'encargado')
  const rec: Seccion = { to: '/recepcion', texto: 'Recepción', corto: 'Recepción', icono: 'recepcion' }
  const coach: Seccion = { to: '/coach', texto: 'Coach', corto: 'Coach', icono: 'coaches' }
  const propias: Seccion[] = []
  const operar: Seccion[] = []
  if (gestion) propias.push({ to: '/admin', texto: 'Administración', corto: 'Admin', icono: 'admin' })
  if (tiene(yo, 'recepcion')) propias.push(rec)
  else if (gestion) operar.push(rec)
  if (tiene(yo, 'coach')) propias.push(coach)
  else if (gestion) operar.push(coach)
  if (tiene(yo, 'socio')) propias.push({ to: '/mi-membresia', texto: 'Mi membresía', corto: 'Membresía', icono: 'membresia' })
  return { propias, operar }
}

const cerrarSesion = () => salir().finally(() => window.location.assign('/login'))

/** Escritorio: menú desplegable "Operar como" (Recepción, Coach). */
function OperarComo({ items }: { items: Seccion[] }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const activo = items.some((i) => location.pathname.startsWith(i.to))
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])
  return (
    <div className="operar" ref={ref}>
      <button
        type="button"
        className={`panel-nav__link operar__btn ${activo ? 'active' : ''}`}
        aria-expanded={abierto}
        aria-controls="operar-lista"
        onClick={() => setAbierto((a) => !a)}
      >
        <IconoNav nombre="operar" />
        <span>Operar como</span>
        <IconoNav nombre="abajo" size={16} />
      </button>
      {abierto && (
        <ul id="operar-lista" className="operar__lista glass">
          {items.map((i) => (
            <li key={i.to}>
              <NavLink to={i.to} className="operar__item" onClick={() => setAbierto(false)}>
                <IconoNav nombre={i.icono} />
                <span>{i.texto}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Celular: menú lateral con todo lo que no cabe en la barra inferior. */
function MenuLateral({
  abierto,
  onCerrar,
  yo,
  propias,
  operar,
  resto,
  pestanas,
}: {
  abierto: boolean
  onCerrar: () => void
  yo: Yo
  propias: Seccion[]
  operar: Seccion[]
  resto: Pestana<string>[]
  pestanas: RegistroPestanas | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) {
      d.showModal()
      cerrarRef.current?.focus()
    }
    if (!abierto && d.open) d.close()
  }, [abierto])
  const enlace = (s: Seccion) => (
    <li key={s.to}>
      <NavLink to={s.to} className="menu-lat__item" onClick={onCerrar}>
        <IconoNav nombre={s.icono} />
        <span>{s.texto}</span>
      </NavLink>
    </li>
  )
  return (
    <dialog ref={ref} className="drawer menu-lat" aria-label="Menú" onClose={onCerrar} onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="drawer__panel glass">
        <div className="drawer__head">
          <span className="menu-lat__quien">
            <strong>{yo.nombre ?? 'Mi cuenta'}</strong>
            <small>{yo.email}</small>
          </span>
          <button ref={cerrarRef} type="button" className="icon-btn glass" onClick={onCerrar} aria-label="Cerrar menú">
            <IconoNav nombre="cerrar" />
          </button>
        </div>
        {pestanas && resto.length > 0 && (
          <>
            <p className="drawer__label">En esta pantalla</p>
            <ul className="menu-lat__lista">
              {resto.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`menu-lat__item ${pestanas.valor === t.id ? 'active' : ''}`}
                    aria-current={pestanas.valor === t.id ? 'page' : undefined}
                    onClick={() => {
                      pestanas.onCambio(t.id)
                      onCerrar()
                      window.scrollTo({ top: 0 })
                    }}
                  >
                    <IconoNav nombre={t.icono} />
                    <span>{t.texto}</span>
                    {!!t.aviso && <span className="ptab__aviso">{t.aviso}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {propias.length > 0 && (
          <>
            <p className="drawer__label">Mis secciones</p>
            <ul className="menu-lat__lista">{propias.map(enlace)}</ul>
          </>
        )}
        {operar.length > 0 && (
          <>
            <p className="drawer__label">Operar como</p>
            <ul className="menu-lat__lista">{operar.map(enlace)}</ul>
          </>
        )}
        <button type="button" className="btn btn--glass glass menu-lat__salir" onClick={cerrarSesion}>
          <IconoNav nombre="salir" size={18} />
          Cerrar sesión
        </button>
      </div>
    </dialog>
  )
}

export function PanelLayout({
  titulo,
  permitido,
  children,
}: {
  titulo: string
  permitido: (yo: Yo) => boolean
  children: (yo: Yo) => ReactNode
}) {
  const estado = useYo()
  const location = useLocation()
  const [pestanas, setPestanas] = useState<RegistroPestanas | null>(null)
  const [menu, setMenu] = useState(false)
  const ctx = useMemo(() => ({ registrar: setPestanas }), [])

  useEffect(() => {
    document.title = `${titulo} · Spartacus Fitness Center`
  }, [titulo])

  if (estado.tipo === 'sin-sesion') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  let contenido: ReactNode
  if (estado.tipo === 'cargando') {
    contenido = (
      <div className="card glass panel-msg" aria-live="polite">
        <span className="auth__spinner" aria-hidden="true" /> Cargando…
      </div>
    )
  } else if (estado.tipo === 'error') {
    contenido = <div className="card glass panel-msg"><p className="auth__error" role="alert">{estado.msg}</p></div>
  } else if (!permitido(estado.yo)) {
    contenido = (
      <div className="card glass panel-msg">
        <h1 className="h3">Sin acceso</h1>
        <p>Tu cuenta no tiene permiso para ver esta sección.</p>
        <Link className="btn btn--red" to="/panel">Ir a mi panel</Link>
      </div>
    )
  } else {
    contenido = children(estado.yo)
  }

  const yo = estado.tipo === 'listo' ? estado.yo : null
  const { propias, operar } = yo ? secciones(yo) : { propias: [], operar: [] }

  // Barra inferior del celular: las pestañas principales de esta pantalla (o, si no tiene, las secciones).
  const marcadas = pestanas?.items.filter((t) => t.principal) ?? []
  const principales = pestanas ? (marcadas.length ? marcadas : pestanas.items).slice(0, 4) : []
  const resto = pestanas ? pestanas.items.filter((t) => !principales.includes(t)) : []
  const seccionesAbajo = pestanas ? [] : [...propias, ...operar].slice(0, 4)

  return (
    <NavPanelCtx.Provider value={ctx}>
      <Background />
      <header className="nav glass panel-nav">
        <Link className="nav__mark" to="/">
          <img src="/images/logos/casco-oscuro.png" alt="" width={34} height={27} />
          Spartacus
        </Link>
        {yo && (propias.length > 1 || operar.length > 0) && (
          <nav aria-label="Secciones del panel" className="panel-nav__arriba">
            <ul className="panel-nav__links">
              {propias.map((e) => (
                <li key={e.to}>
                  <NavLink to={e.to} className="panel-nav__link">
                    <IconoNav nombre={e.icono} />
                    <span>{e.texto}</span>
                  </NavLink>
                </li>
              ))}
              {operar.length > 0 && (
                <li>
                  <OperarComo items={operar} />
                </li>
              )}
            </ul>
          </nav>
        )}
        <div className="nav__end panel-nav__fin">
          {yo && <span className="panel-nav__user">{yo.nombre ?? yo.email}</span>}
          <button type="button" className="btn btn--glass btn--sm glass panel-nav__salir" onClick={cerrarSesion}>
            <IconoNav nombre="salir" size={18} />
            <span>Salir</span>
          </button>
        </div>
      </header>
      <main className={`panel wrap ${yo ? 'panel--con-barra' : ''}`}>{contenido}</main>

      {yo && (
        <>
          <nav aria-label="Navegación principal" className="app-barra glass">
            <ul>
              {principales.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`app-barra__item ${pestanas!.valor === t.id ? 'active' : ''}`}
                    aria-current={pestanas!.valor === t.id ? 'page' : undefined}
                    aria-label={t.texto}
                    onClick={() => {
                      pestanas!.onCambio(t.id)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <span className="app-barra__icono">
                      <IconoNav nombre={t.icono} size={22} />
                      {!!t.aviso && <span className="ptab__aviso">{t.aviso}</span>}
                    </span>
                    <span className="app-barra__texto">{t.texto.split(' ')[0]}</span>
                  </button>
                </li>
              ))}
              {seccionesAbajo.map((s) => (
                <li key={s.to}>
                  <NavLink to={s.to} className="app-barra__item" aria-label={s.texto}>
                    <span className="app-barra__icono">
                      <IconoNav nombre={s.icono} size={22} />
                    </span>
                    <span className="app-barra__texto">{s.corto}</span>
                  </NavLink>
                </li>
              ))}
              <li>
                <button type="button" className={`app-barra__item ${menu ? 'active' : ''}`} aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}>
                  <span className="app-barra__icono">
                    <IconoNav nombre="menu" size={22} />
                  </span>
                  <span className="app-barra__texto">Menú</span>
                </button>
              </li>
            </ul>
          </nav>
          <MenuLateral abierto={menu} onCerrar={() => setMenu(false)} yo={yo} propias={propias} operar={operar} resto={resto} pestanas={pestanas} />
        </>
      )}
    </NavPanelCtx.Provider>
  )
}

/** /panel → la sección que le corresponde a cada persona. */
export function PanelInicio() {
  const estado = useYo()
  if (estado.tipo === 'sin-sesion') return <Navigate to="/login?next=%2Fpanel" replace />
  if (estado.tipo !== 'listo') {
    return (
      <PanelLayout titulo="Panel" permitido={() => true}>
        {() => null}
      </PanelLayout>
    )
  }
  const yo = estado.yo
  const destino = tiene(yo, 'admin', 'encargado') ? '/admin' : tiene(yo, 'recepcion') ? '/recepcion' : tiene(yo, 'coach') ? '/coach' : '/mi-membresia'
  return <Navigate to={destino} replace />
}
