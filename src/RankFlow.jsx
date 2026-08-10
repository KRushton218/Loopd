import { useState } from 'react'
import { BANDS, removeFromBands } from './store.js'
import { courseById } from './data.js'

// Beli-style ranking: pick a sentiment band, then binary-insert into that band
// via head-to-head "which was better?" questions, then an optional note.
export default function RankFlow({ courseId, store, onDone, onCancel }) {
  const course = courseById(courseId)
  const [band, setBand] = useState(null)
  const [cmp, setCmp] = useState(null)   // { list, lo, hi }
  const [note, setNote] = useState('')

  const startComparisons = (bandKey) => {
    setBand(bandKey)
    // Re-ranking? Pull the course out before inserting it again.
    const bands = removeFromBands(store.bands, courseId)
    const list = bands[bandKey]
    setCmp({ bands, list, lo: 0, hi: list.length })
  }

  const finish = (cmpState, chosenBand) => {
    const { bands, list, lo } = cmpState
    const nextList = [...list]
    nextList.splice(lo, 0, courseId)
    const nextBands = { ...bands, [chosenBand]: nextList }
    onDone(nextBands, note)
  }

  const pick = (newWins) => {
    let { lo, hi } = cmp
    const mid = Math.floor((lo + hi) / 2)
    if (newWins) hi = mid
    else lo = mid + 1
    setCmp({ ...cmp, lo, hi })
  }

  const comparing = band && cmp && cmp.lo < cmp.hi
  const doneComparing = band && cmp && cmp.lo >= cmp.hi

  return (
    <div className="rank-overlay">
      <div className="rank-sheet">
        <div className="rank-title">
          {!band ? `How was ${course.name}?` : comparing ? 'Which was better?' : 'Add a note'}
        </div>

        {!band && (
          <div className="band-btns">
            {Object.entries(BANDS).map(([key, b]) => (
              <button key={key} className={`band-btn ${key}`} onClick={() => startComparisons(key)}>
                <span className="emoji">{b.emoji}</span>
                {b.label}
              </button>
            ))}
          </div>
        )}

        {comparing && (() => {
          const mid = Math.floor((cmp.lo + cmp.hi) / 2)
          const other = courseById(cmp.list[mid])
          return (
            <div className="vs-wrap">
              <button className="vs-card" onClick={() => pick(true)}>
                <div className="vs-name">{course.name}</div>
                <div className="vs-sub">{course.city}, {course.state}</div>
              </button>
              <div className="vs-divider">vs</div>
              <button className="vs-card" onClick={() => pick(false)}>
                <div className="vs-name">{other.name}</div>
                <div className="vs-sub">{other.city}, {other.state}</div>
              </button>
            </div>
          )
        })()}

        {doneComparing && (
          <>
            <textarea
              className="note-input"
              placeholder="Caddie tips, must-play holes, where to grab a beer after… (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <button className="rate-cta" style={{ margin: 0, width: '100%' }}
              onClick={() => finish(cmp, band)}>
              Save round
            </button>
          </>
        )}

        <button className="cancel-link" style={{ alignSelf: 'center', marginTop: 4 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
