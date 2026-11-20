import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/api'
import { BotonCrear, BotonesEdicion, IconoNav, ModalEdicion, avisar, confirmarExito, hayCambios, useVerMas } from './Navegacion'
import { api, fechaLarga, horaMx, type Comunidad, type Conversacion, type Mensaje, type RetoAdmin, type RetoInput } from './api'

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fechaCorta = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/* ================= Socio: Comunidad ================= */

export function ComunidadSocio({ onDatos }: { onDatos?: (c: Comunidad) => void }) {
  const [c, setC] = useState<Comunidad | null>(null)
  const [busy, setBusy] = useState(false)
  const cargar = useCallback(() => api.miComunidad().then((x) => { setC(x); onDatos?.(x) }).catch((e) => avisar('error', msg(e))), [onDatos])
  useEffect(() => {
    cargar()
  }, [cargar])
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await cargar()
      avisar('ok', ok)
    } catch (e) {
      avisar('error', msg(e))
    } finally {
      setBusy(false)
    }
  }
  if (!c) return <div className="card glass panel-msg" aria-live="polite"><span className="auth__spinner" aria-hidden="true" /> Cargando…</div>
  const obtenidos = c.logros.filter((l) => l.obtenido).length
  const r = c.ranking
  return (
    <div className="form">
      {/* Retos */}
      <section className="card glass form" aria-labelledby="retos-t">
        <h2 id="retos-t" className="h3">Retos de tu sede</h2>
        {c.retos.length === 0 && <p className="field__hint">Por ahora no hay retos. Cuando tu sede publique uno, aparecerá aquí.</p>}
        <div className="retos">
          {c.retos.map((x) => (
            <article key={x.id} className={`reto ${x.cumplido ? 'is-cumplido' : ''}`}>
              <div className="reto__head">
                <strong>{x.nombre}</strong>
                <small>{fechaCorta(x.desde)} – {fechaCorta(x.hasta)}{x.terminado ? ' · terminado' : ''}</small>
              </div>
              {x.descripcion && <p>{x.descripcion}</p>}
              <p className="field__hint">Meta: venir {x.meta} {x.meta === 1 ? 'día' : 'días'}{x.premio ? ` · Premio: ${x.premio}` : ''}</p>
              {x.inscrito && (
                <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={x.meta} aria-valuenow={Math.min(x.dias, x.meta)} aria-label={`Avance en ${x.nombre}`}>
                  <span style={{ width: `${Math.min(100, (x.dias / x.meta) * 100)}%` }} />
                  <small>{x.cumplido ? `¡Cumplido! ${x.dias} de ${x.meta} días${x.premio ? ' · pide tu premio en recepción' : ''}` : `${x.dias} de ${x.meta} días`}</small>
                </div>
              )}
              {!x.terminado && (
                x.inscrito
                  ? <button type="button" className="btn btn--glass btn--sm glass" disabled={busy} onClick={() => window.confirm(`¿Salir del reto "${x.nombre}"?`) && run(() => api.salirReto(x.id), 'Saliste del reto.')}>Salir del reto</button>
                  : <button type="button" className="btn btn--red btn--sm" disabled={busy} onClick={() => run(() => api.inscribirReto(x.id), `Te inscribiste a "${x.nombre}". Cuentan tus entradas desde el ${fechaCorta(x.desde)}.`)}>Unirme</button>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="grid-2">
        {/* Ranking opcional */}
        <section className="card glass form" aria-labelledby="ranking-t">
          <h2 id="ranking-t" className="h3">Ranking de {MESES[Number(r.mes.slice(5, 7)) - 1]}</h2>
          <p className="field__hint">Días que vino cada quien este mes. Solo aparecen quienes lo activan.</p>
          <label className="check">
            <input type="checkbox" checked={r.participo} disabled={busy} onChange={(e) => run(() => api.miRanking(e.target.checked), e.target.checked ? 'Ya apareces en el ranking.' : 'Ya no apareces en el ranking.')} />
            Aparecer en el ranking como «{r.nombrePublico}»
          </label>
          {r.top.length === 0 ? (
            <p className="field__hint">Todavía nadie aparece este mes.</p>
          ) : (
            <ol className="ranking">
              {r.top.map((x, i) => (
                <li key={i} className={x.soyYo ? 'is-yo' : ''}>
                  <span className="ranking__lugar">{x.lugar}</span>
                  <span className="ranking__nombre">{x.nombre}{x.soyYo ? ' (tú)' : ''}</span>
                  <strong>{x.dias} {x.dias === 1 ? 'día' : 'días'}</strong>
                </li>
              ))}
            </ol>
          )}
          {r.participo && r.miLugar && !r.top.some((x) => x.soyYo) && <p>Vas en el lugar <strong>{r.miLugar.lugar}</strong> de {r.participantes} con {r.miLugar.dias} días.</p>}
          {r.participo && !r.miLugar && <p className="field__hint">Aparecerás cuando registres tu primera entrada del mes.</p>}
        </section>

        {/* Logros */}
        <section className="card glass form" aria-labelledby="logros-t">
          <h2 id="logros-t" className="h3">Mis logros</h2>
          <p className="field__hint">{obtenidos} de {c.logros.length} obtenidos</p>
          <ul className="logros">
            {c.logros.map((l) => (
              <li key={l.clave} className={l.obtenido ? 'is-ok' : ''}>
                <span className="logros__icono" aria-hidden="true"><IconoNav nombre={l.obtenido ? 'comunidad' : 'candado'} size={18} /></span>
                <span className="logros__texto">
                  <strong>{l.titulo}</strong>
                  <small>{l.descripcion}{!l.obtenido && l.meta > 1 ? ` · ${l.actual} de ${l.meta}` : ''}</small>
                </span>
                <span className="visually-hidden">{l.obtenido ? 'Obtenido' : 'Pendiente'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

/* ================= Chat (socio ↔ coaches) ================= */

/** Conversación con recarga cada 20 s mientras está abierta. */
export function Chat({ cargar, enviar, soyCoach, aviso }: { cargar: () => Promise<Mensaje[]>; enviar: (t: string) => Promise<unknown>; soyCoach: boolean; aviso?: string }) {
  const id = useId()
  const [msgs, setMsgs] = useState<Mensaje[] | null>(null)
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const fin = useRef<HTMLDivElement>(null)
  const refrescar = useCallback(() => cargar().then(setMsgs).catch(() => setMsgs((m) => m ?? [])), [cargar])
  useEffect(() => {
    refrescar()
    const t = setInterval(refrescar, 20_000)
    return () => clearInterval(t)
  }, [refrescar])
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'nearest' })
  }, [msgs?.length])
  const mandar = async (e: FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) return
    setBusy(true)
    try {
      await enviar(texto.trim())
      setTexto('')
      await refrescar()
    } catch (err) {
      avisar('error', msg(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="chat">
      {aviso && <p className="chat__aviso">{aviso}</p>}
      <div className="chat__lista" aria-live="polite">
        {msgs === null && <p className="field__hint">Cargando…</p>}
        {msgs?.length === 0 && <p className="field__hint">{soyCoach ? 'Sin mensajes todavía.' : 'Escribe tu primera pregunta a tu coach.'}</p>}
        {msgs?.map((m) => {
          const mio = m.deCoach === soyCoach
          return (
            <div key={m.id} className={`chat__msg ${mio ? 'is-mio' : ''}`}>
              {!mio && m.deCoach && <small className="chat__autor">{m.autor ?? 'Coach'}</small>}
              <p>{m.texto}</p>
              <small className="chat__hora">{horaMx(m.fecha)}{mio && m.leido ? ' · visto' : ''}</small>
            </div>
          )
        })}
        <div ref={fin} />
      </div>
      <form className="chat__form" onSubmit={mandar}>
        <label htmlFor={`${id}-t`} className="visually-hidden">Mensaje</label>
        <textarea id={`${id}-t`} rows={2} maxLength={1000} placeholder={soyCoach ? 'Escribe tu respuesta…' : 'Escribe tu pregunta…'} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="btn btn--red" disabled={busy || !texto.trim()}>{busy ? 'Enviando…' : 'Enviar'}</button>
      </form>
    </div>
  )
}

export function ChatSocio() {
  const cargar = useCallback(() => api.misMensajes(), [])
  const enviar = useCallback((t: string) => api.escribirCoach(t), [])
  return (
    <div className="card glass form">
      <h2 className="h3">Pregúntale a tu coach</h2>
      <Chat
        cargar={cargar}
        enviar={enviar}
        soyCoach={false}
        aviso="Los coaches responden cuando pueden entre clases, así que la respuesta puede tardar desde minutos hasta un día. Si es urgente o no te han contestado, acércate con tu coach en el gym."
      />
    </div>
  )
}

/* ================= Coach: bandeja de mensajes ================= */

export function MensajesCoach({ sedeId, onSinLeer }: { sedeId: string; onSinLeer?: (n: number) => void }) {
  const [lista, setLista] = useState<Conversacion[] | null>(null)
  const [sel, setSel] = useState<Conversacion | null>(null)
  const cargarBandeja = useCallback(
    () => api.bandejaCoach(sedeId).then((x) => { setLista(x); onSinLeer?.(x.reduce((s, c) => s + c.sinLeer, 0)) }).catch(() => setLista([])),
    [sedeId, onSinLeer],
  )
  useEffect(() => {
    cargarBandeja()
    const t = setInterval(cargarBandeja, 30_000)
    return () => clearInterval(t)
  }, [cargarBandeja])
  const [ver, mas] = useVerMas(lista ?? [], 12)
  const cargar = useCallback(() => (sel ? api.conversacionCoach(sedeId, sel.socioId) : Promise.resolve([])), [sedeId, sel])
  const enviar = useCallback((t: string) => api.contestarSocio(sedeId, sel!.socioId, t), [sedeId, sel])
  return (
    <div className="card glass form">
      <h2 className="h3">Mensajes de socios</h2>
      <p className="field__hint">Cualquier coach de la sede puede contestar. El socio ve el nombre de quien le respondió.</p>
      <div className="lista">
        {lista === null && <p className="field__hint">Cargando…</p>}
        {lista?.length === 0 && <p className="field__hint">Ningún socio ha escrito todavía.</p>}
        {ver.map((c) => (
          <button key={c.socioId} type="button" className="fila" onClick={() => setSel(c)}>
            <span className="fila__main">
              <strong>{c.nombre} {c.sinLeer > 0 && <span className="tag tag--warn">{c.sinLeer} sin leer</span>}</strong>
              <small>{c.deCoach ? 'Tú: ' : ''}{c.ultimo.slice(0, 80)}</small>
            </span>
            <small>{horaMx(c.fecha)}</small>
          </button>
        ))}
      </div>
      {mas}
      {sel && (
        <ModalEdicion titulo={`Chat con ${sel.nombre}`} onCerrar={() => { setSel(null); cargarBandeja() }}>
          <Chat cargar={cargar} enviar={enviar} soyCoach />
        </ModalEdicion>
      )}
    </div>
  )
}

/* ================= Administración: retos ================= */

const RETO_VACIO = { nombre: '', descripcion: '', meta: '12', desde: '', hasta: '', premio: '' }

export function RetosAdmin({ sedeId }: { sedeId: string }) {
  const id = useId()
  const [lista, setLista] = useState<RetoAdmin[] | null>(null)
  const [f, setF] = useState(RETO_VACIO)
  const [orig, setOrig] = useState(RETO_VACIO)
  const [editando, setEditando] = useState<RetoAdmin | null>(null)
  const [creando, setCreando] = useState(false)
  const [detalle, setDetalle] = useState<RetoAdmin | null>(null)
  const [busy, setBusy] = useState(false)
  const cargar = useCallback(() => api.retos(sedeId).then(setLista).catch(() => setLista([])), [sedeId])
  useEffect(() => {
    cargar()
  }, [cargar])
  const cerrar = () => { setCreando(false); setEditando(null); setF(RETO_VACIO) }
  const abrirNuevo = () => { setF(RETO_VACIO); setOrig(RETO_VACIO); setEditando(null); setCreando(true) }
  const abrirEditar = (r: RetoAdmin) => {
    const d = { nombre: r.nombre, descripcion: r.descripcion ?? '', meta: String(r.meta), desde: r.desde, hasta: r.hasta, premio: r.premio ?? '' }
    setDetalle(null)
    setF(d)
    setOrig(d)
    setEditando(r)
  }
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await cargar()
      return ok
    } catch (e) {
      avisar('error', msg(e))
      return null
    } finally {
      setBusy(false)
    }
  }
  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const data: RetoInput = { nombre: f.nombre, descripcion: f.descripcion || null, meta: Number(f.meta), desde: f.desde, hasta: f.hasta, premio: f.premio || null }
    const ok = await run(() => (editando ? api.editarReto(sedeId, editando.id, data) : api.crearReto(sedeId, data)), editando ? 'Reto actualizado.' : 'Reto publicado.')
    if (ok) {
      if (editando) avisar('ok', ok)
      else confirmarExito('Reto publicado', `"${data.nombre}" ya aparece en la app de los socios de la sede.`)
      cerrar()
    }
  }
  const [ver, mas] = useVerMas(lista ?? [], 8)
  const hoy = new Date().toISOString().slice(0, 10)
  return (
    <div className="card glass form">
      <div className="lista-head">
        <h2 className="h3">Retos</h2>
        <BotonCrear texto="Nuevo reto" onClick={abrirNuevo} />
      </div>
      <p className="field__hint">Retos de asistencia: los socios se inscriben desde su app y cuentan sus días con entrada permitida. Aquí ves quién lo cumplió para entregar el premio en recepción.</p>
      <div className="lista">
        {lista === null && <p className="field__hint">Cargando…</p>}
        {lista?.length === 0 && <p className="field__hint">Crea el primero, por ejemplo "Noviembre: 16 visitas".</p>}
        {ver.map((r) => (
          <button key={r.id} type="button" className={`fila ${r.activo ? '' : 'fila--off'}`} onClick={() => setDetalle(r)}>
            <span className="fila__main">
              <strong>{r.nombre}</strong>
              <small>{fechaCorta(r.desde)} – {fechaCorta(r.hasta)} · meta {r.meta} días{r.activo ? '' : ' · oculto'}</small>
            </span>
            <span className="fila__acc">
              <span className="tag">{r.inscritos} inscritos</span>
              {r.cumplieron.length > 0 && <span className="tag tag--ok">{r.cumplieron.length} cumplieron</span>}
              {r.hasta < hoy && <span className="tag">Terminado</span>}
            </span>
          </button>
        ))}
      </div>
      {mas}

      {detalle && (
        <ModalEdicion titulo={detalle.nombre} onCerrar={() => setDetalle(null)}>
          <dl className="dato-lista">
            <div><dt>Fechas</dt><dd>{fechaLarga(detalle.desde)} – {fechaLarga(detalle.hasta)}</dd></div>
            <div><dt>Meta</dt><dd>{detalle.meta} días</dd></div>
            <div><dt>Premio</dt><dd>{detalle.premio ?? 'Sin premio'}</dd></div>
            <div><dt>Inscritos</dt><dd>{detalle.inscritos}</dd></div>
          </dl>
          {detalle.descripcion && <p>{detalle.descripcion}</p>}
          <h3 className="h3">Cumplieron ({detalle.cumplieron.length})</h3>
          {detalle.cumplieron.length === 0 ? <p className="field__hint">Nadie todavía.</p> : (
            <ol className="ranking">
              {detalle.cumplieron.map((x, i) => <li key={i}><span className="ranking__lugar">{i + 1}</span><span className="ranking__nombre">{x.nombre}</span><strong>{x.dias} días</strong></li>)}
            </ol>
          )}
          <div className="fila__acc" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn--red btn--sm" onClick={() => abrirEditar(detalle)}>Editar</button>
            <button
              type="button"
              className="btn btn--glass btn--sm glass"
              disabled={busy}
              onClick={async () => {
                const ok = await run(() => api.editarReto(sedeId, detalle.id, { activo: !detalle.activo }), detalle.activo ? 'Reto oculto: ya no aparece en la app.' : 'Reto visible otra vez.')
                if (ok) { avisar('ok', ok); setDetalle(null) }
              }}
            >
              {detalle.activo ? 'Ocultar de la app' : 'Mostrar en la app'}
            </button>
          </div>
        </ModalEdicion>
      )}

      {(creando || editando) && (
        <ModalEdicion titulo={editando ? `Editar ${orig.nombre}` : 'Nuevo reto'} onCerrar={cerrar}>
          <form className="form" onSubmit={guardar}>
            <div className="field">
              <label htmlFor={`${id}-n`}>Nombre</label>
              <input id={`${id}-n`} required minLength={3} placeholder="Noviembre: 16 visitas" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor={`${id}-d`}>Desde</label>
                <input id={`${id}-d`} type="date" required value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-h`}>Hasta</label>
                <input id={`${id}-h`} type="date" required min={f.desde || undefined} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-m`}>Meta (días que debe venir)</label>
                <input id={`${id}-m`} type="number" min={1} max={366} required value={f.meta} onChange={(e) => setF({ ...f, meta: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${id}-p`}>Premio (opcional)</label>
              <input id={`${id}-p`} placeholder="Una proteína gratis" value={f.premio} onChange={(e) => setF({ ...f, premio: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-ds`}>Descripción (opcional)</label>
              <input id={`${id}-ds`} placeholder="Cuentan los días con entrada registrada" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
            </div>
            <BotonesEdicion cambios={hayCambios(orig, f)} busy={busy} onCancelar={cerrar} texto={editando ? 'Guardar cambios' : 'Publicar reto'} />
          </form>
        </ModalEdicion>
      )}
    </div>
  )
}
