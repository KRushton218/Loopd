// Live course search over OpenStreetMap data via the Photon geocoder.
// Keyless and CORS-open, so it works from a static deploy — no API key to
// leak. Filtered server-side to leisure=golf_course. OSM data is ODbL:
// attribution is shown in the search results footer.
const ENDPOINT = 'https://photon.komoot.io/api/'

function normalize(feature) {
  const p = feature.properties
  const [lng, lat] = feature.geometry.coordinates
  return {
    id: `osm-${p.osm_type || 'N'}${p.osm_id}`,
    name: p.name,
    lat, lng,
    city: p.city || p.town || p.village || p.county || '',
    state: p.state || '',
    country: p.country || '',
    rating: null, numRatings: 0, yourScore: null, friendsScore: null,
    website: null, phone: null,
    access: '', par: null, yardage: null,
    region: p.state || p.country || '',
    photos: [], notes: [],
    source: 'osm',
  }
}

export async function searchLiveCourses(query, signal) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&osm_tag=leisure:golf_course&limit=10&lang=en`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`course search failed: ${res.status}`)
  const json = await res.json()
  return (json.features || []).filter((f) => f.properties?.name).map(normalize)
}
