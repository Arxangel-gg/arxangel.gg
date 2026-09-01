# ARXANGEL — Flagship Site

The official home of **ARXANGEL** — a dependency-free, production-ready static site
built for Netlify. Cinematic hero, the **SUMMONED** release centerpiece with a custom
player, the Order pillars, a lazy Twitch facade, ambient FX, and a cinematic intro —
all driven by one config file and fully embeddable in Carrd.

No build step. No frameworks. Just open `index.html`.

---

## 1. What's inside

```
site/
├── index.html              # the whole page (semantic, SEO + JSON-LD)
├── css/
│   ├── fonts.css           # self-hosted variable fonts (zero 3rd-party requests)
│   └── main.css            # design system + every component (sectioned + commented)
├── js/
│   ├── config.js           # ★ EDIT THIS — links, media, toggles
│   ├── env.js              # runtime flags + helpers
│   ├── main.js             # orchestrator (nav, scroll, video, embed bridge, lazy-load)
│   └── modules/
│       ├── intro.js        # cinematic welcome overlay (once/session)
│       ├── ambient.js      # ONE canvas: embers + dust + comets
│       ├── audio.js        # SUMMONED player + sound pill (one shared <audio>)
│       ├── cursor.js       # gold crosshair cursor (desktop only)
│       ├── reveal.js       # scroll-reveal animations
│       ├── quotes.js       # rotating transmission line
│       └── releases.js     # featured cover swap + "The Vault" grid
├── data/
│   └── releases.json       # ★ EDIT THIS — discography (add future releases here)
├── assets/                 # logo.svg, og-image, key-art, generated app icons
├── fonts/                  # cinzel.woff2, inter.woff2 (variable, latin subset)
├── media/                  # bg.webm / bg.mp4 (optimized) + posters
├── favicon.svg, site.webmanifest, robots.txt, sitemap.xml
├── _headers                # caching + security (framing left open for Carrd)
└── netlify.toml            # config for Git-based deploys
```

---

## 2. Editing the site (no code required)

**`js/config.js`** is the single source of truth:

| What | Where |
|------|-------|
| Social / platform links (Twitch, Discord, X, Steam, YouTube…) | `links` — a blank `""` **auto-hides** that button |
| SUMMONED streaming buttons (Spotify, Apple Music…) | `streaming` — blank `""` auto-hides; all blank shows a "soon" line |
| Turn features on/off (intro, FX, cursor, quotes, sound, live, **bets**, scroll bar) | `features` |
| **Ambient visit sound** (soft ASMR cue, not a playlist track) | `audio.ambientTrackUrl` |
| **The single (SUMMONED) Spotify player** | the `<iframe>` in `index.html` (`release__spotify`) + `streaming.spotify` |
| Toggle the **Bets** section site-wide without redeploying | `data.flagsUrl` JSON, or `?bets=on/off` per-device (see §9) |
| Twitch channel + **parent domains** (see §6) | `embeds` |

**Updating the featured single later:** swap the Spotify **track id** in the
`release__spotify` iframe `src` (and `streaming.spotify`), then drop the new cover
into `data/releases.json` (`cover`). To turn the *previous* single into a back-catalog
item, add it as a non-featured entry — it lands in **The Vault** automatically.

**`data/releases.json`** is the discography:
- The `featured: true` entry can swap the SUMMONED cover (set `cover` to a real image path; leave it as the default `key-art` to keep the designed cover).
- **Add any new single/EP/album** as another object and it appears automatically in **The Vault** grid — no code changes.

**Swapping the background video / poster:** drop new files in `media/` (keep names, or update `config.js → media`). To re-optimize a heavy source, see §7.

---

## 3. Preview locally

Any static server works:

```bash
# Python (built in)
cd site
python -m http.server 8000
# → http://localhost:8000

# or Node
npx serve site
```

> Use a server, not `file://` — ES modules and `fetch()` require `http://`.

---

## 4. Deploy to Netlify

### Option A — Drag & drop (fastest)
1. Go to <https://app.netlify.com/drop>.
2. Drag the **`site`** folder onto the page.
3. Done — you get a `*.netlify.app` URL. `_headers` is applied automatically.

