import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { appFeatures, base, faqs, sedes, type Sede } from './data'
import { openStatus } from './status'
import SedesMap, { type Focus } from './SedesMap'
import Background from './Background'

const sections = [
  { href: '#mapa', label: 'Mapa' },
  { href: '#historia', label: 'Historia' },
  { href: '#sedes', label: 'Sedes' },
  { href: '#planes', label: 'Planes' },
  { href: '#app', label: 'App' },
  { href: '#preguntas', label: 'Preguntas' },
]

/** Menú lateral para móvil y tableta. */
function Drawer({ open, onClose, onSede, now }: { open: boolean; onClose: () => void; onSede: (i: number) => void; now: Date }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      closeRef.current?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      id="menu"
      className="drawer"
      aria-label="Menú"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="drawer__panel glass">
        <div className="drawer__head">
          <span className="nav__mark">
            <img src="/images/logos/casco-oscuro.png" alt="" width={34} height={27} />
            Spartacus
          </span>
          <button ref={closeRef} type="button" className="icon-btn glass" onClick={onClose} aria-label="Cerrar menú">✕</button>
        </div>
        <nav aria-label="Secciones">
          <ul className="drawer__links">
            {sections.map((s) => (
              <li key={s.href}>
                <a href={s.href} onClick={onClose}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="drawer__label">Ir a una sede</p>
        <ul className="drawer__sedes">
          {sedes.map((s, i) => (
            <li key={s.id}>
              <button type="button" onClick={() => { onClose(); onSede(i) }}>
                <strong>{s.name}</strong>
                <Status sede={s} now={now} />
              </button>
            </li>
          ))}
        </ul>
        <div className="drawer__actions">
          <Link className="btn btn--red" to="/registro" onClick={onClose}>Crear cuenta</Link>
          <Link className="btn btn--glass glass" to="/login" onClick={onClose}>Iniciar sesión</Link>
        </div>
      </div>
    </dialog>
  )
}

/** Re-render periódico para el estado "abierto ahora". */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Marca con .is-in cada [data-reveal] al entrar en pantalla. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    const sweep = () =>
      els.forEach((el) => {
        if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-in')
          io.unobserve(el)
        }
      })
    window.addEventListener('scroll', sweep, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', sweep)
    }
  }, [])
}

function Status({ sede, now }: { sede: Sede; now: Date }) {
  const s = openStatus(sede.week, now)
  return (
    <span className={`status ${s.open ? 'is-open' : ''}`}>
      <span className="status__dot" aria-hidden="true" />
      {s.text}
    </span>
  )
}

const money = (n: number) => `$${n.toLocaleString('es-MX')}`

type Viewer = { sede: number; photo: number } | null

