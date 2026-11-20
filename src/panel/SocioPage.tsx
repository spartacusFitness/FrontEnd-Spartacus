import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, actualizarPerfil, subirFoto, type Yo } from '../auth/api'
import { AvancePeso, DIAS_LARGO, OBJETIVOS, RachaVista, RutinaVista, SEMANA, equipo, grupo, hoyDia, objetivo } from './Entrenamiento'
import { Icono } from './Icono'
import { IconoNav, Pestanas, avisar, confirmarExito, type IconoUI } from './Navegacion'
import { PanelLayout, tiene } from './PanelLayout'
import { api, fechaLarga, horaMx, pesos, type Catalogo, type FichaEntrenamiento, type MiMembresia, type Nutricion, type Objetivo, type Plan, type Sexo } from './api'

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
    <PanelLayout titulo="Mi app" permitido={(yo) => tiene(yo, 'socio') || !!yo.sede}>
      {(yo) => <MiApp yo={yo} />}
    </PanelLayout>
  )
}

type Tab = 'inicio' | 'rutina' | 'nutricion' | 'pagos' | 'tienda' | 'perfil'

/** Acción con su propio aviso (ok / error) y estado de carga. */
function useAccion() {
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    try {
      const m = await fn()
      if (m) avisar('ok', m)
    } catch (e) {
      avisar('error', msg(e))
    } finally {
      setBusy(false)
    }
  }
  const avisos: ReactNode = null
  return { busy, run, avisos }
}

function MiApp({ yo: yoInicial }: { yo: Yo }) {
  const [yo, setYo] = useState(yoInicial)
  const [tab, setTab] = useState<Tab>('inicio')
  const [m, setM] = useState<MiMembresia | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [ficha, setFicha] = useState<FichaEntrenamiento | null>(null)
  const [nutri, setNutri] = useState<Nutricion | null>(null)
  const esSocio = tiene(yo, 'socio')

  const cargarMembresia = useCallback(() => {
    api.miMembresia().then(setM).catch(() => {})
    if (yo.sede) api.planes(yo.sede.id).then(setPlanes).catch(() => {})
  }, [yo.sede])
  const cargarEntreno = useCallback(() => {
    if (!esSocio) return
    api.miEntrenamiento().then(setFicha).catch(() => {})
    api.miNutricion().then(setNutri).catch(() => {})
  }, [esSocio])
  useEffect(cargarMembresia, [cargarMembresia])
  const activa = !!m?.vigente
  useEffect(() => {
    if (!activa) return
    cargarEntreno()
    api.catalogo().then(setCatalogo).catch(() => {})
  }, [activa, cargarEntreno])

  if (!yo.sede) {
    return (
      <div className="card glass panel-msg">
        <h1 className="h3">Primero tu sede</h1>
        <p>Detecta tu sede más cercana para ver sus planes.</p>
        <Link className="btn btn--red" to="/login">Detectar mi sede</Link>
      </div>
    )
  }

  const nombreCorto = yo.apodo ?? yo.nombre?.split(' ')[0] ?? 'atleta'
  const promosHoy = catalogo?.promociones.length ?? 0
  // Sin membresía vigente todo se ve, pero bloqueado (salvo Pagos y los datos de su cuenta).
  const bloqueada = !!m && !m.vigente
  const icono = (normal: IconoUI): IconoUI => (bloqueada ? 'candado' : normal)

  return (
    <div className="app-socio">
      <div className="panel-head">
        <div>
          <h1>Hola, {nombreCorto}</h1>
          <p>Sede {yo.sede.nombre}</p>
        </div>
      </div>

      <Pestanas<Tab>
        etiqueta="Mi app"
        valor={tab}
        onCambio={setTab}
        items={[
          { id: 'inicio', texto: 'Inicio', icono: 'inicio', principal: true },
          { id: 'rutina', texto: 'Rutina', icono: icono('coaches'), principal: true },
          { id: 'nutricion', texto: 'Nutrición', icono: icono('nutricion'), principal: true },
          { id: 'pagos', texto: 'Pagos', icono: 'membresia', principal: true },
          { id: 'tienda', texto: 'Tienda', icono: icono('venta'), aviso: promosHoy || undefined },
          { id: 'perfil', texto: 'Perfil', icono: 'perfil' },
        ]}
      />

      {tab === 'inicio' && <Inicio m={m} ficha={ficha} nutri={nutri} promosHoy={promosHoy} ir={setTab} bloqueada={bloqueada} />}
      {bloqueada && tab === 'rutina' && <Bloqueado titulo="Mi rutina" incluye={['Tu rutina semanal hecha por tu coach', 'Ejercicios, series, repeticiones y descansos', 'Indicaciones de cada ejercicio']} ir={setTab} />}
      {bloqueada && tab === 'nutricion' && <Bloqueado titulo="Mi nutrición" incluye={['Calorías y macros según tu objetivo', 'Ideas de comidas sin tus alérgenos', 'Consejos para tu objetivo']} ir={setTab} />}
      {bloqueada && tab === 'tienda' && <Bloqueado titulo="Tienda" incluye={['Promociones del día', 'Productos disponibles en tu sede']} ir={setTab} />}
      {!bloqueada && tab === 'rutina' && (
        <div className="card glass form">
          {ficha?.rutina ? <RutinaVista rutina={ficha.rutina} /> : <p>Tu coach todavía no te asigna rutina. Pídesela en tu siguiente visita.</p>}
        </div>
      )}
      {!bloqueada && tab === 'nutricion' && <NutricionVista nutri={nutri} ir={setTab} />}
      {tab === 'pagos' && <Pagos yo={yo} m={m} planes={planes} onCambio={cargarMembresia} />}
      {!bloqueada && tab === 'tienda' && <Tienda catalogo={catalogo} />}
      {tab === 'perfil' && (
        <Perfil
          yo={yo}
          ficha={ficha}
          onYo={setYo}
          onCambio={cargarEntreno}
          bloqueada={bloqueada}
          ir={setTab}
        />
      )}
    </div>
  )
}

