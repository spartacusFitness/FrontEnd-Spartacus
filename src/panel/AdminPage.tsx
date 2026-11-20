import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, type Yo } from '../auth/api'
import { DashboardTab } from './DashboardTab'
import { BotonesEdicion, EnModal, ModalEdicion, Pestanas, hayCambios, useEspejo, useVerMas } from './Navegacion'
import { PanelLayout, sedesDe, tiene } from './PanelLayout'
import { ProductosTab, PromocionesTab } from './TiendaAdmin'
import { aCentavos, api, fechaLarga, horaMx, pesos, type Coach, type DiaCerrado, type EntradaBitacora, type Plan, type Recepcionista, type Sede } from './api'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')

/** Botón/acción con estado de carga y mensaje de error/éxito. */
function useAccion() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const m = await fn()
      if (m) setOk(m)
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }
  useEspejo(ok, error)
  const avisos: ReactNode = null
  return { busy, run, avisos }
}

export default function AdminPage() {
  return (
    <PanelLayout titulo="Administración" permitido={(yo) => tiene(yo, 'admin', 'encargado')}>
      {(yo) => <Admin yo={yo} />}
    </PanelLayout>
  )
}

type Tab = 'dashboard' | 'sede' | 'planes' | 'productos' | 'promociones' | 'recepcion' | 'coaches' | 'bitacora'

