// API de los paneles (admin, recepción y socio). Todo pasa por `authed`: Bearer + firma.
import { authed } from '../auth/api'

export const pesos = (centavos: number) =>
  (centavos / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const aCentavos = (pesosTexto: string) => Math.round(Number(pesosTexto.replace(/[^0-9.]/g, '')) * 100)

export const fechaLarga = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const horaMx = (iso: string | Date) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' })

/* ---------- Tipos ---------- */

export interface Sede {
  id: string
  nombre: string
  ciudad: string
  direccion: string
  lat: number
  lng: number
  mapsUrl: string | null
  diasSinServicio?: string
  antipassbackMin?: number
  activa?: boolean
}

export interface Plan {
  id: number
  sedeId: string
  nombre: string
  tipo: 'visita' | 'semana' | 'mes' | 'especial'
  duracionDias: number
  precio: number
  descripcion: string | null
  pagoEnLinea: boolean
  requiereValidacion: boolean
  renovableEnLinea: boolean
  activo: boolean
}

export interface Recepcionista {
  id: number
  nombre: string
  activo: boolean
  bloqueado?: boolean
}

export interface DiaCerrado {
  id: number
  fecha: string
  motivo: string
}

export interface EntradaBitacora {
  id: number
  accion: string
  entidad: string
  entidadId: string
  datos: unknown
  recepcionistaId: number | null
  createdAt: string
}

export interface EstadoRecepcion {
  sede: { id: string; nombre: string; antipassbackMin: number }
  turno: null | {
    id: number
    abiertoEn: string
    efectivoInicial: number
    recepcionista: string
    efectivo: number
    terminal: number
    cobros: number
  }
  recepcionistas: { id: number; nombre: string }[]
  solicitudesPendientes: number
  entradasHoy: number
}

export interface SocioBusqueda {
  id: string
  nombre: string | null
  email: string
  fotoUrl: string | null
  verificado: boolean
  vigenteHasta: string | null
}

export interface Ficha {
  id: string
  nombre: string | null
  email: string
  fotoUrl: string | null
  verificado: boolean
  fechaNacimiento: string | null
  vigente: { plan: string; inicio: string; fin: string } | null
  membresias: { id: number; plan: string; inicio: string; fin: string }[]
  asistencias: { id: number; resultado: string; origen: string; fecha: string }[]
}

export interface SolicitudRecepcion {
  id: number
  estado: 'pendiente_pago' | 'pagada' | 'completada' | 'vencida' | 'cancelada'
  metodo: 'tarjeta' | 'mostrador'
  venceEn: string
  creadaEn: string
  socio: { id: string; nombre: string | null; email: string; fotoUrl: string | null } | null
  plan: { id: number; nombre: string; precio: number; requiereValidacion: boolean } | null
}

export interface Turno {
  id: number
  abiertoEn: string
  cerradoEn: string | null
  efectivoInicial: number
  efectivoEsperado: number | null
  efectivoContado: number | null
  diferencia: number | null
  notas: string | null
  recepcionista: string
}

export interface MiMembresia {
  sedeId: string | null
  vigente: { plan: string; inicio: string; fin: string } | null
  solicitudes: { id: number; plan: string; precio: number; metodo: string; estado: string; venceEn: string }[]
}

export type Categoria = 'suplementos' | 'bebidas' | 'snacks' | 'accesorios' | 'ropa' | 'otro'

export interface Producto {
  id: number
  sedeId: string
  nombre: string
  categoria: Categoria
  icono: string
  precio: number
  stock: number
  stockMinimo: number
  activo: boolean
}

export interface Movimiento {
  id: number
  tipo: 'venta' | 'entrada' | 'ajuste'
  cantidad: number
  stockResultante: number
  motivo: string | null
  createdAt: string
}

export interface Promocion {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  diasSemana: string
  desde: string | null
  hasta: string | null
  activa: boolean
  vigenteHoy: boolean
  imagenUrl: string | null
  productos: { productoId: number; cantidad: number; nombre: string; icono: string; precio: number }[]
}

export interface ItemVenta {
  tipo: 'producto' | 'promocion'
  id: number
  cantidad: number
}

export interface Catalogo {
  productos: { id: number; nombre: string; categoria: Categoria; icono: string; precio: number; disponible: boolean }[]
  promociones: Promocion[]
  hoy: string | null
}

type Acum = { ingresos: number; efectivo: number; terminal: number; stripe: number; membresias: number; productos: number; promociones: number; pagos: number; entradas: number; rechazos: number }

export interface Resumen {
  rango: { desde: string; hasta: string; dias: number }
  sedes: { id: string; nombre: string }[]
  totales: Acum & { ticketPromedio: number; sociosActivos: number; nuevasMembresias: number; cortes: number; diferenciaCortes: number }
  porSede: (Acum & { sedeId: string; nombre: string; sociosActivos: number; nuevasMembresias: number })[]
  porDia: (Acum & { dia: string })[]
  topProductos: { descripcion: string; tipo: string; cantidad: number; importe: number }[]
  stockBajo: { id: number; sedeId: string; sede: string; nombre: string; icono: string; stock: number; stockMinimo: number }[]
}

/* ---------- Admin ---------- */

export const api = {
  /* tienda (admin/encargado; recepción solo ve y registra entradas) */
  productos: (id: string, todos = false) => authed<Producto[]>('GET', `/sedes/${id}/productos${todos ? '?todos=1' : ''}`),
  crearProducto: (id: string, data: { nombre: string; categoria: Categoria; icono: string; precio: number; stockInicial: number; stockMinimo: number }) =>
    authed<Producto>('POST', `/sedes/${id}/productos`, data),
  editarProducto: (id: string, pid: number, data: Partial<Pick<Producto, 'nombre' | 'categoria' | 'icono' | 'precio' | 'stockMinimo' | 'activo'>>) =>
    authed<Producto>('PATCH', `/sedes/${id}/productos/${pid}`, data),
  inventario: (id: string, pid: number, mov: { tipo: 'entrada'; cantidad: number; motivo?: string } | { tipo: 'ajuste'; stockContado: number; motivo: string }) =>
    authed<{ stock: number }>('POST', `/sedes/${id}/productos/${pid}/inventario`, mov),
  movimientos: (id: string, pid: number) => authed<Movimiento[]>('GET', `/sedes/${id}/productos/${pid}/movimientos`),
  promociones: (id: string) => authed<Promocion[]>('GET', `/sedes/${id}/promociones`),
  crearPromo: (id: string, data: { nombre: string; descripcion?: string; precio: number; diasSemana: number[]; desde?: string; hasta?: string; productos: { productoId: number; cantidad: number }[]; imagenPath?: string }) =>
    authed<Promocion>('POST', `/sedes/${id}/promociones`, data),
  editarPromo: (id: string, pid: number, data: Record<string, unknown>) => authed<Promocion>('PATCH', `/sedes/${id}/promociones/${pid}`, data),
  firmaImagenPromo: (id: string, tipo: string) => authed<{ path: string; token: string }>('POST', `/sedes/${id}/promociones/imagen`, { tipo }),
  vender: (s: string, items: ItemVenta[], metodo: 'efectivo' | 'terminal', perfilId?: string) =>
    authed<{ pagoId: number; total: number }>('POST', `/recepcion/${s}/ventas`, { items, metodo, ...(perfilId ? { perfilId } : {}) }),
  catalogo: () => authed<Catalogo>('GET', '/yo/tienda'),
  resumen: (desde: string, hasta: string, sedeId?: string) =>
    authed<Resumen>('GET', `/reportes/resumen?desde=${desde}&hasta=${hasta}${sedeId ? `&sedeId=${sedeId}` : ''}`),

  sedes: () => authed<Sede[]>('GET', '/sedes'),
  editarSede: (id: string, data: Partial<Omit<Sede, 'id' | 'diasSinServicio'>> & { diasSinServicio?: number[] }) =>
    authed<Sede>('PATCH', `/sedes/${id}`, data),
  diasCerrados: (id: string) => authed<DiaCerrado[]>('GET', `/sedes/${id}/dias-cerrados`),
  agregarDia: (id: string, fecha: string, motivo: string) => authed<DiaCerrado>('POST', `/sedes/${id}/dias-cerrados`, { fecha, motivo }),
  quitarDia: (id: string, diaId: number) => authed<void>('DELETE', `/sedes/${id}/dias-cerrados/${diaId}`),
  cuentaRecepcion: (id: string) => authed<{ usuario: string; contrasena: string; nueva: boolean }>('POST', `/sedes/${id}/cuenta-recepcion`),
  recepcionistas: (id: string) => authed<Recepcionista[]>('GET', `/sedes/${id}/recepcionistas`),
  crearRecepcionista: (id: string, nombre: string, pin: string) => authed<Recepcionista>('POST', `/sedes/${id}/recepcionistas`, { nombre, pin }),
  editarRecepcionista: (id: string, rid: number, data: { nombre?: string; pin?: string; activo?: boolean }) =>
    authed<Recepcionista>('PATCH', `/sedes/${id}/recepcionistas/${rid}`, data),
  planes: (id: string, todos = false) => authed<Plan[]>('GET', `/sedes/${id}/planes${todos ? '?todos=1' : ''}`),
  crearPlan: (id: string, data: Omit<Plan, 'id' | 'sedeId' | 'activo' | 'descripcion'> & { descripcion?: string }) =>
    authed<Plan>('POST', `/sedes/${id}/planes`, data),
  editarPlan: (id: string, pid: number, data: Partial<Omit<Plan, 'id' | 'sedeId'>>) => authed<Plan>('PATCH', `/sedes/${id}/planes/${pid}`, data),
  bitacora: (id: string) => authed<EntradaBitacora[]>('GET', `/sedes/${id}/bitacora`),

  /* ---------- Recepción ---------- */
  estado: (s: string) => authed<EstadoRecepcion>('GET', `/recepcion/${s}/estado`),
  abrirTurno: (s: string, recepcionistaId: number, pin: string, efectivoInicial: number) =>
    authed<unknown>('POST', `/recepcion/${s}/turno/abrir`, { recepcionistaId, pin, efectivoInicial }),
  cerrarTurno: (s: string, pin: string, efectivoContado: number, notas?: string) =>
    authed<Turno>('POST', `/recepcion/${s}/turno/cerrar`, { pin, efectivoContado, notas }),
  turnos: (s: string) => authed<Turno[]>('GET', `/recepcion/${s}/turnos`),
  solicitudes: (s: string) => authed<SolicitudRecepcion[]>('GET', `/recepcion/${s}/solicitudes`),
  buscar: (s: string, q: string) => authed<SocioBusqueda[]>('GET', `/recepcion/${s}/socios?q=${encodeURIComponent(q)}`),
  ficha: (s: string, perfilId: string) => authed<Ficha>('GET', `/recepcion/${s}/socios/${perfilId}`),
  alta: (s: string, data: { nombre: string; email: string; fechaNacimiento?: string }) =>
    authed<{ id: string; nombre: string; email: string; correoEnviado: boolean }>('POST', `/recepcion/${s}/socios`, data),
  cobrar: (s: string, data: { perfilId: string; planId: number; metodo: 'efectivo' | 'terminal'; solicitudId?: number; credencialValidada?: boolean }) =>
    authed<{ pagoId: number; total: number; inicio: string; fin: string }>('POST', `/recepcion/${s}/cobros`, data),
  entrada: (s: string, perfilId: string) =>
    authed<{ id: number; resultado: 'permitida' | 'rechazada_passback' | 'rechazada_sin_membresia'; fin: string | null; antipassbackMin: number }>(
      'POST',
      `/recepcion/${s}/asistencias`,
      { perfilId },
    ),

  /* ---------- Socio ---------- */
  miMembresia: () => authed<MiMembresia>('GET', '/yo/membresia'),
  solicitar: (planId: number, metodo: 'mostrador' | 'tarjeta') => authed<{ id: number; estado: string; venceEn: string }>('POST', '/yo/solicitudes', { planId, metodo }),
}
