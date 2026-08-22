# Go-live diagnosis (2026-08-11)

Verdict up front: **the prototype is already live.** The `Deploy to GitHub Pages`
workflow ran on the first push to `main` (run #1, 2026-08-10, both `build` and
`deploy` jobs green), and `deploy-pages@v4` only succeeds when Pages is enabled
with the "GitHub Actions" source. The site should be serving at:

**https://krushton218.github.io/Loopd/**

(Verify in a browser — the sandbox this diagnosis ran in blocks `github.io`
egress, so it was confirmed via the Actions API rather than an HTTP fetch.)

## What was verified

| Check | Result |
|---|---|
| `npm ci && npm run build` | ✅ Clean build — 98 KB gzipped JS, 9 KB CSS |
| Deploy workflow on `main` | ✅ Run #1 succeeded (build + deploy jobs) |
| `vite.config.js` base path | ✅ `base: './'` — correct for the `/Loopd/` subpath |
| Runtime smoke test (Chromium, 390×844) | ✅ Feed renders, all four tabs navigate, map opens, no console errors |
| External runtime dependencies | ✅ Only OSM tiles (attributed); photos are CSS gradients, no CDN fonts/scripts |
| localStorage persistence | ✅ Wrapped in try/catch (private-mode safe) |
| Deep links / 404.html | ✅ Not needed — single-URL app, no client-side routes |

## Gaps found (small, none blocking)

1. **No favicon.** `index.html` declares no icon, so every visit 404s on
   `/favicon.ico` and the tab shows a blank page icon. Fix: one line, e.g. an
   inline emoji SVG —
   `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⛳</text></svg>">`

2. **No meta description / Open Graph / Twitter card tags.** Sharing the link
   in a text or on social renders bare. Add `<meta name="description">`,
   `og:title`, `og:description`, `og:image` (and `theme-color` for the mobile
   address bar) to `index.html`.

3. **README has no live link.** It still only says "visit localhost:5173" —
   add the Pages URL at the top so visitors can tap through.