/** Función que existe pero requiere membresía: se ve en gris con lo que incluye. */
function Bloqueado({ titulo, incluye, ir, compacto = false }: { titulo: string; incluye: string[]; ir: (t: Tab) => void; compacto?: boolean }) {
  return (
    <div className={`card glass bloqueado ${compacto ? 'bloqueado--compacto' : ''}`}>
      <span className="bloqueado__candado"><IconoNav nombre="candado" size={20} /></span>
      <h2 className="h3">{titulo}</h2>
      <ul className="bloqueado__lista">
        {incluye.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <p className="field__hint">Disponible con tu membresía activa.</p>
      {!compacto && <button type="button" className="btn btn--red" onClick={() => ir('pagos')}>Ver planes</button>}
    </div>
  )
}

/* ---------------- Inicio ---------------- */

function Inicio({ m, ficha, nutri, promosHoy, ir, bloqueada }: { m: MiMembresia | null; ficha: FichaEntrenamiento | null; nutri: Nutricion | null; promosHoy: number; ir: (t: Tab) => void; bloqueada: boolean }) {
  const hoy = hoyDia()
  const rutina = ficha?.rutina
  const deHoy = rutina?.dias.find((d) => d.diaSemana === hoy)
  const siguiente = rutina ? [...SEMANA.slice(SEMANA.indexOf(hoy) + 1), ...SEMANA.slice(0, SEMANA.indexOf(hoy) + 1)].find((d) => rutina.dias.some((x) => x.diaSemana === d)) : undefined
  return (
    <>
      <div className={`card glass inicio-membresia ${m?.vigente ? 'glass--red' : ''}`}>
        <div>
          <span className="field__hint">Mi membresía</span>
          <h2 className="h3">{m ? (m.vigente ? m.vigente.plan : 'Sin membresía activa') : '…'}</h2>
          {m?.vigente ? <p>Vigente hasta el <strong>{fechaLarga(m.vigente.fin)}</strong></p> : m && <p>Elige un plan para empezar a entrenar.</p>}
        </div>
        <button type="button" className={`btn ${m?.vigente ? 'btn--glass glass' : 'btn--white'}`} onClick={() => ir('pagos')}>
          {m?.vigente ? 'Renovar' : 'Ver planes'}
        </button>
      </div>

      {bloqueada && (
        <div className="grid-2">
          <Bloqueado compacto titulo="Mi racha" incluye={['Días seguidos y de la semana']} ir={ir} />
          <Bloqueado compacto titulo="Hoy toca" incluye={['Tu rutina del día']} ir={ir} />
          <Bloqueado compacto titulo="Mi nutrición" incluye={['Calorías y comidas']} ir={ir} />
          <Bloqueado compacto titulo="Comunidad" incluye={['Logros y rachas']} ir={ir} />
        </div>
      )}
      {!bloqueada && (<>

      <div className="grid-2">
        <div className="card glass">
          <h2 className="h3">Mi racha</h2>
          {ficha ? <RachaVista racha={ficha.racha} /> : <p className="field__hint">Cargando…</p>}
        </div>
        <div className="card glass form">
          <h2 className="h3">Hoy toca</h2>
          {!rutina && <p>Aún no tienes rutina. Tu coach te la asigna en tu siguiente visita.</p>}
          {rutina && !deHoy && (
            <p>
              Hoy descansas.{siguiente !== undefined && <> Tu próximo entrenamiento es el <strong>{DIAS_LARGO[siguiente].toLowerCase()}</strong>.</>}
            </p>
          )}
          {deHoy && (
            <>
              <p className="hoy-toca__grupos">{deHoy.categorias.map(grupo).join(' · ') || rutina!.nombre}</p>
              <ol className="hoy-toca">
                {deHoy.ejercicios.map((e, i) => (
                  <li key={i}>
                    <span>{e.nombre}<small>{e.maquina ?? equipo(e.equipo)}</small></span>
                    <strong>{e.series} × {e.repeticiones}</strong>
                  </li>
                ))}
              </ol>
            </>
          )}
          {rutina && <button type="button" className="btn btn--glass glass" onClick={() => ir('rutina')}>Ver rutina de la semana</button>}
        </div>
      </div>

      <div className="grid-2">
        <div className="card glass form">
          <h2 className="h3">Mi nutrición</h2>
          {!nutri && <p className="field__hint">Cargando…</p>}
          {nutri && nutri.calorias === null && (
            <>
              <p>Para calcular tu plan nos falta {nutri.faltan.join(', ')}.</p>
              <button type="button" className="btn btn--red" onClick={() => ir('perfil')}>Completar mi perfil</button>
            </>
          )}
          {nutri?.calorias && (
            <>
              <p>
                <strong className="hero-num">{nutri.calorias.toLocaleString('es-MX')}</strong> <span className="field__hint">kcal al día · {objetivo(ficha?.objetivo ?? null)}</span>
              </p>
              <Macros n={nutri} />
              <button type="button" className="btn btn--glass glass" onClick={() => ir('nutricion')}>Ver mi plan de comidas</button>
            </>
          )}
        </div>
        <div className="card glass form">
          <h2 className="h3">Comunidad</h2>
          <p>Muy pronto: comparte tu racha y tus logros con la comunidad de Spartacus.</p>
          {promosHoy > 0 && (
            <button type="button" className="btn btn--red" onClick={() => ir('tienda')}>
              {promosHoy === 1 ? 'Hay 1 promoción hoy' : `Hay ${promosHoy} promociones hoy`}
            </button>
          )}
        </div>
      </div>
      </>)}
    </>
  )
}

function Macros({ n }: { n: Nutricion }) {
  return (
    <div className="macros">
      <div><strong>{n.proteinaG} g</strong><span>Proteína</span></div>
      <div><strong>{n.carbohidratosG} g</strong><span>Carbohidratos</span></div>
      <div><strong>{n.grasaG} g</strong><span>Grasa</span></div>
      <div><strong>{n.aguaL} L</strong><span>Agua</span></div>
    </div>
  )
}

/* ---------------- Nutrición ---------------- */

function NutricionVista({ nutri, ir }: { nutri: Nutricion | null; ir: (t: Tab) => void }) {
  if (!nutri) return <div className="card glass panel-msg"><span className="auth__spinner" aria-hidden="true" /> Cargando…</div>
  return (
    <>
      <div className="card glass form">
        <h2 className="h3">Mi plan de nutrición</h2>
        <p>{nutri.enfoque}</p>
        {nutri.calorias ? (
          <>
            <p>
              <strong className="hero-num">{nutri.calorias.toLocaleString('es-MX')}</strong> <span className="field__hint">kcal al día</span>
            </p>
            <Macros n={nutri} />
            <p className="field__hint">Actividad: {nutri.actividad} (según tus visitas de las últimas 4 semanas).</p>
          </>
        ) : (
          <>
            <p>Para calcular tus calorías nos falta {nutri.faltan.join(', ')}. Mientras, aquí tienes ideas de comidas.</p>
            <button type="button" className="btn btn--red" onClick={() => ir('perfil')}>Completar mi perfil</button>
          </>
        )}
        {nutri.alergenosEvitados.length > 0 && <p className="tag tag--warn" style={{ justifySelf: 'start' }}>Sin {nutri.alergenosEvitados.join(', ')}</p>}
      </div>

      <div className="grid-2">
        {nutri.comidas.map((c) => (
          <div key={c.momento} className="card glass">
            <h3 className="h3 comida__titulo">{c.momento}</h3>
            <ul className="comida__lista">
              {c.opciones.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="card glass form">
        <h3 className="h3 comida__titulo">Consejos</h3>
        <ul className="comida__lista">
          {nutri.consejos.map((c) => <li key={c}>{c}</li>)}
        </ul>
        {nutri.avisos.map((a) => <p key={a} className="field__hint">{a}</p>)}
      </div>
    </>
  )
}

/* ---------------- Pagos ---------------- */

function Pagos({ yo, m, planes, onCambio }: { yo: Yo; m: MiMembresia | null; planes: Plan[]; onCambio: () => void }) {
  const [elegido, setElegido] = useState<Plan | null>(null)
  const pendiente = m?.solicitudes.find((s) => s.estado === 'pendiente_pago' || s.estado === 'pagada')

  return (
    <>
      <div className="grid-2">
        <div className={`card glass ${m?.vigente ? 'glass--red' : ''}`}>
          <h2 className="h3">{m?.vigente ? m.vigente.plan : 'Sin membresía activa'}</h2>
          {m?.vigente ? <p style={{ fontSize: 20 }}>Vigente hasta el <strong>{fechaLarga(m.vigente.fin)}</strong></p> : <p>Elige un plan y págalo para empezar a entrenar.</p>}
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


      <div className="card glass">
        <h2 className="h3">{m?.vigente ? 'Renovar o cambiar de plan' : 'Planes de tu sede'}</h2>
        {planes.length === 0 && <p className="field__hint">Tu sede todavía no publica sus planes. Pregunta en recepción.</p>}
        <div className="grid-3">
          {planes.map((p) => (
            <div key={p.id} className="kpi glass form">
              <span>{p.nombre}</span>
              <strong>{pesos(p.precio)}</strong>
              <small className="field__hint">
                {p.duracionDias} {p.duracionDias === 1 ? 'día' : 'días'}
                {p.descripcion ? ` · ${p.descripcion}` : ''}
              </small>
              <button type="button" className="btn btn--red btn--sm" onClick={() => setElegido(p)}>
                Ver detalle y pagar
              </button>
            </div>
          ))}
        </div>
        {pendiente && <p className="field__hint" style={{ marginTop: 12 }}>Ya tienes una solicitud pendiente; complétala en recepción.</p>}
      </div>
      {elegido && <PlanModal plan={elegido} yo={yo} m={m} pendiente={!!pendiente} onCerrar={() => setElegido(null)} onCambio={onCambio} />}
    </>
  )
}

/** Desglose de un plan y las dos formas de pagarlo, cada una explicada. */
function PlanModal({ plan, yo, m, pendiente, onCerrar, onCambio }: { plan: Plan; yo: Yo; m: MiMembresia | null; pendiente: boolean; onCerrar: () => void; onCambio: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const soloRecepcion = plan.requiereValidacion || !plan.pagoEnLinea
  const inicio = m?.vigente ? `al terminar tu membresía actual (${fechaLarga(m.vigente.fin)})` : 'el día que pagues'

  const enGym = async () => {
    setBusy(true)
    try {
      const s = await api.solicitar(plan.id, 'mostrador')
      confirmarExito('Plan reservado', `Preséntate en recepción de ${yo.sede!.nombre} antes del ${horaMx(s.venceEn)}.`, `Paga ${pesos(plan.precio)} y tu ${plan.nombre} se activa en ese momento.`)
      onCambio()
      onCerrar()
    } catch (e) {
      avisar('error', msg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} className="modal glass" aria-labelledby="plan-modal-titulo" onClose={onCerrar} onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal__cuerpo">
        <div className="modal__head">
          <h2 id="plan-modal-titulo" className="h3">{plan.nombre}</h2>
          <button type="button" className="icon-btn glass" aria-label="Cerrar" onClick={onCerrar}><IconoNav nombre="cerrar" /></button>
        </div>

        <dl className="desglose">
          <div><dt>Precio</dt><dd>{pesos(plan.precio)}</dd></div>
          <div><dt>Duración</dt><dd>{plan.duracionDias} {plan.duracionDias === 1 ? 'día' : 'días'}</dd></div>
          <div><dt>Sede</dt><dd>{yo.sede?.nombre}</dd></div>
          <div><dt>Empieza</dt><dd>{inicio}</dd></div>
        </dl>
        {plan.descripcion && <p>{plan.descripcion}</p>}
        <p className="field__hint">Si tu último día cae en un día que el gym cierra, se recorre al siguiente día abierto sin costo.</p>

        <div className="pago-opciones">
          <section className="pago-opcion">
            <h3>Pagar en el gym</h3>
            <ol>
              <li>Reserva tu plan aquí; no se cobra nada todavía.</li>
              <li>Tienes <strong>3 días hábiles</strong> para ir a recepción de {yo.sede?.nombre}.</li>
              {plan.requiereValidacion && <li>Lleva tu credencial o documento: recepción lo revisa.</li>}
              <li>Pagas en efectivo o con tarjeta en la terminal.</li>
              <li>Tu membresía se activa en ese momento.</li>
            </ol>
            <button type="button" className="btn btn--red" disabled={busy || pendiente} onClick={enGym}>
              {busy ? 'Reservando…' : 'Reservar y pagar en el gym'}
            </button>
            {pendiente && <p className="field__hint">Ya tienes una reserva pendiente; complétala en recepción.</p>}
          </section>

          <section className={`pago-opcion ${soloRecepcion ? 'pago-opcion--off' : ''}`}>
            <h3>Pagar con tarjeta</h3>
            {soloRecepcion ? (
              <p>Este plan se contrata en recepción{plan.requiereValidacion ? ' porque necesitan revisar tu credencial' : ''}. Las renovaciones sí podrás pagarlas aquí.</p>
            ) : (
              <ol>
                <li>Pagas aquí con tarjeta de forma segura (Stripe); tus datos no pasan por nosotros.</li>
                <li>Tu membresía empieza en cuanto se confirma el pago.</li>
                <li>Si es tu primera vez, pasa a recepción para registrar tu rostro y entrar.</li>
              </ol>
            )}
            <button type="button" className="btn btn--glass glass" disabled>Disponible muy pronto</button>
          </section>
        </div>
      </div>
    </dialog>
  )
}

/* ---------------- Tienda ---------------- */

function Tienda({ catalogo }: { catalogo: Catalogo | null }) {
  if (!catalogo) return <div className="card glass panel-msg"><span className="auth__spinner" aria-hidden="true" /> Cargando…</div>
  if (!catalogo.promociones.length && !catalogo.productos.length) {
    return <div className="card glass panel-msg"><p>Tu sede todavía no publica productos ni promociones.</p></div>
  }
  return (
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
  )
}

/* ---------------- Perfil ---------------- */

function Perfil({ yo, ficha, onYo, onCambio, bloqueada, ir }: { yo: Yo; ficha: FichaEntrenamiento | null; onYo: (y: Yo) => void; onCambio: () => void; bloqueada: boolean; ir: (t: Tab) => void }) {
  const id = useId()
  const [datos, setDatos] = useState({ nombre: yo.nombre ?? '', apodo: yo.apodo ?? '', fechaNacimiento: yo.fechaNacimiento ?? '' })
  const [fisico, setFisico] = useState({ alturaCm: '', objetivo: '' as Objetivo | '', sexo: '' as Sexo | '' })
  const [salud, setSalud] = useState({ condiciones: '', alergias: '' })
  const accFoto = useAccion()
  const accDatos = useAccion()
  const accFisico = useAccion()
  const accSalud = useAccion()
  const accPeso = useAccion()

  useEffect(() => {
    if (!ficha) return
    setFisico({ alturaCm: ficha.alturaCm ? String(ficha.alturaCm) : '', objetivo: ficha.objetivo ?? '', sexo: ficha.sexo ?? '' })
    setSalud({ condiciones: ficha.salud?.condiciones ?? '', alergias: ficha.salud?.alergias ?? '' })
  }, [ficha])

  return (
    <>
      <div className="grid-2">
        <div className="card glass form">
          <h2 className="h3">Mi perfil</h2>
          <div className="socio-head">
            <span className="avatar avatar--lg">{yo.fotoUrl ? <img src={yo.fotoUrl} alt="" referrerPolicy="no-referrer" /> : (yo.nombre ?? '?')[0].toUpperCase()}</span>
            <label className="btn btn--glass btn--sm glass" style={{ cursor: 'pointer' }}>
              {accFoto.busy ? 'Subiendo…' : 'Cambiar foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="visually-hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) accFoto.run(async () => { onYo(await subirFoto(f)); return 'Foto actualizada.' })
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {accFoto.avisos}
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              accDatos.run(async () => {
                onYo(await actualizarPerfil({ nombre: datos.nombre, ...(datos.apodo ? { apodo: datos.apodo } : {}), ...(datos.fechaNacimiento ? { fechaNacimiento: datos.fechaNacimiento } : {}) }))
                onCambio()
                return 'Datos guardados.'
              })
            }}
          >
            <div className="field">
              <label htmlFor={`${id}-n`}>Nombre</label>
              <input id={`${id}-n`} required minLength={2} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor={`${id}-a`}>Apodo (para la comunidad)</label>
                <input id={`${id}-a`} placeholder="Ej. dani.fit" value={datos.apodo} onChange={(e) => setDatos({ ...datos, apodo: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-f`}>Fecha de nacimiento</label>
                <input id={`${id}-f`} type="date" value={datos.fechaNacimiento} onChange={(e) => setDatos({ ...datos, fechaNacimiento: e.target.value })} />
              </div>
            </div>
            {accDatos.avisos}
            <button className="btn btn--glass glass" disabled={accDatos.busy}>Guardar</button>
          </form>
        </div>

        {bloqueada ? (
          <Bloqueado titulo="Mi objetivo" incluye={['Tu objetivo, estatura y sexo para tu plan']} ir={ir} />
        ) : (
        <form
          className="card glass form"
          onSubmit={(e) => {
            e.preventDefault()
            accFisico.run(async () => {
              await api.miFisico({ alturaCm: fisico.alturaCm ? Number(fisico.alturaCm) : null, objetivo: fisico.objetivo || null, sexo: fisico.sexo || null })
              onCambio()
              return 'Guardado. Tu coach ya lo ve y tu plan de nutrición se actualizó.'
            })
          }}
        >
          <h2 className="h3">Mi objetivo</h2>
          <div className="field">
            <label htmlFor={`${id}-o`}>Objetivo</label>
            <select id={`${id}-o`} className="select" value={fisico.objetivo} onChange={(e) => setFisico({ ...fisico, objetivo: e.target.value as Objetivo | '' })}>
              <option value="">Elige tu objetivo</option>
              {OBJETIVOS.map(([k, l, d]) => <option key={k} value={k}>{l} — {d}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor={`${id}-e`}>Estatura (cm)</label>
              <input id={`${id}-e`} inputMode="numeric" pattern="\d{2,3}" placeholder="Ej. 170" value={fisico.alturaCm} onChange={(e) => setFisico({ ...fisico, alturaCm: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-s`}>Sexo</label>
              <select id={`${id}-s`} className="select" value={fisico.sexo} onChange={(e) => setFisico({ ...fisico, sexo: e.target.value as Sexo | '' })}>
                <option value="">Prefiero no decir</option>
                <option value="mujer">Mujer</option>
                <option value="hombre">Hombre</option>
              </select>
            </div>
          </div>
          <p className="field__hint">El sexo solo se usa para calcular tus calorías.</p>
          {accFisico.avisos}
          <button className="btn btn--glass glass" disabled={accFisico.busy}>Guardar</button>
        </form>
        )}
      </div>

      {bloqueada ? (
        <Bloqueado titulo="Mi salud y mi avance" incluye={['Condiciones y alergias que ve tu coach', 'Tu historial de peso con gráfica']} ir={ir} />
      ) : (
      <div className="grid-2">
        <form
          className="card glass form"
          onSubmit={(e) => {
            e.preventDefault()
            accSalud.run(async () => {
              await api.miSalud({ condiciones: salud.condiciones || null, alergias: salud.alergias || null })
              onCambio()
              return 'Guardado.'
            })
          }}
        >
          <h2 className="h3">Mi salud</h2>
          <p className="field__hint">Solo tú y los coaches de tu sede lo ven. Les ayuda a cuidarte, y tus alergias se quitan de tu plan de comidas.</p>
          <div className="field">
            <label htmlFor={`${id}-c`}>Condiciones especiales</label>
            <textarea id={`${id}-c`} rows={3} placeholder="Lesiones, enfermedades, embarazo…" value={salud.condiciones} onChange={(e) => setSalud({ ...salud, condiciones: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-al`}>Alergias</label>
            <input id={`${id}-al`} placeholder="Ej. nuez, lactosa" value={salud.alergias} onChange={(e) => setSalud({ ...salud, alergias: e.target.value })} />
          </div>
          {accSalud.avisos}
          <button className="btn btn--glass glass" disabled={accSalud.busy}>Guardar</button>
        </form>

        <div className="card glass form">
          <h2 className="h3">Mi avance</h2>
          {ficha ? (
            <AvancePeso
              ficha={ficha}
              busy={accPeso.busy}
              onRegistrar={(kg) =>
                accPeso.run(async () => {
                  await api.miPeso(kg)
                  onCambio()
                  return 'Peso registrado.'
                })
              }
            />
          ) : (
            <p className="field__hint">Cargando…</p>
          )}
          {accPeso.avisos}
        </div>
      </div>
      )}
    </>
  )
}
