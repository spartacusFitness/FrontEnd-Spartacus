import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/api'
import { supabase } from '../lib/supabase'
import { ICONOS, Icono } from './Icono'
import { aCentavos, api, horaMx, pesos, type Categoria, type Movimiento, type Producto, type Promocion } from './api'
import { useEspejo, useVerMas, destacadosPrimero, Estrella, BotonesEdicion, EnModal, hayCambios } from './Navegacion'

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo de nuevo.')
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const CATEGORIAS: [Categoria, string][] = [
  ['suplementos', 'Suplementos'],
  ['bebidas', 'Bebidas'],
  ['snacks', 'Snacks'],
  ['accesorios', 'Accesorios'],
  ['ropa', 'Ropa'],
  ['otro', 'Otro'],
]

function Avisos({ error, ok }: { error: string | null; ok: string | null }) {
  useEspejo(ok, error)
  return null
}

/* ---------------- Productos e inventario ---------------- */

const VACIO = { nombre: '', categoria: 'suplementos' as Categoria, icono: 'proteina', precio: '', stockInicial: '0', stockMinimo: '0', esServicio: false }

export function ProductosTab({ sedeId }: { sedeId: string }) {
  const id = useId()
  const [lista, setLista] = useState<Producto[]>([])
  const [f, setF] = useState(VACIO)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [orig, setOrig] = useState(VACIO)
  const cancelar = () => { setEditando(null); setF(VACIO) }
  const [sel, setSel] = useState<Producto | null>(null)
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [mov, setMov] = useState({ tipo: 'entrada' as 'entrada' | 'ajuste', cantidad: '', motivo: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const filtrados = useMemo(() => destacadosPrimero(lista.filter((p) => !q || p.nombre.toLowerCase().includes(q.toLowerCase()))), [lista, q])
  const [verProds, masProds] = useVerMas(filtrados, 10, q)

  const cargar = useCallback(() => {
    api.productos(sedeId, true).then(setLista).catch(() => {})
  }, [sedeId])
  useEffect(cargar, [cargar])
  useEffect(() => {
    if (sel) api.movimientos(sedeId, sel.id).then(setMovs).catch(() => setMovs([]))
  }, [sel, sedeId])

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const m = await fn()
      if (m) setOk(m)
      cargar()
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const base = { nombre: f.nombre, categoria: f.categoria, icono: f.icono, precio: aCentavos(f.precio), stockMinimo: Number(f.stockMinimo) || 0 }
      if (editando) await api.editarProducto(sedeId, editando.id, base)
      else await api.crearProducto(sedeId, { ...base, stockInicial: f.esServicio ? 0 : Number(f.stockInicial) || 0, esServicio: f.esServicio })
      setF(VACIO)
      setEditando(null)
      return editando ? 'Producto actualizado.' : 'Producto agregado.'
    })
  }

  const registrar = (e: FormEvent) => {
    e.preventDefault()
    if (!sel) return
    run(async () => {
      const r = await api.inventario(
        sedeId,
        sel.id,
        mov.tipo === 'entrada'
          ? { tipo: 'entrada', cantidad: Number(mov.cantidad), ...(mov.motivo ? { motivo: mov.motivo } : {}) }
          : { tipo: 'ajuste', stockContado: Number(mov.cantidad), motivo: mov.motivo },
      )
      setMov({ ...mov, cantidad: '', motivo: '' })
      setSel({ ...sel, stock: r.stock })
      return `Stock de ${sel.nombre}: ${r.stock}.`
    })
  }

  return (
    <div className="grid-2">
      <div className="card glass">
        <h2 className="h3">Productos</h2>
        <p className="field__hint">Fija con la estrella los que más se venden (Visita, Agua…): salen primero en Venta.</p>
        {lista.length > 6 && <input type="search" aria-label="Buscar producto" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="lista">
          {lista.length === 0 && <p className="field__hint">Agrega tu primer producto.</p>}
          {lista.length > 0 && filtrados.length === 0 && <p className="field__hint">Ningún producto con ese nombre.</p>}
          {verProds.map((p) => (
            <button key={p.id} type="button" className={`fila ${sel?.id === p.id ? 'is-active' : ''} ${p.activo ? '' : 'fila--off'}`} onClick={() => setSel(p)}>
              <span className="socio-head">
                <span className="prod__icono"><Icono nombre={p.icono} /></span>
                <span className="fila__main">
                  <strong>{p.nombre} · {pesos(p.precio)}</strong>
                  <small>{CATEGORIAS.find(([c]) => c === p.categoria)?.[1]}{p.activo ? '' : ' · desactivado'}</small>
                </span>
              </span>
              <span className="fila__acc">
                {p.esServicio ? <span className="tag">Servicio</span> : <span className={`tag ${p.stock === 0 ? 'tag--bad' : p.stock <= p.stockMinimo ? 'tag--warn' : 'tag--ok'}`}>{p.stock} en stock</span>}
                <Estrella activa={p.destacado} nombre={p.nombre} disabled={busy} onClick={() => run(async () => { await api.editarProducto(sedeId, p.id, { destacado: !p.destacado }); return p.destacado ? `${p.nombre} ya no está fijado.` : `${p.nombre} fijado: sale primero en Venta.` })} />
              </span>
            </button>
          ))}
        </div>
        {masProds}
      </div>

      <div className="form">
        {sel && (
          <div className="card glass form">
            <div className="socio-head">
              <span className="prod__icono"><Icono nombre={sel.icono} /></span>
              <div className="fila__main">
                <strong style={{ fontSize: 20 }}>{sel.nombre}</strong>
                <small>{sel.esServicio ? 'Servicio: sin inventario' : `${sel.stock} en stock · mínimo ${sel.stockMinimo}`}</small>
              </div>
            </div>
            {!sel.esServicio && <form className="form" onSubmit={registrar}>
              <div className="dias" role="radiogroup" aria-label="Tipo de movimiento">
                <label className="dia"><input type="radio" checked={mov.tipo === 'entrada'} onChange={() => setMov({ ...mov, tipo: 'entrada' })} />Llegó mercancía</label>
                <label className="dia"><input type="radio" checked={mov.tipo === 'ajuste'} onChange={() => setMov({ ...mov, tipo: 'ajuste' })} />Ajuste por conteo</label>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor={`${id}-c`}>{mov.tipo === 'entrada' ? 'Piezas que llegaron' : 'Piezas contadas en físico'}</label>
                  <input id={`${id}-c`} type="number" min={mov.tipo === 'entrada' ? 1 : 0} required value={mov.cantidad} onChange={(e) => setMov({ ...mov, cantidad: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`${id}-m`}>Motivo{mov.tipo === 'ajuste' ? '' : ' (opcional)'}</label>
                  <input id={`${id}-m`} required={mov.tipo === 'ajuste'} placeholder={mov.tipo === 'ajuste' ? 'Merma, conteo mensual…' : 'Pedido a proveedor'} value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} />
                </div>
              </div>
              <div className="auth__done-actions">
                <button className="btn btn--red btn--sm" disabled={busy}>Registrar</button>
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => { const d = { nombre: sel.nombre, categoria: sel.categoria, icono: sel.icono, precio: String(sel.precio / 100), stockInicial: '0', stockMinimo: String(sel.stockMinimo), esServicio: sel.esServicio }; setEditando(sel); setF(d); setOrig(d) }}>Editar datos</button>
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => run(async () => { await api.editarProducto(sedeId, sel.id, { activo: !sel.activo }); setSel({ ...sel, activo: !sel.activo }) })}>
                  {sel.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </form>}
            {movs.length > 0 && (
              <table className="tabla">
                <thead><tr><th>Fecha</th><th>Movimiento</th><th className="num">Cant.</th><th className="num">Quedó</th></tr></thead>
                <tbody>
                  {movs.slice(0, 8).map((m) => (
                    <tr key={m.id}>
                      <td>{horaMx(m.createdAt)}</td>
                      <td>{m.tipo === 'venta' ? 'Venta' : m.tipo === 'entrada' ? 'Entrada' : `Ajuste${m.motivo ? `: ${m.motivo}` : ''}`}</td>
                      <td className="num">{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                      <td className="num">{m.stockResultante}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <EnModal si={!!editando} titulo={`Editar ${editando?.nombre ?? ''}`} onCerrar={cancelar}>
        <form className={editando ? 'form' : 'card glass form'} onSubmit={guardar}>
          {!editando && <h2 className="h3">Nuevo producto</h2>}
          <div className="field">
            <label htmlFor={`${id}-n`}>Nombre</label>
            <input id={`${id}-n`} required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor={`${id}-cat`}>Categoría</label>
              <select id={`${id}-cat`} className="select" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as Categoria })}>
                {CATEGORIAS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-p`}>Precio (MXN)</label>
              <input id={`${id}-p`} inputMode="decimal" required value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
            </div>
            {!editando && !f.esServicio && (
              <div className="field">
                <label htmlFor={`${id}-s`}>Stock inicial</label>
                <input id={`${id}-s`} type="number" min={0} value={f.stockInicial} onChange={(e) => setF({ ...f, stockInicial: e.target.value })} />
              </div>
            )}
            {!f.esServicio && <div className="field">
              <label htmlFor={`${id}-mi`}>Avisar con</label>
              <input id={`${id}-mi`} type="number" min={0} value={f.stockMinimo} onChange={(e) => setF({ ...f, stockMinimo: e.target.value })} aria-describedby={`${id}-mi-h`} />
              <small id={`${id}-mi-h`} className="field__hint">piezas o menos</small>
            </div>}
          </div>
          {!editando && (
            <label className="check">
              <input type="checkbox" checked={f.esServicio} onChange={(e) => setF({ ...f, esServicio: e.target.checked })} />
              Es un servicio sin inventario (p. ej. Visita de un día)
            </label>
          )}
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend className="field__label">Ícono</legend>
            <div className="iconos-sel">
              {ICONOS.map((ic) => (
                <label key={ic.clave} className="icono-op">
                  <input type="radio" name={`${id}-ic`} checked={f.icono === ic.clave} onChange={() => setF({ ...f, icono: ic.clave })} />
                  <Icono nombre={ic.clave} size={24} />
                  {ic.nombre}
                </label>
              ))}
            </div>
          </fieldset>
          <Avisos error={error} ok={ok} />
          {editando ? (
            <BotonesEdicion cambios={hayCambios(orig, f)} busy={busy} onCancelar={cancelar} />
          ) : (
            <div className="auth__done-actions">
              <button className="btn btn--red" disabled={busy}>Agregar producto</button>
            </div>
          )}
        </form>
        </EnModal>
      </div>
    </div>
  )
}

/* ---------------- Promociones ---------------- */

const PVACIO = { nombre: '', descripcion: '', precio: '', dias: new Set<number>(), desde: '', hasta: '', productos: [] as { productoId: number; cantidad: number }[] }

export function PromocionesTab({ sedeId }: { sedeId: string }) {
  const id = useId()
  const [promos, setPromos] = useState<Promocion[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [f, setF] = useState(PVACIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [orig, setOrig] = useState(PVACIO)
  const comparable = (x: typeof f) => ({ ...x, dias: [...x.dias].sort() })
  const cancelar = () => { setEditando(null); setF(PVACIO); setImagen(null) }
  const [imagen, setImagen] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.promociones(sedeId).then(setPromos).catch(() => {})
    api.productos(sedeId).then(setProductos).catch(() => {})
  }, [sedeId])
  useEffect(cargar, [cargar])

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const m = await fn()
      if (m) setOk(m)
      cargar()
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }

  const subirImagen = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) throw new ApiError('La imagen debe pesar menos de 3 MB.', 400)
    const firma = await api.firmaImagenPromo(sedeId, file.type)
    const { error: e } = await supabase.storage.from('promos').uploadToSignedUrl(firma.path, firma.token, file, { contentType: file.type })
    if (e) throw new ApiError('No pudimos subir la imagen.', 400)
    return firma.path
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      if (!f.productos.length) throw new ApiError('Agrega al menos un producto a la promoción.', 400)
      const imagenPath = imagen ? await subirImagen(imagen) : undefined
      const data = {
        nombre: f.nombre,
        ...(f.descripcion ? { descripcion: f.descripcion } : {}),
        precio: aCentavos(f.precio),
        diasSemana: [...f.dias],
        ...(f.desde ? { desde: f.desde } : {}),
        ...(f.hasta ? { hasta: f.hasta } : {}),
        productos: f.productos,
        ...(imagenPath ? { imagenPath } : {}),
      }
      if (editando) await api.editarPromo(sedeId, editando, data)
      else await api.crearPromo(sedeId, data)
      setF(PVACIO)
      setImagen(null)
      setEditando(null)
      return editando ? 'Promoción actualizada.' : 'Promoción creada.'
    })
  }

  const editar = (p: Promocion) => {
    const d = {
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: String(p.precio / 100),
      dias: new Set(p.diasSemana.split(',').filter(Boolean).map(Number)),
      desde: p.desde ?? '',
      hasta: p.hasta ?? '',
      productos: p.productos.map((x) => ({ productoId: x.productoId, cantidad: x.cantidad })),
    }
    setEditando(p.id)
    setF(d)
    setOrig(d)
    setImagen(null)
  }

  const [verPromos, masPromos] = useVerMas(promos, 8)
  const valorNormal = f.productos.reduce((s, x) => s + (productos.find((p) => p.id === x.productoId)?.precio ?? 0) * x.cantidad, 0)
  const cuando = (p: Promocion) => {
    const d = p.diasSemana.split(',').filter(Boolean).map((n) => DIAS[Number(n)])
    return [d.length ? d.join(', ') : 'Todos los días', p.desde || p.hasta ? `${p.desde ?? '…'} a ${p.hasta ?? '…'}` : ''].filter(Boolean).join(' · ')
  }

  return (
    <div className="grid-2">
      <div className="card glass">
        <h2 className="h3">Promociones</h2>
        <div className="lista">
          {promos.length === 0 && <p className="field__hint">Crea una promo, por ejemplo "Lunes 2x1 en preentreno".</p>}
          {verPromos.map((p) => (
            <div key={p.id} className={`fila ${p.activa ? '' : 'fila--off'}`}>
              <span className="socio-head">
                {p.imagenUrl ? <img src={p.imagenUrl} alt="" width={64} height={36} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <span className="prod__icono"><Icono nombre={p.productos[0]?.icono ?? 'otro'} /></span>}
                <span className="fila__main">
                  <strong>{p.nombre} · {pesos(p.precio)}</strong>
                  <small>{cuando(p)} · {p.productos.map((x) => `${x.cantidad}× ${x.nombre}`).join(', ')}</small>
                </span>
              </span>
              <span className="fila__acc">
                {p.vigenteHoy && <span className="tag tag--ok">Hoy</span>}
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => editar(p)}>Editar</button>
                <button type="button" className="btn btn--glass btn--sm glass" onClick={() => run(async () => { await api.editarPromo(sedeId, p.id, { activa: !p.activa }) })}>
                  {p.activa ? 'Desactivar' : 'Activar'}
                </button>
              </span>
            </div>
          ))}
        </div>
        {masPromos}
      </div>

      <EnModal si={!!editando} titulo={`Editar promoción ${orig.nombre}`} onCerrar={cancelar}>
      <form className={editando ? 'form' : 'card glass form'} onSubmit={guardar}>
        {!editando && <h2 className="h3">Nueva promoción</h2>}
        <div className="field">
          <label htmlFor={`${id}-n`}>Nombre</label>
          <input id={`${id}-n`} required placeholder="Lunes 2x1 en preentreno" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-d`}>Descripción (opcional)</label>
          <input id={`${id}-d`} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend className="field__label">Productos incluidos</legend>
          <div className="lista">
            {f.productos.map((x, i) => (
              <div key={x.productoId} className="fila">
                <span>{productos.find((p) => p.id === x.productoId)?.nombre ?? `#${x.productoId}`}</span>
                <span className="cant">
                  <button type="button" aria-label="Menos" onClick={() => setF({ ...f, productos: f.productos.map((y, j) => (j === i ? { ...y, cantidad: Math.max(1, y.cantidad - 1) } : y)) })}>−</button>
                  <strong>{x.cantidad}</strong>
                  <button type="button" aria-label="Más" onClick={() => setF({ ...f, productos: f.productos.map((y, j) => (j === i ? { ...y, cantidad: y.cantidad + 1 } : y)) })}>+</button>
                  <button type="button" aria-label="Quitar" onClick={() => setF({ ...f, productos: f.productos.filter((_, j) => j !== i) })}>×</button>
                </span>
              </div>
            ))}
          </div>
          <select
            className="select"
            value=""
            aria-label="Agregar producto a la promoción"
            onChange={(e) => {
              const pid = Number(e.target.value)
              if (pid && !f.productos.some((x) => x.productoId === pid)) setF({ ...f, productos: [...f.productos, { productoId: pid, cantidad: 1 }] })
            }}
          >
            <option value="">+ Agregar producto…</option>
            {productos.filter((p) => !f.productos.some((x) => x.productoId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre} · {pesos(p.precio)}</option>)}
          </select>
          {valorNormal > 0 && <small className="field__hint">Por separado costaría {pesos(valorNormal)}.</small>}
        </fieldset>
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${id}-p`}>Precio de la promo</label>
            <input id={`${id}-p`} inputMode="decimal" required value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-de`}>Desde (opcional)</label>
            <input id={`${id}-de`} type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-ha`}>Hasta (opcional)</label>
            <input id={`${id}-ha`} type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          </div>
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend className="field__label">Días que aplica (ninguno = todos)</legend>
          <div className="dias">
            {DIAS.map((d, i) => (
              <label key={d} className="dia">
                <input
                  type="checkbox"
                  checked={f.dias.has(i)}
                  onChange={(e) => {
                    const n = new Set(f.dias)
                    if (e.target.checked) n.add(i)
                    else n.delete(i)
                    setF({ ...f, dias: n })
                  }}
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${id}-img`}>Imagen (opcional, de Canva u otra)</label>
          <input id={`${id}-img`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImagen(e.target.files?.[0] ?? null)} />
        </div>
        <Avisos error={error} ok={ok} />
        {editando ? (
          <BotonesEdicion cambios={!!imagen || hayCambios(comparable(orig), comparable(f))} busy={busy} onCancelar={cancelar} />
        ) : (
          <div className="auth__done-actions">
            <button className="btn btn--red" disabled={busy}>{busy ? 'Guardando…' : 'Crear promoción'}</button>
          </div>
        )}
      </form>
      </EnModal>
    </div>
  )
}
