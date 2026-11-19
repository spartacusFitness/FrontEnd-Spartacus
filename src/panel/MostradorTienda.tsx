import { useCallback, useEffect, useId, useState } from 'react'
import { ApiError } from '../auth/api'
import { Icono } from './Icono'
import { api, pesos, type ItemVenta, type Producto, type Promocion } from './api'

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')

type Linea = ItemVenta & { nombre: string; precio: number }

/** Punto de venta: productos y promociones de hoy, carrito, cobro en efectivo o terminal. */
export function VentaTab({ sedeId, onVenta }: { sedeId: string; onVenta: () => void }) {
  const id = useId()
  const [productos, setProductos] = useState<Producto[]>([])
  const [promos, setPromos] = useState<Promocion[]>([])
  const [carrito, setCarrito] = useState<Linea[]>([])
  const [metodo, setMetodo] = useState<'efectivo' | 'terminal'>('efectivo')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.productos(sedeId).then(setProductos).catch(() => {})
    api.promociones(sedeId).then((p) => setPromos(p.filter((x) => x.vigenteHoy))).catch(() => {})
  }, [sedeId])
  useEffect(cargar, [cargar])

  const agregar = (l: Omit<Linea, 'cantidad'>) => {
    setOk(null)
    setCarrito((c) => {
      const i = c.findIndex((x) => x.tipo === l.tipo && x.id === l.id)
      return i >= 0 ? c.map((x, j) => (j === i ? { ...x, cantidad: x.cantidad + 1 } : x)) : [...c, { ...l, cantidad: 1 }]
    })
  }
  const cambiar = (i: number, d: number) => setCarrito((c) => c.flatMap((x, j) => (j !== i ? [x] : x.cantidad + d <= 0 ? [] : [{ ...x, cantidad: x.cantidad + d }])))
  const total = carrito.reduce((s, x) => s + x.precio * x.cantidad, 0)
  const enCarrito = (pid: number) => carrito.filter((x) => x.tipo === 'producto' && x.id === pid).reduce((s, x) => s + x.cantidad, 0)
  const visibles = productos.filter((p) => !q || p.nombre.toLowerCase().includes(q.toLowerCase()))

  const cobrar = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.vender(sedeId, carrito.map(({ tipo, id, cantidad }) => ({ tipo, id, cantidad })), metodo)
      setOk(`Venta registrada: ${pesos(r.total)} (${metodo}).`)
      setCarrito([])
      cargar()
      onVenta()
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pos">
      <div className="card glass form">
        {promos.length > 0 && (
          <>
            <h3 className="field__label">Promociones de hoy</h3>
            <div className="productos-grid">
              {promos.map((p) => (
                <button key={p.id} type="button" className="prod prod--promo" onClick={() => agregar({ tipo: 'promocion', id: p.id, nombre: p.nombre, precio: p.precio })}>
                  <span className="prod__icono"><Icono nombre={p.productos[0]?.icono ?? 'otro'} /></span>
                  <strong>{p.nombre}</strong>
                  <small>{p.productos.map((x) => `${x.cantidad}× ${x.nombre}`).join(' + ')}</small>
                  <span>{pesos(p.precio)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor={`${id}-q`}>Productos</label>
          <input id={`${id}-q`} type="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="productos-grid">
          {visibles.length === 0 && <p className="field__hint">No hay productos. El encargado los agrega en Administración → Productos.</p>}
          {visibles.map((p) => {
            const agotado = p.stock - enCarrito(p.id) <= 0
            return (
              <button
                key={p.id}
                type="button"
                className="prod"
                aria-disabled={agotado}
                onClick={() => !agotado && agregar({ tipo: 'producto', id: p.id, nombre: p.nombre, precio: p.precio })}
              >
                <span className="prod__icono"><Icono nombre={p.icono} /></span>
                <strong>{p.nombre}</strong>
                <small>{agotado ? 'Agotado' : `${p.stock - enCarrito(p.id)} disponibles`}</small>
                <span>{pesos(p.precio)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card glass form" aria-live="polite">
        <h2 className="h3">Venta</h2>
        {carrito.length === 0 ? (
          <p className="field__hint">Toca un producto o promoción para agregarlo.</p>
        ) : (
          <div>
            {carrito.map((x, i) => (
              <div key={`${x.tipo}-${x.id}`} className="carrito__item">
                <span>{x.nombre}{x.tipo === 'promocion' ? ' (promo)' : ''}</span>
                <span className="cant">
                  <button type="button" aria-label={`Quitar uno de ${x.nombre}`} onClick={() => cambiar(i, -1)}>−</button>
                  <strong>{x.cantidad}</strong>
                  <button type="button" aria-label={`Agregar uno de ${x.nombre}`} onClick={() => cambiar(i, 1)}>+</button>
                </span>
                <strong className="num">{pesos(x.precio * x.cantidad)}</strong>
              </div>
            ))}
            <div className="total"><span>Total</span><span>{pesos(total)}</span></div>
          </div>
        )}
        <div className="dias" role="radiogroup" aria-label="Método de pago">
          {(['efectivo', 'terminal'] as const).map((m) => (
            <label key={m} className="dia">
              <input type="radio" name={`${id}-m`} checked={metodo === m} onChange={() => setMetodo(m)} />
              {m === 'efectivo' ? 'Efectivo' : 'Terminal'}
            </label>
          ))}
        </div>
        {error && <p className="auth__error" role="alert">{error}</p>}
        {ok && <p className="banner banner--ok" role="status">{ok}</p>}
        <div className="auth__done-actions">
          <button type="button" className="btn btn--red" disabled={busy || !carrito.length} onClick={cobrar}>
            {busy ? 'Cobrando…' : `Cobrar ${carrito.length ? pesos(total) : ''}`}
          </button>
          {carrito.length > 0 && <button type="button" className="btn btn--glass glass" onClick={() => setCarrito([])}>Vaciar</button>}
        </div>
      </div>
    </div>
  )
}

/** Inventario en recepción: ver stock y registrar mercancía que llega. */
export function InventarioTab({ sedeId }: { sedeId: string }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cant, setCant] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.productos(sedeId).then(setProductos).catch(() => {})
  }, [sedeId])
  useEffect(cargar, [cargar])

  const entrada = async (p: Producto) => {
    setError(null)
    setOk(null)
    try {
      const r = await api.inventario(sedeId, p.id, { tipo: 'entrada', cantidad: Number(cant[p.id]) })
      setOk(`${p.nombre}: ahora hay ${r.stock}.`)
      setCant({ ...cant, [p.id]: '' })
      cargar()
    } catch (e) {
      setError(msg(e))
    }
  }

  return (
    <div className="card glass form">
      <h2 className="h3">Inventario</h2>
      <p className="field__hint">Registra aquí la mercancía que llega. Los ajustes por conteo y los precios los hace el encargado.</p>
      {error && <p className="auth__error" role="alert">{error}</p>}
      {ok && <p className="auth__ok" role="status">{ok}</p>}
      <div className="lista">
        {productos.map((p) => (
          <div key={p.id} className="fila">
            <span className="socio-head">
              <span className="prod__icono"><Icono nombre={p.icono} /></span>
              <span className="fila__main">
                <strong>{p.nombre}</strong>
                <small>{pesos(p.precio)}</small>
              </span>
            </span>
            <span className="fila__acc">
              <span className={`tag ${p.stock === 0 ? 'tag--bad' : p.stock <= p.stockMinimo ? 'tag--warn' : 'tag--ok'}`}>{p.stock} en stock</span>
              <input
                aria-label={`Piezas que llegaron de ${p.nombre}`}
                type="number"
                min={1}
                placeholder="Llegaron"
                style={{ width: 100, minHeight: 40, borderRadius: 12, padding: '0 10px', background: 'rgba(0,0,0,.3)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}
                value={cant[p.id] ?? ''}
                onChange={(e) => setCant({ ...cant, [p.id]: e.target.value })}
              />
              <button type="button" className="btn btn--glass btn--sm glass" disabled={!Number(cant[p.id])} onClick={() => entrada(p)}>Registrar</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
