import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { distanceKm, sedes } from './data'
import { openStatus } from './status'

export type Focus = { index: number; nonce: number } | null

const markerIcon = (active: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="pin ${active ? 'is-active' : ''}"><img src="/images/logos/casco-claro.png" alt="" /></span>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -30],
  })

const bounds = L.latLngBounds(sedes.map((s) => s.coords)).pad(0.4)

/** Mueve la cámara cuando cambia el foco. */
function Camera({ focus, user }: { focus: Focus; user: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (!focus) return
    const sede = sedes[focus.index]
    if (user) {
      // Encuadra a la persona y a su sede, luego acerca a la sede.
      map.flyToBounds(L.latLngBounds([user, sede.coords]).pad(0.3), { duration: 1.2 })
      const t = setTimeout(() => map.flyTo(sede.coords, 16, { duration: 1.4 }), 1500)
      return () => clearTimeout(t)
    }
    map.flyTo(sede.coords, 16, { duration: 1.4 })
  }, [focus, map, user])
  return null
}

function Reset({ nonce }: { nonce: number }) {
  const map = useMap()
  useEffect(() => {
    if (nonce) map.flyToBounds(bounds, { duration: 1 })
  }, [nonce, map])
  return null
}

type Geo = { state: 'idle' | 'loading' | 'done' | 'error'; text?: string }

export default function SedesMap({
  focus,
  onFocus,
  onOpenSede,
  now,
}: {
  focus: Focus
  onFocus: (index: number) => void
  onOpenSede: (index: number) => void
  now: Date
}) {
  const [user, setUser] = useState<[number, number] | null>(null)
  const [geo, setGeo] = useState<Geo>({ state: 'idle' })
  const [reset, setReset] = useState(0)
  const markers = useRef<(L.Marker | null)[]>([])

  // Abre el popup de la sede enfocada cuando termina de volar.
  useEffect(() => {
    if (!focus) return
    const t = setTimeout(() => markers.current[focus.index]?.openPopup(), user ? 3000 : 1500)
    return () => clearTimeout(t)
  }, [focus, user])

  const icons = useMemo(() => sedes.map((_, i) => markerIcon(focus?.index === i)), [focus])

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ state: 'error', text: 'Tu navegador no permite detectar tu ubicación.' })
      return
    }
    setGeo({ state: 'loading', text: 'Buscando tu ubicación…' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        const ranked = sedes
          .map((s, i) => ({ i, km: distanceKm(here, s.coords) }))
          .sort((a, b) => a.km - b.km)
        const best = ranked[0]
        setUser(here)
        setGeo({
          state: 'done',
          text: `Tu sede más cercana es ${sedes[best.i].name}, a ${best.km < 10 ? best.km.toFixed(1) : Math.round(best.km)} km.`,
        })
        onFocus(best.i)
      },
      (err) => {
        setGeo({
          state: 'error',
          text:
            err.code === err.PERMISSION_DENIED
              ? 'No diste permiso de ubicación. Elige tu sede en la lista.'
              : 'No pudimos obtener tu ubicación. Inténtalo de nuevo.',
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div className="map">
      <MapContainer bounds={bounds} scrollWheelZoom={false} className="map__canvas" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map__tiles"
          maxZoom={19}
        />
        {sedes.map((s, i) => {
          const st = openStatus(s.week, now)
          return (
            <Marker
              key={s.id}
              position={s.coords}
              icon={icons[i]}
              ref={(m) => { markers.current[i] = m }}
              eventHandlers={{ click: () => onFocus(i) }}
              title={`Sede ${s.name}`}
            >
              <Popup className="map-popup">
                <strong className="map-popup__name">Sede {s.name}</strong>
                <span className="map-popup__addr">{s.address}</span>
                <span className={`status ${st.open ? 'is-open' : ''}`}><span className="status__dot" />{st.text}</span>
                <span className="map-popup__actions">
                  <button type="button" className="btn btn--red btn--sm" onClick={() => onOpenSede(i)}>Ver sede</button>
                  <a className="btn btn--glass btn--sm glass" href={s.mapsUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
                </span>
              </Popup>
            </Marker>
          )
        })}
        {user && (
          <CircleMarker center={user} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#3d8bff', fillOpacity: 1 }} />
        )}
        <Camera focus={focus} user={user} />
        <Reset nonce={reset} />
      </MapContainer>

      <div className="map__panel glass">
        <button type="button" className="btn btn--red map__locate" onClick={locate} disabled={geo.state === 'loading'}>
          <span className="locate-icon" aria-hidden="true" />
          {geo.state === 'loading' ? 'Buscando…' : 'Encontrar mi sede más cercana'}
        </button>
        <p className={`map__msg ${geo.state === 'error' ? 'is-error' : ''}`} aria-live="polite">
          {geo.text ?? 'O elige una sede para acercar el mapa.'}
        </p>
        <ul className="map__list">
          {sedes.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={`map__item ${focus?.index === i ? 'is-active' : ''}`}
                onClick={() => onFocus(i)}
              >
                <img src="/images/logos/casco-oscuro.png" alt="" width={28} height={28} />
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.city}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="map__all" onClick={() => setReset((n) => n + 1)}>Ver las tres sedes</button>
      </div>
    </div>
  )
}
