# Loopd — Plan: prototype → real app

Goal: ship a real iOS app (Android later) that does the core Beli-for-golf loop —
rank courses, bookmark them, see friends' activity, plan trips on a map.

---

## 1. Platform decision

**React Native + Expo (TypeScript), iOS-first.**

- The existing prototype is React; components, state shapes, and the design system
  port almost 1:1 to React Native primitives.
- Expo gives us: managed native builds (EAS Build), OTA updates (EAS Update),
  push notifications, App Store submission tooling — no Xcode wrangling for most work.
- `expo-router` for file-based navigation (tabs map directly to our 4-tab shell).
- Ship iOS via TestFlight first; Android is a config away when we want it.

Why not native Swift: one codebase, faster iteration, and nothing in Loopd
(maps, feeds, photos) needs bleeding-edge native performance.

Why not stay web/PWA: social + camera + push + App Store presence is the product.
The web prototype survives as a marketing site / web viewer later.

## 2. Backend

**Supabase** (managed Postgres) as the single backend:

- **Postgres + PostGIS** — the trip-planning map ("courses near each other") is a
  geo query; PostGIS `ST_DWithin`/bounding-box queries make it trivial and fast.
  Relational data (ratings, follows, rankings) is naturally SQL.
- **Supabase Auth** — Sign in with Apple (required by App Store when offering
  social login), Google, email OTP. Row Level Security for authorization.
- **Supabase Storage** — user photos, with on-the-fly image transforms/CDN.
- **Realtime** — live feed/leaderboard updates if we want them.
- **Edge Functions** (Deno/TS) — ranking-score computation, feed fan-out,
  course-data enrichment jobs, webhook handlers.

Why not Firebase: Firestore is a poor fit for relational + geo + ranking queries;
we'd be fighting the data model from day one.

## 3. Maps & the course silhouette

**Mapbox** (`@rnmapbox/maps` in the app):

- Custom map styling (mute everything, make golf features pop) — this is Loopd's
  visual identity, and Mapbox styling is far ahead of Google's.
- **Static Images API** renders the course-page hero: a styled, non-interactive
  map image centered on the course with a pin — exactly the "silhouette of the
  course on maps" from the spec, real instead of generated art.
- Trip-planning map: pin clustering, offline tiles later.
- Generous free tier (50k monthly map loads on mobile); predictable pricing after.

Fallback/complement: Apple Maps via `expo-maps` is free on iOS but style-locked.
Directions button deep-links to Apple/Google Maps — no API needed.

## 4. Course data (the moat problem)

_See §11 — research findings on vendors, coverage, pricing, licensing._

Strategy in short:

1. **Seed** our own `courses` table from OpenGolfAPI (free, ODbL, ~16.8k US
   courses with contact info) + OpenStreetMap boundaries, cross-checked with
   GolfCourseAPI (pending license verification).
2. **Enrich live, don't cache**: Google Places is display-time-only by ToS —
   we may store only the Place ID. Use it as a live verification layer for
   phone/website/hours, not as DB seed.
3. **Own the delta**: user-submitted corrections/additions become our data.
   The course DB quality becomes a moat over time, like Beli's restaurant graph.
4. **Upgrade later**: iGolf or Golfbert (sales-led, ~$5k+/yr) only if/when we
   need hole-level GPS polygons and booking-grade global coverage.

## 5. The ranking system (core product mechanic)

Beli's magic is *comparative* ranking, not "give it 4 stars":

- After marking a course played, the app asks **"Better or worse than X?"** a few
  times (binary comparisons against courses you've already ranked).
- Store raw comparisons (`ranking_comparisons` table); an Edge Function converts
  each user's comparison graph into a 0–10 score per course
  (binary-search insertion like Beli, refined with Elo/Bradley–Terry).
- A course's public rating = trimmed mean of user scores (min N ratings before
  showing, to avoid single-vote 10.0s).
- Friends' score = mean over people you follow.

This is pure algorithm work on our own data — no external service.

## 6. Social graph, feed, leaderboard

- `follows` table (follower_id, followee_id). Instagram-style public-by-default,
  private accounts later.
- **Feed (MVP)**: read-time query — "activities by people I follow, newest first,"
  denormalized into an `activities` table written on every check-in/rating/photo.
  At our scale for a long time, a single indexed query is plenty.
- **Feed (later, if needed)**: Stream (getstream.io) activity feeds, or fan-out-
  on-write in Postgres. Don't buy this early.
