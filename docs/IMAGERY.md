# Course imagery

The course page used to open on a generated silhouette — abstract fairways and
bunkers drawn from a hash of the course name. It looked like golf, but it was
never a picture of *that* course. This is what replaced it, and how to feed it.

---

## 1. The tiering rule

Real imagery is either metered, keyed, or both. Spending it evenly across
40,000 courses would mean spending most of it on courses nobody opens, so the
budget follows attention:

| Tier | Who lands here | Providers, in order |
| --- | --- | --- |
| **Flagship** | ≥ 800 ratings — the Pebbles and Bethpages | SkyFi archive → satellite basemap → Wikimedia → Google Places |
| **Well known** | ≥ 150 ratings, or anyone has left a note | satellite basemap → Wikimedia → Google Places |
| **Long tail** | everything OSM search turns up | satellite basemap → Wikimedia |

`prominenceTier()` in `src/imagery.js` owns the thresholds; a course can pin its
own tier with a `tier` field when the rating count lies (a new course that is
obviously a flagship, say).

Two properties matter more than the exact numbers:

- **Every provider fails soft.** A blocked host, a rate limit, or a renamed
  field drops that provider out of `Promise.allSettled` and the next one fills
  the slot. The generated silhouette is still there as the last resort, so the
  hero is never empty and never blocks on the network.
- **The satellite basemap leads the carousel.** It is the one image guaranteed
  to be of *this* course — it is rendered from the course's own coordinates. A
  photo provider can only ever return a confident guess, so photos come second.
  The exception is a **verified member photo**, which leads everything: a person
  who stood on the 7th beats an aerial.

## 2. What works with no key at all

Both of these are live today on the static GitHub Pages build:

- **Esri World Imagery** — free satellite tiles, no key, attribution required.
  Rendered through Leaflet (already a dependency), so tile maths, retina and
  resize are handled. `SATELLITE_LAYER` in `src/imagery.js` is a one-line swap
  to Mapbox Satellite once there is a token (PLAN §3).
- **Wikimedia Commons** — `generator=geosearch` for CC/public-domain photos taken
  within 3 km of the pin. CORS-open with `origin=*`.

Attribution is a licence condition for both, so it renders on the slide itself
(the credit pill), not in an About screen.

## 3. Turning on the keyed providers

Copy `.env.example` to `.env.local`. Config resolves in this order, first hit
wins (`src/config.js`):

1. `window.LOOPD_CONFIG` — a `<script>` injected at deploy time
2. `import.meta.env.VITE_*` — baked in at build time
3. `localStorage['loopd-config']` — a per-browser override for development

### SkyFi

SkyFi's archive holds already-captured scenes, including open-data ones that
cost nothing — that is the tier worth pulling, not fresh tasking.

**The SkyFi key must not reach the browser.** Point `VITE_SKYFI_ENDPOINT` at a
proxy (a Supabase Edge Function is the natural home) that holds the secret and
answers this contract:

```
GET  {endpoint}?lat=&lng=&name=&limit=&openData=true
→ 200 { "archives": [ {
        "archiveId": "…",
        "thumbnailUrls": { "300x300": "https://…" },   // or thumbnailUrl / previewUrl
        "captureTimestamp": "2025-06-02T18:11:00Z",     // or capturedAt / acquisitionDate
        "provider": "…",                                // or constellation / satellite
        "resolution": "50cm"                            // or gsd
      } ] }
```

`fetchSkyfi()` reads that response **tolerantly** — it accepts `archives`,
`results`, `scenes`, or a bare array, and falls back through the alternate field
names above. That is deliberate: the shapes differ between SkyFi's archive-search
API and its MCP tool output, and a renamed key should cost us one scene, not the
whole hero.

> **Not yet verified against live SkyFi.** The SkyFi MCP server was not
> connected to the session this was built in, and this environment's network
> policy blocks outbound hosts, so the adapter has never seen a real response.
> The tolerant mapper and the fail-soft path are what make that safe to ship —
> but the first person with a key should confirm the field names and delete this
> note.

### Google

Set `VITE_GOOGLE_MAPS_KEY` and **restrict it to the deploy's HTTP referrer in
the Google Cloud console first** — anything in the bundle is public. This turns
on Static Maps (cheap) and Places photos (billed per request), which is why they
sit below the keyless tiers rather than above them. Google's terms require the
contributor attribution to be displayed; it renders in the credit pill.

## 4. Caching

`loopd-media-v1` in localStorage holds **URLs and credits only, never pixels**,
for 7 days, capped at 120 courses LRU. A re-opened course page costs nothing and
does not re-bill a metered provider. `clearMediaCache()` empties it.

## 5. Member photos and what "verified" means

The claim a photo makes is *"this is what that course looks like"*, so the check
that matters is **was it taken there**.

| Result | When | Where it shows |
| --- | --- | --- |
| **Verified** (high) | EXIF geotag within 3 km of the pin | hero carousel + gallery |
| **Verified** (medium) | no geotag, but uploaded from within 3 km | hero carousel + gallery |
| **Pending review** | nothing to check against, or uploaded from elsewhere | gallery only |
| **Couldn't verify** | geotag proves it is somewhere else, or the file isn't plausibly an original | gallery only, greyed |

Uploading a real photo from your couch is the normal case, so a device-location
mismatch is *pending*, never a rejection. Only a geotag that positively places
the photo elsewhere rejects it.

`src/exif.js` is a ~150-line reader for exactly two tags (GPS fix, capture time)
— a full EXIF library is not worth the bundle for that.

**These checks are advisory.** EXIF is trivially editable; they stop honest
mistakes and cheap reposts, not a determined faker. The authoritative pass is
server-side, which is why `verifyPhoto()` includes a `moderation` check that
reports `pass: null` — an un-run check must never read as a pass. Vision
moderation before publish is an App Store 1.2 requirement (PLAN §7), and the
three states above are already the review queue's states.

## 6. Storage, and what replaces it

With no backend, an upload is downscaled to 1200 px / q0.72 in a canvas and
parked in `loopd-uploads-v1`: 4 photos per course, ~3 MB total, evicted
oldest-first across all courses so one enthusiastic uploader can't wedge the
app's storage.

`src/uploads.js` is the file Supabase Storage deletes. The upload record is
already the row shape — `{ courseId, userId, dataUrl → storage_path, width,
height, takenAt, geotagged, addedAt, verification }` — so the migration is
swapping the persistence calls, not reshaping the data.

## 7. Desktop

At ≥ 1024 px the course page portals out of the phone frame into a two-column
modal: the image carousel on the left, a live interactive satellite map on the
right, plus a provenance card naming the tier and the sources that actually
rendered. Esc or a backdrop click closes it. Below that breakpoint nothing
changes — the page pins itself back to the same 430 px column.
