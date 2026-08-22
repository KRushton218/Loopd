// "Verified by our system" for user-uploaded course photos.
//
// The claim a photo makes is "this is what that course looks like", so the
// check that matters is *was it taken there*. A geotag inside the course
// boundary is strong evidence; a geotag somewhere else is proof it is not.
// Everything else is inconclusive and goes to review rather than being
// silently published or silently dropped.
//
// Client-side checks are advisory. They stop honest mistakes and cheap
// reposts, not a determined faker — EXIF is trivially editable. The
// authoritative pass runs server-side before publish (PLAN §7: vision
// moderation is an App Store 1.2 requirement), which is why the states below
// map 1:1 onto the review queue a backend will own.

import { VERIFY_RADIUS_KM } from './config.js'

export const STATUS = {
  verified: { label: 'Verified', icon: '✓', tone: 'ok' },
  pending: { label: 'Pending review', icon: '◔', tone: 'wait' },
  rejected: { label: "Couldn't verify", icon: '!', tone: 'bad' },
}

export function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

// A photo big enough to be a camera shot rather than a screenshot or a
// thumbnail someone scraped off the club's website.
function sanityCheck({ width, height, bytes }) {
  if (width < 600 || height < 400) {
    return { id: 'resolution', pass: false, detail: `${width}×${height} is too small to be an original` }
  }
  const aspect = width / height
  if (aspect > 3.5 || aspect < 0.28) {
    return { id: 'resolution', pass: false, detail: 'Extreme crop — looks like a screenshot' }
  }
  if (bytes < 20_000) {
    return { id: 'resolution', pass: false, detail: 'Heavily recompressed — likely a repost' }
  }
  return { id: 'resolution', pass: true, detail: `${width}×${height}` }
}

function locationCheck(course, exif, deviceFix) {
  const target = { lat: course.lat, lng: course.lng }

  if (exif?.lat != null) {
    const km = distanceKm(target, { lat: exif.lat, lng: exif.lng })
    return km <= VERIFY_RADIUS_KM
      ? { id: 'geotag', pass: true, weight: 'strong', detail: `Geotagged ${km.toFixed(1)} km from the pin` }
      : { id: 'geotag', pass: false, weight: 'strong', detail: `Geotagged ${Math.round(km)} km away` }
  }

  // No geotag — most phones strip it on share. If the upload is happening at
  // the course we can still corroborate it, just more weakly: the device is
  // there now, which is not the same as the photo being taken there.
  if (deviceFix) {
    const km = distanceKm(target, deviceFix)
    return km <= VERIFY_RADIUS_KM
      ? { id: 'device-location', pass: true, weight: 'weak', detail: `Uploaded from ${km.toFixed(1)} km away` }
      : { id: 'device-location', pass: false, weight: 'weak', detail: `Uploaded from ${Math.round(km)} km away` }
  }

  return { id: 'geotag', pass: null, weight: 'strong', detail: 'No location data in the file' }
}

function recencyCheck(exif) {
  if (!exif?.takenAt) return { id: 'capture-time', pass: null, detail: 'No capture time' }
  const taken = new Date(exif.takenAt)
  if (taken.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return { id: 'capture-time', pass: false, detail: 'Capture time is in the future' }
  }
  return { id: 'capture-time', pass: true, detail: taken.toLocaleDateString() }
}

// Placeholder for the server-side vision scan. It intentionally does not
// pretend to have run — an un-run check must never read as a pass.
function moderationCheck() {
  return { id: 'moderation', pass: null, detail: 'Queued for server-side moderation' }
}

export function verifyPhoto({ course, exif, deviceFix, width, height, bytes }) {
  const sanity = sanityCheck({ width, height, bytes })
  const location = locationCheck(course, exif, deviceFix)
  const checks = [sanity, location, recencyCheck(exif), moderationCheck()]

  // A file that isn't plausibly an original never gets in, whatever its
  // location claims. Otherwise the location check decides:
  //   geotag inside the radius   → verified (strong: the file itself says so)
  //   uploaded from the course   → verified (weak: the device is there, the
  //                                photo might not have been)
  //   geotag outside the radius  → rejected (positive proof it is elsewhere)
  //   uploaded from elsewhere    → pending, not rejected — uploading a real
  //                                photo from the couch is the normal case
  //   nothing to go on           → pending
  let status, reason
  if (!sanity.pass) {
    status = 'rejected'
    reason = sanity.detail
  } else if (location.pass === true) {
    status = 'verified'
    reason = location.detail
  } else if (location.pass === false && location.weight === 'strong') {
    status = 'rejected'
    reason = location.detail
  } else {
    status = 'pending'
    reason = location.pass === false
      ? `${location.detail} — sent for review`
      : 'No location to check against — sent for review'
  }

  return {
    status,
    // How much the "verified" badge is actually worth, for the tooltip and for
    // the review queue to sort by once there is a backend.
    confidence: status === 'verified' ? (location.weight === 'strong' ? 'high' : 'medium') : null,
    checks,
    reason,
    at: new Date().toISOString(),
  }
}

// Best-effort device fix, only when the browser hands one over quickly. Never
// blocks the upload: a photo with no corroboration is "pending", not lost.
export function currentPosition({ timeoutMs = 4000 } = {}) {
  if (!navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => { if (!done) { done = true; resolve(v) } }
    setTimeout(() => finish(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    )
  })
}
