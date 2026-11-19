import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, type Yo } from '../auth/api'
import { PanelLayout, tiene } from './PanelLayout'
import { Icono } from './Icono'
import { api, fechaLarga, horaMx, pesos, type Catalogo, type MiMembresia, type Plan } from './api'

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')

const ESTADO: Record<string, string> = {
  pendiente_pago: 'Paga en recepción',
  pagada: 'Pagada · preséntate en recepción',
  completada: 'Completada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

export default function SocioPage() {
  return (
    <PanelLayout titulo="Mi membresía" permitido={(yo) => tiene(yo, 'socio') || !!yo.sede}>
      {(yo) => <MiPanel yo={yo} />}
    </PanelLayout>
  )
}

function MiPanel({ yo }: { yo: Yo }) {
  const [m, setM] = useState<MiMembresia | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.miMembresia().then(setM).catch((e) => setError(msg(e)))
    if (yo.sede) api.planes(yo.sede.id).then(setPlanes).catch(() => {})
    api.catalogo().then(setCatalogo).catch(() => {})
  }, [yo.sede])
  useEffect(cargar, [cargar])

  if (!yo.sede) {
    return (
      <div className="card glass panel-msg">
        <h1 className="h3">Primero tu sede</h1>
        <p>Detecta tu sede más cercana para ver sus planes.</p>
        <Link className="btn btn--red" to="/login">Detectar mi sede</Link>
      </div>
    )
  }

  const pendiente = m?.solicitudes.find((s) => s.estado === 'pendiente_pago' || s.estado === 'pagada')

  const pedir = async (plan: Plan) => {
    setBusy(plan.id)
    setError(null)
    setOk(null)
    try {
      const s = await api.solicitar(plan.id, 'mostrador')
      setOk(`Listo. Preséntate en recepción de ${yo.sede!.nombre} antes del ${horaMx(s.venceEn)} para pagar ${pesos(plan.precio)} y activar tu ${plan.nombre}.`)
      cargar()
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="panel-head">
        <div>
          <h1>Mi membresía</h1>
          <p>Sede {yo.sede.nombre}</p>
        </div>
      </div>

      <div className="grid-2">
        <div className={`card glass ${m?.vigente ? 'glass--red' : ''}`}>
          <h2 className="h3">{m?.vigente ? m.vigente.plan : 'Sin membresía activa'}</h2>
          {m?.vigente ? (
            <p style={{ fontSize: 20 }}>Vigente hasta el <strong>{fechaLarga(m.vigente.fin)}</strong></p>
          ) : (
            <p>Elige un plan y págalo en recepción para empezar a entrenar.</p>
          )}
        </div>
        <div className="card glass">
          <h2 className="h3">Mis solicitudes</h2>
          <div className="lista">
            {!m?.solicitudes.length && <p className="field__hint">Aún no has pedido ningún plan.</p>}
            {m?.solicitudes.map((s) => (
              <div key={s.id} className="fila">
                <div className="fila__main">
                  <strong>{s.plan} · {pesos(s.precio)}</strong>
                  <small>{s.estado === 'pendiente_pago' ? `Vence ${horaMx(s.venceEn)}` : ''}</small>
                </div>
                <span className={`tag ${s.estado === 'completada' ? 'tag--ok' : s.estado === 'vencida' ? 'tag--bad' : 'tag--warn'}`}>{ESTADO[s.estado] ?? s.estado}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="auth__error" role="alert">{error}</p>}
      {ok && <p className="auth__ok" role="status">{ok}</p>}

      <div className="card glass">
        <h2 className="h3">{m?.vigente ? 'Renovar o cambiar de plan' : 'Planes de tu sede'}</h2>
        <div className="grid-3">
          {planes.map((p) => (
            <div key={p.id} className="kpi glass form">
              <span>{p.nombre}</span>
              <strong>{pesos(p.precio)}</strong>
              <small className="field__hint">
                {p.duracionDias} {p.duracionDias === 1 ? 'día' : 'días'}
                {p.descripcion ? ` · ${p.descripcion}` : ''}
              </small>
              {p.requiereValidacion || !p.pagoEnLinea ? (
                <p className="field__hint">Se contrata en recepción{p.requiereValidacion ? ' presentando tu credencial o documento' : ''}.</p>
              ) : (
                <>
                  <button type="button" className="btn btn--red btn--sm" disabled={busy !== null || !!pendiente} onClick={() => pedir(p)}>
                    {busy === p.id ? 'Un momento…' : 'Pagar en el gym'}
                  </button>
                  <button type="button" className="btn btn--glass btn--sm glass" disabled title="Muy pronto">
                    Pagar con tarjeta · pronto
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        {pendiente && <p className="field__hint" style={{ marginTop: 12 }}>Ya tienes una solicitud pendiente; complétala en recepción.</p>}
      </div>

      {catalogo && (catalogo.promociones.length > 0 || catalogo.productos.length > 0) && (
        <div className="card glass form">
          <h2 className="h3">Promociones y productos</h2>
          <p className="field__hint">Se pagan en recepción, en efectivo o con tarjeta.</p>
          {catalogo.promociones.length > 0 && (
            <div className="grid-3">
              {catalogo.promociones.map((p) => (
                <article key={p.id} className="kpi glass glass--red form">
                  {p.imagenUrl && <img className="promo-img" src={p.imagenUrl} alt={p.nombre} loading="lazy" />}
                  <span style={{ color: '#fff' }}>Hoy</span>
                  <strong>{p.nombre}</strong>
                  <small>{p.productos.map((x) => `${x.cantidad}× ${x.nombre}`).join(' + ')}</small>
                  <strong>{pesos(p.precio)}</strong>
                  {p.descripcion && <small>{p.descripcion}</small>}
                </article>
              ))}
            </div>
          )}
          <div className="productos-grid">
            {catalogo.productos.map((p) => (
              <div key={p.id} className="prod" style={{ cursor: 'default' }} aria-disabled={!p.disponible}>
                <span className="prod__icono"><Icono nombre={p.icono} /></span>
                <strong>{p.nombre}</strong>
                <small>{p.disponible ? 'Disponible' : 'Agotado'}</small>
                <span>{pesos(p.precio)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
