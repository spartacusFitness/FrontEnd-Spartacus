import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { ApiError, type Yo } from '../auth/api'
import { InventarioTab, VentaTab } from './MostradorTienda'
import { Pestanas, useEspejo } from './Navegacion'
import { PanelLayout, sedesDe, tiene } from './PanelLayout'
import {
  aCentavos,
  api,
  fechaLarga,
  horaMx,
  pesos,
  type EstadoRecepcion,
  type Ficha,
  type Plan,
  type Sede,
  type SocioBusqueda,
  type SolicitudRecepcion,
  type Turno,
  type Objetivo,
} from './api'
import { OBJETIVOS } from './Entrenamiento'

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')

export default function RecepcionPage() {
  return (
    <PanelLayout titulo="Recepción" permitido={(yo) => tiene(yo, 'admin', 'encargado', 'recepcion')}>
      {(yo) => <Recepcion yo={yo} />}
    </PanelLayout>
  )
}

type Tab = 'socios' | 'venta' | 'solicitudes' | 'alta' | 'inventario' | 'corte'

function Recepcion({ yo }: { yo: Yo }) {
  const permitidas = sedesDe(yo, 'admin', 'encargado', 'recepcion')
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeId, setSedeId] = useState(permitidas?.[0] ?? '')
  const [estado, setEstado] = useState<EstadoRecepcion | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [tab, setTab] = useState<Tab>('socios')
  const [seleccion, setSeleccion] = useState<{ perfilId: string; planId?: number; solicitudId?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEspejo(null, error)

  useEffect(() => {
    if (permitidas === null) {
      api.sedes().then((s) => {
        setSedes(s)
        setSedeId((a) => a || s[0]?.id || '')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recargar = useCallback(() => {
    if (!sedeId) return
    api.estado(sedeId).then(setEstado).catch((e) => setError(msg(e)))
    api.planes(sedeId).then(setPlanes).catch(() => {})
  }, [sedeId])
  useEffect(recargar, [recargar])

  if (!sedeId) return <div className="card glass">No tienes una sede asignada.</div>

  const abrirFicha = (perfilId: string, planId?: number, solicitudId?: number) => {
    setSeleccion({ perfilId, planId, solicitudId })
    setTab('socios')
  }

  return (
    <>
      <div className="panel-head">
        <div>
          <h1>Recepción {estado?.sede.nombre ?? ''}</h1>
          <p>
            {estado?.turno
              ? `Turno de ${estado.turno.recepcionista} desde ${horaMx(estado.turno.abiertoEn)}`
              : 'Sin turno abierto'}
          </p>
        </div>
        {permitidas === null && sedes.length > 1 && (
          <label className="field" style={{ minWidth: 220 }}>
            <span className="field__label">Sede</span>
            <select className="select" value={sedeId} onChange={(e) => { setSedeId(e.target.value); setSeleccion(null) }}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {estado && !estado.turno && <AbrirTurno sedeId={sedeId} estado={estado} onAbierto={recargar} />}

      {estado?.turno && (
        <>
          <div className="kpis">
            <div className="kpi glass"><span>Efectivo cobrado</span><strong>{pesos(estado.turno.efectivo)}</strong></div>
            <div className="kpi glass"><span>Terminal</span><strong>{pesos(estado.turno.terminal)}</strong></div>
            <div className="kpi glass"><span>Entradas hoy</span><strong>{estado.entradasHoy}</strong></div>
            <div className="kpi glass glass--red"><span>Solicitudes pendientes</span><strong>{estado.solicitudesPendientes}</strong></div>
          </div>

          <Pestanas<Tab>
            etiqueta="Acciones de recepción"
            valor={tab}
            onCambio={setTab}
            items={[
              { id: 'socios', texto: 'Socios', icono: 'socios', principal: true },
              { id: 'venta', texto: 'Venta', icono: 'venta', principal: true },
              { id: 'solicitudes', texto: 'Solicitudes', icono: 'solicitudes', aviso: estado.solicitudesPendientes, principal: true },
              { id: 'alta', texto: 'Alta de socio', icono: 'alta', principal: true },
              { id: 'inventario', texto: 'Inventario', icono: 'inventario' },
              { id: 'corte', texto: 'Corte de turno', icono: 'corte' },
            ]}
          />

          {tab === 'socios' && (
            <SociosTab sedeId={sedeId} planes={planes} seleccion={seleccion} onSeleccion={setSeleccion} onCambio={recargar} />
          )}
          {tab === 'venta' && <VentaTab sedeId={sedeId} onVenta={recargar} />}
          {tab === 'inventario' && <InventarioTab sedeId={sedeId} />}
          {tab === 'solicitudes' && <SolicitudesTab sedeId={sedeId} onCobrar={abrirFicha} />}
          {tab === 'alta' && <AltaTab sedeId={sedeId} onAlta={(id) => abrirFicha(id)} />}
          {tab === 'corte' && <CorteTab sedeId={sedeId} estado={estado} onCerrado={recargar} />}
        </>
      )}
    </>
  )
}

/* ---------------- Abrir turno ---------------- */

function AbrirTurno({ sedeId, estado, onAbierto }: { sedeId: string; estado: EstadoRecepcion; onAbierto: () => void }) {
  const id = useId()
  const [rid, setRid] = useState(estado.recepcionistas[0]?.id ?? 0)
  const [pin, setPin] = useState('')
  const [fondo, setFondo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEspejo(null, error)

  if (!estado.recepcionistas.length) {
    return <div className="card glass">No hay recepcionistas en esta sede. El encargado debe darlos de alta en Administración → Recepción.</div>
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.abrirTurno(sedeId, rid, pin, aCentavos(fondo || '0'))
      onAbierto()
    } catch (err) {
      setError(msg(err))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card glass form" onSubmit={submit} style={{ maxWidth: 520 }}>
      <h2 className="h3">Abrir turno</h2>
      <div className="field">
        <label htmlFor={`${id}-r`}>¿Quién atiende?</label>
        <select id={`${id}-r`} className="select" value={rid} onChange={(e) => setRid(Number(e.target.value))}>
          {estado.recepcionistas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-p`}>Tu PIN</label>
          <input id={`${id}-p`} type="password" inputMode="numeric" autoComplete="off" required pattern="\d{4,6}" value={pin} onChange={(e) => setPin(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-f`}>Efectivo en caja al iniciar</label>
          <input id={`${id}-f`} inputMode="decimal" placeholder="$0" value={fondo} onChange={(e) => setFondo(e.target.value)} />
        </div>
      </div>
      <button className="btn btn--red" disabled={busy}>{busy ? 'Abriendo…' : 'Abrir turno'}</button>
    </form>
  )
}

/* ---------------- Socios: búsqueda + ficha ---------------- */

function SociosTab({
  sedeId,
  planes,
  seleccion,
  onSeleccion,
  onCambio,
}: {
  sedeId: string
  planes: Plan[]
  seleccion: { perfilId: string; planId?: number; solicitudId?: number } | null
  onSeleccion: (s: { perfilId: string; planId?: number; solicitudId?: number } | null) => void
  onCambio: () => void
}) {
  const id = useId()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<SocioBusqueda[]>([])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      api.buscar(sedeId, q).then(setRes).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q, sedeId, version])

  // Tras cobrar o registrar entrada: refresca la lista y los indicadores del turno.
  const cambio = () => {
    setVersion((v) => v + 1)
    onCambio()
  }

  return (
    <div className="grid-2">
      <div className="card glass form">
        <div className="field">
          <label htmlFor={`${id}-q`}>Buscar socio por nombre o correo</label>
          <input id={`${id}-q`} type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. Luis, ana@correo.com" />
        </div>
        <div className="lista">
          {res.length === 0 && <p className="field__hint">{q.length >= 2 ? 'Sin resultados.' : 'Escribe al menos 2 letras.'}</p>}
          {res.map((p) => (
            <button key={p.id} type="button" className={`fila ${seleccion?.perfilId === p.id ? 'is-active' : ''}`} onClick={() => onSeleccion({ perfilId: p.id })}>
              <span className="socio-head">
                <Avatar nombre={p.nombre ?? p.email} foto={p.fotoUrl} />
                <span className="fila__main">
                  <strong>{p.nombre ?? 'Sin nombre'}</strong>
                  <small>{p.email}</small>
                </span>
              </span>
              {p.vigenteHasta ? <span className="tag tag--ok">Hasta {fechaLarga(p.vigenteHasta)}</span> : <span className="tag tag--bad">Sin membresía</span>}
            </button>
          ))}
        </div>
      </div>

      {seleccion ? (
        <FichaSocio key={seleccion.perfilId + (seleccion.solicitudId ?? '')} sedeId={sedeId} planes={planes} seleccion={seleccion} onCambio={cambio} />
      ) : (
        <div className="card glass"><p className="field__hint">Elige un socio para ver su membresía, registrar su entrada o cobrar.</p></div>
      )}
    </div>
  )
}

function Avatar({ nombre, foto, grande }: { nombre: string; foto: string | null; grande?: boolean }) {
  return (
    <span className={`avatar ${grande ? 'avatar--lg' : ''}`} aria-hidden="true">
      {foto ? <img src={foto} alt="" referrerPolicy="no-referrer" /> : nombre[0]?.toUpperCase()}
    </span>
  )
}

const RESULTADO: Record<string, { texto: string; ok: boolean }> = {
  permitida: { texto: 'Entrada permitida', ok: true },
  rechazada_passback: { texto: 'Rechazada: ya entró hace menos de unos minutos (anti-passback)', ok: false },
  rechazada_sin_membresia: { texto: 'Rechazada: no tiene membresía vigente', ok: false },
}

function FichaSocio({
  sedeId,
  planes,
  seleccion,
  onCambio,
}: {
  sedeId: string
  planes: Plan[]
  seleccion: { perfilId: string; planId?: number; solicitudId?: number }
  onCambio: () => void
}) {
  const id = useId()
  const [f, setF] = useState<Ficha | null>(null)
  // Por defecto, el primer plan que no requiere revisar credencial (los especiales se eligen a propósito).
  const [planId, setPlanId] = useState(seleccion.planId ?? planes.find((p) => !p.requiereValidacion)?.id ?? planes[0]?.id ?? 0)
  const [metodo, setMetodo] = useState<'efectivo' | 'terminal'>('efectivo')
  const [credencial, setCredencial] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEspejo(null, error)
  const [banner, setBanner] = useState<{ texto: string; ok: boolean } | null>(null)

  const cargar = useCallback(() => {
    api.ficha(sedeId, seleccion.perfilId).then(setF).catch((e) => setError(msg(e)))
  }, [sedeId, seleccion.perfilId])
  useEffect(cargar, [cargar])

  const plan = planes.find((p) => p.id === planId)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setBanner(null)
    try {
      await fn()
      cargar()
      onCambio()
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!f) return <div className="card glass"><p className="field__hint">{error ?? 'Cargando…'}</p></div>

  return (
    <div className="card glass form">
      <div className="socio-head">
        <Avatar nombre={f.nombre ?? f.email} foto={f.fotoUrl} grande />
        <div className="fila__main">
          <strong style={{ fontSize: 22 }}>{f.nombre ?? 'Sin nombre'}</strong>
          <small>{f.email}</small>
          <span>
            {f.vigente ? <span className="tag tag--ok">{f.vigente.plan} · hasta {fechaLarga(f.vigente.fin)}</span> : <span className="tag tag--bad">Sin membresía vigente</span>}{' '}
            {!f.verificado && <span className="tag tag--warn">Identidad sin revisar</span>}
          </span>
        </div>
      </div>

      {banner && <p className={`banner ${banner.ok ? 'banner--ok' : 'banner--bad'}`} role="status">{banner.texto}</p>}

      <button
        type="button"
        className="btn btn--glass glass"
        disabled={busy}
        onClick={() => run(async () => { const r = await api.entrada(sedeId, f.id); setBanner(RESULTADO[r.resultado]) })}
      >
        Registrar entrada
      </button>

      <h3 className="h3" style={{ fontSize: 22, marginTop: 6 }}>{f.vigente ? 'Renovar' : 'Cobrar membresía'}</h3>
      {seleccion.solicitudId && <p className="tag tag--warn">Completando solicitud en línea #{seleccion.solicitudId}</p>}
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-pl`}>Plan</label>
          <select id={`${id}-pl`} className="select" value={planId} onChange={(e) => { setPlanId(Number(e.target.value)); setCredencial(false) }}>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {pesos(p.precio)}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field__label">Método</span>
          <div className="dias">
            {(['efectivo', 'terminal'] as const).map((m) => (
              <label key={m} className="dia">
                <input type="radio" name={`${id}-m`} checked={metodo === m} onChange={() => setMetodo(m)} />
                {m === 'efectivo' ? 'Efectivo' : 'Terminal'}
              </label>
            ))}
          </div>
        </div>
      </div>
      {plan?.requiereValidacion && (
        <label className="check">
          <input type="checkbox" checked={credencial} onChange={(e) => setCredencial(e.target.checked)} />
          Revisé la credencial o documento que avala este plan
        </label>
      )}
      <button
        type="button"
        className="btn btn--red"
        disabled={busy || !plan}
        onClick={() =>
          run(async () => {
            const r = await api.cobrar(sedeId, {
              perfilId: f.id,
              planId,
              metodo,
              ...(seleccion.solicitudId ? { solicitudId: seleccion.solicitudId } : {}),
              ...(plan?.requiereValidacion ? { credencialValidada: credencial } : {}),
            })
            setBanner({ ok: true, texto: `Cobrado ${pesos(r.total)} (${metodo}). Vigente del ${fechaLarga(r.inicio)} al ${fechaLarga(r.fin)}.` })
          })
        }
      >
        {busy ? 'Un momento…' : `Cobrar ${plan ? pesos(plan.precio) : ''}`}
      </button>

      {f.asistencias.length > 0 && (
        <>
          <h3 className="field__label" style={{ marginTop: 8 }}>Últimas entradas</h3>
          <div className="lista">
            {f.asistencias.slice(0, 5).map((a) => (
              <div key={a.id} className="fila">
                <small>{horaMx(a.fecha)}</small>
                <span className={`tag ${a.resultado === 'permitida' ? 'tag--ok' : 'tag--bad'}`}>{RESULTADO[a.resultado]?.ok ? 'Permitida' : 'Rechazada'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Solicitudes ---------------- */

const ESTADO_SOL: Record<string, { texto: string; cls: string }> = {
  pendiente_pago: { texto: 'Pagará en el gym', cls: 'tag--warn' },
  pagada: { texto: 'Pagada en línea', cls: 'tag--ok' },
  completada: { texto: 'Completada', cls: 'tag--ok' },
  vencida: { texto: 'Vencida', cls: 'tag--bad' },
  cancelada: { texto: 'Cancelada', cls: '' },
}

function SolicitudesTab({ sedeId, onCobrar }: { sedeId: string; onCobrar: (perfilId: string, planId?: number, solicitudId?: number) => void }) {
  const [sols, setSols] = useState<SolicitudRecepcion[] | null>(null)
  useEffect(() => {
    api.solicitudes(sedeId).then(setSols).catch(() => setSols([]))
  }, [sedeId])
  if (!sols) return <div className="card glass"><p className="field__hint">Cargando…</p></div>
  const pendientes = sols.filter((s) => s.estado === 'pendiente_pago' || s.estado === 'pagada')
  const resto = sols.filter((s) => !pendientes.includes(s))
  return (
    <div className="card glass">
      <h2 className="h3">Solicitudes en línea</h2>
      <div className="lista">
        {pendientes.length === 0 && <p className="field__hint">No hay solicitudes por atender.</p>}
        {pendientes.map((s) => (
          <div key={s.id} className="fila">
            <div className="fila__main">
              <strong>{s.socio?.nombre ?? s.socio?.email} · {s.plan?.nombre} {s.plan ? pesos(s.plan.precio) : ''}</strong>
              <small>
                <span className={`tag ${ESTADO_SOL[s.estado].cls}`}>{ESTADO_SOL[s.estado].texto}</span> Vence {horaMx(s.venceEn)}
                {s.plan?.requiereValidacion ? ' · revisar credencial' : ''}
              </small>
            </div>
            {s.socio && (
              <button type="button" className="btn btn--red btn--sm" onClick={() => onCobrar(s.socio!.id, s.plan?.id, s.id)}>
                Atender
              </button>
            )}
          </div>
        ))}
      </div>
      {resto.length > 0 && (
        <>
          <h3 className="field__label" style={{ margin: '18px 0 8px' }}>Recientes</h3>
          <div className="lista">
            {resto.slice(0, 15).map((s) => (
              <div key={s.id} className="fila fila--off">
                <div className="fila__main">
                  <strong>{s.socio?.nombre ?? s.socio?.email} · {s.plan?.nombre}</strong>
                  <small>{horaMx(s.creadaEn)}</small>
                </div>
                <span className={`tag ${ESTADO_SOL[s.estado]?.cls ?? ''}`}>{ESTADO_SOL[s.estado]?.texto ?? s.estado}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Alta en mostrador ---------------- */

function AltaTab({ sedeId, onAlta }: { sedeId: string; onAlta: (perfilId: string) => void }) {
  const id = useId()
  const [f, setF] = useState({ nombre: '', email: '', fechaNacimiento: '', alturaCm: '', pesoKg: '', objetivo: '' as Objetivo | '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEspejo(null, error)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.alta(sedeId, {
        nombre: f.nombre,
        email: f.email,
        ...(f.fechaNacimiento ? { fechaNacimiento: f.fechaNacimiento } : {}),
        ...(f.alturaCm ? { alturaCm: Number(f.alturaCm) } : {}),
        ...(f.pesoKg ? { pesoKg: Number(f.pesoKg.replace(',', '.')) } : {}),
        ...(f.objetivo ? { objetivo: f.objetivo } : {}),
      })
      onAlta(r.id)
    } catch (err) {
      setError(msg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card glass form" onSubmit={submit} style={{ maxWidth: 620 }}>
      <h2 className="h3">Alta de socio en mostrador</h2>
      <p className="field__hint">Revisa su identificación. Le llegará un correo para crear su contraseña y entrar a la app. Después podrás cobrarle su plan.</p>
      <div className="field">
        <label htmlFor={`${id}-n`}>Nombre completo</label>
        <input id={`${id}-n`} required minLength={2} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-e`}>Correo</label>
          <input id={`${id}-e`} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-f`}>Fecha de nacimiento</label>
          <input id={`${id}-f`} type="date" value={f.fechaNacimiento} onChange={(e) => setF({ ...f, fechaNacimiento: e.target.value })} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-a`}>Estatura (cm)</label>
          <input id={`${id}-a`} inputMode="numeric" pattern="d{2,3}" placeholder="Opcional" value={f.alturaCm} onChange={(e) => setF({ ...f, alturaCm: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-p`}>Peso (kg)</label>
          <input id={`${id}-p`} inputMode="decimal" pattern="d{2,3}([.,]d{1,2})?" placeholder="Opcional" value={f.pesoKg} onChange={(e) => setF({ ...f, pesoKg: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-o`}>Objetivo</label>
          <select id={`${id}-o`} className="select" value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value as Objetivo | '' })}>
            <option value="">Lo elige después</option>
            {OBJETIVOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn--red" disabled={busy}>{busy ? 'Registrando…' : 'Dar de alta y cobrar'}</button>
    </form>
  )
}

/* ---------------- Corte de turno ---------------- */

function CorteTab({ sedeId, estado, onCerrado }: { sedeId: string; estado: EstadoRecepcion; onCerrado: () => void }) {
  const id = useId()
  const t = estado.turno!
  const esperado = t.efectivoInicial + t.efectivo
  const [contado, setContado] = useState('')
  const [notas, setNotas] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEspejo(null, error)
  const [hecho, setHecho] = useState<Turno | null>(null)
  const [historial, setHistorial] = useState<Turno[]>([])

  useEffect(() => {
    api.turnos(sedeId).then(setHistorial).catch(() => {})
  }, [sedeId, hecho])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.cerrarTurno(sedeId, pin, aCentavos(contado || '0'), notas || undefined)
      setHecho(r)
      setTimeout(onCerrado, 2500)
    } catch (err) {
      setError(msg(err))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid-2">
      <form className="card glass form" onSubmit={submit}>
        <h2 className="h3">Corte de turno</h2>
        <table className="tabla">
          <tbody>
            <tr><td>Fondo inicial</td><td className="num">{pesos(t.efectivoInicial)}</td></tr>
            <tr><td>Cobrado en efectivo</td><td className="num">{pesos(t.efectivo)}</td></tr>
            <tr><td><strong>Efectivo esperado en caja</strong></td><td className="num"><strong>{pesos(esperado)}</strong></td></tr>
            <tr><td>Cobrado con terminal</td><td className="num">{pesos(t.terminal)}</td></tr>
            <tr><td>Cobros</td><td className="num">{t.cobros}</td></tr>
          </tbody>
        </table>
        {hecho ? (
          <p className={`banner ${hecho.diferencia === 0 ? 'banner--ok' : 'banner--bad'}`} role="status">
            Turno cerrado. {hecho.diferencia === 0 ? 'La caja cuadra.' : `Diferencia: ${pesos(hecho.diferencia ?? 0)} (${(hecho.diferencia ?? 0) < 0 ? 'falta' : 'sobra'}).`}
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor={`${id}-c`}>Efectivo contado en caja</label>
              <input id={`${id}-c`} inputMode="decimal" required value={contado} onChange={(e) => setContado(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-n`}>Notas (opcional)</label>
              <input id={`${id}-n`} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-p`}>PIN de {t.recepcionista}</label>
              <input id={`${id}-p`} type="password" inputMode="numeric" autoComplete="off" required value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
            <button className="btn btn--red" disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar turno'}</button>
          </>
        )}
      </form>
      <div className="card glass">
        <h2 className="h3">Cortes anteriores</h2>
        <div className="lista">
          {historial.filter((h) => h.cerradoEn).slice(0, 10).map((h) => (
            <div key={h.id} className="fila">
              <div className="fila__main">
                <strong>{h.recepcionista}</strong>
                <small>{horaMx(h.abiertoEn)} – {h.cerradoEn ? horaMx(h.cerradoEn) : ''}</small>
              </div>
              <span className={`tag ${h.diferencia === 0 ? 'tag--ok' : 'tag--bad'}`}>
                {h.diferencia === 0 ? 'Cuadró' : pesos(h.diferencia ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
