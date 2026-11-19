import type { Week } from './data'

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const fmt = (t: string) => t.replace(/^0/, '')

/** Hora actual en la zona del gimnasio (centro de México). */
function nowInMexico(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { day, min: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function openStatus(week: Week, date?: Date): { open: boolean; text: string } {
  const { day, min } = nowInMexico(date)
  const today = week[day]
  if (today && min >= toMin(today[0]) && min < toMin(today[1])) {
    const left = toMin(today[1]) - min
    return {
      open: true,
      text: left <= 60 ? `Abierto · cierra en ${left} min` : `Abierto ahora · cierra a las ${fmt(today[1])}`,
    }
  }
  if (today && min < toMin(today[0])) {
    return { open: false, text: `Cerrado · abre hoy a las ${fmt(today[0])}` }
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7
    const h = week[d]
    if (h) {
      const when = i === 1 ? 'mañana' : `el ${DAYS[d]}`
      return { open: false, text: `Cerrado · abre ${when} a las ${fmt(h[0])}` }
    }
  }
  return { open: false, text: 'Cerrado' }
}
