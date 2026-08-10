// localStorage-backed user state: your ranked courses (Beli-style bands),
// bookmarks, and check-in notes. This is the layer a real backend replaces.
import { played, bookmarked, courseById } from './data.js'

const KEY = 'loopd-v1'

// Score bands: position within a band maps linearly onto its range.
export const BANDS = {
  loved: { label: 'Loved it', emoji: '😍', hi: 10, lo: 7.5 },
  liked: { label: 'Liked it', emoji: '🙂', hi: 7.4, lo: 5 },
  notForMe: { label: 'Not for me', emoji: '😕', hi: 4.9, lo: 2.5 },
}
export const BAND_ORDER = ['loved', 'liked', 'notForMe']

export function initialStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved && saved.bands) return saved
  } catch { /* corrupted or absent — fall through to seed */ }

  // Seed from the demo data: place pre-played courses into bands by their score.
  const bands = { loved: [], liked: [], notForMe: [] }
  const entries = played
    .map((id) => ({ id, s: courseById(id).yourScore ?? 7 }))
    .sort((a, b) => b.s - a.s)
  for (const e of entries) {
    const band = e.s >= 7.5 ? 'loved' : e.s >= 5 ? 'liked' : 'notForMe'
    bands[band].push(e.id)
  }
  return {
    bands,
    bookmarks: [...bookmarked],
    checkins: played.map((id) => ({ courseId: id, note: '', date: null })),
  }
}

export function saveStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* private mode etc. */ }
}

// Position in band → 0–10 score. Best in "loved" is always a 10.0.
export function computeScores(bands) {
  const scores = {}
  for (const key of BAND_ORDER) {
    const { hi, lo } = BANDS[key]
    const list = bands[key]
    list.forEach((id, i) => {
      const t = list.length > 1 ? i / (list.length - 1) : 0
      scores[id] = Math.round((hi - (hi - lo) * t) * 10) / 10
    })
  }
  return scores
}

export function playedIds(store) {
  return BAND_ORDER.flatMap((k) => store.bands[k])
}

export function isPlayed(store, courseId) {
  return playedIds(store).includes(courseId)
}

export function removeFromBands(bands, courseId) {
  const next = {}
  for (const k of BAND_ORDER) next[k] = bands[k].filter((id) => id !== courseId)
  return next
}