4. **OSM public tile server.** `tile.openstreetmap.org` is fine for a
   prototype's traffic and is properly attributed, but the OSMF usage policy
   discourages it for real production volume. When traffic is real (or when
   the plan's Mapbox move happens), switch tile providers.

5. **No PR checks.** CI only runs the deploy on push to `main`; there's no
   build check on branches/PRs. A tiny `on: pull_request` build job would
   catch a broken push before it deploys.

Items 1–3 are a single small `index.html`/README commit. Items 4–5 matter only
as usage grows.

## "Go live" for the real product

That's a different, larger track and it's already specced: see
[PLAN.md](PLAN.md) — Expo/React Native app, Supabase backend, course-data
seeding (OpenGolfAPI + OSM), comparative-ranking engine, TestFlight → App
Store. Critical path starts at Phase 0 (app scaffold + Supabase project);
the two long-lead items worth starting early are the course-data seed and the
GolfNow/Lightspeed partnership applications (§11).

The rest of this document is the deep audit: every interactive element and
every mocked data structure in the prototype, each mapped to its
real-data transition using the vendor research in PLAN.md §11.

---

# Deep audit: every interaction & mock → its real-data plan

Notation: **Phase N** references the roadmap in PLAN.md §10.
"OGA" = OpenGolfAPI seed, "OSM" = OpenStreetMap, "Places" = Google Places
live lookup (display-time only, store Place ID only — ToS), per §11.

## A. Contact buttons (were dead; now wired to mock fields, still need real sourcing)

These three, on the course page (`App.jsx` `action-btns`), were the only
buttons in the app with no handler. As of this branch they open the mock
`website`/`phone`/lat-lng values, so the live demo has zero dead buttons —
but the underlying data still transitions to vendor-sourced fields:

| Button | Real implementation | Data source | Phase |
|---|---|---|---|
| 🌐 **Website** | `<a href>` / `Linking.openURL` to the course site | Seed URL from **OGA** (has website per course); verified at page-view time via **Places** Place Details (store only the Place ID, refresh ~yearly) | 1 |
| 📞 **Call** | `tel:` link | Phone from **OGA** seed; **Places** live verification layer (phone is an Enterprise-tier Details field, $20/1k calls, inside the $200/mo credit at early volume) | 1 |
| 🧭 **Directions** | Deep-link to Apple/Google Maps with `courses.geom` lat/lng — **no API or vendor needed** (PLAN §3) | Own DB (PostGIS point) | 1 |

The mock data already carried `website` and `phone` strings for all 10
courses, which is what made wiring them a two-line change — the strings swap
for API-backed fields later with no further UI work. (In the native app,
Directions should prefer an Apple Maps deep link on iOS.)

## B. Live-but-local interactions (work today, backed by localStorage or mock arrays)

| Interaction | Works today via | Real transition | Vendor/API | Phase |
|---|---|---|---|---|
| **Search → Courses** (`SearchOverlay`) | ~~Substring filter over 10 mock courses~~ **Now live**: mock filter + worldwide OSM search (Photon geocoder, keyless, filtered to `leisure=golf_course`, ODbL attribution in results). Found courses are rankable/bookmarkable and persist locally (`store.customCourses`). | Same endpoint state moves server-side: Postgres `pg_trgm` + FTS over the seeded `courses` table; Photon results become the OSM half of the seed. Google Places stays display-time-only (a browser-exposed Places key on a static site was the reason to prefer OSM here too) | **OGA + OSM** seed; own DB | 1 |
| **Search location field** | Substring match on `city/state/region` strings | Same FTS + PostGIS `ST_DWithin` for "near X"; geocode the query via Mapbox Geocoding (bundled in Mapbox account) | Mapbox / own DB | 1 |
| **Search → Looprs** | Substring filter over 7 mock users | FTS over `users` table (username, name) | Own DB (Supabase) | 2 |
| **Bookmark toggle** (course hero 🔖) | `store.bookmarks` in localStorage | `bookmarks` table upsert/delete, RLS-scoped to the user | Supabase | 1 |
| **"I played here — rank it" → band pick** (`RankFlow`) | Band arrays in localStorage | `check_ins` row + band membership server-side | Supabase | 1 |
| **Head-to-head "Which was better?"** | Binary-insert position, **raw picks discarded** | ⚠️ Store each pick as a `ranking_comparisons` row (winner/loser/timestamp) — PLAN §5's Elo/Bradley–Terry refinement is impossible without the raw graph. The prototype's throw-away-after-insert behavior must *not* be ported as-is. | Own algorithm, Edge Function | 1 |
| **Score computation (0–10)** | Linear interpolation over band position, client-side (`computeScores`) | Edge Function recomputes per-user scores from the comparison graph on each check-in; client displays server value | Supabase Edge Functions | 1 |
| **Save round + note** | `checkins[]` in localStorage | `check_ins.note`; also needs `played_at` date picker (prototype hardcodes "now") and photo attach | Supabase (+ Storage) | 1–2 |
| **Trip map pins** (`MapView`) | All 10 mock courses, Leaflet + OSM public tiles | Viewport-bounded PostGIS query ("search this area"), pin clustering, Mapbox GL styled tiles | **Mapbox** (`@rnmapbox/maps`), own DB | 3 |
| **Map pin popup → course page** | Leaflet popup link | Mapbox annotation callback | Mapbox | 3 |
| **Profile Played/Bookmarked toggle cards** | localStorage lists | Same queries as Lists tab, scoped to any user id (enables visiting others' profiles) | Supabase | 2 |
| **Bottom nav, back buttons, cancel links, segmented controls** | Local UI state | Ports to expo-router navigation unchanged | — | 0 |

## C. Should-be-tappable (rendered as static rows/cards today, need target screens)

| Element | Today | Needs | Phase |
|---|---|---|---|
| **UserRow** in Loopr search results | Not tappable, no follow affordance | Other-user profile screen + **Follow/Unfollow** button writing to `follows` | 2 |
| **Feed card user header** (avatar/name) | Not tappable | Link to that user's profile | 2 |
| **Leaderboard rows/podium** | Not tappable | Link to user profiles; also scoped variants (friends-only, by state) are just filters on the materialized view | 2 |
| **Followers / Following counts** on Profile | Static mock numbers (128/143) | Counts from `follows` + tappable follower/following list screens | 2 |
| **Guide cards** (Lists → Guides) | Render title/source/count, not tappable | Guide detail screen backed by `lists`/`list_items`; editorial content entered as data (PLAN Phase 4). Licensing note: "Golf Digest" titles are mock — real guides need either original editorial or a licensing conversation | 4 |
| **Feed photos / course photo strip** | CSS-gradient placeholders | Real photos from Supabase Storage w/ CDN transforms; needs the capture/upload flow (`expo-image-manipulator` client resize) and pre-publish moderation scan (App Store 1.2) | 2 |

## D. Mock data structures in `data.js` → real sources

| Mock | Shape today | Real source | Transition notes |
|---|---|---|---|
| `courses` (10 rows) | Hand-written, incl. `rating`, `numRatings`, `friendsScore`, `region`, `par`, `yardage`, `access`, `website`, `phone` | `courses` table seeded from **OGA** (16.8k US, free, ODbL — attribution required in-app) cross-checked w/ **GolfCourseAPI** (blocked on their caching-ToS answer — open follow-up #1 in PLAN §11) + **OSM** boundaries | `par`/`yardage` come from OGA scorecards. `access` (Public/Resort) is in OGA's data. `region` ("Monterey Peninsula") is editorial — either curate top-course regions by hand or derive from OSM admin areas. `rating`/`numRatings`/`friendsScore` do **not** ship in any vendor feed — they're Loopd-computed (see `course_stats` below) and start at zero; UI needs a "not enough ratings yet" state (trimmed mean, min-N per PLAN §5) |
| `currentUser` | Hardcoded Kiran | Supabase Auth (Sign in with Apple required, Google, email OTP) + `users` profile row | Entire auth/onboarding flow is missing from the prototype — it's the largest unbuilt surface (PLAN Phase 1; onboarding "pick 5 courses you've played" is Phase 4) |
| `users` (7 friends) | Hardcoded | `users` table | Social graph starts empty: launch cohort needs invite/find-friends (contacts permission, share link) — not yet in PLAN, worth adding to Phase 2 |
| `feed` (6 items) | Hardcoded, relative "2h ago" strings | `activities` table written on every check-in/photo, read-time query "by people I follow, newest first" (PLAN §6); real timestamps rendered relative | Push notification per activity via Expo Push ("Maya played Pebble Beach") — Phase 2 |
| `played` / `bookmarked` seeds | Arrays seeding localStorage | Dropped entirely — real users start empty; the localStorage seed logic in `store.js` `initialStore()` is prototype-only | The Phase-4 onboarding flow replaces the "pre-seeded rankings" trick |
| `recs` | Hardcoded 3 ids | No vendor for this — start as a query: "courses your friends loved that you haven't played, within X miles" (PostGIS + follows), evolve later | Not explicitly in PLAN — recommend adding to Phase 3 scope |
| `guides` | 4 hardcoded cards | `lists` / `list_items` rows, editorial tooling = SQL inserts at first | Phase 4 |
| `leaderboard` incl. `delta` ("+3 this month") | Hardcoded | Materialized view `count(distinct course_id)` over `check_ins`, refreshed on schedule; delta = same count windowed to 30 days | Phase 2 |
| `notes` per course | Hardcoded | `check_ins.note` joined w/ user; needs **report/block** on every note/photo surface (App Store rule 1.2 — launch blocker for App Review, PLAN §7) | 2 |
| Course photos (`grad` gradients) | CSS gradients | Supabase Storage paths | See C above |
| `userById` / `courseById` helpers | Array `.find` | Become API/query calls — the prototype's "every screen reads from data.js" discipline (its stated design goal) pays off here: swap the module for a data layer, UI untouched | 0–1 |

## E. Derived/visual elements with a specific replacement

| Element | Today | Real version |
|---|---|---|
| **Course hero silhouette** (`CourseSilhouette`) | Seeded-random SVG fairways/greens/bunkers — decorative, not the actual course | **Mapbox Static Images API** hero: styled real map centered on the course pin (PLAN §3). Upgrade path to true hole polygons = OSM interior detail where mapped (open follow-up #2), else iGolf/Golfbert ($5k+/yr, sales-led) only when GPS-grade features justify it |
| **Score pill color logic** | `< 8.5` renders "mid" | Keep — pure client style |
| **Map legend / pin colors** | played/bookmarked/other from localStorage | Same, from server lists |
| **OSM tile layer + attribution** | `tile.openstreetmap.org` | Mapbox GL custom style (Loopd's visual identity); keep OSM *data* attribution wherever OSM-derived course data is shown — ODbL requires it even off the map |

## F. Monetization hooks not yet in the UI (PLAN §8 says "design the cell for it now")

| Hook | Where it lands | Source |
|---|---|---|
| **Book a tee time** button | Course page action row (4th button) | Affiliate deep link to GolfNow/Supreme Golf w/ tag (~6% TeeOff-ballpark commission, zero integration risk); upgrade to Lightspeed/GolfNow partner API booking later — applications have weeks-to-months lead, start at Phase 5 or earlier |
| **Sponsored badge slot** | Feed card, search result row, list row | Homegrown `sponsorships` table; the shared `CourseRow`/card components are exactly where the badge slot should be reserved when porting |

## G. Summary: what stands between the prototype and "real data everywhere"

In dependency order:

1. **Supabase project + schema + RLS** (PLAN §9) — unlocks everything below.
2. **Auth + onboarding** — biggest missing surface; nothing user-scoped is real without it.
3. **Course DB seed** — OGA pull (free key, 10k req/day) + OSM cross-check;
   the two open vendor questions (GolfCourseAPI caching ToS, OSM interior-detail
   quality probe) are cheap to resolve now and gate nothing else.
4. **Check-in pipeline done right** — persist raw `ranking_comparisons`
   (fixing the prototype's discard behavior), Edge-Function scoring,
   `course_stats` aggregates with min-N display rule.
5. **Social graph** — follows, other-user profiles, feed from `activities`,
   leaderboard view, report/block moderation (App Review blocker).
6. **Maps** — Mapbox swap-in for tiles, static hero images, viewport queries.
7. **Contact buttons** — OGA-seeded website/phone + Places live verification
   (the three dead buttons become one afternoon of work once the DB exists).
8. **Content & hooks** — guides as data, tee-time affiliate link, sponsored slot.

Every mock has a named destination; no interaction in the prototype depends on
data that lacks a sourcing plan. The two external unknowns that could shift the
plan are GolfCourseAPI's caching terms (fallback: OGA+OSM only, US-only launch —
already the stated launch posture) and Places pricing at scale (fallback:
serve OGA contact data un-verified, refresh from OGA periodically).
