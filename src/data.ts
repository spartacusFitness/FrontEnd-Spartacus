// Coordenadas: de los enlaces de Google Maps del gimnasio.
// Direcciones: aproximadas (OpenStreetMap) — confirmar.
// Horarios, precios y "qué encontrarás": CONTENIDO DE MUESTRA, confirmar con cada sede.

export type Hours = [open: string, close: string] | null // null = cerrado
/** Índice 0 = domingo … 6 = sábado */
export type Week = [Hours, Hours, Hours, Hours, Hours, Hours, Hours]

export interface Photo {
  src: string
  alt: string
  w: number
  h: number
}

export interface Plan {
  name: 'Visita' | 'Semana' | 'Mes'
  price: number
  lines: string[]
}

export interface Sede {
  id: string
  name: string
  city: string
  address: string
  coords: [number, number]
  mapsUrl: string
  week: Week
  hoursText: [string, string][]
  highlights: { title: string; text: string }[]
  plans: Plan[]
  photos: Photo[]
}

const p = (sede: string, n: number, alt: string, w = 1200, h = 1600): Photo => ({
  src: `/images/${sede}/imagen${n}.jpeg`,
  alt,
  w,
  h,
})

/** Lo que tienen todas las sedes. */
export const base = ['Peso libre', 'Máquinas de placas', 'Máquinas de selector', 'Racks y Smith', 'Cardio', 'Lockers']

