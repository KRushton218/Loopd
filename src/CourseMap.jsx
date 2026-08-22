import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// One map component for two jobs: the satellite slide in the hero carousel
// (interactive={false} — it is a picture of the course, not a map you drive)
// and the embedded map on the desktop course page.
//
// Leaflet is already a dependency and it owns the tile maths, retina handling
// and resize behaviour, so a real aerial costs us nothing extra over hand-
// stitching a static-image URL — and it works with no API key.
export default function CourseMap({
  lat, lng, zoom = 16, layer, interactive = false, marker = true, className = '',
}) {
  const el = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    const map = L.map(el.current, {
      zoomControl: interactive,
      // The hero slide renders its own credit pill, so Leaflet's control would
      // both duplicate the attribution and sit on top of the course title.
      attributionControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      tap: interactive,
    }).setView([lat, lng], zoom)
    mapRef.current = map

    L.tileLayer(layer.url, {
      attribution: layer.attribution,
      maxZoom: layer.maxZoom ?? 19,
    }).addTo(map)

    if (marker) {
      L.marker([lat, lng], {
        interactive: false,
        icon: L.divIcon({ className: '', html: '<div class="map-pin course"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(map)
    }

    // The hero is inside a carousel that may still be laying out when the map
    // mounts; without this Leaflet caches a zero size and renders one tile.
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el.current)

    return () => { ro.disconnect(); map.remove() }
  }, [lat, lng, zoom, interactive, marker, layer.url])

  return <div ref={el} className={`course-map ${className}`} aria-label="Map of the course" />
}
