// Real course imagery, tiered by how prolific the club is.
//
// The rule from the product side: spend paid/metered imagery credits on the
// clubs people actually open, and fall back to keyless sources for the long
// tail — but never show a generated silhouette when something real exists.
//
//   flagship   (Pebble, Bethpage — heavy ratings)  SkyFi archive → satellite → Wikimedia → Google
//   known      (a few hundred ratings, or notes)   satellite → Wikimedia → Google
//   long tail  (everything OSM search turns up)    satellite → Wikimedia
//
// Every provider fails soft to the next one, and the generated silhouette is
// the last resort, so the hero is never empty and never blocks on the network.
//
// Media item shape (one carousel slide):
//   { id, kind, provider, url?, map?, caption, credit, creditUrl, license,
//     capturedAt?, verification? }
//   kind: 'satellite' | 'photo' | 'placeholder' | 'user'
//   map:  { lat, lng, zoom, layer } — rendered as tiles by <CourseMap/>

import { imageryConfig } from './config.js'

/* ---------------- tiering ---------------- */

export function prominenceTier(course) {
  if (course.tier) return course.tier                  // explicit override wins
  const ratings = course.numRatings ?? 0
  const notes = course.notes?.length ?? 0
  if (ratings >= 800) return 'flagship'
  if (ratings >= 150 || notes > 0) return 'known'
  return 'longTail'
}

const PLAN = {
  flagship: ['skyfi', 'satellite', 'wikimedia', 'googlePlaces'],
  known: ['satellite', 'wikimedia', 'googlePlaces'],
  longTail: ['satellite', 'wikimedia'],
}

export function providerPlan(course) {
  return PLAN[prominenceTier(course)] ?? PLAN.longTail
}

/* ---------------- satellite basemap (keyless, always available) ---------------- */

// Esri's World Imagery is free to use with attribution and needs no key, so a
// static deploy can show a real aerial of the actual course on day one. Swap
// LAYER for Mapbox Satellite once we have a token (PLAN §3) — same shape.
export const SATELLITE_LAYER = {
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  maxZoom: 19,
}

// The plain street map, for the desktop "where is this" panel.
export const STREET_LAYER = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}

function satelliteItem(course) {
  return {
    id: `sat-${course.id}`,
    kind: 'satellite',
    provider: 'esri',
    map: { lat: course.lat, lng: course.lng, zoom: 16, layer: SATELLITE_LAYER },
    caption: 'Satellite view',
    credit: 'Esri · Maxar',
    creditUrl: 'https://www.esri.com/en-us/legal/terms/data-attributions',
    license: 'Esri World Imagery terms',
  }
}

/* ---------------- SkyFi archive ---------------- */

// SkyFi sells fresh tasking but also exposes an *archive* of already-captured
// scenes, including open-data ones that cost nothing — that is the tier worth
// pulling for the clubs everyone opens.
//
// The key must not reach the browser, so we call `skyfi.endpoint` (our proxy)
// rather than SkyFi directly, and read the response tolerantly: field names
// differ between the archive-search API and the MCP tool output, and we would
// rather show two of three scenes than throw on a renamed key.
function firstOf(obj, keys) {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), obj)
    if (v != null && v !== '') return v
  }
  return null
}

async function fetchSkyfi(course, { signal, config }) {
  const { endpoint, apiKey, maxScenes, openData } = config.skyfi
  const url = new URL(endpoint)
  url.searchParams.set('lat', course.lat)
  url.searchParams.set('lng', course.lng)
  url.searchParams.set('name', course.name)
  url.searchParams.set('limit', String(maxScenes))
  if (openData) url.searchParams.set('openData', 'true')

  const res = await fetch(url, {
    signal,
    headers: apiKey ? { 'X-Skyfi-Api-Key': apiKey } : undefined,
  })
  if (!res.ok) throw new Error(`skyfi ${res.status}`)
  const json = await res.json()
  const scenes = json.archives ?? json.results ?? json.scenes ?? (Array.isArray(json) ? json : [])

  return scenes.slice(0, maxScenes).map((s, i) => {
    const thumb = firstOf(s, ['thumbnailUrls.300x300', 'thumbnailUrl', 'previewUrl', 'thumbnail', 'url'])
    if (!thumb) return null
    const captured = firstOf(s, ['captureTimestamp', 'capturedAt', 'acquisitionDate', 'date'])
    const sat = firstOf(s, ['provider', 'constellation', 'satellite', 'platform'])
    const res_m = firstOf(s, ['resolution', 'gsd', 'openData.resolution'])
    return {
      id: `skyfi-${course.id}-${firstOf(s, ['archiveId', 'id']) ?? i}`,
      kind: 'satellite',
      provider: 'skyfi',
      url: thumb,
      caption: [res_m && `${res_m} archive capture`, captured && new Date(captured).toLocaleDateString()]
        .filter(Boolean).join(' · ') || 'Archive capture',
      credit: ['SkyFi', sat].filter(Boolean).join(' · '),
      creditUrl: 'https://skyfi.com',
      license: 'SkyFi archive licence',
      capturedAt: captured,
    }
  }).filter(Boolean)
}

