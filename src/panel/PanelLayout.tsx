import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import Background from '../Background'
import { ApiError, salir, yo as cargarYo, type Rol, type Yo } from '../auth/api'
import { supabase } from '../lib/supabase'
import '../auth/auth.css'
import { IconoNav, type IconoUI } from './Navegacion'
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
  const enlaces: { to: string; texto: string; corto: string; icono: IconoUI }[] = yo
    ? [
        ...(tiene(yo, 'admin', 'encargado') ? [{ to: '/admin', texto: 'Administración', corto: 'Admin', icono: 'admin' as const }] : []),
        ...(tiene(yo, 'admin', 'encargado', 'recepcion') ? [{ to: '/recepcion', texto: 'Recepción', corto: 'Recepción', icono: 'recepcion' as const }] : []),
        ...(tiene(yo, 'admin', 'encargado', 'coach') ? [{ to: '/coach', texto: 'Coach', corto: 'Coach', icono: 'coaches' as const }] : []),
        ...(tiene(yo, 'socio') ? [{ to: '/mi-membresia', texto: 'Mi membresía', corto: 'Membresía', icono: 'membresia' as const }] : []),
      ]
    : []
  const links = (clase: string, corto = false) =>
    enlaces.map((e) => (
      <li key={e.to}>
        <NavLink to={e.to} className={clase} aria-label={corto ? e.texto : undefined}>
          <IconoNav nombre={e.icono} />
          <span>{corto ? e.corto : e.texto}</span>
        </NavLink>
      </li>
    ))

  return (
    <>
      <Background />
      <header className="nav glass panel-nav">
        <Link className="nav__mark" to="/">
          <img src="/images/logos/casco-oscuro.png" alt="" width={34} height={27} />
          Spartacus
        </Link>
        {enlaces.length > 1 && (
          <nav aria-label="Secciones del panel" className="panel-nav__arriba">
            <ul className="panel-nav__links">{links('panel-nav__link')}</ul>
          </nav>
        )}
        <div className="nav__end">
          {yo && <span className="panel-nav__user">{yo.nombre ?? yo.email}</span>}
          <button
            type="button"
            className="btn btn--glass btn--sm glass panel-nav__salir"
            onClick={() => salir().finally(() => window.location.assign('/login'))}
          >
            <IconoNav nombre="salir" size={18} />
            <span>Salir</span>
          </button>
        </div>
      </header>
      <main className={`panel wrap ${enlaces.length > 1 ? 'panel--con-barra' : ''}`}>{contenido}</main>
      {enlaces.length > 1 && (
        <nav aria-label="Secciones del panel" className="panel-abajo glass">
          <ul>{links('panel-abajo__link', true)}</ul>
        </nav>
      )}
    </>
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
