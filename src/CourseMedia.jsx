import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadCourseMedia } from './imagery.js'
import { addUpload, removeUpload, uploadAsMedia, uploadsFor } from './uploads.js'
import { STATUS } from './verification.js'
import CourseMap from './CourseMap.jsx'

/* ---------------- last-resort artwork ---------------- */

// Deterministic pseudo-random from a string, so each course gets its own
// stable "map silhouette" without storing artwork.
function seeded(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519)
    h = Math.imul(h ^ (h >>> 13), 3266489917)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// Abstract satellite-style silhouette: fairway ribbons, greens, bunkers and a
// location pin. Only shown when every real provider came back empty — it reads
// as "a golf course", never as *this* golf course.
export function CourseSilhouette({ course }) {
  const shapes = useMemo(() => {
    const rnd = seeded(course.id + course.name)
    const fairways = Array.from({ length: 4 }, (_, i) => {
      const x = 40 + rnd() * 300
      const y = 30 + rnd() * 140
      const rot = rnd() * 360
      const w = 60 + rnd() * 90
      return { x, y, rot, w, h: 16 + rnd() * 14, key: 'f' + i }
    })
    const greens = fairways.map((f, i) => ({
      x: f.x + Math.cos((f.rot * Math.PI) / 180) * (f.w / 2 + 8),
      y: f.y + Math.sin((f.rot * Math.PI) / 180) * (f.h / 2 + 4),
      r: 7 + rnd() * 5,
      key: 'g' + i,
    }))
    const bunkers = Array.from({ length: 5 }, (_, i) => ({
      x: 30 + rnd() * 340, y: 25 + rnd() * 150, r: 2.5 + rnd() * 3.5, key: 'b' + i,
    }))
    const roads = Array.from({ length: 2 }, (_, i) => {
      const y = 40 + rnd() * 130
      return { d: `M -10 ${y} Q ${100 + rnd() * 200} ${y - 60 + rnd() * 120}, 440 ${20 + rnd() * 160}`, key: 'r' + i }
    })
    return { fairways, greens, bunkers, roads }
  }, [course.id, course.name])

  return (
    <svg viewBox="0 0 430 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="430" height="230" fill="#dde8df" />
      {shapes.roads.map((r) => (
        <path key={r.key} d={r.d} stroke="#c8d4ca" strokeWidth="7" fill="none" />
      ))}
      {shapes.fairways.map((f) => (
        <ellipse key={f.key} cx={f.x} cy={f.y} rx={f.w / 2} ry={f.h / 2}
          transform={`rotate(${f.rot} ${f.x} ${f.y})`} fill="#a7cbaa" />
      ))}
      {shapes.greens.map((g) => (
        <circle key={g.key} cx={g.x} cy={g.y} r={g.r} fill="#5f9e6b" />
      ))}
      {shapes.bunkers.map((b) => (
        <circle key={b.key} cx={b.x} cy={b.y} r={b.r} fill="#e6d9ae" />
      ))}
      <g transform="translate(215, 92)">
        <path d="M0 -26 C -13 -26 -20 -16 -20 -8 C -20 4 0 22 0 22 C 0 22 20 4 20 -8 C 20 -16 13 -26 0 -26 Z"
          fill="#1d5c3a" stroke="#fff" strokeWidth="2.5" />
        <circle cy="-9" r="6.5" fill="#fff" />
      </g>
    </svg>
  )
}

/* ---------------- data ---------------- */

// Resolves provider imagery once per course and keeps the user's own photos
// merged in, so an upload shows up in the carousel the moment it is accepted.
export function useCourseMedia(course, user) {
  const [state, setState] = useState({ items: [], loading: true, tier: null })
  const [uploads, setUploads] = useState(() => uploadsFor(course.id))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true }))
    loadCourseMedia(course, { signal: ctrl.signal }).then((res) => {
      if (!ctrl.signal.aborted) setState({ items: res.items, loading: false, tier: res.tier })
    })
    setUploads(uploadsFor(course.id))
    return () => ctrl.abort()
  }, [course.id])

  // Verified member photos lead — a real person standing on the 7th beats a
  // basemap. Everything unverified stays out of the hero and lives in the
  // gallery below, where its status is visible.
  const media = useMemo(() => [
    ...uploads.filter((u) => u.verification.status === 'verified').map(uploadAsMedia),
    ...state.items,
  ], [uploads, state.items])

  // One uploader for both entry points — the slot at the end of the hero
  // carousel and the "add" tile in the gallery below.
  const addPhoto = useCallback(async (file) => {
    setUploading(true)
    setUploadError(null)
    const res = await addUpload({ file, course, user })
    setUploading(false)
    if (res.ok) setUploads(uploadsFor(course.id))
    else setUploadError(res.error)
  }, [course, user])

  const dropUpload = useCallback((id) => {
    setUploads(removeUpload(course.id, id))
  }, [course.id])

  return {
    media, uploads, loading: state.loading, tier: state.tier,
    addPhoto, dropUpload, uploading, uploadError,
  }
}

