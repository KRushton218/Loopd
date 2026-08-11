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

- **Home** — friends' rounds feed + search (courses or Looprs, with a location filter)
- **Rank a course** — Beli-style: *Loved it / Liked it / Not for me*, then quick
  head-to-head "which was better?" matchups slot it into your list and every course
  gets a 0–10 score. Your rankings persist locally.
- **Trip map** — every course pinned on a real map, colored by played / bookmarked /
  to-discover, so you can spot golf-trip clusters.
- **Lists** — Played (ranked), Bookmarked, Recs, and editorial Guides
- **Leaderboard** — most courses played
- **Course pages** — ratings (average / you / friends), contact buttons, photos, notes
- **Profile** — your counts, your ranked list, your activity

Courses and friends are mock data for now — the full production plan (native app,
real course database, live social graph) is in [docs/PLAN.md](docs/PLAN.md).

## Stack

Vite + React, Leaflet + OpenStreetMap for the map, localStorage for your data.
No backend yet — by design; see the plan.