### Option B — Git / continuous deploy
1. Push the repo to GitHub/GitLab.
2. In Netlify: **Add new site → Import an existing project**.
3. Set **Base directory** = `site` and **Publish directory** = `site` (or `.`).
   Leave the build command empty (it's static). `netlify.toml` handles the rest.

### Custom domain (`arxangel.gg`)
Netlify → **Domain settings → Add a domain** → point your DNS (Netlify DNS or a
`CNAME`/`A` record) at the site. HTTPS is automatic. This makes the Netlify site the
real `arxangel.gg` — the recommended setup (see §5).

---

## 5. Carrd integration

You have two paths. **Recommended:** make this Netlify site your primary
`arxangel.gg` (§4 custom domain) and retire the Carrd page — it's a full flagship
site, not a widget. But if you want to **embed it inside an existing Carrd page**,
use the code below.

### A) Full-screen takeover (recommended) — the site IS the page

Makes the iframe cover the entire viewport so the Carrd page becomes the ARXANGEL
site, with the **full experience** (nav, intro, hero, FX, sound). In Carrd add an
**Embed → Code** element (placed anywhere — it breaks out to full screen) and paste:

```html
<!-- ARXANGEL — full-screen takeover -->
<iframe
  id="axFlagshipFrame"
  title="ARXANGEL"
  src="https://roaring-sundae-d0aff7.netlify.app/"
  style="position:fixed; inset:0; width:100%; height:100%; border:0; margin:0; padding:0; z-index:2147483000; background:#07060a;"
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
  referrerpolicy="strict-origin-when-cross-origin"></iframe>

<script>
/* Make the takeover bullet-proof: lift the iframe out of any Carrd container that
   uses transform/overflow (which would clip a fixed element), and stop the Carrd
   page scrolling behind it. */
(function () {
  var f = document.getElementById("axFlagshipFrame");
  if (!f) return;
  if (f.parentNode !== document.body) document.body.appendChild(f);
  var h = document.documentElement, b = document.body;
  h.style.margin = b.style.margin = "0";
  h.style.height = b.style.height = "100%";
  h.style.overflow = b.style.overflow = "hidden";
})();
</script>
```

- **No `?embed=1`** here — that's the whole point: you get the complete site, not a
  stripped widget. The iframe is its own full viewport, so the fixed nav, intro and
  internal scrolling all behave exactly like the standalone site.
- The `background:#07060a` avoids a white flash before the site paints.
- Already using your live URL `roaring-sundae-d0aff7.netlify.app`. Swap it if you move
  to a custom domain.

> Even simpler if you're willing: point `arxangel.gg` straight at Netlify (§4) and skip
> Carrd entirely — same result with one less layer.

### B) Inline widget (optional) — boxed panel inside a normal Carrd layout

If instead you want it to sit **inside** your existing Carrd page as a self-resizing
panel (keeps your Carrd header/sections around it), add `?embed=1` — that hides the
nav/intro/cursor/quote/sound, runs transparent, and posts its height so the box grows
to fit:

```html
<div style="width:100%;max-width:1280px;margin:0 auto;">
  <iframe id="axFlagshipFrame" title="ARXANGEL"
    src="https://roaring-sundae-d0aff7.netlify.app/?embed=1"
    style="width:100%;height:760px;border:0;display:block;background:transparent;border-radius:18px;"
    loading="lazy" allowtransparency="true"
    allow="autoplay; fullscreen; clipboard-write"></iframe>
</div>
<script>
(function () {
  var f = document.getElementById("axFlagshipFrame");
  var origin = new URL(f.src).origin;
  addEventListener("message", function (e) {
    if (e.origin === origin && e.data && e.data.type === "AX_CONSOLE_RESIZE") {
      var hh = Number(e.data.height) || 0;
      if (hh > 240) f.style.height = Math.min(hh, 20000) + "px";
    }
  });
  f.addEventListener("load", function () { f.contentWindow.postMessage({ type: "AX_REQUEST_CONTEXT" }, origin); });
})();
</script>
```

The site sets framing-friendly headers (no `X-Frame-Options`), so both modes embed cleanly.

---

## 6. ⚠️ Twitch parent domains (required for the Live section)

Twitch's player **refuses to load unless the embedding domain is whitelisted**.
In `js/config.js` add **every** domain that serves the page:

```js
embeds: {
  twitchChannel: "arxangel_gg",
  twitchParents: ["arxangel.gg", "your-site.netlify.app", "localhost"],
}
```

If you embed in Carrd, also add your **Carrd domain** (e.g. `yoursite.carrd.co`) —
the player runs inside the iframe, so its parent is the Carrd page. (The site also
auto-adds the current host + any ancestor frames at runtime, so this is a backstop.)

---

## 7. The music playlist (auto-populating)

The **Transmissions** section renders each release as a card; pressing play loads
that track's Spotify player inline. Releases come from one of two sources:

### Easy mode — `data/releases.json` (no backend)
Add an object per release and it appears instantly. Take the track id from its
Spotify link (`open.spotify.com/track/<ID>`) and a 640px cover from Spotify (open
the oEmbed thumbnail and swap `00001e02` → `0000b273` in the image path):

```json
{
  "title": "New Single",
  "type": "Single",
  "year": "2026",
  "releaseDate": "2026-08-01",
  "cover": "https://i.scdn.co/image/ab67616d0000b273XXXXXXXXXXXXXXXX",
  "spotifyType": "track",
  "spotifyTrack": "THE_TRACK_ID",
  "links": { "spotify": "https://open.spotify.com/track/THE_TRACK_ID" }
}
```

`music.featuredTitle` in `config.js` pins one release first (currently `SUMMONED`);
the newest `releaseDate` gets the **Latest** tag.

### Auto mode — pull your whole Spotify catalog (zero edits, ever)
The Netlify function `netlify/functions/releases.js` fetches your entire
discography so **new drops appear by themselves**. One-time setup:

1. <https://developer.spotify.com/dashboard> → **Create app** → copy the
   **Client ID** + **Client secret** (any redirect URI — we never use login).
2. Netlify → **Site configuration → Environment variables**, add:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_ARTIST_ID` = `0aT62hqUqTkgTmeYfgUy4n` *(optional; already the default)*
3. Redeploy. The site calls `/.netlify/functions/releases` (cached ~15 min).

Until then the function returns 503 and the site **silently falls back** to
`releases.json`, so it always works. (Functions ship automatically on a Git deploy,
and are bundled in a drag-and-drop deploy of the `site` folder too.)

> Spotify embeds follow the **visitor's system theme** (dark under dark mode, which
> matches the site for most of the audience). Spotify doesn't allow forcing it from
> outside the iframe.

---

## 8. The Range (bundled aim trainer + global leaderboard)

The **ARXAIM** aim trainer is self-hosted at **`/range/`** (`site/range/`) and
re-themed to the brand gold (fonts self-hosted too — no Google Fonts). The
homepage **"The Range"** section is a facade whose *Enter The Range* button opens
`/range/`; the game has a `← arxangel.gg` link back home. Personal bests live in
`localStorage`. To update it, edit the files in `site/range/` (mode colors live
in `app.js` `MODES`; palette in `style.css` `:root`).

### Global leaderboard (Supabase)
Scores live in the **`arxtrainerscores`** table of your Supabase project.
**One-time setup:** run `supabase-leaderboard.sql` (repo root, next to this
folder) in Supabase → **SQL Editor**. That script (re)builds the table and the
secure submit function; the leaderboard lights up the moment it has run.

- Boards are per **mode + duration** (30/60/120s), one slot per callsign (best
  score wins), each entry tagged **desktop or mobile** — the board has an
  All / Desktop / Mobile filter and marks mobile scores with a phone icon.
- Security: the shipped anon key is **read-only** on the table (row-level
  security). All writes go through the `submit_arxtrainer_score()` Postgres
  function, which sanitizes callsigns and rejects impossible scores.
- Works with **any deploy style** (drag-and-drop included) — the game talks to
  Supabase directly. If Supabase is unreachable, the leaderboard UI simply
  stays hidden; everything else works.
- To wipe or inspect boards: Supabase → **Table Editor** → `arxtrainerscores`.

---

## 9. Asset optimization (reference)

The shipped media was re-encoded from the original 19 MB source down to ~1 MB.
To re-optimize a new background video with [ffmpeg](https://ffmpeg.org):

```bash
# MP4 (H.264) — ~1 MB for a 10s 1280-wide loop
ffmpeg -i SOURCE.mp4 -vf "scale=1280:-2" -c:v libx264 -profile:v high -crf 28 \
  -preset slow -pix_fmt yuv420p -movflags +faststart -an media/bg.mp4

# WebM (VP9) — even smaller, served first where supported
ffmpeg -i SOURCE.mp4 -vf "scale=1280:-2" -c:v libvpx-vp9 -crf 36 -b:v 0 \
  -row-mt 1 -pix_fmt yuv420p -an media/bg.webm

# Poster (shown instantly + as the reduced-motion / data-saver fallback)
ffmpeg -ss 2.5 -i SOURCE.mp4 -frames:v 1 -vf "scale=1280:-2" -q:v 3 media/poster.jpg
```

Fonts are **self-hosted variable woff2** (Cinzel + Inter, latin subset) — no Google
Fonts request, no layout shift.

---

## 10. Performance & accessibility notes

- **Zero dependencies / zero third-party requests** on first paint (fonts, FX are
  local; the Spotify embed and ambient ASMR are lazy / `preload="none"`).
- **Audio that never clashes:** the ambient ASMR cue auto-**ducks** (pauses) the
  instant a visitor engages the Spotify or Twitch player, then they can re-enable it
  from the sound pill.
- Respects **`prefers-reduced-motion`** (disables FX/animations, keeps the poster) and
  **Save-Data** (skips the canvas FX and video).
- The ambient canvas is one rAF loop with pre-rendered sprites, DPR capped at 2,
  density scaled to the viewport, and pauses when the tab is hidden.
- Semantic HTML, skip link, ARIA on interactive controls, keyboard-seekable player,
  visible focus rings, full no-JS fallback.

---

*Order from Chaos. Light from Fire. Victory from Orbit.*
