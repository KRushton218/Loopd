// User-contributed course photos.
//
// No backend yet, so a photo is downscaled in the browser and parked in
// localStorage next to the rest of the user's state. That caps us at a few
// megabytes total, which is why uploads are budgeted and evicted oldest-first
// rather than silently failing at the quota wall. Supabase Storage replaces
// this whole file (PLAN §7) — the record shape is already the row shape.

import { readExif } from './exif.js'
import { verifyPhoto, currentPosition } from './verification.js'

const KEY = 'loopd-uploads-v1'
const MAX_EDGE = 1200          // px on the long side once downscaled
const JPEG_QUALITY = 0.72
const MAX_PER_COURSE = 4
const BUDGET_BYTES = 3_000_000 // localStorage realistically gives us ~5 MB

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} }
}

function persist(all) {
  // Trim oldest-first across every course until we are back inside budget,
  // so one enthusiastic uploader cannot wedge the whole app's storage.
  let flat = Object.entries(all).flatMap(([courseId, list]) =>
    list.map((u) => ({ courseId, u })))
  let size = JSON.stringify(all).length
  flat.sort((a, b) => new Date(a.u.addedAt) - new Date(b.u.addedAt))

  while (size > BUDGET_BYTES && flat.length) {
    const oldest = flat.shift()
    all[oldest.courseId] = all[oldest.courseId].filter((x) => x.id !== oldest.u.id)
    if (!all[oldest.courseId].length) delete all[oldest.courseId]
    size = JSON.stringify(all).length
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(all))
    return true
  } catch {
    return false   // private mode or a quota we could not trim under
  }
}

export function uploadsFor(courseId) {
  return readAll()[courseId] ?? []
}

export function removeUpload(courseId, id) {
  const all = readAll()
  all[courseId] = (all[courseId] ?? []).filter((u) => u.id !== id)
  if (!all[courseId].length) delete all[courseId]
  persist(all)
  return all[courseId] ?? []
}

async function downscale(file) {
  const bitmap = await createImageBitmap(file)
  // Verification judges the *original* dimensions — a downscaled copy would
  // make every photo look like it failed the resolution check. Read them
  // before close(), which zeroes the bitmap.
  const source = { width: bitmap.width, height: bitmap.height }
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height))
  const w = Math.round(source.width * scale)
  const h = Math.round(source.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  return { dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), ...source }
}

// Returns { ok, upload, error }. Never throws: an upload failing is a UI
// state, not an exception the course page has to catch.
export async function addUpload({ file, course, user, askLocation = true }) {
  if (!file?.type?.startsWith('image/')) {
    return { ok: false, error: 'That file is not an image.' }
  }
  if (uploadsFor(course.id).length >= MAX_PER_COURSE) {
    return { ok: false, error: `You can add ${MAX_PER_COURSE} photos per course for now.` }
  }

  let processed
  try {
    processed = await downscale(file)
  } catch {
    return { ok: false, error: "Couldn't read that image." }
  }

  const exif = await readExif(file)
  // Only ask the browser for a fix when the file itself has no geotag —
  // no reason to prompt for a permission we do not need.
  const deviceFix = !exif?.lat && askLocation ? await currentPosition() : null

  const verification = verifyPhoto({
    course, exif, deviceFix,
    width: processed.width,
    height: processed.height,
    bytes: file.size,
  })

  const upload = {
    id: `up-${course.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    courseId: course.id,
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    dataUrl: processed.dataUrl,
    width: processed.width,
    height: processed.height,
    bytes: file.size,
    takenAt: exif?.takenAt ?? null,
    geotagged: exif?.lat != null,
    addedAt: new Date().toISOString(),
    verification,
  }

  const all = readAll()
  all[course.id] = [...(all[course.id] ?? []), upload]
  if (!persist(all)) {
    return { ok: false, error: 'Out of local storage — remove a photo and try again.' }
  }
  return { ok: true, upload }
}

// Shapes an upload like everything else the carousel renders.
export function uploadAsMedia(upload) {
  return {
    id: upload.id,
    kind: 'user',
    provider: 'user',
    url: upload.dataUrl,
    caption: upload.takenAt
      ? `Shot ${new Date(upload.takenAt).toLocaleDateString()}`
      : 'Member photo',
    credit: `@${upload.username}`,
    creditUrl: null,
    license: null,
    capturedAt: upload.takenAt,
    verification: upload.verification,
  }
}