- **Leaderboard**: materialized view over check-ins (`count distinct course`),
  refreshed on a schedule; scoped variants (friends-only, by state) are just filters.
- **Search**: Postgres `pg_trgm` + FTS for typo-tolerant course/user search at MVP;
  upgrade to Typesense/Algolia/Meilisearch when the corpus or ranking needs grow.

## 7. The rest of the stack

| Concern | Choice | Notes |
|---|---|---|
| Push notifications | Expo Push | Free, unified APNs/FCM; "Maya played Pebble Beach" |
| Photos | Supabase Storage + CDN transforms | Client-side resize (`expo-image-manipulator`) before upload |
| Crash reporting | Sentry (`sentry-expo`) | |
| Analytics | PostHog | Free tier, session replay, feature flags for experiments |
| CI/CD | GitHub + EAS Build/Submit + EAS Update | OTA-update JS fixes without App Review |
| Moderation | Report/block + hide UGC (App Store rule 1.2) | Photo scan via a vision-moderation API before publish |
| Deep links | Expo Linking + universal links | Course/profile share links |
| Email | Resend or Postmark | Auth emails, digests |

## 8. Monetization plumbing (defer, but don't paint over)

- **Sponsored/boosted courses & guides**: homegrown — a `sponsorships` table and
  a "Sponsored" badge slot in feed/search/list cells. Design the cell for it now.
- **Tee-time referrals**: start as **affiliate deep links** (open GolfNow/Supreme
  Golf with our affiliate tag) — revenue without integration risk; true in-app
  booking only if a partner API materializes (see §11).
- **Trip-planning referrals**: hand-negotiated partnerships; just a link-out slot.
- **Ads**: AdMob native ads in feed — last resort, hurts a social product early.
- **Subscriptions (if ever)**: RevenueCat over raw StoreKit.

## 9. Data model (first cut)

```
users          id, username, name, avatar_url, bio, created_at
follows        follower_id → users, followee_id → users
courses        id, name, geom (PostGIS point), city, state, country,
               website, phone, par, yardage, access, source, external_ids (jsonb)
check_ins      id, user_id, course_id, played_at, note, score (0-10, computed)
ranking_comparisons  user_id, winner_course_id, loser_course_id, created_at
bookmarks      user_id, course_id, created_at
photos         id, check_in_id, storage_path, caption
activities     id, user_id, type, course_id, check_in_id, created_at  (feed table)
lists / list_items   for Recs + editorial Guides
course_stats   course_id, avg_score, num_ratings  (materialized, refreshed)
```

## 10. Phased roadmap

**Phase 0 — Foundations (≈1 week)**
Expo app scaffold (TS, expo-router, 4-tab shell ported from prototype),
Supabase project, schema + RLS, EAS builds to TestFlight, Sentry/PostHog wired.

**Phase 1 — Core loop, single-player (≈3–4 weeks)**
Auth (Apple/Google/email). Course DB seeded (§4/§11). Search (name + location).
Course page with real Mapbox hero + Places-enriched contact buttons.
Check-in → comparative ranking flow → personal 0–10 scores. Bookmarks. Played list.
*Exit bar: you can find any course, rank it, and your Played list is real.*

**Phase 2 — Social (≈2–3 weeks)**
Profiles, follow graph, activity feed with notes/photos, push notifications,
leaderboard, Loopr search, report/block moderation.
*Exit bar: two friends can follow each other and see each other's rounds.*

**Phase 3 — Map & trips (≈2 weeks)**
Full-screen map view with clustered course pins (color = played/bookmarked/rec),
"search this area", course-density trip view; save a trip (named list + map).