function Admin({ yo }: { yo: Yo }) {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeId, setSedeId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [error, setError] = useState<string | null>(null)
  const permitidas = sedesDe(yo, 'admin', 'encargado')

  const recargar = useCallback(() => {
    api
      .sedes()
      .then((s) => {
        const mias = permitidas === null ? s : s.filter((x) => permitidas.includes(x.id))
        setSedes(mias)
        setSedeId((actual) => actual || mias[0]?.id || '')
      })
      .catch((e) => setError(msg(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(recargar, [recargar])

  const sede = sedes.find((s) => s.id === sedeId)

  return (
    <>
      <div className="panel-head">
        <div>
          <h1>Administración</h1>
          <p>{permitidas === null ? 'Administrador: todas las sedes' : 'Encargado de sede'}</p>
        </div>
        {sedes.length > 1 && tab !== 'dashboard' && (
          <label className="field" style={{ minWidth: 240 }}>
            <span className="field__label">Sede</span>
            <select className="select" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}{s.activa === false ? ' (inactiva)' : ''}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="auth__error" role="alert">{error}</p>}

      <Pestanas<Tab>
        etiqueta="Secciones de administración"
        valor={tab}
        onCambio={setTab}
        items={[
          { id: 'dashboard', texto: 'Dashboard', icono: 'dashboard', principal: true },
          { id: 'sede', texto: 'Sede y calendario', icono: 'sede' },
          { id: 'planes', texto: 'Planes', icono: 'planes', principal: true },
          { id: 'productos', texto: 'Productos', icono: 'productos', principal: true },
          { id: 'promociones', texto: 'Promociones', icono: 'promociones', principal: true },
          { id: 'recepcion', texto: 'Recepción', icono: 'recepcion' },
          { id: 'coaches', texto: 'Coaches', icono: 'coaches' },
          { id: 'bitacora', texto: 'Bitácora', icono: 'bitacora' },
        ]}
      />

      {tab === 'dashboard' && sedes.length > 0 && <DashboardTab sedes={sedes} todas={permitidas === null} />}
      {sede && tab === 'productos' && <ProductosTab key={sede.id} sedeId={sede.id} />}
      {sede && tab === 'promociones' && <PromocionesTab key={sede.id} sedeId={sede.id} />}
      {sede && tab === 'sede' && <SedeTab key={sede.id} sede={sede} onGuardada={recargar} esAdmin={permitidas === null} />}
      {sede && tab === 'planes' && <PlanesTab key={sede.id} sedeId={sede.id} />}
      {sede && tab === 'recepcion' && <RecepcionTab key={sede.id} sedeId={sede.id} />}
      {sede && tab === 'coaches' && <CoachesTab key={sede.id} sedeId={sede.id} />}
      {sede && tab === 'bitacora' && <BitacoraTab key={sede.id} sedeId={sede.id} />}
    </>
  )
}

/* ---------------- Sede y calendario ---------------- */

function SedeTab({ sede, onGuardada, esAdmin }: { sede: Sede; onGuardada: () => void; esAdmin: boolean }) {
  const id = useId()
  const [f, setF] = useState({
    nombre: sede.nombre,
    ciudad: sede.ciudad,
    direccion: sede.direccion,
    mapsUrl: sede.mapsUrl ?? '',
    antipassbackMin: String(sede.antipassbackMin ?? 5),
    dias: new Set((sede.diasSinServicio ?? '').split(',').filter(Boolean).map(Number)),
    activa: sede.activa !== false,
  })
  const guardar = useAccion()
  // Edición en modal: se compara contra lo guardado (los días como lista ordenada).
  const [abierto, setAbierto] = useState(false)
  const [orig, setOrig] = useState(f)
  const comparable = (x: typeof f) => ({ ...x, dias: [...x.dias].sort() })
  const cerrar = () => { setF(orig); setAbierto(false) }
  const [dias, setDias] = useState<DiaCerrado[]>([])
  const [nuevo, setNuevo] = useState({ fecha: '', motivo: '' })
  const cal = useAccion()

  const cargarDias = useCallback(() => {
    api.diasCerrados(sede.id).then(setDias).catch(() => {})
  }, [sede.id])
  useEffect(cargarDias, [cargarDias])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    guardar.run(async () => {
      await api.editarSede(sede.id, {
        nombre: f.nombre,
        ciudad: f.ciudad,
        direccion: f.direccion,
        ...(f.mapsUrl ? { mapsUrl: f.mapsUrl } : {}),
        antipassbackMin: Number(f.antipassbackMin),
        diasSinServicio: [...f.dias],
        ...(esAdmin ? { activa: f.activa } : {}),
      })
      setOrig(f)
      setAbierto(false)
      onGuardada()
      return 'Sede guardada.'
    })
  }

  return (
    <div className="grid-2">
      {!abierto && (
        <div className="card glass form">
          <h2 className="h3">Datos de la sede</h2>
          <dl className="dato-lista">
            <div><dt>Nombre</dt><dd>{orig.nombre}</dd></div>
            <div><dt>Ciudad</dt><dd>{orig.ciudad}</dd></div>
            <div><dt>Dirección</dt><dd>{orig.direccion}</dd></div>
            <div><dt>Anti-passback</dt><dd>{orig.antipassbackMin} min</dd></div>
            <div><dt>Sin servicio</dt><dd>{[...orig.dias].sort().map((i) => DIAS[i]).join(', ') || 'Abre todos los días'}</dd></div>
            <div><dt>Estado</dt><dd>{orig.activa ? 'Activa' : 'Inactiva'}</dd></div>
          </dl>
          <button type="button" className="btn btn--red" onClick={() => setAbierto(true)}>Editar datos</button>
        </div>
      )}
      {abierto && (
      <ModalEdicion titulo={`Editar ${orig.nombre}`} onCerrar={cerrar}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${id}-n`}>Nombre</label>
            <input id={`${id}-n`} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor={`${id}-c`}>Ciudad</label>
            <input id={`${id}-c`} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-d`}>Dirección</label>
          <input id={`${id}-d`} value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor={`${id}-m`}>Enlace de Google Maps</label>
          <input id={`${id}-m`} type="url" value={f.mapsUrl} onChange={(e) => setF({ ...f, mapsUrl: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-a`}>Anti-passback (minutos)</label>
          <input id={`${id}-a`} type="number" min={0} max={240} value={f.antipassbackMin} onChange={(e) => setF({ ...f, antipassbackMin: e.target.value })} aria-describedby={`${id}-a-h`} />
          <p id={`${id}-a-h`} className="field__hint">Tiempo en que el mismo socio no puede volver a entrar.</p>
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend className="field__label">Días de la semana sin servicio</legend>
          <div className="dias">
            {DIAS.map((d, i) => (
              <label key={d} className="dia">
                <input
                  type="checkbox"
                  checked={f.dias.has(i)}
                  onChange={(e) => {
                    const next = new Set(f.dias)
                    if (e.target.checked) next.add(i)
                    else next.delete(i)
                    setF({ ...f, dias: next })
                  }}
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        {esAdmin && (
          <label className="check">
            <input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} />
            Sede activa
          </label>
        )}
        {guardar.avisos}
        <BotonesEdicion cambios={hayCambios(comparable(orig), comparable(f))} busy={guardar.busy} onCancelar={cerrar} />
      </form>
      </ModalEdicion>
      )}

      <div className="card glass form">
        <h2 className="h3">Días cerrados</h2>
        <p className="field__hint">Festivos y cierres. Si una membresía vence en uno de estos días, se recorre al siguiente día abierto.</p>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault()
            cal.run(async () => {
              await api.agregarDia(sede.id, nuevo.fecha, nuevo.motivo)
              setNuevo({ fecha: '', motivo: '' })
              cargarDias()
            })
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-f`}>Fecha</label>
            <input id={`${id}-f`} type="date" required value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-mo`}>Motivo</label>
            <input id={`${id}-mo`} required placeholder="Navidad" value={nuevo.motivo} onChange={(e) => setNuevo({ ...nuevo, motivo: e.target.value })} />
          </div>
          <button className="btn btn--glass glass" disabled={cal.busy} style={{ alignSelf: 'end' }}>Agregar</button>
        </form>
        {cal.avisos}
        <div className="lista">
          {dias.length === 0 && <p className="field__hint">Sin días cerrados.</p>}
          {dias.map((d) => (
            <div key={d.id} className="fila">
              <div className="fila__main">
                <strong>{fechaLarga(d.fecha)}</strong>
                <small>{d.motivo}</small>
              </div>
              <button type="button" className="btn btn--glass btn--sm glass" onClick={() => cal.run(async () => { await api.quitarDia(sede.id, d.id); cargarDias() })}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Planes ---------------- */

const PLAN_VACIO = { nombre: '', tipo: 'mes' as Plan['tipo'], duracionDias: '30', precio: '', descripcion: '', pagoEnLinea: true, requiereValidacion: false, renovableEnLinea: true }

function PlanesTab({ sedeId }: { sedeId: string }) {
  const id = useId()
  const [planes, setPlanes] = useState<Plan[]>([])
  const [editando, setEditando] = useState<number | null>(null)
  const [f, setF] = useState(PLAN_VACIO)
  const [orig, setOrig] = useState(PLAN_VACIO)
  const acc = useAccion()
  const cancelar = () => { setEditando(null); setF(PLAN_VACIO) }

  const cargar = useCallback(() => {
    api.planes(sedeId, true).then(setPlanes).catch(() => {})
  }, [sedeId])
  useEffect(cargar, [cargar])

  const editar = (p: Plan) => {
    const datos = {
      nombre: p.nombre,
      tipo: p.tipo,
      duracionDias: String(p.duracionDias),
      precio: String(p.precio / 100),
      descripcion: p.descripcion ?? '',
      pagoEnLinea: p.pagoEnLinea,
      requiereValidacion: p.requiereValidacion,
      renovableEnLinea: p.renovableEnLinea,
    }
    setEditando(p.id)
    setF(datos)
    setOrig(datos)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    acc.run(async () => {
      const data = {
        nombre: f.nombre,
        tipo: f.tipo,
        duracionDias: Number(f.duracionDias),
        precio: aCentavos(f.precio),
        ...(f.descripcion ? { descripcion: f.descripcion } : {}),
        pagoEnLinea: f.pagoEnLinea,
        requiereValidacion: f.requiereValidacion,
        renovableEnLinea: f.renovableEnLinea,
      }
      if (editando) await api.editarPlan(sedeId, editando, data)
      else await api.crearPlan(sedeId, data)
      setEditando(null)
      setF(PLAN_VACIO)
      cargar()
      return editando ? 'Plan actualizado.' : 'Plan creado.'
    })
  }

  return (
    <div className="grid-2">
      <div className="card glass">
        <h2 className="h3">Planes de la sede</h2>
        <div className="lista">
          {planes.length === 0 && <p className="field__hint">Aún no hay planes. Crea el primero.</p>}
          {planes.map((p) => (
            <div key={p.id} className={`fila ${p.activo ? '' : 'fila--off'}`}>
              <div className="fila__main">
                <strong>{p.nombre} · {pesos(p.precio)}</strong>
                <small>
                  {p.duracionDias} {p.duracionDias === 1 ? 'día' : 'días'}
                  {p.requiereValidacion ? ' · requiere credencial' : ''}
                  {p.pagoEnLinea ? ' · se contrata en línea' : ' · solo en recepción'}
                </small>
              </div>
              <div className="fila__acc">
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => editar(p)}>Editar</button>
                <button
                  type="button"
                  className="btn btn--glass btn--sm glass"
                  onClick={() => acc.run(async () => { await api.editarPlan(sedeId, p.id, { activo: !p.activo }); cargar() })}
                >
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <EnModal si={!!editando} titulo={`Editar plan ${orig.nombre}`} onCerrar={cancelar}>
      <form className={editando ? 'form' : 'card glass form'} onSubmit={submit}>
        {!editando && <h2 className="h3">Nuevo plan</h2>}
        <div className="field">
          <label htmlFor={`${id}-n`}>Nombre</label>
          <input id={`${id}-n`} required placeholder="Mensualidad, Convenio prepa…" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${id}-t`}>Tipo</label>
            <select
              id={`${id}-t`}
              className="select"
              value={f.tipo}
              onChange={(e) => {
                const tipo = e.target.value as Plan['tipo']
                setF((prev) => ({
                  ...prev,
                  tipo,
                  duracionDias: { visita: '1', semana: '7', mes: '30', especial: prev.duracionDias }[tipo],
                  ...(tipo === 'especial' ? { requiereValidacion: true, pagoEnLinea: false } : {}),
                }))
              }}
            >
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="especial">Especial (convenio, estudiante)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-d`}>Duración (días)</label>
            <input id={`${id}-d`} type="number" min={1} max={400} required value={f.duracionDias} onChange={(e) => setF({ ...f, duracionDias: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-p`}>Precio (MXN)</label>
            <input id={`${id}-p`} inputMode="decimal" required placeholder="450" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-ds`}>Descripción (opcional)</label>
          <input id={`${id}-ds`} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </div>
        <label className="check"><input type="checkbox" checked={f.pagoEnLinea} onChange={(e) => setF({ ...f, pagoEnLinea: e.target.checked })} /> Se puede contratar desde la app</label>
        <label className="check"><input type="checkbox" checked={f.requiereValidacion} onChange={(e) => setF({ ...f, requiereValidacion: e.target.checked })} /> Requiere revisar credencial o documento</label>
        <label className="check"><input type="checkbox" checked={f.renovableEnLinea} onChange={(e) => setF({ ...f, renovableEnLinea: e.target.checked })} /> Se puede renovar desde la app</label>
        {acc.avisos}
        {editando ? (
          <BotonesEdicion cambios={hayCambios(orig, f)} busy={acc.busy} onCancelar={cancelar} />
        ) : (
          <div className="auth__done-actions">
            <button className="btn btn--red" disabled={acc.busy}>Crear plan</button>
          </div>
        )}
      </form>
      </EnModal>
    </div>
  )
}

/* ---------------- Recepción: cuenta y recepcionistas ---------------- */

function RecepcionTab({ sedeId }: { sedeId: string }) {
  const id = useId()
  const [cuenta, setCuenta] = useState<{ usuario: string; contrasena: string } | null>(null)
  const [lista, setLista] = useState<Recepcionista[]>([])
  const [nuevo, setNuevo] = useState({ nombre: '', pin: '' })
  const [pinNuevo, setPinNuevo] = useState<Record<number, string>>({})
  const accCuenta = useAccion()
  const acc = useAccion()

  const cargar = useCallback(() => {
    api.recepcionistas(sedeId).then(setLista).catch(() => {})
  }, [sedeId])
  useEffect(cargar, [cargar])

  return (
    <div className="grid-2">
      <div className="card glass form">
        <h2 className="h3">Cuenta de recepción</h2>
        <p>La computadora de recepción entra con esta cuenta. Cada recepcionista se identifica después con su PIN.</p>
        {cuenta && (
          <div className="secreto" role="status">
            <span className="field__hint">Usuario</span>
            <code>{cuenta.usuario}</code>
            <span className="field__hint">Contraseña (cópiala ahora; no se vuelve a mostrar)</span>
            <code>{cuenta.contrasena}</code>
            <button type="button" className="btn btn--glass btn--sm glass" onClick={() => navigator.clipboard?.writeText(`${cuenta.usuario}\n${cuenta.contrasena}`)}>Copiar</button>
          </div>
        )}
        {accCuenta.avisos}
        <button
          type="button"
          className="btn btn--red"
          disabled={accCuenta.busy}
          onClick={() =>
            accCuenta.run(async () => {
              const c = await api.cuentaRecepcion(sedeId)
              setCuenta(c)
              return c.nueva ? 'Cuenta creada.' : 'Contraseña restablecida. La anterior ya no sirve.'
            })
          }
        >
          Generar / restablecer contraseña
        </button>
      </div>

      <div className="card glass form">
        <h2 className="h3">Recepcionistas</h2>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault()
            acc.run(async () => {
              await api.crearRecepcionista(sedeId, nuevo.nombre, nuevo.pin)
              setNuevo({ nombre: '', pin: '' })
              cargar()
              return 'Recepcionista agregado.'
            })
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-n`}>Nombre</label>
            <input id={`${id}-n`} required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-p`}>PIN (4 a 6 números)</label>
            <input id={`${id}-p`} required inputMode="numeric" pattern="\d{4,6}" type="password" autoComplete="new-password" value={nuevo.pin} onChange={(e) => setNuevo({ ...nuevo, pin: e.target.value })} />
          </div>
          <button className="btn btn--glass glass" disabled={acc.busy} style={{ alignSelf: 'end' }}>Agregar</button>
        </form>
        {acc.avisos}
        <div className="lista">
          {lista.length === 0 && <p className="field__hint">Agrega a las personas que atienden recepción.</p>}
          {lista.map((r) => (
            <div key={r.id} className={`fila ${r.activo ? '' : 'fila--off'}`}>
              <div className="fila__main">
                <strong>{r.nombre}</strong>
                <small>{!r.activo ? 'Inactivo' : r.bloqueado ? 'PIN bloqueado por intentos fallidos' : 'Activo'}</small>
              </div>
              <div className="fila__acc">
                <input
                  aria-label={`Nuevo PIN para ${r.nombre}`}
                  placeholder="Nuevo PIN"
                  inputMode="numeric"
                  type="password"
                  autoComplete="new-password"
                  style={{ width: 110, minHeight: 40, borderRadius: 12, padding: '0 10px', background: 'rgba(0,0,0,.3)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}
                  value={pinNuevo[r.id] ?? ''}
                  onChange={(e) => setPinNuevo({ ...pinNuevo, [r.id]: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn--glass btn--sm glass"
                  disabled={!pinNuevo[r.id]}
                  onClick={() => acc.run(async () => { await api.editarRecepcionista(sedeId, r.id, { pin: pinNuevo[r.id] }); setPinNuevo({ ...pinNuevo, [r.id]: '' }); cargar(); return `PIN de ${r.nombre} cambiado.` })}
                >
                  Cambiar PIN
                </button>
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => acc.run(async () => { await api.editarRecepcionista(sedeId, r.id, { activo: !r.activo }); cargar() })}>
                  {r.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Coaches ---------------- */

function CoachesTab({ sedeId }: { sedeId: string }) {
  const id = useId()
  const [lista, setLista] = useState<Coach[] | null>(null)
  const [nuevo, setNuevo] = useState({ nombre: '', email: '' })
  const acc = useAccion()
  const cargar = useCallback(() => {
    api.coaches(sedeId).then(setLista).catch(() => setLista([]))
  }, [sedeId])
  useEffect(cargar, [cargar])

  return (
    <div className="grid-2">
      <form
        className="card glass form"
        onSubmit={(e) => {
          e.preventDefault()
          acc.run(async () => {
            const r = await api.crearCoach(sedeId, nuevo.nombre, nuevo.email)
            setNuevo({ nombre: '', email: '' })
            cargar()
            return r.correoEnviado
              ? `Listo. Le enviamos a ${r.email} un correo para crear su contraseña.`
              : `Coach agregado. No se pudo enviar el correo: pídele que entre a "¿La olvidaste?" en el login con ${r.email} para crear su contraseña.`
          })
        }}
      >
        <h2 className="h3">Agregar coach</h2>
        <p>Recibe un correo para crear su contraseña. Si ya tiene cuenta (por ejemplo, también es socio), solo se le agrega el rol de coach. Un coach trabaja en una sola sede.</p>
        <div className="field">
          <label htmlFor={`${id}-n`}>Nombre</label>
          <input id={`${id}-n`} required autoComplete="off" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-e`}>Correo</label>
          <input id={`${id}-e`} required type="email" autoComplete="off" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
        </div>
        {acc.avisos}
        <button className="btn btn--red" disabled={acc.busy}>{acc.busy ? 'Agregando…' : 'Agregar coach'}</button>
      </form>

      <div className="card glass form">
        <h2 className="h3">Coaches de la sede</h2>
        <div className="lista">
          {lista === null && <p className="field__hint">Cargando…</p>}
          {lista?.length === 0 && <p className="field__hint">Todavía no hay coaches en esta sede.</p>}
          {lista?.map((c) => (
            <div key={c.id} className="fila">
              <span className="avatar">{c.fotoUrl ? <img src={c.fotoUrl} alt="" referrerPolicy="no-referrer" /> : (c.nombre ?? c.email)[0].toUpperCase()}</span>
              <div className="fila__main" style={{ flex: 1 }}>
                <strong>{c.nombre ?? c.email}</strong>
                <small>{c.email} · {c.rutinasActivas} {c.rutinasActivas === 1 ? 'rutina activa' : 'rutinas activas'}</small>
              </div>
              <button
                type="button"
                className="btn btn--glass btn--sm glass"
                disabled={acc.busy}
                onClick={() => {
                  if (!window.confirm(`¿Quitar a ${c.nombre ?? c.email} como coach? Su cuenta y las rutinas que hizo se conservan.`)) return
                  acc.run(async () => {
                    await api.quitarCoach(sedeId, c.id)
                    cargar()
                    return 'Coach quitado.'
                  })
                }}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Bitácora ---------------- */

const ACCIONES: Record<string, string> = {
  'turno.abrir': 'Abrió turno',
  'turno.cerrar': 'Cerró turno (corte)',
  'cobro.membresia': 'Cobró membresía',
  'socio.alta': 'Alta de socio',
  'solicitud.crear': 'Solicitud en línea',
  'asistencia.rechazada_passback': 'Entrada rechazada (anti-passback)',
  'asistencia.rechazada_sin_membresia': 'Entrada rechazada (sin membresía)',
  'venta.productos': 'Venta de productos',
  'coach.alta': 'Agregó coach',
  'coach.baja': 'Quitó coach',
  'rutina.guardar': 'Guardó rutina',
  'rutina.quitar': 'Quitó rutina',
  'maquina.crear': 'Agregó máquina',
  'maquina.editar': 'Editó máquina',
  'ejercicio.crear': 'Agregó ejercicio',
  'ejercicio.editar': 'Editó ejercicio',
  'salud.actualizar': 'Actualizó datos de salud',
  'perfil.fisico': 'Actualizó objetivo/estatura',
  'producto.crear': 'Agregó producto',
  'producto.editar': 'Editó producto',
  'inventario.entrada': 'Entrada de mercancía',
  'inventario.ajuste': 'Ajuste de inventario',
  'promocion.crear': 'Creó promoción',
  'promocion.editar': 'Editó promoción',
  'plan.crear': 'Creó plan',
  'plan.editar': 'Editó plan',
  'sede.editar': 'Editó sede',
  'sede.crear': 'Creó sede',
  'dia_cerrado.crear': 'Agregó día cerrado',
  'dia_cerrado.quitar': 'Quitó día cerrado',
  'recepcionista.crear': 'Agregó recepcionista',
  'recepcionista.editar': 'Editó recepcionista',
  'recepcion.crear': 'Creó cuenta de recepción',
  'recepcion.restablecer': 'Restableció contraseña de recepción',
}

function BitacoraTab({ sedeId }: { sedeId: string }) {
  const [filas, setFilas] = useState<EntradaBitacora[] | null>(null)
  const [verFilas, masFilas] = useVerMas(filas ?? [], 25)
  useEffect(() => {
    api.bitacora(sedeId).then(setFilas).catch(() => setFilas([]))
  }, [sedeId])
  return (
    <div className="card glass">
      <h2 className="h3">Bitácora</h2>
      {!filas ? (
        <p className="field__hint">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="field__hint">Sin movimientos todavía.</p>
      ) : (
        <><div style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Acción</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {verFilas.map((b) => (
                <tr key={b.id}>
                  <td>{horaMx(b.createdAt)}</td>
                  <td>{ACCIONES[b.accion] ?? b.accion}</td>
                  <td><small>{resumen(b)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {masFilas}</>
      )}
    </div>
  )
}

function resumen(b: EntradaBitacora): string {
  const d = (b.datos ?? {}) as Record<string, unknown>
  if (b.accion === 'cobro.membresia') return `${d.plan} · ${pesos(Number(d.total))} · ${d.metodo} · hasta ${d.fin}`
  if (b.accion === 'turno.cerrar') return `Esperado ${pesos(Number(d.esperado))} · contado ${pesos(Number(d.efectivoContado))} · diferencia ${pesos(Number(d.diferencia))}`
  if (b.accion === 'turno.abrir') return `Fondo inicial ${pesos(Number(d.efectivoInicial))}`
  if (b.accion === 'socio.alta') return String(d.email ?? '')
  if (b.accion.startsWith('dia_cerrado')) return `${d.fecha ?? ''} ${d.motivo ?? ''}`
  if (b.accion === 'plan.crear') return `${d.nombre} · ${pesos(Number(d.precio))}`
  if (b.accion === 'venta.productos') return `${(d.items as string[] | undefined)?.join(', ') ?? ''} · ${pesos(Number(d.total))} · ${d.metodo}`
  if (b.accion.startsWith('inventario.')) return `${d.producto} · ${Number(d.cantidad) > 0 ? '+' : ''}${d.cantidad} → ${d.stock}${d.motivo ? ` · ${d.motivo}` : ''}`
  return ''
}