/** Modal de vidrio con las fotos de UNA sede. */
function Lightbox({ viewer, onClose, onMove }: { viewer: Viewer; onClose: () => void; onMove: (d: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (viewer && !d.open) d.showModal()
    if (!viewer && d.open) d.close()
  }, [viewer])

  const sede = viewer ? sedes[viewer.sede] : null
  const photo = sede && viewer ? sede.photos[viewer.photo] : null

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={sede ? `Fotos de la sede ${sede.name}` : 'Fotos'}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onMove(1)
        if (e.key === 'ArrowLeft') onMove(-1)
      }}
    >
      {sede && photo && viewer && (
        <div className="lightbox__card glass">
          <header className="lightbox__head">
            <p className="lightbox__title">Sede {sede.name}</p>
            <p className="lightbox__count">{viewer.photo + 1} / {sede.photos.length}</p>
            <button type="button" className="icon-btn glass" onClick={onClose} aria-label="Cerrar">✕</button>
          </header>
          <figure className="lightbox__figure">
            <img key={photo.src} src={photo.src} alt={photo.alt} width={photo.w} height={photo.h} />
            <figcaption>{photo.alt}</figcaption>
          </figure>
          <div className="lightbox__nav">
            <button type="button" className="icon-btn glass" onClick={() => onMove(-1)} aria-label="Foto anterior">←</button>
            <div className="lightbox__thumbs">
              {sede.photos.map((ph, i) => (
                <button
                  key={ph.src}
                  type="button"
                  className={`thumb ${i === viewer.photo ? 'is-active' : ''}`}
                  onClick={() => onMove(i - viewer.photo)}
                  aria-label={`Ver foto ${i + 1}`}
                >
                  <img src={ph.src} alt="" width={ph.w} height={ph.h} loading="lazy" />
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn glass" onClick={() => onMove(1)} aria-label="Foto siguiente">→</button>
          </div>
        </div>
      )}
    </dialog>
  )
}

export default function Landing() {
  const now = useNow()
  const [tab, setTab] = useState(0)
  const [focus, setFocus] = useState<Focus>(null)
  const [viewer, setViewer] = useState<Viewer>(null)
  const [menu, setMenu] = useState(false)
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  useReveal()
  useEffect(() => {
    document.title = 'Spartacus Fitness Center'
  }, [])

  const open = (sede: number, photo: number) => setViewer({ sede, photo })
  const close = useCallback(() => setViewer(null), [])
  const move = useCallback(
    (d: number) =>
      setViewer((v) => {
        if (!v) return v
        const n = sedes[v.sede].photos.length
        return { ...v, photo: (v.photo + d + n) % n }
      }),
    [],
  )

  /** Acerca el mapa a una sede. */
  const focusMap = useCallback((i: number, scroll = false) => {
    setFocus({ index: i, nonce: Date.now() })
    setTab(i)
    if (scroll) document.getElementById('mapa')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /** Abre la ficha de una sede. */
  const goSede = useCallback((i: number) => {
    setTab(i)
    document.getElementById('sedes')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const onTabKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    const next = (tab + d + sedes.length) % sedes.length
    setTab(next)
    tabsRef.current[next]?.focus()
  }

  const sede = sedes[tab]

  return (
    <>
      <Background />

      <header className="nav glass">
        <a className="nav__mark" href="#top">
          <img src="/images/logos/casco-oscuro.png" alt="" width={34} height={27} />
          Spartacus
        </a>
        <nav aria-label="Principal">
          <ul className="nav__links">
            {sections.slice(0, 5).map((s) => (
              <li key={s.href}><a href={s.href}>{s.label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="nav__end">
          <Link className="nav__login" to="/login">Iniciar sesión</Link>
          <Link className="btn btn--red btn--sm nav__cta" to="/registro">Crear cuenta</Link>
          <button
            type="button"
            className="burger glass"
            aria-label="Abrir menú"
            aria-expanded={menu}
            aria-controls="menu"
            onClick={() => setMenu(true)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>
      <Drawer open={menu} onClose={() => setMenu(false)} onSede={goSede} now={now} />

      <main id="top">
        {/* 1 · HERO — nombre + logo en círculo con sedes flotantes */}
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero__copy">
            <h1 id="hero-title" className="hero__title">
              Spartacus
              <span>Fitness Center</span>
            </h1>
            <p className="hero__lead" data-reveal>
              Cadena de gimnasios familiar nacida en Dolores Hidalgo. Peso libre, máquinas y cardio en tres sedes de Guanajuato: Dolores, San Felipe y San Luis de la Paz.
            </p>
            <div className="hero__actions" data-reveal>
              <a className="btn btn--red" href="#mapa">Encuentra tu sede</a>
              <Link className="btn btn--glass glass" to="/registro">Crea tu cuenta</Link>
            </div>
          </div>

          <div className="hero__visual" data-reveal>
            <div className="orb">
              <span className="orb__ring" aria-hidden="true" />
              <div className="orb__disc glass">
                <img src="/images/logos/logo-oscuro.png" alt="Logo de Spartacus Fitness Center: casco espartano sobre una barra con discos" width={1588} height={1064} />
              </div>
            </div>
            {sedes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`float-chip float-chip--${i} glass`}
                onClick={() => focusMap(i, true)}
              >
                <img src="/images/logos/casco-oscuro.png" alt="" width={30} height={24} />
                <span>
                  <strong>{s.name}</strong>
                  <Status sede={s} now={now} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 2 · MAPA */}
        <section id="mapa" className="mapsec wrap" aria-labelledby="map-title">
          <div className="section-head" data-reveal>
            <h2 id="map-title" className="h2">¿Dónde entrenas?</h2>
            <p>Toca un casco para ver la sede, o deja que encontremos la más cercana a ti.</p>
          </div>
          <SedesMap focus={focus} onFocus={(i) => focusMap(i)} onOpenSede={goSede} now={now} />
        </section>

        {/* 3 · HISTORIA */}
        <section id="historia" className="story wrap" aria-labelledby="story-title">
          <div className="story__card glass" data-reveal>
            <div className="story__text">
              <h2 id="story-title" className="story__quote">Nunca olvides dónde empezaste</h2>
              <p>
                Spartacus nació en Dolores Hidalgo como el gimnasio de una familia dolorense, y lo sigue siendo: somos una cadena 100% familiar. Lo que empezó en una sola nave hoy son tres sedes en Dolores, San Felipe y San Luis de la Paz.
              </p>
              <p>
                Crecimos, pero la regla no cambió: en recepción te conocen por tu nombre, el primer día alguien te enseña el piso y la frase de la pared de Dolores aplica para todos, también para nosotros.
              </p>
              <ul className="story__facts">
                <li className="glass"><strong>Dolores</strong><span>donde empezó todo</span></li>
                <li className="glass"><strong>3 sedes</strong><span>en Guanajuato</span></li>
                <li className="glass glass--red"><strong>100%</strong><span>familiar</span></li>
              </ul>
            </div>
            <button type="button" className="story__photo" onClick={() => open(0, 4)} aria-label="Ver la foto del cartel en la sede Dolores">
              <img src={sedes[0].photos[4].src} alt={sedes[0].photos[4].alt} width={1200} height={1600} loading="lazy" />
              <span className="story__caption glass">La pared de la sede Dolores · #MásFuerteQueNunca</span>
            </button>
          </div>
        </section>

        {/* 4–6 · SEDES: ficha, qué encontrarás y planes de la sede elegida */}
        <section id="sedes" className="sedes wrap" aria-labelledby="sedes-title">
          <div className="section-head" data-reveal>
            <h2 id="sedes-title" className="h2">Nuestras sedes</h2>
            <p>Todas tienen el equipo completo; cada una tiene lo suyo y sus propios precios.</p>
          </div>

          <div className="tabs-bar">
            <div className="tabs glass" role="tablist" aria-label="Sedes" onKeyDown={onTabKey}>
              {sedes.map((s, i) => (
                <button
                  key={s.id}
                  ref={(el) => { tabsRef.current[i] = el }}
                  type="button"
                  role="tab"
                  id={`tab-${s.id}`}
                  aria-selected={tab === i}
                  aria-controls={`panel-${s.id}`}
                  tabIndex={tab === i ? 0 : -1}
                  className={`tab ${tab === i ? 'is-active' : ''}`}
                  onClick={() => setTab(i)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div key={sede.id} className="sede-panel" role="tabpanel" id={`panel-${sede.id}`} aria-labelledby={`tab-${sede.id}`}>
            {/* Ficha */}
            <div className="sede glass">
              <div className="sede__info">
                <h3 className="sede__name">Sede {sede.name}</h3>
                <a className="sede__address" href={sede.mapsUrl} target="_blank" rel="noreferrer">
                  <span className="pin-icon" aria-hidden="true" />
                  {sede.address}
                </a>
                <div className="sede__status glass"><Status sede={sede} now={now} /></div>
                <dl className="hours">
                  {sede.hoursText.map(([d, h]) => (
                    <div key={d}><dt>{d}</dt><dd>{h}</dd></div>
                  ))}
                </dl>
                <div className="sede__actions">
                  <button type="button" className="btn btn--red" onClick={() => open(tab, 0)}>
                    Ver fotos ({sede.photos.length})
                  </button>
                  <button type="button" className="btn btn--glass glass" onClick={() => focusMap(tab, true)}>
                    Ver en el mapa
                  </button>
                </div>
              </div>

              <div className="gallery">
                {sede.photos.slice(0, 5).map((ph, i) => (
                  <button
                    key={ph.src}
                    type="button"
                    className={`gallery__item gallery__item--${i}`}
                    onClick={() => open(tab, i)}
                    aria-label={`Ampliar: ${ph.alt}`}
                  >
                    <img src={ph.src} alt={ph.alt} width={ph.w} height={ph.h} loading="lazy" />
                    {i === 4 && sede.photos.length > 5 && (
                      <span className="gallery__more glass">+{sede.photos.length - 5}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ¿Qué encontrarás? */}
            <div id="equipo" className="find">
              <div className="find__head glass">
                <h3 className="h3">¿Qué encontrarás en {sede.name}?</h3>
                <p>Todas nuestras sedes cuentan con:</p>
                <ul className="chips">
                  {base.map((b) => <li key={b} className="chip glass">{b}</li>)}
                </ul>
              </div>
              <ul className="find__grid">
                {sede.highlights.map((h) => (
                  <li key={h.title} className="find__item glass">
                    <span className="find__mark" aria-hidden="true" />
                    <h4>{h.title}</h4>
                    <p>{h.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Planes de la sede */}
            <div id="planes" className="plans">
              <h3 className="h3 plans__title">Planes en {sede.name}</h3>
              <div className="plans__grid">
                {sede.plans.map((p, i) => (
                  <article key={p.name} className={`plan glass ${i === 2 ? 'glass--red plan--top' : ''}`}>
                    <h4 className="plan__name">{p.name}</h4>
                    <p className="plan__price">{money(p.price)} <span>{p.name === 'Visita' ? 'por día' : p.name === 'Semana' ? 'por semana' : 'al mes'}</span></p>
                    <ul className="plan__lines">
                      {p.lines.map((l) => <li key={l}>{l}</li>)}
                    </ul>
                    <Link
                      className={`btn ${i === 2 ? 'btn--white' : 'btn--red'} plan__action`}
                      to={`/login?next=pagar&sede=${sede.id}&plan=${p.name.toLowerCase()}`}
                    >
                      Pagar en línea
                    </Link>
                  </article>
                ))}
              </div>
              <p className="plans__note">Precios en pesos mexicanos. También puedes pagar en recepción, en efectivo o con tarjeta.</p>
            </div>
          </div>
        </section>

        {/* 7 · APP + PAGO CON STRIPE */}
        <section id="app" className="app wrap" aria-labelledby="app-title">
          <div className="app__card glass">
            <div className="app__copy" data-reveal>
              <h2 id="app-title" className="h2">Tu gym en el celular</h2>
              <p className="app__lead">
                La app de Spartacus es web: entras desde el navegador de tu celular o computadora, sin descargar nada. Paga tu visita, semana o mes con tarjeta; el pago lo procesa Stripe y tus datos de tarjeta nunca pasan por nuestras manos.
              </p>
              <ul className="app__features">
                {appFeatures.map((f, i) => (
                  <li key={f.title} className={`feature glass ${i === 0 ? 'glass--red' : ''}`}>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </li>
                ))}
              </ul>
              <div className="app__stores">
                <Link className="btn btn--white" to="/registro">Crear mi cuenta</Link>
                <Link className="btn btn--glass glass" to="/login">Ya tengo cuenta</Link>
              </div>
            </div>

            <div className="phones" data-reveal>
              <figure className="phone phone--back">
                <img src="/images/app/inicio.jpg" alt="Pantalla de inicio de la app: racha de 12 días, objetivo, nutrición y rutina del día" width={780} height={1688} loading="lazy" />
              </figure>
              <figure className="phone phone--front">
                <img src="/images/app/pago.jpg" alt="Pantalla de pago de la app: mensualidad de $450 en sede Dolores pagada con tarjeta mediante Stripe" width={780} height={1688} loading="lazy" />
              </figure>
              <div className="phones__badge glass">
                <span className="lock-icon" aria-hidden="true" />
                <span><strong>Pago seguro</strong> con Stripe</span>
              </div>
              <div className="phones__streak glass glass--red">
                <strong>12 días</strong>
                <span>de racha</span>
              </div>
            </div>
          </div>
        </section>

        {/* PREGUNTAS */}
        <section id="preguntas" className="faq wrap" aria-labelledby="faq-title">
          <div className="section-head faq__head">
            <h2 id="faq-title" className="h2">Preguntas</h2>
            <p>Lo que más nos preguntan en recepción.</p>
          </div>
          <div className="faq__list">
            {faqs.map((f, i) => (
              <details key={f.q} className="faq__item glass" open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CIERRE */}
        <section className="close wrap" aria-labelledby="close-title">
          <div className="close__card glass">
            <img className="close__logo" src="/images/logos/logo-blanco.png" alt="" width={1588} height={1064} loading="lazy" />
            <h2 id="close-title" className="close__title">Que este sea tu inicio</h2>
            <p>Ven con ropa cómoda y toalla. Tu primer día un instructor te enseña todo el piso.</p>
            <div className="close__actions">
              <a className="btn btn--white btn--big" href="#mapa">Encuentra tu sede</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer wrap">
        <div className="footer__card glass">
          <img className="footer__logo" src="/images/logos/logo-oscuro.png" alt="Spartacus Fitness Center" width={1588} height={1064} loading="lazy" />
          <div className="footer__row">
            <ul className="footer__places">
              {sedes.map((s, i) => (
                <li key={s.id}>
                  <a href="#sedes" onClick={(e) => { e.preventDefault(); goSede(i) }}>{s.name}</a>
                  <small>{s.address}</small>
                </li>
              ))}
            </ul>
            <ul className="footer__links">
              <li><a href="#mapa">Mapa</a></li>
              <li><a href="#historia">Historia</a></li>
              <li><a href="#planes">Planes</a></li>
              <li><a href="#app">App</a></li>
              <li><a href="#preguntas">Preguntas</a></li>
              <li><a href="#top">Volver arriba</a></li>
            </ul>
          </div>
          <p className="footer__legal">© 2026 Spartacus Fitness Center · Mapa © colaboradores de OpenStreetMap</p>
        </div>
      </footer>

      <Lightbox viewer={viewer} onClose={close} onMove={move} />
    </>
  )
}
