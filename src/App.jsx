import { useEffect, useMemo, useState } from 'react'
import {
  currentUser, users, feed, recs, guides,
  leaderboard, userById, courseById, allCourses, registerCourse,
} from './data.js'
import { searchLiveCourses } from './liveSearch.js'
import {
  initialStore, saveStore, computeScores, playedIds, isPlayed, BANDS, BAND_ORDER,
} from './store.js'
import RankFlow from './RankFlow.jsx'
import MapView from './MapView.jsx'

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
// location pin — reads as "this course, on a map".
function CourseSilhouette({ course }) {
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

function ScorePill({ score, small }) {
  if (score == null) return null
  const cls = ['score-pill', score < 8.5 ? 'mid' : '', small ? 'small' : ''].join(' ')
  return <div className={cls}>{score.toFixed(1)}</div>
}

function Photo({ photo, className }) {
  return (
    <div className={className}
      style={{ background: `linear-gradient(135deg, ${photo.grad[0]}, ${photo.grad[1]})` }}>
      {photo.caption}
    </div>
  )
}

function CourseRow({ course, rank, score, onOpen }) {
  const place = [course.city, course.state || course.country].filter(Boolean).join(', ')
  const sub = [place, course.access].filter(Boolean).join(' · ')
  return (
    <div className="row" onClick={() => onOpen(course)}>
      {rank != null && <div className="rank-num">{rank}</div>}
      <div>
        <div className="title">{course.name}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className="right">
        <ScorePill score={score ?? course.rating} small />
      </div>
    </div>
  )
}

function UserRow({ user }) {
  return (
    <div className="row">
      <div className="avatar">{user.avatar}</div>
      <div>
        <div className="title">{user.name}</div>
        <div className="sub">@{user.username} · {user.played} courses played</div>
      </div>
    </div>
  )
}

/* ---------------- Search overlay ---------------- */
function SearchOverlay({ onClose, onOpenCourse }) {
  const [mode, setMode] = useState('courses')
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [live, setLive] = useState({ results: [], loading: false, error: false })

  const courseResults = allCourses().filter((c) => {
    const okQ = !q || c.name.toLowerCase().includes(q.toLowerCase())
    const hay = `${c.city} ${c.state} ${c.region} ${c.country}`.toLowerCase()
    const okLoc = !loc || hay.includes(loc.toLowerCase())
    return okQ && okLoc
  })
  const userResults = users.filter((u) =>
    !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.username.toLowerCase().includes(q.toLowerCase()))

  // Live worldwide course search (OpenStreetMap) once the query is real.
  useEffect(() => {
    const query = [q.trim(), loc.trim()].filter(Boolean).join(' ')
    if (mode !== 'courses' || q.trim().length < 3) {
      setLive({ results: [], loading: false, error: false })
      return
    }
    const ctrl = new AbortController()
    setLive((l) => ({ ...l, loading: true, error: false }))
    const t = setTimeout(async () => {
      try {
        const results = await searchLiveCourses(query, ctrl.signal)
        setLive({ results, loading: false, error: false })
      } catch (e) {
        if (e.name !== 'AbortError') setLive({ results: [], loading: false, error: true })
      }
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, loc, mode])

  // Don't repeat courses already shown from Loopd's own list.
  const shownNames = new Set(courseResults.map((c) => c.name.toLowerCase()))
  const liveResults = live.results.filter((c) => !shownNames.has(c.name.toLowerCase()))

  return (
    <div className="search-overlay">
      <div className="head">
        <div className="seg">
          <button className={mode === 'courses' ? 'active' : ''} onClick={() => setMode('courses')}>Courses</button>
          <button className={mode === 'looprs' ? 'active' : ''} onClick={() => setMode('looprs')}>Looprs</button>
        </div>
      </div>
      <div className="fields">
        <div className="field">
          <span>🔍</span>
          <input autoFocus placeholder={mode === 'courses' ? 'Search courses' : 'Search Looprs'}
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {mode === 'courses' && (
          <div className="field">
            <span>📍</span>
            <input placeholder="City, state, or region" value={loc} onChange={(e) => setLoc(e.target.value)} />
          </div>
        )}
        <button className="cancel-link" onClick={onClose}>Cancel</button>
      </div>
      <div className="results">
        {mode === 'courses' ? (
          <>
            {courseResults.map((c) => <CourseRow key={c.id} course={c} onOpen={onOpenCourse} />)}
            {liveResults.map((c) => <CourseRow key={c.id} course={c} onOpen={onOpenCourse} />)}
            {live.loading && <div className="empty-state">Searching all courses…</div>}
            {!live.loading && !courseResults.length && !liveResults.length && (
              <div className="empty-state">
                {live.error
                  ? 'Course search is unreachable right now — check your connection.'
                  : q.trim().length < 3
                    ? 'Keep typing to search every course worldwide.'
                    : 'No courses match — try the full course name.'}
              </div>
            )}
            {(liveResults.length > 0 || live.loading) && (
              <div className="search-note">Course search data © OpenStreetMap contributors</div>
            )}
          </>
        ) : (
          userResults.length
            ? userResults.map((u) => <UserRow key={u.id} user={u} />)
            : <div className="empty-state">No Looprs found.</div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Course page ---------------- */
function CoursePage({ courseId, store, scores, onClose, onToggleBookmark, onStartRank }) {
  const course = courseById(courseId)
  const saved = store.bookmarks.includes(courseId)
  const yourScore = scores[courseId]
  const checkin = store.checkins.find((c) => c.courseId === courseId && c.note)

  return (
    <div className="course-page">
      <div className="course-hero">
        <CourseSilhouette course={course} />
        <button className="hero-back" onClick={onClose}>←</button>
        <button className="hero-bookmark" onClick={() => onToggleBookmark(courseId)}>{saved ? '🔖' : '📑'}</button>
        <div className="hero-bottom">
          <h1>{course.name}</h1>
          <div className="hero-rating">
            {course.rating != null ? (
              <>
                <div className="big">{course.rating.toFixed(1)}</div>
                <div className="n">{course.numRatings.toLocaleString()} ratings</div>
              </>
            ) : (
              <div className="n">No Loopd ratings yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="course-meta">
        <div className="loc">{[course.city, course.state, course.country].filter(Boolean).join(', ')}</div>
        {(() => {
          const facts = [
            course.access,
            course.par && `Par ${course.par}`,
            course.yardage && `${course.yardage.toLocaleString()} yds`,
            course.region,
          ].filter(Boolean).join(' · ')
          return facts ? <div className="facts">{facts}</div> : null
        })()}
      </div>

      <div className="action-btns">
        {course.website && (
          <button onClick={() => window.open(`https://${course.website}`, '_blank', 'noopener')}>
            <span className="icon">🌐</span>Website
          </button>
        )}
        {course.phone && (
          <button onClick={() => { window.location.href = `tel:${course.phone.replace(/[^+\d]/g, '')}` }}>
            <span className="icon">📞</span>Call
          </button>
        )}
        <button onClick={() => window.open(`https://maps.google.com/?daddr=${course.lat},${course.lng}`, '_blank', 'noopener')}>
          <span className="icon">🧭</span>Directions
        </button>
      </div>

      <div className="scores-strip">
        <div className="score-box">
          {course.rating != null
            ? <div className="val">{course.rating.toFixed(1)}</div>
            : <div className="val empty">No ratings</div>}
          <div className="lbl">Avg</div>
        </div>
        <div className="score-box">
          {yourScore != null
            ? <div className="val">{yourScore.toFixed(1)}</div>
            : <div className="val empty">Not rated</div>}
          <div className="lbl">You</div>
        </div>
        <div className="score-box">
          {course.friendsScore != null
            ? <div className="val">{course.friendsScore.toFixed(1)}</div>
            : <div className="val empty">—</div>}
          <div className="lbl">Friends</div>
        </div>
      </div>

      <button className="rate-cta" onClick={() => onStartRank(courseId)}>
        {yourScore != null ? 'Re-rank this course' : 'I played here — rank it'}
      </button>

      {course.photos.length > 0 && (
        <>
          <div className="section-label">Photos</div>
          <div className="photo-strip">
            {course.photos.map((p, i) => <Photo key={i} photo={p} className="ph" />)}
          </div>
        </>
      )}

      <div className="section-label">Notes</div>
      <div className="note-list">
        {checkin && (
          <div className="note">
            <div className="avatar">{currentUser.avatar}</div>
            <div className="body">
              <div className="who">@{currentUser.username} (you)</div>
              <div className="txt">{checkin.note}</div>
            </div>
            <ScorePill score={yourScore} small />
          </div>
        )}
        {course.notes.length || checkin ? course.notes.map((n, i) => (
          <div className="note" key={i}>
            <div className="avatar">{n.avatar}</div>
            <div className="body">
              <div className="who">@{n.user}</div>
              <div className="txt">{n.text}</div>
            </div>
            <ScorePill score={n.score} small />
          </div>
        )) : <div className="empty-state">No notes yet — be the first to add one.</div>}
      </div>
    </div>
  )
}

/* ---------------- Tabs ---------------- */
function FeedTab({ onOpenSearch, onOpenMap, onOpenCourse }) {
  return (
    <div className="screen">
      <div className="top-bar">
        <div className="brand">L<span className="loop">oo</span>pd</div>
        <div className="search-row">
          <div className="search-input" onClick={onOpenSearch}>
            <span>🔍</span> Courses or Looprs…
          </div>
          <button className="map-btn" onClick={onOpenMap} title="Trip map">🗺️</button>
        </div>
      </div>
      <div className="feed">
        {feed.map((item) => {
          const u = userById(item.userId)
          const c = courseById(item.courseId)
          return (
            <div className="card" key={item.id}>
              <div className="feed-head">
                <div className="avatar">{u.avatar}</div>
                <div className="who">
                  <div><b>{u.name}</b> played</div>
                  <div className="when">{item.when}</div>
                </div>
                <div className="score-pill" style={{ marginLeft: 'auto' }}>{item.score.toFixed(1)}</div>
              </div>
              <div className="feed-course" onClick={() => onOpenCourse(c)}>
                {c.name} <span>· {c.city}, {c.state}</span>
              </div>
              {item.note && <div className="feed-note">“{item.note}”</div>}
              {item.photo && <Photo photo={item.photo} className="feed-photo" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListsTab({ store, scores, onOpenCourse }) {
  const [tab, setTab] = useState('Played')
  const tabs = ['Played', 'Bookmarked', 'Recs', 'Guides']
  const myPlayed = playedIds(store)
  const listFor = { Played: myPlayed, Bookmarked: store.bookmarks, Recs: recs }

  return (
    <div className="screen">
      <div className="top-bar">
        <div className="brand" style={{ fontSize: 22 }}>Lists</div>
      </div>
      <div className="pill-tabs">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Guides' ? (
        <div className="list-body">
          {guides.map((g) => (
            <div key={g.id} className="guide-card"
              style={{ background: `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})` }}>
              <div className="src">{g.source}</div>
              <div className="ttl">{g.title}</div>
              <div className="cnt">{g.count} courses</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="list-body">
          {listFor[tab].length ? listFor[tab].map((id, i) => (
            <CourseRow key={id} course={courseById(id)}
              rank={tab === 'Played' ? i + 1 : null}
              score={tab === 'Played' ? scores[id] : null}
              onOpen={onOpenCourse} />
          )) : <div className="empty-state">Nothing here yet.</div>}
        </div>
      )}
    </div>
  )
}

function LeaderboardTab() {
  const [top1, top2, top3] = leaderboard
  const podiumOrder = [top2, top1, top3]
  const medals = ['🥈', '🥇', '🥉']

  return (
    <div className="screen">
      <div className="top-bar">
        <div className="brand" style={{ fontSize: 22 }}>Leaderboard</div>
      </div>
      <div className="podium">
        {podiumOrder.map((entry, i) => {
          const u = userById(entry.userId)
          return (
            <div className="spot" key={entry.userId}>
              <div className="medal">{medals[i]}</div>
              <div className="avatar lg" style={i === 1 ? undefined : { width: 54, height: 54, fontSize: 26 }}>{u.avatar}</div>
              <div className="name">{u.name}</div>
              <div className="count">{entry.played} played</div>
            </div>
          )
        })}
      </div>
      <div className="list-body">
        {leaderboard.slice(3).map((entry, i) => {
          const u = userById(entry.userId)
          return (
            <div className="row" key={entry.userId}>
              <div className="rank-num">{i + 4}</div>
              <div className="avatar">{u.avatar}</div>
              <div>
                <div className="title">{u.name}</div>
                <div className="sub">{entry.delta}</div>
              </div>
              <div className="right"><b>{entry.played}</b></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProfileTab({ store, scores, onOpenCourse }) {
  const [list, setList] = useState('played')
  const myPlayed = playedIds(store)
  const ids = list === 'played' ? myPlayed : store.bookmarks

  return (
    <div className="screen">
      <div className="profile-head">
        <div className="avatar lg">{currentUser.avatar}</div>
        <div className="name">{currentUser.name}</div>
        <div className="username">@{currentUser.username}</div>
        <div className="follow-stats">
          <div className="stat"><b>{currentUser.followers}</b><span>Followers</span></div>
          <div className="stat"><b>{currentUser.following}</b><span>Following</span></div>
        </div>
      </div>
      <div className="stat-cards">
        <div className="stat-card" onClick={() => setList('played')}
          style={list === 'played' ? { borderColor: 'var(--green-500)' } : undefined}>
          <b>{myPlayed.length}</b><span>Played</span>
        </div>
        <div className="stat-card" onClick={() => setList('bookmarked')}
          style={list === 'bookmarked' ? { borderColor: 'var(--green-500)' } : undefined}>
          <b>{store.bookmarks.length}</b><span>Bookmarked</span>
        </div>
      </div>
      <div className="list-body">
        {ids.length ? ids.map((id, i) => (
          <CourseRow key={id} course={courseById(id)}
            rank={list === 'played' ? i + 1 : null}
            score={list === 'played' ? scores[id] : null}
            onOpen={onOpenCourse} />
        )) : <div className="empty-state">Nothing here yet.</div>}
      </div>
      <div className="section-label">Activity</div>
      <div className="list-body" style={{ paddingBottom: 24 }}>
        {myPlayed.slice(0, 3).map((id) => {
          const c = courseById(id)
          return (
            <div className="row" key={'act' + id} onClick={() => onOpenCourse(c)}>
              <div className="avatar">{currentUser.avatar}</div>
              <div>
                <div className="title">You ranked {c.name}</div>
                <div className="sub">{c.city}, {c.state}</div>
              </div>
              <div className="right"><ScorePill score={scores[id]} small /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Shell ---------------- */
export default function App() {
  const [tab, setTab] = useState('home')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [courseId, setCourseId] = useState(null)
  const [ranking, setRanking] = useState(null)   // courseId being ranked
  const [store, setStore] = useState(initialStore)

  useEffect(() => { saveStore(store) }, [store])
  const scores = useMemo(() => computeScores(store.bands), [store.bands])

  // Accepts a full course object; live-search finds register + persist so
  // they survive reloads and resolve everywhere a courseId is stored.
  const openCourse = (course) => {
    if (course.source === 'osm') {
      registerCourse(course)
      setStore((s) => s.customCourses.some((c) => c.id === course.id)
        ? s
        : { ...s, customCourses: [...s.customCourses, course] })
    }
    setCourseId(course.id)
  }

  const toggleBookmark = (id) => setStore((s) => ({
    ...s,
    bookmarks: s.bookmarks.includes(id)
      ? s.bookmarks.filter((b) => b !== id)
      : [...s.bookmarks, id],
  }))

  const finishRank = (nextBands, note) => {
    setStore((s) => {
      const others = s.checkins.filter((c) => c.courseId !== ranking)
      return {
        ...s,
        bands: nextBands,
        // A ranked course no longer belongs on the wishlist.
        bookmarks: s.bookmarks.filter((b) => b !== ranking),
        checkins: [...others, { courseId: ranking, note, date: new Date().toISOString() }],
      }
    })
    setRanking(null)
  }

  const tabs = [
    { id: 'home', label: 'Home', icon: '⛳' },
    { id: 'lists', label: 'Lists', icon: '📋' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ]

  return (
    <div className="phone">
      {tab === 'home' && <FeedTab onOpenSearch={() => setSearchOpen(true)} onOpenMap={() => setMapOpen(true)} onOpenCourse={openCourse} />}
      {tab === 'lists' && <ListsTab store={store} scores={scores} onOpenCourse={openCourse} />}
      {tab === 'leaderboard' && <LeaderboardTab />}
      {tab === 'profile' && <ProfileTab store={store} scores={scores} onOpenCourse={openCourse} />}

      <div className="bottom-nav">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''}
            onClick={() => { setTab(t.id); setSearchOpen(false); setMapOpen(false); setCourseId(null) }}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {searchOpen && (
        <SearchOverlay onClose={() => setSearchOpen(false)} onOpenCourse={openCourse} />
      )}
      {mapOpen && (
        <MapView scores={scores} bookmarks={store.bookmarks}
          playedSet={new Set(playedIds(store))}
          onOpenCourse={(id) => { setMapOpen(false); openCourse(courseById(id)) }}
          onClose={() => setMapOpen(false)} />
      )}
      {courseId && (
        <CoursePage courseId={courseId} store={store} scores={scores}
          onClose={() => setCourseId(null)}
          onToggleBookmark={toggleBookmark}
          onStartRank={(id) => setRanking(id)} />
      )}
      {ranking && (
        <RankFlow courseId={ranking} store={store}
          onDone={finishRank} onCancel={() => setRanking(null)} />
      )}
    </div>
  )
}
