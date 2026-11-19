import { useEffect, useId, useState } from 'react'
import { ApiError } from '../auth/api'
import { BarrasH, Columnas, Linea, TarjetaGrafica } from './Graficas'
import { Icono } from './Icono'
import { api, pesos, type Resumen, type Sede } from './api'

const hoyMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const corto = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const compacto = (c: number) => {
  const v = c / 100
  return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 10_000 ? `$${(v / 1000).toFixed(1)}K` : pesos(c)
}

type Preset = 'hoy' | '7' | 'mes' | 'mes-pasado' | '30' | 'custom'

function rangoDe(p: Preset): [string, string] {
  const h = hoyMx()
  const [y, m] = h.split('-').map(Number)
  if (p === 'hoy') return [h, h]
  if (p === '7') return [sumar(h, -6), h]
  if (p === '30') return [sumar(h, -29), h]
  if (p === 'mes') return [`${h.slice(0, 7)}-01`, h]
  const ini = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)
  const fin = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
  return [ini, fin]
}

function csv(r: Resumen) {
  const filas = [
    ['Fecha', 'Ingresos', 'Efectivo', 'Terminal', 'Tarjeta en línea', 'Membresías', 'Productos', 'Promociones', 'Pagos', 'Entradas'],
    ...r.porDia.map((d) => [d.dia, d.ingresos, d.efectivo, d.terminal, d.stripe, d.membresias, d.productos, d.promociones, d.pagos, d.entradas].map((v, i) => (i && i < 8 ? (Number(v) / 100).toFixed(2) : v))),
    [],
    ['Sede', 'Ingresos', 'Efectivo', 'Terminal', 'Tarjeta en línea', 'Socios activos', 'Nuevas membresías', 'Entradas'],
    ...r.porSede.map((s) => [s.nombre, s.ingresos / 100, s.efectivo / 100, s.terminal / 100, s.stripe / 100, s.sociosActivos, s.nuevasMembresias, s.entradas]),
  ]
  const texto = filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `spartacus-${r.rango.desde}_a_${r.rango.hasta}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function DashboardTab({ sedes, todas }: { sedes: Sede[]; todas: boolean }) {
  const id = useId()
  const [preset, setPreset] = useState<Preset>('mes')
  const [rango, setRango] = useState<[string, string]>(() => rangoDe('mes'))
  const [sede, setSede] = useState<string>(todas ? '' : sedes[0]?.id ?? '')
  const [r, setR] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!todas && !sede) return
    setCargando(true)
    setError(null)
    api
      .resumen(rango[0], rango[1], sede || undefined)
      .then(setR)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No pudimos cargar el reporte.'))
      .finally(() => setCargando(false))
  }, [rango, sede, todas])

  const elegir = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRango(rangoDe(p))
  }

  const t = r?.totales
  const variasSedes = (r?.porSede.length ?? 0) > 1

  return (
    <div className="panel" style={{ padding: 0 }}>
      {/* Filtros: una fila, rango primero */}
      <div className="filtros">
        <div className="field">
          <label htmlFor={`${id}-p`}>Periodo</label>
          <select id={`${id}-p`} className="select" value={preset} onChange={(e) => elegir(e.target.value as Preset)}>
            <option value="hoy">Hoy</option>
            <option value="7">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="mes-pasado">Mes pasado</option>
            <option value="30">Últimos 30 días</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        {preset === 'custom' && (
          <>
            <div className="field">
              <label htmlFor={`${id}-d`}>Desde</label>
              <input id={`${id}-d`} type="date" value={rango[0]} max={rango[1]} onChange={(e) => e.target.value && setRango([e.target.value, rango[1]])} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-h`}>Hasta</label>
              <input id={`${id}-h`} type="date" value={rango[1]} min={rango[0]} onChange={(e) => e.target.value && setRango([rango[0], e.target.value])} />
            </div>
          </>
        )}
        {(todas || sedes.length > 1) && (
          <div className="field">
            <label htmlFor={`${id}-s`}>Sede</label>
            <select id={`${id}-s`} className="select" value={sede} onChange={(e) => setSede(e.target.value)}>
              {todas && <option value="">Todas las sedes</option>}
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}
        {r && (
          <button type="button" className="btn btn--glass glass" onClick={() => csv(r)}>Exportar CSV</button>
        )}
      </div>

      {error && <p className="auth__error" role="alert">{error}</p>}

      {!r ? (
        <div className="card glass panel-msg"><span className="auth__spinner" aria-hidden="true" /> Cargando reporte…</div>
      ) : (
        <div className={`panel ${cargando ? 'cargando-suave' : ''}`} style={{ padding: 0 }} aria-busy={cargando}>
          <div className="grid-2">
            <div className="card glass glass--red">
              <span className="field__label">Ingresos · {r.rango.desde === r.rango.hasta ? corto(r.rango.desde) : `${corto(r.rango.desde)} – ${corto(r.rango.hasta)}`}</span>
              <p className="hero-num">{pesos(t!.ingresos)}</p>
              <p className="field__hint" style={{ color: '#fff' }}>{t!.pagos} cobros · ticket promedio {pesos(t!.ticketPromedio)}</p>
            </div>
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="kpi glass"><span>Socios activos hoy</span><strong>{t!.sociosActivos}</strong></div>
              <div className="kpi glass"><span>Entradas</span><strong>{t!.entradas}</strong></div>
              <div className="kpi glass"><span>Membresías nuevas</span><strong>{t!.nuevasMembresias}</strong></div>
              <div className="kpi glass">
                <span>Diferencia en {t!.cortes} {t!.cortes === 1 ? 'corte' : 'cortes'}</span>
                <strong>{t!.diferenciaCortes === 0 ? 'Cuadra' : pesos(t!.diferenciaCortes)}</strong>
              </div>
            </div>
          </div>

          <TarjetaGrafica
            titulo="Ingresos por día"
            subtitulo="Membresías, productos y promociones, todos los métodos de pago"
            tabla={{ columnas: ['Día', 'Ingresos', 'Efectivo', 'Terminal', 'Tarjeta en línea'], filas: r.porDia.map((d) => [corto(d.dia), pesos(d.ingresos), pesos(d.efectivo), pesos(d.terminal), pesos(d.stripe)]) }}
          >
            <Columnas datos={r.porDia.map((d) => ({ clave: d.dia, etiqueta: corto(d.dia), valor: d.ingresos }))} formato={compacto} vacio="Sin ingresos en este periodo." />
          </TarjetaGrafica>

          <TarjetaGrafica
            titulo="Entradas por día"
            subtitulo="Accesos permitidos"
            tabla={{ columnas: ['Día', 'Entradas', 'Rechazadas'], filas: r.porDia.map((d) => [corto(d.dia), d.entradas, d.rechazos]) }}
          >
            <Linea datos={r.porDia.map((d) => ({ clave: d.dia, etiqueta: corto(d.dia), valor: d.entradas }))} formato={(v) => String(Math.round(v))} vacio="Sin entradas registradas en este periodo." />
          </TarjetaGrafica>

          <div className={variasSedes ? 'grid-3' : 'grid-2'}>
            {variasSedes && (
              <TarjetaGrafica
                titulo="Ingresos por sede"
                tabla={{ columnas: ['Sede', 'Ingresos', 'Socios activos', 'Entradas'], filas: r.porSede.map((s) => [s.nombre, pesos(s.ingresos), s.sociosActivos, s.entradas]) }}
              >
                <BarrasH
                  datos={[...r.porSede].sort((a, b) => b.ingresos - a.ingresos).map((s) => ({ clave: s.sedeId, etiqueta: s.nombre, valor: s.ingresos, detalle: `${s.sociosActivos} socios activos · ${s.entradas} entradas` }))}
                  formato={pesos}
                />
              </TarjetaGrafica>
            )}
            <TarjetaGrafica
              titulo="Cómo pagaron"
              tabla={{ columnas: ['Método', 'Importe'], filas: [['Efectivo', pesos(t!.efectivo)], ['Terminal', pesos(t!.terminal)], ['Tarjeta en línea', pesos(t!.stripe)]] }}
            >
              <BarrasH
                datos={[
                  { clave: 'efectivo', etiqueta: 'Efectivo', valor: t!.efectivo },
                  { clave: 'terminal', etiqueta: 'Terminal', valor: t!.terminal },
                  { clave: 'stripe', etiqueta: 'Tarjeta en línea', valor: t!.stripe },
                ]}
                formato={pesos}
              />
            </TarjetaGrafica>
            <TarjetaGrafica
              titulo="Qué se vendió"
              tabla={{ columnas: ['Tipo', 'Importe'], filas: [['Membresías', pesos(t!.membresias)], ['Productos', pesos(t!.productos)], ['Promociones', pesos(t!.promociones)]] }}
            >
              <BarrasH
                datos={[
                  { clave: 'membresias', etiqueta: 'Membresías', valor: t!.membresias },
                  { clave: 'productos', etiqueta: 'Productos', valor: t!.productos },
                  { clave: 'promociones', etiqueta: 'Promociones', valor: t!.promociones },
                ]}
                formato={pesos}
              />
            </TarjetaGrafica>
          </div>

          <div className="grid-2">
            <TarjetaGrafica
              titulo="Productos más vendidos"
              tabla={{ columnas: ['Producto', 'Unidades', 'Importe'], filas: r.topProductos.map((p) => [p.descripcion, p.cantidad, pesos(p.importe)]) }}
            >
              <BarrasH
                datos={r.topProductos.map((p) => ({ clave: `${p.tipo}-${p.descripcion}`, etiqueta: `${p.descripcion}${p.tipo === 'promocion' ? ' (promo)' : ''}`, valor: p.importe, detalle: `${p.cantidad} ${p.cantidad === 1 ? 'unidad' : 'unidades'}` }))}
                formato={pesos}
              />
            </TarjetaGrafica>
            <section className="card glass">
              <h3 className="grafica__titulo" style={{ marginBottom: 12 }}>Stock bajo</h3>
              {r.stockBajo.length === 0 ? (
                <p className="field__hint">Todo el inventario está arriba de su mínimo.</p>
              ) : (
                <div className="lista">
                  {r.stockBajo.map((p) => (
                    <div key={p.id} className="fila">
                      <span className="socio-head">
                        <span className="prod__icono"><Icono nombre={p.icono} /></span>
                        <span className="fila__main">
                          <strong>{p.nombre}</strong>
                          <small>{p.sede} · mínimo {p.stockMinimo}</small>
                        </span>
                      </span>
                      <span className={`tag ${p.stock === 0 ? 'tag--bad' : 'tag--warn'}`}>{p.stock === 0 ? 'Agotado' : `Quedan ${p.stock}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