/* ---------------- one slide ---------------- */

function MediaFrame({ item, onError }) {
  if (item.map) {
    return <CourseMap {...item.map} className="media-map" />
  }
  if (item.kind === 'placeholder') {
    return (
      <div className="media-grad"
        style={{ background: `linear-gradient(135deg, ${item.grad[0]}, ${item.grad[1]})` }} />
    )
  }
  return (
    <img className="media-img" src={item.url} alt={item.caption ?? ''}
      loading="lazy" decoding="async" onError={() => onError(item.id)} />
  )
}

function VerifiedBadge({ verification }) {
  if (!verification) return null
  const s = STATUS[verification.status]
  return (
    <span className={`verify-badge ${s.tone}`}
      title={[verification.reason, verification.confidence && `${verification.confidence} confidence`]
        .filter(Boolean).join(' · ')}>
      <i>{s.icon}</i>{s.label}
    </span>
  )
}

/* ---------------- carousel ---------------- */

export function MediaCarousel({ course, media, loading, onAddPhoto, addDisabled }) {
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState(() => new Set())

  const shown = media.filter((m) => !broken.has(m.id))
  const markBroken = useCallback((id) => {
    setBroken((prev) => new Set(prev).add(id))
  }, [])

  // Slides are laid out by scroll-snap, so the scroll position *is* the index.
  const onScroll = () => {
    const el = trackRef.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const go = (i) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const slots = shown.length + (onAddPhoto ? 1 : 0)
  const current = shown[index]

  return (
    <div className="media-carousel">
      <div className="media-track" ref={trackRef} onScroll={onScroll}>
        {shown.map((item) => (
          <div className="media-slide" key={item.id}>
            <MediaFrame item={item} onError={markBroken} />
            {item.verification && (
              <div className="slide-badges"><VerifiedBadge verification={item.verification} /></div>
            )}
          </div>
        ))}

        {!shown.length && (
          <div className="media-slide">
            {loading
              ? <div className="media-skeleton"><span>Finding imagery…</span></div>
              : <CourseSilhouette course={course} />}
          </div>
        )}

        {onAddPhoto && (
          <div className="media-slide">
            <AddPhotoSlot onPick={onAddPhoto} disabled={addDisabled} />
          </div>
        )}
      </div>

      {slots > 1 && (
        <>
          <div className="media-dots">
            {Array.from({ length: slots }, (_, i) => (
              <button key={i} className={i === index ? 'on' : ''} aria-label={`Image ${i + 1}`}
                onClick={() => go(i)} />
            ))}
          </div>
          <button className="media-arrow left" aria-label="Previous image"
            onClick={() => go(Math.max(0, index - 1))}>‹</button>
          <button className="media-arrow right" aria-label="Next image"
            onClick={() => go(Math.min(slots - 1, index + 1))}>›</button>
        </>
      )}

      {current?.credit && (
        <div className="media-credit">
          {current.caption && <b>{current.caption}</b>}
          {current.creditUrl
            ? <a href={current.creditUrl} target="_blank" rel="noopener noreferrer">{current.credit}</a>
            : <span>{current.credit}</span>}
          {current.license && <em>{current.license}</em>}
        </div>
      )}
    </div>
  )
}

/* ---------------- upload ---------------- */

function AddPhotoSlot({ onPick, disabled, compact }) {
  const input = useRef(null)
  return (
    <div className={`add-photo ${compact ? 'compact' : ''} ${disabled ? 'busy' : ''}`}
      onClick={() => !disabled && input.current?.click()}>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }} />
      <div className="plus">＋</div>
      <div className="label">{disabled ? 'Checking photo…' : 'Add a photo'}</div>
      {!compact && <div className="hint">Geotagged shots verify instantly</div>}
    </div>
  )
}

// The gallery below the fold: every photo this user has contributed, with the
// verification result spelled out. Pending and rejected photos stay visible to
// their owner — a silent drop reads as a bug.
export function PhotoGallery({ uploads, onAdd, onRemove, uploading, error }) {
  return (
    <>
      <div className="section-label">Your photos</div>
      <div className="upload-grid">
        {uploads.map((u) => {
          const s = STATUS[u.verification.status]
          return (
            <figure className={`upload ${s.tone}`} key={u.id}>
              <img src={u.dataUrl} alt="" loading="lazy" />
              <button className="upload-remove" aria-label="Remove photo"
                onClick={() => onRemove(u.id)}>✕</button>
              <figcaption>
                <VerifiedBadge verification={u.verification} />
                <span className="why">{u.verification.reason}</span>
              </figcaption>
            </figure>
          )
        })}
        <AddPhotoSlot onPick={onAdd} disabled={uploading} compact />
      </div>
      {error && <div className="upload-error">{error}</div>}
      <div className="upload-note">
        Photos are checked against the course location before they appear on the
        page. Anything we can’t place goes to review.
      </div>
    </>
  )
}
