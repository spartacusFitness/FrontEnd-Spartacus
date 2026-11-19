import { useId, useState } from 'react'
import { Linea, TarjetaGrafica } from './Graficas'
import { fechaLarga, type Equipo, type FichaEntrenamiento, type GrupoMuscular, type Objetivo, type Racha, type Rutina } from './api'

/* ---------- Catálogos con su texto ---------- */

export const GRUPOS: [GrupoMuscular, string][] = [
  ['pecho', 'Pecho'],
  ['espalda', 'Espalda'],
  ['hombro', 'Hombro'],
  ['bicep', 'Bíceps'],
  ['tricep', 'Tríceps'],
  ['antebrazo', 'Antebrazo'],
  ['pierna', 'Pierna'],
  ['gluteo', 'Glúteo'],
  ['pantorrilla', 'Pantorrilla'],
  ['abdomen', 'Abdomen'],
  ['cardio', 'Cardio'],
  ['cuerpo_completo', 'Cuerpo completo'],
]
export const EQUIPOS: [Equipo, string][] = [
  ['maquina', 'Máquina'],
  ['mancuernas', 'Mancuernas'],
  ['barra', 'Barra'],
  ['ligas', 'Ligas'],
  ['kettlebell', 'Kettlebell'],
  ['polea', 'Polea'],
  ['peso_corporal', 'Peso corporal'],
  ['otro', 'Otro'],
]
export const OBJETIVOS: [Objetivo, string, string][] = [
  ['deficit', 'Déficit', 'Bajar grasa'],
  ['volumen', 'Volumen', 'Ganar músculo'],
  ['recomposicion', 'Recomposición corporal', 'Bajar grasa y ganar músculo'],
  ['condicion', 'Condición física', 'Resistencia y energía'],
  ['fuerza', 'Fuerza', 'Levantar más'],
  ['salud', 'Salud', 'Moverse y sentirse bien'],
]
export const grupo = (g: string) => GRUPOS.find(([k]) => k === g)?.[1] ?? g
export const equipo = (e: string) => EQUIPOS.find(([k]) => k === e)?.[1] ?? e
export const objetivo = (o: string | null) => (o ? (OBJETIVOS.find(([k]) => k === o)?.[1] ?? o) : 'Sin objetivo')

export const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
/** Orden de la semana en México: lunes primero. */
export const SEMANA = [1, 2, 3, 4, 5, 6, 0]
const INICIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

/** Día de la semana de hoy en México (0 = domingo). */
export const hoyDia = () => {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return new Date(`${ymd}T12:00:00Z`).getUTCDay()
}

/* ---------- Racha ---------- */

/** Racha: los 7 días de esta semana (lunes a domingo) y los días hábiles seguidos. */
export function RachaVista({ racha, compacta = false }: { racha: Racha; compacta?: boolean }) {
  const vino = new Set(racha.diasSemana.map((d) => new Date(`${d}T12:00:00Z`).getUTCDay()))
  const hoy = hoyDia()
  const puntos = (
    <ol className="racha__semana" aria-label={`Esta semana vino ${racha.semana} ${racha.semana === 1 ? 'día' : 'días'}`}>
      {SEMANA.map((d) => (
        <li key={d} className={`racha__dia ${vino.has(d) ? 'is-vino' : ''} ${d === hoy ? 'is-hoy' : ''}`} title={`${DIAS_LARGO[d]}: ${vino.has(d) ? 'vino' : 'no vino'}`}>
          {INICIAL[d]}
        </li>
      ))}
    </ol>
  )
  if (compacta) {
    return (
      <div className="racha racha--compacta">
        {puntos}
        <span className="racha__num" title="Días hábiles seguidos">
          <strong>{racha.consecutiva}</strong> {racha.consecutiva === 1 ? 'seguido' : 'seguidos'}
        </span>
      </div>
    )
  }
  return (
    <div className="racha">
      <div className="racha__cifras">
        <div>
          <strong className="hero-num">{racha.consecutiva}</strong>
          <span>{racha.consecutiva === 1 ? 'día seguido' : 'días seguidos'}</span>
        </div>
        <div>
          <strong className="hero-num">{racha.semana}</strong>
          <span>esta semana</span>
        </div>
      </div>
      {puntos}
      <p className="field__hint">Los fines de semana y los días que el gym cierra no rompen la racha.{racha.ultimaVisita ? ` Última visita: ${fechaLarga(racha.ultimaVisita)}.` : ''}</p>
    </div>
  )
}

/* ---------- Rutina (solo lectura) ---------- */