export const sedes: Sede[] = [
  {
    id: 'dolores',
    name: 'Dolores',
    city: 'Dolores Hidalgo, Gto.',
    address: 'Calle Nayarit 54, Col. Mariano Balleza, 37803 Dolores Hidalgo, Gto.',
    coords: [21.1588342, -100.9303548],
    mapsUrl: 'https://maps.app.goo.gl/vz48B85iWDDCfwaL8',
    week: [['08:00', '14:00'], ['05:00', '23:00'], ['05:00', '23:00'], ['05:00', '23:00'], ['05:00', '23:00'], ['05:00', '23:00'], ['06:00', '18:00']],
    hoursText: [['Lunes a viernes', '5:00 – 23:00'], ['Sábado', '6:00 – 18:00'], ['Domingo', '8:00 – 14:00']],
    highlights: [
      { title: 'Techo de luz hexagonal', text: 'La nave entera iluminada por hexágonos de luz blanca.' },
      { title: 'Zona de cardio larga', text: 'Una fila de caminadoras y elípticas a lo largo del pasillo.' },
      { title: 'Lockers a la entrada', text: 'Guarda tus cosas antes de pisar el área de pesas.' },
    ],
    plans: [
      { name: 'Visita', price: 60, lines: ['Un día completo', 'Acceso a todo el piso'] },
      { name: 'Semana', price: 180, lines: ['7 días seguidos', 'Acceso a todo el piso', 'Lockers'] },
      { name: 'Mes', price: 450, lines: ['30 días', 'Acceso a todo el piso', 'Lockers', 'Rutina inicial con instructor'] },
    ],
    photos: [
      p('sedeDolores', 2, 'Nave de Dolores con techo de luces hexagonales y máquinas rojas'),
      p('sedeDolores', 1, 'Fila de caminadoras y lockers bajo las luces hexagonales'),
      p('sedeDolores', 3, 'Máquinas de pierna y discos azules con gente entrenando'),
      p('sedeDolores', 4, 'Pasillo central con tragaluces y bancos rojos'),
      p('sedeDolores', 5, 'Cartel "Nunca olvides dónde empezaste" sobre las caminadoras'),
    ],
  },
  {
    id: 'san-felipe',
    name: 'San Felipe',
    city: 'San Felipe, Gto.',
    address: 'Calle Leona Vicario 306, La Huerta de San Agustín, 37600 San Felipe, Gto.',
    coords: [21.4858429, -101.2223491],
    mapsUrl: 'https://maps.app.goo.gl/8foGwfjfe3DUJpS5A',
    week: [['08:00', '13:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['06:00', '16:00']],
    hoursText: [['Lunes a viernes', '5:00 – 22:00'], ['Sábado', '6:00 – 16:00'], ['Domingo', '8:00 – 13:00']],
    highlights: [
      { title: 'La nave más grande', text: 'Techo de acero alto y luz de día sobre todo el piso.' },
      { title: 'Peso libre amplio', text: 'Racks largos de mancuernas Hammer Strength y bancos de sobra.' },
      { title: 'Ciclismo indoor', text: 'Bicicletas de spinning junto al área de máquinas.' },
    ],
    plans: [
      { name: 'Visita', price: 55, lines: ['Un día completo', 'Acceso a todo el piso'] },
      { name: 'Semana', price: 170, lines: ['7 días seguidos', 'Acceso a todo el piso', 'Lockers'] },
      { name: 'Mes', price: 420, lines: ['30 días', 'Acceso a todo el piso', 'Lockers', 'Rutina inicial con instructor'] },
    ],
    photos: [
      p('sedeSanFelipe', 6, 'La nave de San Felipe con techo de acero y decenas de máquinas rojas', 1280, 960),
      p('sedeSanFelipe', 5, 'Máquinas de selector rojas en fila', 960, 1280),
      p('sedeSanFelipe', 1, 'Rack de barras y mancuernas frente al espejo', 1280, 960),
      p('sedeSanFelipe', 2, 'Discos negros y máquinas rojas con gente entrenando', 1280, 960),
      p('sedeSanFelipe', 7, 'Racks de mancuernas y bancos planos', 1280, 960),
      p('sedeSanFelipe', 4, 'Máquina roja de selector con la nave al fondo', 1280, 960),
      p('sedeSanFelipe', 3, 'Mancuerna Hammer Strength de 20 kg', 1280, 960),
    ],
  },
  {
    id: 'san-luis',
    name: 'San Luis',
    city: 'San Luis de la Paz, Gto.',
    address: 'Av. Ferrocarril, Col. Vista Hermosa, 37900 San Luis de la Paz, Gto.',
    coords: [21.2915606, -100.5145921],
    mapsUrl: 'https://maps.app.goo.gl/xeEA4xWACmcW2VEa8',
    week: [null, ['05:30', '22:00'], ['05:30', '22:00'], ['05:30', '22:00'], ['05:30', '22:00'], ['05:30', '22:00'], ['07:00', '15:00']],
    hoursText: [['Lunes a viernes', '5:30 – 22:00'], ['Sábado', '7:00 – 15:00'], ['Domingo', 'Cerrado']],
    highlights: [
      { title: 'Escaladoras', text: 'Una fila completa de escaladoras rojas bajo arcos de piedra.' },
      { title: 'Caminadoras curvas', text: 'Sin motor: tú pones la velocidad.' },
      { title: 'Edificio de piedra', text: 'Entrenas entre arcos y muros de piedra de otro siglo.' },
    ],
    plans: [
      { name: 'Visita', price: 50, lines: ['Un día completo', 'Acceso a todo el piso'] },
      { name: 'Semana', price: 160, lines: ['7 días seguidos', 'Acceso a todo el piso', 'Lockers'] },
      { name: 'Mes', price: 400, lines: ['30 días', 'Acceso a todo el piso', 'Lockers', 'Rutina inicial con instructor'] },
    ],
    photos: [
      p('sedeSanLuis', 2, 'Fila de escaladoras rojas bajo un arco de piedra'),
      p('sedeSanLuis', 1, 'Máquina Smith roja con discos negros apilados'),
      p('sedeSanLuis', 5, 'Máquina de pec deck roja frente a un arco de piedra'),
      p('sedeSanLuis', 6, 'Racks de mancuernas de hule de 25 kg en adelante'),
      p('sedeSanLuis', 3, 'Caminadoras curvas sin motor junto a un muro de piedra'),
      p('sedeSanLuis', 4, 'Escaladoras y elípticas bajo el arco de piedra'),
    ],
  },
]

export const appFeatures = [
  { title: 'Paga con tarjeta', text: 'Visita, semana o mes desde tu celular. Pagos procesados por Stripe.' },
  { title: 'Tu racha', text: 'Cada día que entrenas suma. No la rompas.' },
  { title: 'Objetivos', text: 'Bajar de peso, ganar fuerza: registra tu meta y mira tu avance.' },
  { title: 'Nutrición', text: 'Recomendaciones de comidas según tu objetivo.' },
  { title: 'Rutinas', text: 'Armadas por tu coach o generadas con IA, listas para el piso.' },
  { title: 'Comunidad', text: 'Sigue a tus compañeros de sede y comparte tu progreso.' },
]

export const faqs = [
  {
    q: '¿Necesito experiencia para empezar?',
    a: 'No. El primer día un instructor te enseña el piso, ajusta las máquinas contigo y te deja una rutina para tus primeras semanas.',
  },
  {
    q: '¿Qué debo llevar?',
    a: 'Ropa deportiva, tenis limpios y toalla: es obligatoria para usar bancos y máquinas. Hay lockers para tus cosas mientras entrenas.',
  },
  {
    q: '¿Los precios son iguales en todas las sedes?',
    a: 'No. Todas manejan visita, semana y mes, pero cada sede tiene sus propios precios. Elige tu sede arriba para verlos.',
  },
  {
    q: '¿Cómo pago?',
    a: 'En recepción en efectivo o con tarjeta, o en línea desde la app web de Spartacus con tarjeta de crédito o débito. Entras con tu correo o con tu cuenta de Google.',
  },
  {
    q: '¿Cómo me inscribo?',
    a: 'En recepción de cualquier sede, con una identificación. Pagas tu primer periodo y entrenas ese mismo día.',
  },
]

/** Distancia en km entre dos puntos (fórmula de haversine). */
export function distanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
