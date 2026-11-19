import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

// Gráficas en SVG propio. Un solo color (rojo de marca, validado contra el fondo oscuro):
// la identidad de cada barra va en su etiqueta escrita, nunca solo en el color.
const ACENTO = '#ff453a'
const GRID = 'rgba(255,255,255,0.10)'
const TEXTO = '#c9cacd'

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Escala "bonita" para el eje Y: 0 … máx en 4 pasos redondos. */
function ticks(max: number) {
  if (max <= 0) return [0, 1]
  const paso0 = max / 4
  const mag = 10 ** Math.floor(Math.log10(paso0))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0)!
  return Array.from({ length: Math.ceil(max / paso) + 1 }, (_, i) => i * paso)
}

interface Punto {
  clave: string
  etiqueta: string
  valor: number
}

/** Tarjeta de gráfica: título, la gráfica y su vista en tabla (accesible y exportable). */
export function TarjetaGrafica({
  titulo,
  subtitulo,
  tabla,
  children,
}: {
  titulo: string
  subtitulo?: string
  tabla: { columnas: string[]; filas: (string | number)[][] }
  children: ReactNode
}) {
  const [verTabla, setVerTabla] = useState(false)
  return (
    <section className="card glass grafica">
      <div className="grafica__head">
        <div>
          <h3 className="grafica__titulo">{titulo}</h3>
          {subtitulo && <p className="field__hint">{subtitulo}</p>}
        </div>
        <button type="button" className="btn btn--glass btn--sm glass" aria-pressed={verTabla} onClick={() => setVerTabla((v) => !v)}>
          {verTabla ? 'Ver gráfica' : 'Ver como tabla'}
        </button>
      </div>
      {verTabla ? (
        <div className="grafica__tabla">
          <table className="tabla">
            <thead>
              <tr>{tabla.columnas.map((c, i) => <th key={c} className={i ? 'num' : ''}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {tabla.filas.map((f, i) => (
                <tr key={i}>{f.map((v, j) => <td key={j} className={j ? 'num' : ''}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}

/** Columnas verticales (p. ej. ingresos por día). Tooltip por barra con mouse y teclado. */
export function Columnas({ datos, formato, alto = 220, vacio = 'Sin datos en este periodo.' }: { datos: Punto[]; formato: (v: number) => string; alto?: number; vacio?: string }) {
  if (!datos.some((d) => d.valor > 0)) return <p className="grafica__vacio">{vacio}</p>
  return <ColumnasPlot datos={datos} formato={formato} alto={alto} />
}

function ColumnasPlot({ datos, formato, alto }: { datos: Punto[]; formato: (v: number) => string; alto: number }) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [activo, setActivo] = useState<number | null>(null)
  const izq = 56
  const abajo = 26
  const arriba = 8
  const w = ancho - izq
  const h = alto - abajo - arriba
  const t = ticks(Math.max(...datos.map((d) => d.valor), 0))
  const max = t[t.length - 1]
  const banda = w / Math.max(datos.length, 1)
  const bw = Math.min(24, Math.max(2, banda * 0.7))
  const cadaN = Math.ceil(datos.length / Math.max(1, Math.floor(w / 64)))
  const y = (v: number) => arriba + h - (v / max) * h

  return (
    <div ref={ref} className="grafica__plot" onPointerLeave={() => setActivo(null)}>
      <svg width={ancho} height={alto} role="img" aria-label="Gráfica de columnas">
        {t.map((v) => (
          <g key={v}>
            <line x1={izq} x2={ancho} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={izq - 8} y={y(v) + 4} textAnchor="end" fill={TEXTO} fontSize={12} style={{ fontVariantNumeric: 'tabular-nums' }}>{formato(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const cx = izq + banda * i + banda / 2
          const top = y(d.valor)
          const alturaB = arriba + h - top
          const r = Math.min(4, alturaB, bw / 2)
          return (
            <g key={d.clave}>
              {alturaB > 0 && (
                <path
                  d={`M${cx - bw / 2},${arriba + h} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${arriba + h} Z`}
                  fill={ACENTO}
                  opacity={activo === null || activo === i ? 1 : 0.45}
                />
              )}
              {/* zona de hover: toda la banda, más grande que la barra */}
              <rect
                x={izq + banda * i}
                y={arriba}
                width={banda}
                height={h}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.etiqueta}: ${formato(d.valor)}`}
                onPointerEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              />
              {i % cadaN === 0 && (
                <text x={cx} y={alto - 8} textAnchor="middle" fill={TEXTO} fontSize={12}>{d.etiqueta}</text>
              )}
            </g>
          )
        })}
      </svg>
      {activo !== null && datos[activo] && (
        <div
          className="grafica__tip"
          style={{ left: Math.min(ancho - 150, Math.max(0, izq + banda * activo + banda / 2 - 70)), top: Math.max(0, y(datos[activo].valor) - 58) }}
          role="status"
        >
          <strong>{formato(datos[activo].valor)}</strong>
          <span>{datos[activo].etiqueta}</span>
        </div>
      )}
    </div>
  )
}

/** Línea con guía vertical (p. ej. entradas por día). Flechas ← → recorren los puntos. */
export function Linea({ datos, formato, alto = 200, vacio = 'Sin datos en este periodo.' }: { datos: Punto[]; formato: (v: number) => string; alto?: number; vacio?: string }) {
  if (!datos.some((d) => d.valor > 0)) return <p className="grafica__vacio">{vacio}</p>
  return <LineaPlot datos={datos} formato={formato} alto={alto} />
}

function LineaPlot({ datos, formato, alto }: { datos: Punto[]; formato: (v: number) => string; alto: number }) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [activo, setActivo] = useState<number | null>(null)
  const id = useId()
  const izq = 44
  const abajo = 26
  const arriba = 10
  const w = ancho - izq - 10
  const h = alto - abajo - arriba
  const t = ticks(Math.max(...datos.map((d) => d.valor), 0))
  const max = t[t.length - 1]
  const x = (i: number) => izq + (datos.length <= 1 ? w / 2 : (i / (datos.length - 1)) * w)
  const y = (v: number) => arriba + h - (v / max) * h
  const linea = datos.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.valor)}`).join(' ')
  const area = datos.length ? `${linea} L${x(datos.length - 1)},${arriba + h} L${x(0)},${arriba + h} Z` : ''
  const cadaN = Math.ceil(datos.length / Math.max(1, Math.floor(w / 64)))

  const mover = (clientX: number, rect: DOMRect) => {
    if (!datos.length) return
    const rel = clientX - rect.left - izq
    const i = datos.length <= 1 ? 0 : Math.round((rel / w) * (datos.length - 1))
    setActivo(Math.max(0, Math.min(datos.length - 1, i)))
  }
  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActivo((a) => Math.min(datos.length - 1, (a ?? -1) + 1))
    if (e.key === 'ArrowLeft') setActivo((a) => Math.max(0, (a ?? datos.length) - 1))
  }
  const fin = datos.length - 1

  return (
    <div
      ref={ref}
      className="grafica__plot"
      tabIndex={0}
      aria-describedby={`${id}-ayuda`}
      onKeyDown={teclas}
      onBlur={() => setActivo(null)}
      onPointerMove={(e) => mover(e.clientX, e.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => setActivo(null)}
    >
      <span id={`${id}-ayuda`} className="visually-hidden">Usa las flechas izquierda y derecha para recorrer los días.</span>
      <svg width={ancho} height={alto} role="img" aria-label="Gráfica de línea">
        {t.map((v) => (
          <g key={v}>
            <line x1={izq} x2={ancho} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={izq - 8} y={y(v) + 4} textAnchor="end" fill={TEXTO} fontSize={12} style={{ fontVariantNumeric: 'tabular-nums' }}>{formato(v)}</text>
          </g>
        ))}
        <path d={area} fill={ACENTO} opacity={0.1} />
        <path d={linea} fill="none" stroke={ACENTO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {datos.map((d, i) =>
          i % cadaN === 0 ? <text key={d.clave} x={x(i)} y={alto - 8} textAnchor="middle" fill={TEXTO} fontSize={12}>{d.etiqueta}</text> : null,
        )}
        {fin >= 0 && activo === null && (
          <circle cx={x(fin)} cy={y(datos[fin].valor)} r={4} fill={ACENTO} stroke="#1c1416" strokeWidth={2} />
        )}
        {activo !== null && (
          <>
            <line x1={x(activo)} x2={x(activo)} y1={arriba} y2={arriba + h} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
            <circle cx={x(activo)} cy={y(datos[activo].valor)} r={5} fill={ACENTO} stroke="#1c1416" strokeWidth={2} />
          </>
        )}
      </svg>
      {activo !== null && datos[activo] && (
        <div className="grafica__tip" style={{ left: Math.min(ancho - 150, Math.max(0, x(activo) - 70)), top: Math.max(0, y(datos[activo].valor) - 60) }} role="status">
          <strong>{formato(datos[activo].valor)}</strong>
          <span>{datos[activo].etiqueta}</span>
        </div>
      )}
    </div>
  )
}

/** Barras horizontales con nombre y valor escritos (sedes, métodos, productos…). */
export function BarrasH({ datos, formato }: { datos: (Punto & { detalle?: string })[]; formato: (v: number) => string }) {
  const max = Math.max(...datos.map((d) => d.valor), 0) || 1
  if (!datos.length) return <p className="field__hint">Sin datos en este periodo.</p>
  return (
    <ul className="barras">
      {datos.map((d) => (
        <li key={d.clave} className="barras__fila" tabIndex={0} aria-label={`${d.etiqueta}: ${formato(d.valor)}${d.detalle ? `, ${d.detalle}` : ''}`}>
          <div className="barras__texto">
            <span>{d.etiqueta}</span>
            <strong>{formato(d.valor)}</strong>
          </div>
          <div className="barras__pista" aria-hidden="true">
            {d.valor > 0 && <div className="barras__barra" style={{ width: `${(d.valor / max) * 100}%` }} />}
          </div>
          {d.detalle && <small className="field__hint">{d.detalle}</small>}
        </li>
      ))}
    </ul>
  )
}
