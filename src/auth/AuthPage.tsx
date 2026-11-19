import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Background from '../Background'
import { distanceKm, sedes } from '../data'
import { getRemember, supabase } from '../lib/supabase'
import {
  ApiError,
  asignarSede,
  entrar,
  entrarConGoogle,
  nuevaContrasena,
  reenviarVerificacion,
  recuperarContrasena,
  registrarDispositivo,
  registrarse,
  salir,
  subirFoto,
  type Rol,
  type Yo,
} from './api'
import './auth.css'

type Mode = 'login' | 'register' | 'recover' | 'reset'

type Locate =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'done'; coords: { lat: number; lng: number }; sede: number; km: number }
  | { state: 'error'; message: string }

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  encargado: 'Encargado de sede',
  recepcion: 'Recepción',
  coach: 'Coach',
  socio: 'Socio',
}

const message = (err: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.') =>
  err instanceof ApiError ? err.message : fallback

/** Botón "Detectar mi sede" y, al detectarla, la tarjeta con la sede asignada. */
function SedeDetector({ loc, onLocate }: { loc: Locate; onLocate: () => void }) {
  if (loc.state === 'done') {
    const s = sedes[loc.sede]
    return (
      <div className="sede-pick glass" aria-live="polite">
        <img src="/images/logos/casco-oscuro.png" alt="" width={40} height={32} />
        <div>
          <strong>Sede {s.name}</strong>
          <span>La más cercana a ti · a {loc.km < 10 ? loc.km.toFixed(1) : Math.round(loc.km)} km</span>
          <small>{s.address}</small>
        </div>
        <button type="button" className="sede-pick__again" onClick={onLocate}>Volver a detectar</button>
      </div>
    )
  }
  return (
    <>
      <button type="button" className="btn btn--glass glass sede-locate" onClick={onLocate} disabled={loc.state === 'loading'}>
        <span className="locate-icon" aria-hidden="true" />
        {loc.state === 'loading' ? 'Buscando tu ubicación…' : 'Detectar mi sede más cercana'}
      </button>
      <p className="field__hint" aria-live="polite">
        {loc.state === 'error' ? loc.message : 'Usamos tu ubicación una sola vez para asignarte la sede más cercana.'}
      </p>
    </>
  )
}

function GoogleMark() {
  // Logotipo "G" de Google, tal como lo piden sus lineamientos para botones de inicio de sesión.
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const id = useId()
  const isLogin = mode === 'login'

  // Intención que trae la persona desde la landing (p. ej. pagar un plan).
  const intentSede = sedes.find((s) => s.id === params.get('sede'))
  const intentPlan = intentSede?.plans.find((p) => p.name.toLowerCase() === params.get('plan'))

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loc, setLoc] = useState<Locate>({ state: 'idle' })
  const [show, setShow] = useState(false)
  const [remember, setRememberState] = useState(getRemember)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [verificar, setVerificar] = useState<string | null>(null)
  const [cuenta, setCuenta] = useState<Yo | null>(null)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const loading = useRef(false)

  useEffect(() => {
    const titles: Record<Mode, string> = {
      login: 'Iniciar sesión',
      register: 'Crear cuenta',
      recover: 'Recuperar contraseña',
      reset: 'Nueva contraseña',
    }
    document.title = `${titles[mode]} · Spartacus Fitness Center`
    setError(null)
    setInfo(null)
  }, [mode])

  // Sesión de Supabase: al cargar (incluido el regreso de Google o del correo) y al cambiar.
  useEffect(() => {
    const cargar = () => {
      if (loading.current) return
      loading.current = true
      registrarDispositivo()
        .then(setCuenta)
        .catch((err) => setError(message(err)))
        .finally(() => {
          loading.current = false
          setChecking(false)
        })
    }

    // Errores que Supabase deja en la URL (enlace vencido, Google cancelado…)
    const q = new URLSearchParams(location.search)
    const h = new URLSearchParams(location.hash.slice(1))
    const urlError = h.get('error_code') ?? q.get('error_code') ?? h.get('error') ?? q.get('error')
    if (urlError) {
      setError(
        urlError === 'otp_expired'
          ? 'El enlace ya expiró o ya se usó. Pide uno nuevo.'
          : 'No pudimos completar el acceso. Inténtalo de nuevo.',
      )
    }

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      if (data.session && mode !== 'reset') cargar()
      else setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setHasSession(!!session)
      if (event === 'PASSWORD_RECOVERY') navigate('/restablecer', { replace: true })
      else if (event === 'SIGNED_IN' && session && mode !== 'reset') cargar()
      else if (event === 'SIGNED_OUT') setCuenta(null)
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  /** Pide la ubicación y calcula la sede más cercana. */
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLoc({ state: 'error', message: 'Tu navegador no permite detectar tu ubicación.' })
      return
    }
    setLoc({ state: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const best = sedes
          .map((s, i) => ({ i, km: distanceKm([coords.lat, coords.lng], s.coords) }))
          .sort((a, b) => a.km - b.km)[0]
        setLoc({ state: 'done', coords, sede: best.i, km: best.km })
        setError(null)
      },
      (err) =>
        setLoc({
          state: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Necesitamos tu ubicación para asignarte la sede más cercana. Actívala en tu navegador (el ícono junto a la dirección) y vuelve a intentarlo.'
              : 'No pudimos obtener tu ubicación. Inténtalo de nuevo.',
        }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await fn()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'register' && loc.state !== 'done') {
      setError('Detecta tu sede más cercana para continuar.')
      return
    }
    run(async () => {
      if (mode === 'login') {
        loading.current = true // evita registrar dos veces (este submit y el evento SIGNED_IN)
        try {
          setCuenta(await entrar(email, password, remember))
        } finally {
          loading.current = false
        }
      } else if (mode === 'register') {
        const r = await registrarse({
          nombre: name,
          email,
          password,
          remember,
          location: (loc as Extract<Locate, { state: 'done' }>).coords,
        })
        if (r === 'verificar') setVerificar(email.trim().toLowerCase())
        else setCuenta(r)
      } else if (mode === 'recover') {
        await recuperarContrasena(email)
        setInfo('Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Revisa también spam.')
      } else if (mode === 'reset') {
        await nuevaContrasena(password)
        setInfo('Listo, tu contraseña se actualizó.')
        loading.current = false
        setCuenta(await registrarDispositivo())
      }
    })
  }

  const google = () =>
    run(() => entrarConGoogle(remember, `/login${location.search}`))

  const cambiarFoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) run(async () => setCuenta(await subirFoto(file)))
  }

  // Si vino desde un panel (/login?next=/recepcion), regresa ahí en cuanto tenga cuenta con sede.
  const next = params.get('next')
  useEffect(() => {
    if (cuenta && (cuenta.sede || cuenta.roles.some((r) => r.rol !== 'socio')) && next?.startsWith('/') && !next.startsWith('//')) {
      navigate(next, { replace: true })
    }
  }, [cuenta, next, navigate])

  const query = location.search
  const primerNombre = cuenta?.nombre?.split(' ')[0]

  let card
  if (checking) {
    card = (
      <div className="auth__done" aria-live="polite">
        <span className="auth__spinner" aria-hidden="true" />
        <h1 id={`${id}-title`} className="auth__title">Un momento…</h1>
      </div>
    )
  } else if (mode === 'reset' && !cuenta) {
    card = hasSession ? (
      <form className="auth__form" onSubmit={submit}>
        <h1 id={`${id}-title`} className="auth__title">Nueva contraseña</h1>
        <div className="field">
          <label htmlFor={`${id}-pass`}>Contraseña nueva</label>
          <input
            id={`${id}-pass`}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby={`${id}-pass-hint`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id={`${id}-pass-hint`} className="field__hint">Mínimo 8 caracteres.</p>
        </div>
        {error && <p className="auth__error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--red auth__submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    ) : (
      <div className="auth__done">
        <h1 id={`${id}-title`} className="auth__title">Enlace no válido</h1>
        <p>{error ?? 'Este enlace para cambiar la contraseña ya expiró o ya se usó.'}</p>
        <Link className="btn btn--red" to="/recuperar">Pedir otro enlace</Link>
      </div>
    )
  } else if (cuenta && !cuenta.sede) {
    card = (
      <div className="auth__done">
        <h1 id={`${id}-title`} className="auth__title">
          {primerNombre ? `${primerNombre}, un último paso` : 'Un último paso'}
        </h1>
        <p>Te asignamos la sede de Spartacus más cercana a ti. Detecta tu ubicación para terminar.</p>
        <div className="auth__step">
          <SedeDetector loc={loc} onLocate={locate} />
        </div>
        {error && <p className="auth__error" role="alert">{error}</p>}
        <button
          type="button"
          className="btn btn--red auth__submit"
          disabled={busy || loc.state !== 'done'}
          onClick={() =>
            run(async () => setCuenta(await asignarSede((loc as Extract<Locate, { state: 'done' }>).coords)))
          }
        >
          {busy ? 'Guardando…' : 'Confirmar mi sede'}
        </button>
      </div>
    )
  } else if (cuenta) {
    card = (
      <div className="auth__done">
        <div className="perfil">
          <label className="perfil__foto" htmlFor={`${id}-foto`} title="Cambiar foto">
            {cuenta.fotoUrl ? (
              <img src={cuenta.fotoUrl} alt="Tu foto de perfil" width={88} height={88} referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden="true">{(primerNombre ?? cuenta.email)[0].toUpperCase()}</span>
            )}
            <span className="perfil__cam">Cambiar</span>
          </label>
          <input id={`${id}-foto`} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={cambiarFoto} />
          <div>
            <h1 id={`${id}-title`} className="auth__title">{primerNombre ? `¡Hola, ${primerNombre}!` : '¡Hola!'}</h1>
            <p className="field__hint">{cuenta.email}</p>
          </div>
        </div>
        {cuenta.sede && (
          <p className="auth__sede">Tu sede: <strong>{cuenta.sede.nombre}</strong></p>
        )}
        {cuenta.roles.length > 0 && (
          <ul className="chips" aria-label="Tus roles">
            {cuenta.roles.map((r) => (
              <li key={`${r.rol}-${r.sedeId}`} className="chip glass">
                {ROL_LABEL[r.rol]}{r.sedeId && r.rol !== 'socio' ? ` · ${sedes.find((s) => s.id === r.sedeId)?.name ?? r.sedeId}` : ''}
              </li>
            ))}
          </ul>
        )}
        {info && <p className="auth__ok" role="status">{info}</p>}
        {error && <p className="auth__error" role="alert">{error}</p>}
        <p className="field__hint">
          {getRemember() ? 'Sesión recordada en este dispositivo por 30 días.' : 'Tu sesión se cerrará al cerrar esta pestaña.'}
        </p>
        <div className="auth__done-actions">
          <Link className="btn btn--red" to="/panel">Ir a mi panel</Link>
          <button type="button" className="btn btn--glass glass" disabled={busy} onClick={() => run(async () => { await salir(); setCuenta(null) })}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  } else if (verificar) {
    card = (
      <div className="auth__done">
        <span className="auth__check auth__check--mail" aria-hidden="true">✉</span>
        <h1 id={`${id}-title`} className="auth__title">Revisa tu correo</h1>
        <p>
          Te enviamos un enlace a <strong>{verificar}</strong> para confirmar tu cuenta. Ábrelo en este mismo dispositivo
          para entrar directo. Si no lo ves, revisa spam.
        </p>
        {info && <p className="auth__ok" role="status">{info}</p>}
        {error && <p className="auth__error" role="alert">{error}</p>}
        <div className="auth__done-actions">
          <button
            type="button"
            className="btn btn--glass glass"
            disabled={busy}
            onClick={() => run(async () => { await reenviarVerificacion(verificar); setInfo('Te enviamos el correo otra vez.') })}
          >
            Reenviar correo
          </button>
          <Link className="btn btn--red" to={`/login${query}`} onClick={() => setVerificar(null)}>Ya lo confirmé</Link>
        </div>
      </div>
    )
  } else if (mode === 'recover') {
    card = (
      <form className="auth__form" onSubmit={submit}>
        <h1 id={`${id}-title`} className="auth__title">Recuperar contraseña</h1>
        <p>Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.</p>
        <div className="field">
          <label htmlFor={`${id}-email`}>Correo electrónico</label>
          <input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {info && <p className="auth__ok" role="status">{info}</p>}
        {error && <p className="auth__error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--red auth__submit" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar enlace'}
        </button>
        <p className="auth__alt"><Link to={`/login${query}`}>Volver a iniciar sesión</Link></p>
      </form>
    )
  } else {
    card = (
      <>
        <div className="auth__switch glass" role="tablist" aria-label="Tipo de acceso">
          <Link role="tab" aria-selected={isLogin} className={isLogin ? 'is-active' : ''} to={`/login${query}`}>Iniciar sesión</Link>
          <Link role="tab" aria-selected={!isLogin} className={!isLogin ? 'is-active' : ''} to={`/registro${query}`}>Crear cuenta</Link>
        </div>

        <h1 id={`${id}-title`} className="auth__title">{isLogin ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h1>

        {intentSede && intentPlan && (
          <p className="auth__intent glass glass--red">
            {isLogin ? 'Inicia sesión' : 'Crea tu cuenta'} para pagar tu <strong>{intentPlan.name}</strong> en Sede {intentSede.name}:{' '}
            <strong>${intentPlan.price}</strong>
          </p>
        )}

        <label className="remember glass" htmlFor={`${id}-remember`}>
          <input
            id={`${id}-remember`}
            type="checkbox"
            checked={remember}
            onChange={(e) => setRememberState(e.target.checked)}
            aria-describedby={`${id}-remember-hint`}
          />
          <span className="remember__box" aria-hidden="true" />
          <span>
            <strong>Recordarme en este dispositivo</strong>
            <small id={`${id}-remember-hint`}>
              {remember ? 'Seguirás con tu sesión iniciada hasta 30 días.' : 'Tu sesión se cierra al cerrar la pestaña.'}
            </small>
          </span>
        </label>

        <button type="button" className="btn-google" disabled={busy} onClick={google}>
          <GoogleMark />
          Continuar con Google
        </button>

        <p className="auth__or"><span>o con tu correo</span></p>

        <form className="auth__form" onSubmit={submit}>
          {!isLogin && (
            <div className="field">
              <label htmlFor={`${id}-name`}>Nombre completo</label>
              <input id={`${id}-name`} name="name" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor={`${id}-email`}>{isLogin ? 'Correo (o usuario de recepción)' : 'Correo electrónico'}</label>
            <input id={`${id}-email`} name="email" type={isLogin ? 'text' : 'email'} autoComplete={isLogin ? 'username' : 'email'} inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <div className="field__row">
              <label htmlFor={`${id}-pass`}>Contraseña</label>
              {isLogin && <Link className="field__link" to={`/recuperar${query}`}>¿La olvidaste?</Link>}
            </div>
            <div className="field__pass">
              <input
                id={`${id}-pass`}
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={isLogin ? undefined : 8}
                aria-describedby={isLogin ? undefined : `${id}-pass-hint`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="field__toggle" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                {show ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {!isLogin && <p id={`${id}-pass-hint`} className="field__hint">Mínimo 8 caracteres.</p>}
          </div>
          {!isLogin && (
            <div className="field" role="group" aria-labelledby={`${id}-sede`}>
              <span id={`${id}-sede`} className="field__label">Tu sede</span>
              <SedeDetector loc={loc} onLocate={locate} />
            </div>
          )}

          {error && <p className="auth__error" role="alert">{error}</p>}

          <button type="submit" className="btn btn--red auth__submit" disabled={busy}>
            {busy ? 'Un momento…' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth__alt">
          {isLogin ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <Link to={`${isLogin ? '/registro' : '/login'}${query}`}>{isLogin ? 'Crea una' : 'Inicia sesión'}</Link>
        </p>
      </>
    )
  }

  return (
    <>
      <Background />
      <header className="nav glass">
        <Link className="nav__mark" to="/">
          <img src="/images/logos/casco-oscuro.png" alt="" width={34} height={27} />
          Spartacus
        </Link>
        <Link className="btn btn--glass btn--sm glass" to="/">← Volver al inicio</Link>
      </header>

      <main className="auth wrap">
        <section className="auth__side" aria-label="Lo que incluye tu cuenta">
          <div className="auth__orb glass">
            <img src="/images/logos/logo-oscuro.png" alt="Spartacus Fitness Center" width={1588} height={1064} />
          </div>
          <h2 className="auth__claim">Tu gym, en el navegador</h2>
          <ul className="auth__perks">
            <li className="glass">Paga visita, semana o mes con tarjeta</li>
            <li className="glass">Lleva tu racha y tus objetivos</li>
            <li className="glass">Rutinas de tu coach o con IA</li>
            <li className="glass">Nutrición y comunidad de tu sede</li>
          </ul>
        </section>

        <section className="auth__card glass" aria-labelledby={`${id}-title`}>
          {card}
        </section>
      </main>
    </>
  )
}
