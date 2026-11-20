import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ApiError, type Yo } from '../auth/api'
import { AvancePeso, DIAS_LARGO, EQUIPOS, GRUPOS, OBJETIVOS, RachaVista, RutinaVista, SEMANA, equipo, grupo, objetivo } from './Entrenamiento'
import { Pestanas, useEspejo, confirmarExito, avisar, useVerMas } from './Navegacion'
import { PanelLayout, sedesDe, tiene } from './PanelLayout'
import { api, type Ejercicio, type Equipo, type FichaEntrenamiento, type GrupoMuscular, type Maquina, type Objetivo, type Rutina, type RutinaInput, type Sede, type SocioCoach } from './api'

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')

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

const iniciales = (n: string | null) => (n ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export default function CoachPage() {
  return (
    <PanelLayout titulo="Coach" permitido={(yo) => tiene(yo, 'admin', 'encargado', 'coach')}>
      {(yo) => <Coach yo={yo} />}
    </PanelLayout>
  )
}

type Tab = 'socios' | 'catalogo'

function Coach({ yo }: { yo: Yo }) {
  const permitidas = sedesDe(yo, 'admin', 'encargado', 'coach')
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeId, setSedeId] = useState('')
  const [tab, setTab] = useState<Tab>('socios')
  const [catalogo, setCatalogo] = useState<{ maquinas: Maquina[]; ejercicios: Ejercicio[] }>({ maquinas: [], ejercicios: [] })

  useEffect(() => {
    api
      .sedes()
      .then((s) => {
        const mias = permitidas === null ? s : s.filter((x) => permitidas.includes(x.id))
        setSedes(mias)
        setSedeId((a) => a || mias[0]?.id || '')
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarCatalogo = useCallback(() => {
    if (sedeId) api.catalogoEntrenamiento(sedeId).then(setCatalogo).catch(() => {})
  }, [sedeId])
  useEffect(cargarCatalogo, [cargarCatalogo])

  const esCoach = tiene(yo, 'coach')
  return (
    <>
      <div className="panel-head">
        <div>
          <h1>Coach</h1>
          <p>{esCoach ? 'Tus socios, sus rutinas y su avance' : 'Rutinas y catálogo de ejercicios de la sede'}</p>
        </div>
        {sedes.length > 1 && (
          <label className="field" style={{ minWidth: 240 }}>
            <span className="field__label">Sede</span>
            <select className="select" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        )}
      </div>
      <Pestanas<Tab>
        etiqueta="Secciones del coach"
        valor={tab}
        onCambio={setTab}
        items={[
          { id: 'socios', texto: 'Socios', icono: 'socios', principal: true },
          { id: 'catalogo', texto: 'Máquinas y ejercicios', icono: 'coaches', principal: true },
        ]}
      />
      {sedeId && tab === 'socios' && <SociosTab key={sedeId} sedeId={sedeId} catalogo={catalogo.ejercicios} irACatalogo={() => setTab('catalogo')} onCatalogo={cargarCatalogo} />}
      {sedeId && tab === 'catalogo' && <CatalogoTab key={sedeId} sedeId={sedeId} catalogo={catalogo} onCambio={cargarCatalogo} />}
    </>
  )
}

/* ================= Socios ================= */

function SociosTab({ sedeId, catalogo, irACatalogo, onCatalogo }: { sedeId: string; catalogo: Ejercicio[]; irACatalogo: () => void; onCatalogo: () => void }) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<SocioCoach[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => api.sociosCoach(sedeId, q).then(setLista).catch(() => setLista([])), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [sedeId, q, version])

  const sinRutina = lista?.filter((s) => !s.tieneRutina).length ?? 0
  const [verSocios, masSocios] = useVerMas(lista ?? [], 12, q)
  return (
    <div className="coach">
      <div className="card glass coach__lista">
        <div className="field">
          <label htmlFor="buscar-socio">Buscar socio</label>
          <input id="buscar-socio" type="search" placeholder="Nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {lista && <p className="field__hint">{lista.length} {lista.length === 1 ? 'socio' : 'socios'}{sinRutina ? ` · ${sinRutina} sin rutina` : ''}</p>}
        <div className="lista">
          {lista === null && <p className="field__hint">Cargando…</p>}
          {lista?.length === 0 && <p className="field__hint">{q ? 'Nadie con ese nombre.' : 'Todavía no hay socios en esta sede.'}</p>}
          {verSocios.map((s) => (
            <button key={s.id} type="button" className={`fila socio-fila ${sel === s.id ? 'is-active' : ''}`} onClick={() => setSel(s.id)} aria-pressed={sel === s.id}>
              <span className="avatar">{s.fotoUrl ? <img src={s.fotoUrl} alt="" referrerPolicy="no-referrer" /> : iniciales(s.nombre)}</span>
              <span className="fila__main">
                <strong>
                  {s.nombre ?? 'Sin nombre'} {!s.tieneRutina && <span className="tag tag--warn">Sin rutina</span>}
                </strong>
                <small>{[s.edad !== null ? `${s.edad} años` : null, objetivo(s.objetivo)].filter(Boolean).join(' · ')}</small>
                <RachaVista racha={s.racha} compacta />
              </span>
            </button>
          ))}
        </div>
        {masSocios}
      </div>
      <div className="coach__ficha">
        {sel ? (
          <FichaCoach key={sel} sedeId={sedeId} perfilId={sel} catalogo={catalogo} irACatalogo={irACatalogo} onCatalogo={onCatalogo} onCambio={() => setVersion((v) => v + 1)} />
        ) : (
          <div className="card glass panel-msg">
            <h2 className="h3">Elige un socio</h2>
            <p>Verás su racha, su objetivo, su avance de peso, sus datos de salud y su rutina.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FichaCoach({ sedeId, perfilId, catalogo, irACatalogo, onCatalogo, onCambio }: { sedeId: string; perfilId: string; catalogo: Ejercicio[]; irACatalogo: () => void; onCatalogo: () => void; onCambio: () => void }) {
  const id = useId()
  const [f, setF] = useState<FichaEntrenamiento | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [salud, setSalud] = useState({ condiciones: '', alergias: '' })
  const [fisico, setFisico] = useState({ alturaCm: '', objetivo: '' as Objetivo | '' })
  const accFisico = useAccion()
  const accSalud = useAccion()
  const accPeso = useAccion()
  const accRutina = useAccion()
  // Propuesta del sistema: el editor se reinicia con ella cada vez que se genera.
  const [propuesta, setPropuesta] = useState<{ rutina: RutinaInput; razones: string[]; n: number } | null>(null)
  const generar = (dias?: number) =>
    accRutina.run(async () => {
      const g = await api.generarRutina(sedeId, perfilId, dias)
      setPropuesta({ rutina: g.rutina, razones: g.razones, n: Date.now() })
      setEditando(true)
      return 'Rutina generada. Revísala, cámbiala si hace falta y acéptala.'
    })
  // Ejercicio escrito a mano por el coach: se agrega al catálogo de la sede.
  const crearEjercicio = async (nombre: string, base: Ejercicio | undefined) => {
    const e = await api.crearEjercicio(sedeId, { nombre, categoria: base?.categoria ?? 'cuerpo_completo', equipo: 'otro', maquinaId: null, series: base?.series ?? 3, repeticiones: base?.repeticiones ?? '10-12', indicaciones: null })
    onCatalogo()
    return e
  }

  const cargar = useCallback(
    () =>
      api
        .fichaCoach(sedeId, perfilId)
        .then((x) => {
          setF(x)
          setSalud({ condiciones: x.salud?.condiciones ?? '', alergias: x.salud?.alergias ?? '' })
          setFisico({ alturaCm: x.alturaCm ? String(x.alturaCm) : '', objetivo: x.objetivo ?? '' })
        })
        .catch((e) => setError(msg(e))),
    [sedeId, perfilId],
  )
  useEffect(() => {
    cargar()
  }, [cargar])

  if (error) return <div className="card glass panel-msg"><p className="auth__error" role="alert">{error}</p></div>
  if (!f) return <div className="card glass panel-msg" aria-live="polite"><span className="auth__spinner" aria-hidden="true" /> Cargando ficha…</div>

  return (
    <div className="ficha">
      <div className="card glass">
        <div className="socio-head">
          <span className="avatar avatar--lg">{f.fotoUrl ? <img src={f.fotoUrl} alt="" referrerPolicy="no-referrer" /> : iniciales(f.nombre)}</span>
          <div>
            <h2 className="h3">{f.nombre ?? 'Sin nombre'}</h2>
            <p className="field__hint">{f.edad !== null ? `${f.edad} años · ` : ''}{objetivo(f.objetivo)}</p>
          </div>
        </div>
        <RachaVista racha={f.racha} />
      </div>

      <div className="grid-2">
        <form
          className="card glass form"
          onSubmit={(e) => {
            e.preventDefault()
            accFisico.run(async () => {
              await api.fisicoCoach(sedeId, perfilId, { alturaCm: fisico.alturaCm ? Number(fisico.alturaCm) : null, objetivo: fisico.objetivo || null })
              await cargar()
              onCambio()
              return 'Guardado.'
            })
          }}
        >
          <h3 className="h3">Objetivo y estatura</h3>
          <div className="field">
            <label htmlFor={`${id}-obj`}>Objetivo</label>
            <select id={`${id}-obj`} className="select" value={fisico.objetivo} onChange={(e) => setFisico({ ...fisico, objetivo: e.target.value as Objetivo | '' })}>
              <option value="">Sin objetivo</option>
              {OBJETIVOS.map(([k, l, d]) => <option key={k} value={k}>{l} — {d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-alt`}>Estatura (cm)</label>
            <input id={`${id}-alt`} inputMode="numeric" pattern="\d{2,3}" placeholder="Ej. 170" value={fisico.alturaCm} onChange={(e) => setFisico({ ...fisico, alturaCm: e.target.value })} />
          </div>
          {accFisico.avisos}
          <button className="btn btn--glass glass" disabled={accFisico.busy}>Guardar</button>
        </form>

        <div className="card glass form">
          <h3 className="h3">Salud</h3>
          {f.salud ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                accSalud.run(async () => {
                  await api.saludCoach(sedeId, perfilId, { condiciones: salud.condiciones || null, alergias: salud.alergias || null })
                  return 'Datos de salud guardados.'
                })
              }}
            >
              <p className="field__hint">Privado: solo lo ven la persona y los coaches de la sede.</p>
              <div className="field">
                <label htmlFor={`${id}-cond`}>Condiciones especiales</label>
                <textarea id={`${id}-cond`} rows={3} placeholder="Lesiones, enfermedades, embarazo…" value={salud.condiciones} onChange={(e) => setSalud({ ...salud, condiciones: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-ale`}>Alergias</label>
                <input id={`${id}-ale`} placeholder="Ej. nuez, lactosa" value={salud.alergias} onChange={(e) => setSalud({ ...salud, alergias: e.target.value })} />
              </div>
              {accSalud.avisos}
              <button className="btn btn--glass glass" disabled={accSalud.busy}>Guardar salud</button>
            </form>
          ) : (
            <p>Los datos de salud solo los ven la persona y los coaches de la sede.</p>
          )}
        </div>
      </div>

      <div className="card glass form">
        <h3 className="h3">Avance</h3>
        <AvancePeso
          ficha={f}
          busy={accPeso.busy}
          onRegistrar={(kg) =>
            accPeso.run(async () => {
              await api.pesoCoach(sedeId, perfilId, kg)
              await cargar()
              return 'Peso registrado.'
            })
          }
        />
        {accPeso.avisos}
      </div>

      <div className="card glass form">
        <div className="grafica__head">
          <h3 className="h3">Rutina</h3>
          {f.rutina && !editando && (
            <div className="fila__acc">
              <button type="button" className="btn btn--red btn--sm" disabled={accRutina.busy} onClick={() => generar()}>Generar nueva</button>
              <button type="button" className="btn btn--glass btn--sm glass" onClick={() => { setPropuesta(null); setEditando(true) }}>Editar rutina</button>
              <button
                type="button"
                className="btn btn--glass btn--sm glass"
                disabled={accRutina.busy}
                onClick={() => {
                  if (!window.confirm(`¿Quitar la rutina de ${f.nombre ?? 'este socio'}? Queda en el historial.`)) return
                  accRutina.run(async () => {
                    await api.quitarRutina(sedeId, perfilId)
                    await cargar()
                    onCambio()
                    return 'Rutina quitada.'
                  })
                }}
              >
                Quitar
              </button>
            </div>
          )}
        </div>
        {accRutina.avisos}
        {editando ? (
          <RutinaEditor
            key={propuesta?.n ?? 'actual'}
            catalogo={catalogo}
            inicial={propuesta?.rutina ?? f.rutina}
            razones={propuesta?.razones ?? []}
            busy={accRutina.busy}
            irACatalogo={irACatalogo}
            onGenerar={generar}
            onCrearEjercicio={crearEjercicio}
            onCancelar={() => { setEditando(false); setPropuesta(null) }}
            onGuardar={(data) =>
              accRutina.run(async () => {
                await api.guardarRutina(sedeId, perfilId, data)
                await cargar()
                setEditando(false)
                setPropuesta(null)
                onCambio()
                confirmarExito('Rutina enviada', `${f.nombre ?? 'El socio'} ya la ve en su app.`, 'Sigue vigente hasta que la cambies.')
              })
            }
          />
        ) : f.rutina ? (
          <>
            <p className="field__hint">Vigente desde el {new Date(f.rutina.actualizada).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} ({semanasDesde(f.rutina.actualizada)}). Cámbiala cuando lo consideres.</p>
            <RutinaVista rutina={f.rutina} />
          </>
        ) : (
          <div className="panel-msg">
            <p>Todavía no tiene rutina. El sistema la arma con su objetivo, nivel, edad y salud; tú la revisas y la aceptas.</p>
            <div className="fila__acc">
              <button type="button" className="btn btn--red" disabled={accRutina.busy} onClick={() => generar()}>{accRutina.busy ? 'Generando…' : 'Generar rutina'}</button>
              <button type="button" className="btn btn--glass glass" onClick={() => setEditando(true)}>Armarla a mano</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Editor de rutina ---------- */

const semanasDesde = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d < 7 ? 'esta semana' : `hace ${Math.floor(d / 7)} semana${d >= 14 ? 's' : ''}`
}

/** Cambiar un ejercicio: elegir del catálogo o escribir uno nuevo (se agrega al catálogo). */
function CambiarEjercicio({ actual, activos, onElegir, onCrear }: { actual: Ejercicio | undefined; activos: Ejercicio[]; onElegir: (e: Ejercicio) => void; onCrear: (nombre: string) => Promise<void> }) {
  const lista = useId()
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const opciones = useMemo(() => [...activos].sort((a, b) => Number(b.categoria === actual?.categoria) - Number(a.categoria === actual?.categoria)), [activos, actual])
  const aplicar = async () => {
    const t = texto.trim()
    if (t.length < 2) return
    const existe = activos.find((e) => e.nombre.toLowerCase() === t.toLowerCase())
    setBusy(true)
    try {
      if (existe) onElegir(existe)
      else await onCrear(t)
      setTexto('')
    } catch (e) {
      avisar('error', msg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="editor__cambiar">
      <label className="field">
        <span className="field__label">Cambiar por</span>
        <input list={lista} placeholder="Escribe o elige otro ejercicio" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void aplicar() } }} />
        <datalist id={lista}>{opciones.map((e) => <option key={e.id} value={e.nombre}>{grupo(e.categoria)}</option>)}</datalist>
      </label>
      <button type="button" className="btn btn--glass btn--sm glass" disabled={busy || texto.trim().length < 2} onClick={() => void aplicar()}>{busy ? '…' : 'Cambiar'}</button>
    </div>
  )
}

interface ItemEditor {
  key: string
  ejercicioId: number
  series: string
  repeticiones: string
  descansoSeg: string
  indicaciones: string
}
interface DiaEditor {
  categorias: GrupoMuscular[]
  notas: string
  ejercicios: ItemEditor[]
}

let llave = 0
const nuevaLlave = () => `i${++llave}`

function RutinaEditor({
  catalogo,
  inicial,
  razones,
  busy,
  onGuardar,
  onGenerar,
  onCrearEjercicio,
  onCancelar,
  irACatalogo,
}: {
  catalogo: Ejercicio[]
  inicial: Rutina | RutinaInput | null
  razones: string[]
  busy: boolean
  onGuardar: (r: RutinaInput) => void
  onGenerar: (dias?: number) => void
  onCrearEjercicio: (nombre: string, base: Ejercicio | undefined) => Promise<Ejercicio>
  onCancelar: () => void
  irACatalogo: () => void
}) {
  const [diasGen, setDiasGen] = useState('')
  const id = useId()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [notas, setNotas] = useState(inicial?.notas ?? '')
  const [dias, setDias] = useState<Map<number, DiaEditor>>(
    () =>
      new Map(
        (inicial?.dias ?? []).map((d) => [
          d.diaSemana,
          {
            categorias: d.categorias,
            notas: d.notas ?? '',
            ejercicios: d.ejercicios.map((e) => ({
              key: nuevaLlave(),
              ejercicioId: e.ejercicioId,
              series: String(e.series),
              repeticiones: e.repeticiones,
              descansoSeg: e.descansoSeg ? String(e.descansoSeg) : '',
              indicaciones: e.indicaciones ?? '',
            })),
          },
        ]),
      ),
  )
  const [error, setError] = useState<string | null>(null)
  const activos = useMemo(() => catalogo.filter((e) => e.activo), [catalogo])
  // Ejercicios recién escritos, mientras llega el catálogo actualizado.
  const [nuevos, setNuevos] = useState<Ejercicio[]>([])
  const porId = useMemo(() => new Map([...nuevos, ...catalogo].map((e) => [e.id, e])), [catalogo, nuevos])

  const cambiarDia = (d: number, fn: (x: DiaEditor) => DiaEditor) =>
    setDias((m) => {
      const n = new Map(m)
      n.set(d, fn(n.get(d)!))
      return n
    })
  const alternarDia = (d: number) =>
    setDias((m) => {
      const n = new Map(m)
      if (n.has(d)) n.delete(d)
      else n.set(d, { categorias: [], notas: '', ejercicios: [] })
      return n
    })

  const guardar = () => {
    setError(null)
    const lista = [...dias.entries()].sort(([a], [b]) => SEMANA.indexOf(a) - SEMANA.indexOf(b))
    if (!nombre.trim()) return setError('Ponle nombre a la rutina.')
    if (!lista.length) return setError('Elige al menos un día.')
    const vacio = lista.find(([, d]) => !d.ejercicios.length)
    if (vacio) return setError(`El ${DIAS_LARGO[vacio[0]].toLowerCase()} no tiene ejercicios.`)
    onGuardar({
      nombre: nombre.trim(),
      notas: notas.trim() || null,
      dias: lista.map(([diaSemana, d]) => ({
        diaSemana,
        categorias: d.categorias,
        notas: d.notas.trim() || null,
        ejercicios: d.ejercicios.map((e) => ({
          ejercicioId: e.ejercicioId,
          series: Number(e.series) || 1,
          repeticiones: e.repeticiones.trim(),
          descansoSeg: e.descansoSeg ? Number(e.descansoSeg) : null,
          indicaciones: e.indicaciones.trim() || null,
        })),
      })),
    })
  }

  if (!activos.length) {
    return (
      <div className="panel-msg">
        <p>Primero agrega las máquinas y ejercicios de la sede; con ellos se arman las rutinas.</p>
        <button type="button" className="btn btn--red" onClick={irACatalogo}>Ir a máquinas y ejercicios</button>
      </div>
    )
  }

  return (
    <div className="form editor">
      <div className="editor__generar">
        <label className="field">
          <span className="field__label">Días por semana</span>
          <select className="select" value={diasGen} onChange={(e) => setDiasGen(e.target.value)}>
            <option value="">Según sus visitas</option>
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} días</option>)}
          </select>
        </label>
        <button type="button" className="btn btn--red" disabled={busy} onClick={() => onGenerar(diasGen ? Number(diasGen) : undefined)}>{busy ? 'Generando…' : 'Generar rutina'}</button>
      </div>
      {razones.length > 0 && (
        <div className="editor__razones">
          <strong>Propuesta del sistema: revísala antes de aceptar</strong>
          <ul>{razones.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-n`}>Nombre de la rutina</label>
          <input id={`${id}-n`} placeholder="Ej. Hipertrofia 4 días" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-no`}>Indicaciones generales (opcional)</label>
          <input id={`${id}-no`} placeholder="Ej. Calienta 10 min antes" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>

      <fieldset className="field">
        <legend className="field__label">Días que entrena</legend>
        <div className="dias">
          {SEMANA.map((d) => (
            <label key={d} className="dia">
              <input type="checkbox" checked={dias.has(d)} onChange={() => alternarDia(d)} />
              {DIAS_LARGO[d]}
            </label>
          ))}
        </div>
      </fieldset>

      {SEMANA.filter((d) => dias.has(d)).map((d) => {
        const dia = dias.get(d)!
        const sugeridos = dia.categorias.length ? activos.filter((e) => dia.categorias.includes(e.categoria)) : activos
        const otros = dia.categorias.length ? activos.filter((e) => !dia.categorias.includes(e.categoria)) : []
        return (
          <section key={d} className="editor__dia" aria-label={DIAS_LARGO[d]}>
            <h4 className="h3">{DIAS_LARGO[d]}</h4>
            <fieldset className="field">
              <legend className="field__label">Grupos musculares</legend>
              <div className="dias">
                {GRUPOS.map(([g, l]) => (
                  <label key={g} className="dia">
                    <input
                      type="checkbox"
                      checked={dia.categorias.includes(g)}
                      onChange={() => cambiarDia(d, (x) => ({ ...x, categorias: x.categorias.includes(g) ? x.categorias.filter((c) => c !== g) : [...x.categorias, g] }))}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>

            <ol className="editor__ejercicios">
              {dia.ejercicios.map((e, i) => {
                const ej = porId.get(e.ejercicioId)
                const set = (campo: keyof ItemEditor, v: string) =>
                  cambiarDia(d, (x) => ({ ...x, ejercicios: x.ejercicios.map((y) => (y.key === e.key ? { ...y, [campo]: v } : y)) }))
                const mover = (delta: number) =>
                  cambiarDia(d, (x) => {
                    const arr = [...x.ejercicios]
                    const [it] = arr.splice(i, 1)
                    arr.splice(i + delta, 0, it)
                    return { ...x, ejercicios: arr }
                  })
                return (
                  <li key={e.key} className="editor__ej">
                    <div className="editor__ej-head">
                      <strong>{i + 1}. {ej?.nombre ?? 'Ejercicio'}</strong>
                      <small>{ej ? `${grupo(ej.categoria)} · ${ej.maquina ?? equipo(ej.equipo)}` : ''}</small>
                      <div className="fila__acc">
                        <button type="button" className="btn btn--glass btn--sm glass" aria-label="Subir" disabled={i === 0} onClick={() => mover(-1)}>↑</button>
                        <button type="button" className="btn btn--glass btn--sm glass" aria-label="Bajar" disabled={i === dia.ejercicios.length - 1} onClick={() => mover(1)}>↓</button>
                        <button type="button" className="btn btn--glass btn--sm glass" onClick={() => cambiarDia(d, (x) => ({ ...x, ejercicios: x.ejercicios.filter((y) => y.key !== e.key) }))}>Quitar</button>
                      </div>
                    </div>
                    <CambiarEjercicio
                      actual={ej}
                      activos={activos}
                      onElegir={(n) => cambiarDia(d, (x) => ({ ...x, ejercicios: x.ejercicios.map((y) => (y.key === e.key ? { ...y, ejercicioId: n.id } : y)) }))}
                      onCrear={async (nombre) => {
                        const n = await onCrearEjercicio(nombre, ej)
                        setNuevos((l) => [...l, n])
                        cambiarDia(d, (x) => ({ ...x, ejercicios: x.ejercicios.map((y) => (y.key === e.key ? { ...y, ejercicioId: n.id } : y)) }))
                      }}
                    />
                    <div className="editor__dosis">
                      <label className="field">
                        <span className="field__label">Series</span>
                        <input inputMode="numeric" pattern="\d{1,2}" value={e.series} onChange={(v) => set('series', v.target.value)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Repeticiones</span>
                        <input placeholder="10-12" value={e.repeticiones} onChange={(v) => set('repeticiones', v.target.value)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Descanso (s)</span>
                        <input inputMode="numeric" pattern="\d{0,3}" placeholder="60" value={e.descansoSeg} onChange={(v) => set('descansoSeg', v.target.value)} />
                      </label>
                      <label className="field editor__ind">
                        <span className="field__label">Indicaciones</span>
                        <input placeholder={ej?.indicaciones ?? 'Ej. controla la bajada'} value={e.indicaciones} onChange={(v) => set('indicaciones', v.target.value)} />
                      </label>
                    </div>
                  </li>
                )
              })}
            </ol>

            <label className="field">
              <span className="field__label">Agregar ejercicio</span>
              <select
                className="select"
                value=""
                onChange={(ev) => {
                  const ej = porId.get(Number(ev.target.value))
                  if (!ej) return
                  cambiarDia(d, (x) => ({
                    ...x,
                    ejercicios: [...x.ejercicios, { key: nuevaLlave(), ejercicioId: ej.id, series: String(ej.series), repeticiones: ej.repeticiones, descansoSeg: '', indicaciones: '' }],
                  }))
                }}
              >
                <option value="">Elige un ejercicio…</option>
                <optgroup label={dia.categorias.length ? 'De los grupos de este día' : 'Ejercicios'}>
                  {sugeridos.map((e) => <option key={e.id} value={e.id}>{e.nombre} — {e.maquina ?? equipo(e.equipo)}</option>)}
                </optgroup>
                {otros.length > 0 && (
                  <optgroup label="Otros">
                    {otros.map((e) => <option key={e.id} value={e.id}>{e.nombre} — {grupo(e.categoria)}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Notas del día (opcional)</span>
              <input placeholder="Ej. Cuida la rodilla" value={dia.notas} onChange={(ev) => cambiarDia(d, (x) => ({ ...x, notas: ev.target.value }))} />
            </label>
          </section>
        )
      })}

      {error && <p className="auth__error" role="alert">{error}</p>}
      <div className="fila__acc" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn--red" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Aceptar y enviar al socio'}</button>
        <button type="button" className="btn btn--glass glass" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

/* ================= Catálogo: máquinas y ejercicios ================= */

const EJ_VACIO = { nombre: '', categoria: 'pecho' as GrupoMuscular, equipo: 'mancuernas' as Equipo, maquinaId: '', series: '3', repeticiones: '10-12', indicaciones: '' }

function CatalogoTab({ sedeId, catalogo, onCambio }: { sedeId: string; catalogo: { maquinas: Maquina[]; ejercicios: Ejercicio[] }; onCambio: () => void }) {
  const id = useId()
  const [maq, setMaq] = useState({ nombre: '', categoria: 'pecho' as GrupoMuscular })
  const [ej, setEj] = useState(EJ_VACIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [filtro, setFiltro] = useState<GrupoMuscular | ''>('')
  const accMaq = useAccion()
  const accEj = useAccion()
  const maquinasActivas = catalogo.maquinas.filter((m) => m.activa)
  const [qe, setQe] = useState('')
  const [qm, setQm] = useState('')
  const lista = catalogo.ejercicios.filter((e) => (!filtro || e.categoria === filtro) && (!qe || e.nombre.toLowerCase().includes(qe.toLowerCase())))
  const [verEj, masEj] = useVerMas(lista, 10, `${filtro}|${qe}`)
  const [verMaq, masMaq] = useVerMas(catalogo.maquinas.filter((m) => !qm || m.nombre.toLowerCase().includes(qm.toLowerCase())), 8, qm)

  return (
    <div className="grid-2">
      <div className="card glass form">
        <h2 className="h3">Máquinas de la sede</h2>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault()
            accMaq.run(async () => {
              await api.crearMaquina(sedeId, maq)
              setMaq({ ...maq, nombre: '' })
              onCambio()
              return 'Máquina agregada.'
            })
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-mn`}>Nombre</label>
            <input id={`${id}-mn`} required placeholder="Ej. Prensa de pierna" value={maq.nombre} onChange={(e) => setMaq({ ...maq, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-mc`}>Grupo muscular</label>
            <select id={`${id}-mc`} className="select" value={maq.categoria} onChange={(e) => setMaq({ ...maq, categoria: e.target.value as GrupoMuscular })}>
              {GRUPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <button className="btn btn--glass glass" disabled={accMaq.busy} style={{ alignSelf: 'end' }}>Agregar</button>
        </form>
        {accMaq.avisos}
        {catalogo.maquinas.length > 6 && <input type="search" aria-label="Buscar máquina" placeholder="Buscar máquina…" value={qm} onChange={(e) => setQm(e.target.value)} />}
        <div className="lista">
          {catalogo.maquinas.length === 0 && <p className="field__hint">Agrega las máquinas que hay en esta sede.</p>}
          {verMaq.map((m) => (
            <div key={m.id} className={`fila ${m.activa ? '' : 'fila--off'}`}>
              <div className="fila__main">
                <strong>{m.nombre}</strong>
                <small>{grupo(m.categoria)}{m.activa ? '' : ' · fuera de servicio'}</small>
              </div>
              <button type="button" className="btn btn--glass btn--sm glass" onClick={() => accMaq.run(async () => { await api.editarMaquina(sedeId, m.id, { activa: !m.activa }); onCambio() })}>
                {m.activa ? 'Fuera de servicio' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
        {masMaq}
      </div>

      <div className="card glass form">
        <h2 className="h3">{editando ? 'Editar ejercicio' : 'Ejercicios'}</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            accEj.run(async () => {
              const data = {
                nombre: ej.nombre,
                categoria: ej.categoria,
                equipo: ej.equipo,
                maquinaId: ej.equipo === 'maquina' ? Number(ej.maquinaId) || null : null,
                series: Number(ej.series) || 1,
                repeticiones: ej.repeticiones,
                indicaciones: ej.indicaciones || null,
              }
              if (editando) await api.editarEjercicio(sedeId, editando, data)
              else await api.crearEjercicio(sedeId, data)
              setEj(EJ_VACIO)
              setEditando(null)
              onCambio()
              return editando ? 'Ejercicio actualizado.' : 'Ejercicio agregado.'
            })
          }}
        >
          <div className="form-row">
            <div className="field">
              <label htmlFor={`${id}-en`}>Nombre</label>
              <input id={`${id}-en`} required placeholder="Ej. Curl con mancuernas" value={ej.nombre} onChange={(e) => setEj({ ...ej, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-ec`}>Grupo muscular</label>
              <select id={`${id}-ec`} className="select" value={ej.categoria} onChange={(e) => setEj({ ...ej, categoria: e.target.value as GrupoMuscular })}>
                {GRUPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor={`${id}-eq`}>Se hace con</label>
              <select id={`${id}-eq`} className="select" value={ej.equipo} onChange={(e) => setEj({ ...ej, equipo: e.target.value as Equipo })}>
                {EQUIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {ej.equipo === 'maquina' && (
              <div className="field">
                <label htmlFor={`${id}-em`}>Máquina</label>
                <select id={`${id}-em`} className="select" required value={ej.maquinaId} onChange={(e) => setEj({ ...ej, maquinaId: e.target.value })}>
                  <option value="">{maquinasActivas.length ? 'Elige…' : 'Primero agrega una máquina'}</option>
                  {maquinasActivas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor={`${id}-es`}>Series sugeridas</label>
              <input id={`${id}-es`} inputMode="numeric" pattern="\d{1,2}" value={ej.series} onChange={(e) => setEj({ ...ej, series: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-er`}>Repeticiones sugeridas</label>
              <input id={`${id}-er`} placeholder="10-12, 30 s o al fallo" value={ej.repeticiones} onChange={(e) => setEj({ ...ej, repeticiones: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${id}-ei`}>Indicaciones (opcional)</label>
            <input id={`${id}-ei`} placeholder="Ej. espalda recta, codos pegados" value={ej.indicaciones} onChange={(e) => setEj({ ...ej, indicaciones: e.target.value })} />
          </div>
          {accEj.avisos}
          <div className="fila__acc" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn--red" disabled={accEj.busy}>{editando ? 'Guardar cambios' : 'Agregar ejercicio'}</button>
            {editando && <button type="button" className="btn btn--glass glass" onClick={() => { setEditando(null); setEj(EJ_VACIO) }}>Cancelar</button>}
          </div>
        </form>

        <label className="field">
          <span className="field__label">Ver</span>
          <select className="select" value={filtro} onChange={(e) => setFiltro(e.target.value as GrupoMuscular | '')}>
            <option value="">Todos los grupos ({catalogo.ejercicios.length})</option>
            {GRUPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <input type="search" aria-label="Buscar ejercicio" placeholder="Buscar ejercicio…" value={qe} onChange={(e) => setQe(e.target.value)} />
        <div className="lista">
          {lista.length === 0 && <p className="field__hint">{catalogo.ejercicios.length ? 'Ningún ejercicio con ese filtro.' : 'Agrega los ejercicios con los que armarás las rutinas.'}</p>}
          {verEj.map((e) => (
            <div key={e.id} className={`fila ${e.activo ? '' : 'fila--off'}`}>
              <div className="fila__main">
                <strong>{e.nombre}</strong>
                <small>{grupo(e.categoria)} · {e.maquina ?? equipo(e.equipo)} · {e.series} × {e.repeticiones}</small>
              </div>
              <div className="fila__acc">
                <button
                  type="button"
                  className="btn btn--glass btn--sm glass"
                  onClick={() => {
                    setEditando(e.id)
                    setEj({ nombre: e.nombre, categoria: e.categoria, equipo: e.equipo, maquinaId: e.maquinaId ? String(e.maquinaId) : '', series: String(e.series), repeticiones: e.repeticiones, indicaciones: e.indicaciones ?? '' })
                  }}
                >
                  Editar
                </button>
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => accEj.run(async () => { await api.editarEjercicio(sedeId, e.id, { activo: !e.activo }); onCambio() })}>
                  {e.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
        {masEj}
      </div>
    </div>
  )
}
