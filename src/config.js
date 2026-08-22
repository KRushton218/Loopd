// Runtime configuration for the imagery providers.
//
// No key is ever committed here. Resolution order, first hit wins:
//   1. window.LOOPD_CONFIG        — an optional <script> injected at deploy time
//   2. import.meta.env.VITE_*     — baked at build time from an untracked .env.local
//   3. localStorage 'loopd-config' — per-browser override, handy while developing
//
// Anything the browser can read is public. A Google key must be locked to our
// HTTP referrer at the provider; a SkyFi key must NOT be shipped to the browser
// at all — point `skyfi.endpoint` at a thin proxy (Supabase Edge Function) that
// holds the secret and speaks the small JSON contract in docs/IMAGERY.md.

const ENV = import.meta.env ?? {}

function localOverrides() {
  try { return JSON.parse(localStorage.getItem('loopd-config')) ?? {} } catch { return {} }
}

function pick(path, envKey) {
  const runtime = path.reduce((o, k) => (o == null ? o : o[k]), globalThis.window?.LOOPD_CONFIG)
  if (runtime != null && runtime !== '') return runtime
  if (envKey && ENV[envKey] != null && ENV[envKey] !== '') return ENV[envKey]
  const local = path.reduce((o, k) => (o == null ? o : o[k]), localOverrides())
  return local != null && local !== '' ? local : null
}

export function imageryConfig() {
  const skyfiEndpoint = pick(['skyfi', 'endpoint'], 'VITE_SKYFI_ENDPOINT')
  const skyfiKey = pick(['skyfi', 'apiKey'], 'VITE_SKYFI_API_KEY')
  const googleKey = pick(['google', 'apiKey'], 'VITE_GOOGLE_MAPS_KEY')

  return {
    skyfi: {
      // Enabled only once someone points us at an endpoint. Until then the
      // flagship tier falls through to the keyless satellite basemap.
      enabled: Boolean(skyfiEndpoint),
      endpoint: skyfiEndpoint,
      apiKey: skyfiKey,
      // Archive scenes older than this are usually the free/cheap tier.
      maxScenes: Number(pick(['skyfi', 'maxScenes']) ?? 3),
      openData: pick(['skyfi', 'openData']) ?? true,
    },
    google: {
      enabled: Boolean(googleKey),
      apiKey: googleKey,
      // Places photos are billed per request; static maps are cheaper.
      photos: pick(['google', 'photos']) ?? true,
      staticMaps: pick(['google', 'staticMaps']) ?? true,
    },
    // Keyless providers. On by default — they are what makes the hero real today.
    wikimedia: { enabled: pick(['wikimedia', 'enabled']) ?? true },
    satellite: { enabled: pick(['satellite', 'enabled']) ?? true },
  }
}

// How close a photo's geotag has to be to the course pin to auto-verify.
// Big courses sprawl ~1.5 km corner to corner; 3 km covers the clubhouse,
// the range, and the far corner of the back nine without letting in the
// next town over.
export const VERIFY_RADIUS_KM = Number(pick(['verification', 'radiusKm']) ?? 3)
