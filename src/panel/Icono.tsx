// Íconos genéricos de productos (en lugar de fotos). Trazo de 2px, mismo lenguaje en todos.
const P: Record<string, string> = {
  proteina: 'M8 3h8v3l2 2v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8l2-2zM6 11h12',
  bebida: 'M7 3h10l-1 18H8zM7.5 9h9',
  agua: 'M10 2h4v3l2 3v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8l2-3zM8 13h8',
  cafe: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2',
  barra: 'M3 9l13-5 5 11-13 5zM8 7l5 11',
  snack: 'M6 4h12l-2 4 2 4-2 4 2 4H6l2-4-2-4 2-4z',
  vitaminas: 'M9 3h6v5H9zM7 8h10v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM10 14h4M12 12v4',
  creatina: 'M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM5 3h14v3H5zM9 11h6v5H9z',
  preentreno: 'M7 5h10v15a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM7 3h10v2M13 9l-3 4h4l-3 4',
  toalla: 'M4 5h16v4H4zM6 9v11h12V9M9 13h6',
  guantes: 'M7 21v-9l-2-3V6a1 1 0 0 1 2 0v3h1V4a1 1 0 0 1 2 0v5h1V3a1 1 0 0 1 2 0v6h1V5a1 1 0 0 1 2 0v8l-2 3v5z',
  shaker: 'M7 3h10l-1 4H8zM8 7h8l-1 14H9z',
  playera: 'M8 3l4 2 4-2 5 4-3 3-2-1v12H8V9l-2 1-3-3z',
  gorra: 'M3 15a9 7 0 0 1 18 0zM12 8V6M3 15h11',
  cinturon: 'M2 9h20v6H2zM14 8h4v8h-4zM16 12h-2',
  visita: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10',
  otro: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
}

export const ICONOS: { clave: string; nombre: string }[] = [
  { clave: 'proteina', nombre: 'Proteína' },
  { clave: 'preentreno', nombre: 'Preentreno' },
  { clave: 'creatina', nombre: 'Creatina' },
  { clave: 'vitaminas', nombre: 'Vitaminas' },
  { clave: 'bebida', nombre: 'Bebida' },
  { clave: 'agua', nombre: 'Agua' },
  { clave: 'cafe', nombre: 'Café' },
  { clave: 'barra', nombre: 'Barra' },
  { clave: 'snack', nombre: 'Snack' },
  { clave: 'shaker', nombre: 'Shaker' },
  { clave: 'toalla', nombre: 'Toalla' },
  { clave: 'guantes', nombre: 'Guantes' },
  { clave: 'cinturon', nombre: 'Cinturón' },
  { clave: 'playera', nombre: 'Playera' },
  { clave: 'gorra', nombre: 'Gorra' },
  { clave: 'visita', nombre: 'Visita' },
  { clave: 'otro', nombre: 'Otro' },
]

export function Icono({ nombre, size = 28 }: { nombre: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[nombre] ?? P.otro} />
    </svg>
  )
}