/** La rutina de la semana; el día de hoy abierto y los demás desplegables. */
export function RutinaVista({ rutina }: { rutina: Rutina }) {
  const hoy = hoyDia()
  const dias = [...rutina.dias].sort((a, b) => SEMANA.indexOf(a.diaSemana) - SEMANA.indexOf(b.diaSemana))
  const deHoy = rutina.dias.find((d) => d.diaSemana === hoy)
  return (
    <div className="rutina">
      <div className="rutina__head">
        <div>
          <h3 className="h3">{rutina.nombre}</h3>
          <p className="field__hint">
            {rutina.coach ? `Por ${rutina.coach}` : 'Rutina'} · {DIAS_SEMANA_TEXTO(rutina.dias.map((d) => d.diaSemana))}
          </p>
        </div>
        <span className={`tag ${deHoy ? 'tag--ok' : ''}`}>{deHoy ? `Hoy: ${deHoy.categorias.map(grupo).join(', ') || 'entrenas'}` : 'Hoy descansas'}</span>
      </div>
      {rutina.notas && <p className="rutina__notas">{rutina.notas}</p>}
      <div className="rutina__dias">
        {dias.map((d) => (
          <details key={d.diaSemana} className="rutina__dia" open={d.diaSemana === hoy}>
            <summary>
              <strong>{DIAS_LARGO[d.diaSemana]}</strong>
              <span>{d.categorias.map(grupo).join(' · ') || `${d.ejercicios.length} ejercicios`}</span>
              {d.diaSemana === hoy && <span className="tag tag--ok">Hoy</span>}
            </summary>
            {d.notas && <p className="rutina__notas">{d.notas}</p>}
            <ol className="rutina__ejercicios">
              {d.ejercicios.map((e, i) => (
                <li key={i}>
                  <div className="rutina__ej">
                    <strong>{e.nombre}</strong>
                    <span className="rutina__dosis">
                      {e.series} × {e.repeticiones}
                      {e.descansoSeg ? ` · descanso ${e.descansoSeg} s` : ''}
                    </span>
                  </div>
                  <small>{e.maquina ?? equipo(e.equipo)}</small>
                  {(e.indicaciones || e.indicacionesEjercicio) && <p className="rutina__ind">{e.indicaciones ?? e.indicacionesEjercicio}</p>}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </div>
  )
}

function DIAS_SEMANA_TEXTO(dias: number[]) {
  const orden = [...dias].sort((a, b) => SEMANA.indexOf(a) - SEMANA.indexOf(b))
  return `${orden.length} ${orden.length === 1 ? 'día' : 'días'}: ${orden.map((d) => DIAS_LARGO[d].slice(0, 3)).join(', ')}`
}

/* ---------- Avance de peso ---------- */

export function AvancePeso({ ficha, onRegistrar, busy }: { ficha: FichaEntrenamiento; onRegistrar: (pesoKg: number) => void; busy: boolean }) {
  const id = useId()
  const [peso, setPeso] = useState('')
  const serie = [...ficha.mediciones].reverse()
  const imc = ficha.pesoKg && ficha.alturaCm ? ficha.pesoKg / (ficha.alturaCm / 100) ** 2 : null
  const kg = (v: number) => `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} kg`
  return (
    <div className="form">
      <div className="kpis kpis--3">
        <div className="kpi glass"><span>Peso actual</span><strong>{ficha.pesoKg ? kg(ficha.pesoKg) : '—'}</strong></div>
        <div className="kpi glass"><span>Estatura</span><strong>{ficha.alturaCm ? `${ficha.alturaCm} cm` : '—'}</strong></div>
        <div className="kpi glass"><span>IMC</span><strong>{imc ? imc.toFixed(1) : '—'}</strong></div>
      </div>
      {serie.length >= 2 && (
        <TarjetaGrafica titulo="Peso" subtitulo="Últimos registros" tabla={{ columnas: ['Fecha', 'Peso (kg)'], filas: serie.map((m) => [m.fecha, m.pesoKg]) }}>
          <Linea datos={serie.map((m) => ({ clave: String(m.id), etiqueta: new Date(`${m.fecha}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }), valor: m.pesoKg }))} formato={kg} alto={170} ajustado />
        </TarjetaGrafica>
      )}
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault()
          onRegistrar(Number(peso.replace(',', '.')))
          setPeso('')
        }}
      >
        <div className="field">
          <label htmlFor={`${id}-p`}>Peso de hoy (kg)</label>
          <input id={`${id}-p`} required inputMode="decimal" pattern="\d{2,3}([.,]\d{1,2})?" placeholder="Ej. 72.5" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </div>
        <button className="btn btn--glass glass" disabled={busy} style={{ alignSelf: 'end' }}>Registrar peso</button>
      </form>
    </div>
  )
}
