# ARXAIM — Precision Aim Trainer

A fast, zero-dependency aim trainer that runs in any browser. Plain HTML/CSS/JS —
no build step, no install, no assets to download. Works offline from a double-click
and deploys to Netlify unchanged.

## Modes

| Mode | What it trains |
|---|---|
| **Gridshot** | Raw speed — three targets up at all times, clear them fast |
| **Flick** | Snap aim — one target, always spawned far from your last hit |
| **Precision** | Micro-adjustments — tiny targets, heavy miss penalty on your accuracy |
| **Tracking** | Smooth aim — keep the crosshair glued to a wandering target |
| **Reflex** | Reaction time — wait for the target, then strike (early clicks cost you) |

Scoring rewards speed and streaks; misses cost points and reset your streak.
Personal bests are tracked **per mode per duration** and saved in your browser
(`localStorage`), along with your last 30 runs.

## Controls

- **Mouse** — aim & shoot (left click)
- **1–5** — quick-start a mode from the menu
- **ESC** — pause / back to menu
- **R** — instant restart

## Settings

Duration (30/60/120s), target size, crosshair style + color, and volume.
All persisted automatically. Sound is synthesized with WebAudio — no audio files.

---

## Run locally (Windows)

Double-click **`Play AimTrainer.bat`** (or just open `index.html` in a browser).
That's it — everything works from `file://`, including saves and sound.

If you prefer a local server:

```powershell
npx serve .
```

## Deploy to Netlify

**Option A — drag & drop (fastest):**
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page. Done — you get a live URL.

**Option B — Netlify CLI:**
```powershell
npm i -g netlify-cli
netlify deploy --prod --dir .
```

**Option C — Git:** push this folder to a GitHub repo and connect it in Netlify.
`netlify.toml` is already configured (no build command, publish root).

## Add it to arxangel.gg

**Recommended — subdomain:** in Netlify → *Domain settings* → add custom domain
`aim.arxangel.gg`, then add the CNAME record Netlify shows you at your DNS
provider. Link to it from your site nav.

**Or embed it — full-page iframe:**

```html
<iframe
  src="https://YOUR-SITE.netlify.app"
  style="position:fixed; inset:0; width:100%; height:100%; border:0;"
  allow="autoplay"
  title="ARXAIM Aim Trainer">
</iframe>
```

The included `netlify.toml` sends a `frame-ancestors` header that allows embedding
from `arxangel.gg` (and subdomains) only — nobody else can iframe your trainer.

There's also a tiny scripting surface if you want to control it from your own page
(same-origin only): `window.ARXAIM.startGame('gridshot')`, etc.

## Files

```
index.html            markup (menu, HUD, overlays)
style.css             neon dark theme
app.js                game engine (canvas, modes, scoring, audio, saves)
netlify.toml          Netlify headers + publish config
Play AimTrainer.bat   Windows launcher
```