**Phase 4 — Content & launch (≈2 weeks)**
Editorial guides (Golf Digest-style lists as data), share links/cards,
onboarding (pick 5 courses you've played → instant ranked list),
App Store assets, privacy policy/ToS, App Review, launch to a beta cohort.

**Phase 5 — Monetization & Android**
Affiliate tee-time links, sponsored slots, Android build (config + QA),
then evaluate booking-API partnerships with real traffic numbers.

## 11. Course data & tee-time vendor research (July 2026)

### Course data vendors

| Vendor | Coverage | Key fields | Pricing | Access | Can we build a cached master DB? |
|---|---|---|---|---|---|
| **OpenGolfAPI** (opengolfapi.org) | 16.8k+ US courses, all 50 states; 16.2k with full scorecards; **US-only** | Name/location, scorecards, tees/slopes, architect, **phone/website/address**, climate | **Free** (1k req/day anon; 10k/day with emailed key) | Self-serve | **Yes** — ODbL: commercial use OK with attribution; share-alike applies if we redistribute the derived database |
| **GolfCourseAPI** (golfcourseapi.com) | ~30k courses worldwide (self-reported) | Name, location, tee data, course/slope rating | Free 50 req/day; $9.99/mo 10k/day; $24.99/mo 100k/day | Self-serve (email) | **Unverified** — caching/storage terms not published; confirm ToS before seeding from it |
| **OpenStreetMap** (Overpass) | ~50k courses worldwide; interior detail (fairway/green/bunker polygons) inconsistent | Boundaries + hole polygons where mapped | Free | Self-serve | **Yes** — ODbL, same terms as OpenGolfAPI; attribution required in-app |
| **iGolf / iGolf Connect** | 40k+ courses, 175+ countries; elevation/terrain for 20k+ | Listings, scorecards, full hole-GPS maps, 3D terrain | "Starts at ~$5,000/yr"; real pricing behind NDA | **Sales-led** | Terms negotiated per deal |
| **Golfbert** | Unpublished | Hole-level GPS polygons (greens/fairways/hazards), tee boxes, scorecards | Unpublished | **Sales-led** (no public pricing/coverage) | Unknown — requires outreach |
| **golfapi.io** | 42k+ courses, 100+ countries | Scorecards, tees/distances, green coordinates | Contact-only | **Sales-led** | Unknown |
| **Golf Intelligence** | "Thousands" (no hard count) | Precision tee/hazard/green coordinates, aerial imagery | $399–$15,000/mo, credit-metered | Self-serve | **No** — cache is metered *per end-user per year*; explicitly not a shared-master-DB license |
| **Google Places** | Global | Phone, website, hours (all Enterprise-tier fields) | Details w/ contact fields: **$20/1k calls**; Nearby Search $32–40/1k; $200/mo free credit | Self-serve | **No** — ToS forbids storing anything except the Place ID (refresh IDs ~yearly) |

**Decision:** seed from OpenGolfAPI + OSM (both free, both ODbL — clean to
combine), display OSM attribution in-app, verify GolfCourseAPI's ToS as a
cross-check source, and treat Google Places strictly as a live lookup at
course-page-view time. Budget an iGolf/Golfbert conversation for the point
where we want hole polygons (GPS/rangefinder-grade features) or full
international coverage. US-only seed data is fine for launch.

### Tee-time booking / affiliate

**Pattern: nobody is self-serve.** Every major platform gates production API
access and commission terms behind a partnership application:

- **GolfNow (NBC Sports Next)** — 11k+ courses. Public API docs + sandbox exist
  (affiliate.gnsvc.com, OAuth2/REST), but commercial onboarding goes through
  their business-partnership application. Owns EZLinks (tee sheets) and TeeOff.
- **TeeOff** — 1,200+ courses, 19 countries; consumer affiliate listings show
  **~6% commission, 21-day cookie** via affiliate networks — the one concrete
  revenue number in the space; treat as the ballpark for referral economics.
- **Supreme Golf** — aggregates GolfNow/TeeOff/Groupon/etc.; no public developer
  program; terms pages gated. Outreach required.
- **Lightspeed Golf (Chronogolf) Partner API** — real, well-documented API
  (book/modify/check-in/pay against live tee sheets), approved-partners only;
  apply via their partner form, ~24h response claimed.
- **foreUP** — "open API" marketing, but access is brokered course-by-course
  through the operator, not a developer portal.

**Decision:** this confirms §8 — launch with **affiliate deep links** (zero
integration risk, immediate referral revenue at TeeOff-style ~6%), and start the
GolfNow + Lightspeed partnership applications early (weeks-to-months of BD lead
time) so a real in-app booking integration is possible by the time we have
traffic numbers worth pitching.

### Competitor sourcing (directional)

18Birdies claims 40k+ courses (vendor undisclosed; UGC layered on top — same
moat strategy as ours). GolfNow's app likely runs on operator-submitted EZLinks
data. Industry pattern matches our plan: course master data and live booking
come from *different* vendors.

### Open follow-ups

1. Email GolfCourseAPI about caching/storage rights + hole-GPS fields.
2. Run the Overpass count query + a sample fairway/green polygon extraction for
   5 known courses to gauge OSM interior-detail quality in our launch regions.
3. Golfbert outreach (pricing, coverage, license) when we near GPS features.
4. GolfNow + Lightspeed partnership applications at start of Phase 5 (or earlier).