/* ---------------- Wikimedia Commons (keyless) ---------------- */

// Geosearch Commons for freely-licensed photos taken at the course, then fall
// back to the club's Wikipedia lead image. Both are CORS-open with origin=*,
// and both are CC/public-domain — the credit line below is the licence
// condition, not decoration, so it renders on the slide.
async function fetchWikimedia(course, { signal }) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'geosearch', ggsnamespace: '6',
    ggscoord: `${course.lat}|${course.lng}`,
    ggsradius: '3000', ggslimit: '12',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200',
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal })
  if (!res.ok) throw new Error(`commons ${res.status}`)
  const json = await res.json()
  const pages = Object.values(json.query?.pages ?? {})

  return pages.map((p) => {
    const info = p.imageinfo?.[0]
    if (!info?.thumburl) return null
    const meta = info.extmetadata ?? {}
    const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').trim()
    const title = strip(p.title).replace(/^File:/, '').replace(/\.\w+$/, '')
    return {
      id: `wm-${p.pageid}`,
      kind: 'photo',
      provider: 'wikimedia',
      url: info.thumburl,
      caption: strip(meta.ObjectName?.value) || title,
      credit: strip(meta.Artist?.value) || 'Wikimedia Commons',
      creditUrl: info.descriptionurl,
      license: strip(meta.LicenseShortName?.value) || 'See Commons',
      capturedAt: strip(meta.DateTimeOriginal?.value) || null,
    }
  }).filter(Boolean)
}

/* ---------------- Google Places photos / Static Maps (key required) ---------------- */

