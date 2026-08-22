import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { allCourses } from './data.js'

// Trip-planning map: every course pinned, colored by your relationship to it.
// Clusters of nearby pins are exactly the "plan a trip around these" signal.
export default function MapView({ scores, bookmarks, playedSet, onOpenCourse, onClose }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true })
    mapRef.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const bounds = []
    for (const c of allCourses()) {
      const isPlayed = playedSet.has(c.id)
      const isSaved = bookmarks.includes(c.id)
      const cls = isPlayed ? 'played' : isSaved ? 'saved' : 'other'
      const label = isPlayed && scores[c.id] != null ? scores[c.id].toFixed(1) : '⛳'
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-pin ${cls}">${label}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
      const m = L.marker([c.lat, c.lng], { icon }).addTo(map)
      const place = [c.city, c.state || c.country].filter(Boolean).join(', ')
      m.bindPopup(
        `<b>${c.name}</b><br>${place}${c.rating != null ? ' · ' + c.rating.toFixed(1) : ''}<br>` +
        `<a href="#" data-course="${c.id}" class="popup-link">Open course →</a>`
      )
      bounds.push([c.lat, c.lng])
    }
    map.fitBounds(bounds, { padding: [40, 40] })

    // Popup links → course page (delegated so it works for every popup).
    const onClick = (e) => {
      const a = e.target.closest('a[data-course]')
      if (a) { e.preventDefault(); onOpenCourse(a.dataset.course) }
    }
    mapEl.current.addEventListener('click', onClick)

    return () => { mapEl.current?.removeEventListener('click', onClick); map.remove() }
  }, [])

  return (
    <div className="map-overlay">
      <div ref={mapEl} className="map-canvas" />
      <button className="hero-back map-close" onClick={onClose}>✕</button>
      <div className="map-legend">
        <span><i className="dot played" /> Played</span>
        <span><i className="dot saved" /> Bookmarked</span>
        <span><i className="dot other" /> To discover</span>
      </div>
    </div>
  )
}
