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
