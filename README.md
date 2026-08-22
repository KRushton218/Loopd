# ⛳ Loopd

**Beli for golfers.** Rank every course you've played, bookmark the ones you haven't,
see where your friends are teeing it up, and plan trips around clusters of great golf.

## Try it

**Live now: [krushton218.github.io/Loopd](https://krushton218.github.io/Loopd/)** —
open it on your phone for the intended experience.

To run it locally instead:

```
npm install
npm run dev
```

Then visit http://localhost:5173.

## What works today

- **Home** — friends' rounds feed + search (courses or Looprs, with a location filter).
  Course search is **live**: type any course name and results come from
  OpenStreetMap's worldwide golf-course data, not just the demo seed — you can
  open, bookmark, and rank any course you find.
- **Rank a course** — Beli-style: *Loved it / Liked it / Not for me*, then quick
  head-to-head "which was better?" matchups slot it into your list and every course
  gets a 0–10 score. Your rankings persist locally.
- **Trip map** — every course pinned on a real map, colored by played / bookmarked /
  to-discover, so you can spot golf-trip clusters.
- **Lists** — Played (ranked), Bookmarked, Recs, and editorial Guides
- **Leaderboard** — most courses played
- **Course pages** — ratings (average / you / friends), contact buttons, notes, and a
  **real image carousel**: a satellite view of the actual course plus freely-licensed
  photos, no API key required. Add your own photo and it's checked against the course
  location before it goes on the page. On a desktop window the page opens wide, with
  the carousel beside a live map. See [docs/IMAGERY.md](docs/IMAGERY.md).
- **Profile** — your counts, your ranked list, your activity

Courses and friends are mock data for now — the full production plan (native app,
real course database, live social graph) is in [docs/PLAN.md](docs/PLAN.md).

## Stack

Vite + React, Leaflet for the maps, OpenStreetMap for course search and street
tiles, Esri World Imagery for satellite, Wikimedia Commons for photos —
every one of them keyless, so the static build has no secrets in it.
localStorage for your data. No backend yet — by design; see the plan.