// Off unless a referrer-restricted key is configured. Places photos are billed
// per request, which is exactly why they sit below the keyless tiers.
async function fetchGooglePlaces(course, { signal, config }) {
  const { apiKey, photos, staticMaps } = config.google
  const out = []

  if (staticMaps) {
    out.push({
      id: `gmap-${course.id}`,
      kind: 'satellite',
      provider: 'google',
      url: 'https://maps.googleapis.com/maps/api/staticmap?' + new URLSearchParams({
        center: `${course.lat},${course.lng}`,
        zoom: '16', size: '640x400', scale: '2', maptype: 'satellite', key: apiKey,
      }),
      caption: 'Satellite view',
      credit: 'Google',
      creditUrl: 'https://www.google.com/permissions/geoguidelines/',
      license: 'Google Maps Platform terms',
    })
  }

  if (photos) {
    const find = 'https://places.googleapis.com/v1/places:searchText'
    const res = await fetch(find, {
      signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
      },
      body: JSON.stringify({
        textQuery: `${course.name} golf course`,
        locationBias: { circle: { center: { latitude: course.lat, longitude: course.lng }, radius: 3000 } },
        maxResultCount: 1,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      const place = json.places?.[0]
      for (const [i, photo] of (place?.photos ?? []).slice(0, 4).entries()) {
        out.push({
          id: `gphoto-${place.id}-${i}`,
          kind: 'photo',
          provider: 'google',
          url: `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1200&key=${apiKey}`,
          caption: place.displayName?.text ?? course.name,
          // Google's terms require the contributor attribution to be displayed.
          credit: photo.authorAttributions?.[0]?.displayName ?? 'Google',
          creditUrl: photo.authorAttributions?.[0]?.uri ?? 'https://maps.google.com',
          license: 'Google Maps Platform terms',
        })
      }
    }
  }
  return out
}

const PROVIDERS = {
  skyfi: { id: 'skyfi', label: 'SkyFi archive', fetch: fetchSkyfi, enabled: (c) => c.skyfi.enabled },
  satellite: { id: 'satellite', label: 'Satellite basemap', fetch: null, enabled: (c) => c.satellite.enabled },
  wikimedia: { id: 'wikimedia', label: 'Wikimedia Commons', fetch: fetchWikimedia, enabled: (c) => c.wikimedia.enabled },
  googlePlaces: { id: 'googlePlaces', label: 'Google Places', fetch: fetchGooglePlaces, enabled: (c) => c.google.enabled },
}

/* ---------------- the seeded silhouette, as a last resort ---------------- */

// The demo courses carry hand-picked gradients; keep them as a fallback slide
// so a course with no network-backed imagery still has something to show.
function placeholderItems(course) {
  return (course.photos ?? []).map((p, i) => ({
    id: `ph-${course.id}-${i}`,
    kind: 'placeholder',
    provider: 'generated',
    grad: p.grad,
    caption: p.caption,
    credit: 'Illustration',
    license: null,
  }))
}

/* ---------------- metadata cache ---------------- */

// URLs and credits only — never pixels. Keeps a re-open instant without
// re-billing a metered provider.
const CACHE_KEY = 'loopd-media-v1'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ENTRIES = 120
const memory = new Map()

function readCache(courseId) {
  if (memory.has(courseId)) return memory.get(courseId)
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}
    const hit = all[courseId]
    if (hit && Date.now() - hit.ts < TTL_MS) {
      memory.set(courseId, hit.items)
      return hit.items
    }
  } catch { /* corrupted cache is just a miss */ }
  return null
}

function writeCache(courseId, items) {
  memory.set(courseId, items)
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}
    all[courseId] = { ts: Date.now(), items }
    const entries = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_ENTRIES)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch { /* private mode / quota — the in-memory copy still helps */ }
}

export function clearMediaCache() {
  memory.clear()
  try { localStorage.removeItem(CACHE_KEY) } catch { /* nothing to clear */ }
}

/* ---------------- the one function the UI calls ---------------- */

const MAX_ITEMS = 10

// Resolves everything a course page can show, best-first. Never rejects:
// a provider that is down, blocked, or rate-limited just drops out.
export async function loadCourseMedia(course, { signal } = {}) {
  if (!course) return { items: [], tier: 'longTail', providers: [] }
  const config = imageryConfig()
  const tier = prominenceTier(course)
  const plan = providerPlan(course).filter((id) => PROVIDERS[id]?.enabled(config))

  const cached = readCache(course.id)
  if (cached) return { items: cached, tier, providers: plan, cached: true }

  // The satellite basemap is tiles, not a request — it is available instantly
  // and leads the carousel because it is the one image guaranteed to be of
  // *this* course. Photo providers can only ever be a confident guess.
  const items = []
  if (plan.includes('satellite')) items.push(satelliteItem(course))

  const networked = plan.filter((id) => PROVIDERS[id].fetch)
  const fetched = await Promise.allSettled(
    networked.map((id) => PROVIDERS[id].fetch(course, { signal, config })),
  )
  for (const [i, r] of fetched.entries()) {
    if (r.status === 'fulfilled') items.push(...r.value)
    else if (r.reason?.name !== 'AbortError') {
      console.warn(`[imagery] ${networked[i]} unavailable:`, r.reason?.message ?? r.reason)
    }
  }

  // SkyFi's dated archive scene is a better lead than a generic basemap.
  items.sort((a, b) => rank(a) - rank(b))
  const seen = new Set()
  const deduped = items.filter((it) => {
    const key = it.url ?? it.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, MAX_ITEMS)

  const final = deduped.length ? deduped : placeholderItems(course)
  if (final.length && !signal?.aborted) writeCache(course.id, final)
  return { items: final, tier, providers: plan }
}

function rank(item) {
  if (item.provider === 'skyfi') return 0
  if (item.kind === 'satellite') return 1
  if (item.kind === 'photo') return 2
  return 3
}
