// Minimal EXIF reader — just the GPS fix and the capture time.
//
// Those two tags are what let us verify a user photo was actually taken at the
// course, so a 2 kB parser beats pulling in a full EXIF library. Anything we
// cannot read returns null and the photo falls through to manual review.

const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_DATETIME_ORIGINAL = 0x9003

// EXIF sits in the first APP1 segment, so a 256 kB slice is always enough and
// avoids pulling a 12 MP photo through an ArrayBuffer twice.
const HEAD_BYTES = 256 * 1024

export async function readExif(file) {
  try {
    const buf = await file.slice(0, HEAD_BYTES).arrayBuffer()
    const view = new DataView(buf)
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null   // not a JPEG

    let off = 2
    while (off + 4 <= view.byteLength) {
      if (view.getUint8(off) !== 0xff) { off++; continue }
      const marker = view.getUint8(off + 1)
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue }
      if (marker === 0xda || marker === 0xd9) return null                  // image data starts
      const size = view.getUint16(off + 2)
      if (marker === 0xe1 && off + 10 <= view.byteLength
          && view.getUint32(off + 4) === 0x45786966 && view.getUint16(off + 8) === 0) {
        return parseTiff(view, off + 10)
      }
      off += 2 + size
    }
  } catch { /* truncated or exotic file — treat as "no EXIF" */ }
  return null
}

function parseTiff(view, start) {
  if (start + 8 > view.byteLength) return null
  const order = view.getUint16(start)
  if (order !== 0x4949 && order !== 0x4d4d) return null
  const le = order === 0x4949
  if (view.getUint16(start + 2, le) !== 42) return null

  const ifd0 = readIfd(view, start, start + view.getUint32(start + 4, le), le)
  if (!ifd0) return null

  const out = { lat: null, lng: null, takenAt: null }

  const exifOffset = ifd0[TAG_EXIF_IFD]?.value
  if (exifOffset != null) {
    const exif = readIfd(view, start, start + exifOffset, le)
    const raw = exif?.[TAG_DATETIME_ORIGINAL]
    if (raw) out.takenAt = parseExifDate(readAscii(view, start, raw, le))
  }

  const gpsOffset = ifd0[TAG_GPS_IFD]?.value
  if (gpsOffset != null) {
    const gps = readIfd(view, start, start + gpsOffset, le)
    if (gps) {
      const lat = readDms(view, start, gps[2], le)
      const lng = readDms(view, start, gps[4], le)
      const latRef = readAscii(view, start, gps[1], le)
      const lngRef = readAscii(view, start, gps[3], le)
      if (lat != null && lng != null) {
        out.lat = latRef === 'S' ? -lat : lat
        out.lng = lngRef === 'W' ? -lng : lng
      }
    }
  }

  return out.lat != null || out.takenAt ? out : null
}

function readIfd(view, tiffStart, ifdStart, le) {
  if (ifdStart + 2 > view.byteLength) return null
  const count = view.getUint16(ifdStart, le)
  const entries = {}
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12
    if (entry + 12 > view.byteLength) break
    const tag = view.getUint16(entry, le)
    const type = view.getUint16(entry + 2, le)
    const n = view.getUint32(entry + 4, le)
    // Values of 4 bytes or fewer are inlined; anything larger is an offset.
    const inline = n * BYTES_PER_TYPE[type] <= 4
    entries[tag] = {
      type,
      count: n,
      offset: inline ? entry + 8 : tiffStart + view.getUint32(entry + 8, le),
      value: type === 4 || type === 3 ? readNumber(view, entry + 8, type, le) : null,
    }
  }
  return entries
}

const BYTES_PER_TYPE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

function readNumber(view, at, type, le) {
  if (at + 4 > view.byteLength) return null
  return type === 3 ? view.getUint16(at, le) : view.getUint32(at, le)
}

function readAscii(view, tiffStart, entry, le) {
  if (!entry) return null
  let s = ''
  for (let i = 0; i < entry.count && entry.offset + i < view.byteLength; i++) {
    const c = view.getUint8(entry.offset + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s.trim() || null
}

// GPS coordinates are three rationals: degrees, minutes, seconds.
function readDms(view, tiffStart, entry, le) {
  if (!entry || entry.count < 3 || entry.type !== 5) return null
  const parts = []
  for (let i = 0; i < 3; i++) {
    const at = entry.offset + i * 8
    if (at + 8 > view.byteLength) return null
    const den = view.getUint32(at + 4, le)
    parts.push(den === 0 ? 0 : view.getUint32(at, le) / den)
  }
  return parts[0] + parts[1] / 60 + parts[2] / 3600
}

// EXIF dates look like "2025:08:14 07:32:19" — not something Date parses.
function parseExifDate(s) {
  if (!s) return null
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, sec] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, sec)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
