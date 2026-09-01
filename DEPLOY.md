# ARXΛNGΞL — deployment

The site is a folder of static files (`site/`) published by **GitHub Pages**.
No build step, no Netlify, no dashboards to babysit.

```
you drop a track on Spotify
        │
        ├── double-click RELEASE.bat ──┐   (immediate)
        │                              ├──► commit to main ──► GitHub Action ──► live
        └── nightly GitHub Action ─────┘   (automatic, within a day)
```

---

## Part 1 — one-time setup

You only ever do this once. It takes about ten minutes, and steps 1–3 are the
only ones that must happen before the site is live.

### 1. Create the repo on GitHub

Go to <https://github.com/new>.

| Field | Value |
|---|---|
| Repository name | `arxangel.gg` (anything works) |
| Visibility | **Public** |
| Initialize with README / .gitignore / licence | **leave all unticked** |

> **Why public?** GitHub Pages only serves from private repos on a paid plan.
> This costs you nothing in secrecy — every file in `site/` is already sent to
> anyone who visits the site, and the Supabase key in `site/range/app.js` is the
> *anon* key, which is designed to be public and is locked down by row-level
> security. There are no credentials in this repo.

### 2. Push this folder to it

Copy the URL GitHub shows you, then run these from `E:\Migrated\AppDev\Arxangel.gg`:

```bash
git remote add origin https://github.com/YOUR-USERNAME/arxangel.gg.git
git push -u origin main
```

Git will ask you to sign in to GitHub the first time. Use the browser prompt.

### 3. Turn on Pages

In your repo: **Settings → Pages → Build and deployment → Source**, choose
**GitHub Actions**. That is the whole configuration — don't pick a branch.

Now open the **Actions** tab. The "Deploy site" workflow runs and, about a
minute later, your site is live at:

```
https://YOUR-USERNAME.github.io/arxangel.gg/
```

**Check it works at this URL before doing step 4.** If the page loads and the
music grid shows six tracks, the hard part is done.

---

## Part 2 — pointing arxangel.gg at it

Right now `arxangel.gg` still serves the **old Carrd page**. This step retires
it. Do it once you're happy with how the site looks on the `github.io` URL.

Your DNS is at **Cloudflare**. In the Cloudflare dashboard → your domain → **DNS**:

### 4a. Delete the old records

Remove the existing `A` / `CNAME` records for `arxangel.gg` and `www` that
point at Carrd. (Screenshot them first if you want a way back.)

### 4b. Add GitHub's records

Four `A` records on the root (`@` / `arxangel.gg`):

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Four `AAAA` records, also on the root:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

One `CNAME` for `www` → `YOUR-USERNAME.github.io`

### 4c. ⚠️ Two Cloudflare settings that will bite you

These are the classic ways this goes wrong:

1. **Set the proxy status to "DNS only" (grey cloud), not "Proxied" (orange).**
   GitHub has to reach your domain over plain HTTP once to issue the free
   HTTPS certificate. With the orange cloud on, that check fails and you get
   stuck on "certificate provisioning" forever. You can switch the proxy back
   on later, after the certificate is issued, if you want Cloudflare's CDN.

2. **If you do re-enable the proxy, set SSL/TLS mode to "Full" or "Full
   (strict)" — never "Flexible".** Flexible mode plus GitHub's own
   HTTPS redirect produces an infinite redirect loop.

### 4d. Finish in GitHub

`site/CNAME` already contains `arxangel.gg`, so GitHub picks the domain up
automatically on the next deploy. In **Settings → Pages**, wait for the
certificate to be issued (a few minutes to an hour), then tick
**Enforce HTTPS**.

---

## Part 3 — the day-to-day

### You released a track

**Double-click `RELEASE.bat`** and pick option 1. That's it. It reads your
public Spotify page, adds anything new to the playlist, bumps the cache token
so browsers pick the change up immediately, commits, and pushes. The site is
live about a minute later.

Or from a terminal:

```bash
python tools/arx.py publish
```

### You did nothing

The **Sync releases from Spotify** action runs every night at 09:15 UTC and
does the same thing on its own. A track released today is on the site by
tomorrow morning without you touching anything.

### Other things the tool does

| Command | What it does |
|---|---|
| `python tools/arx.py` | Interactive menu (same as `RELEASE.bat`) |
| `python tools/arx.py status` | Compare local playlist vs Spotify vs git |
| `python tools/arx.py sync` | Update `releases.json` but **don't** push |
| `python tools/arx.py refresh` | Force a cache-bust + republish, no content change |
| `python tools/arx.py add <url>` | Add one release from a Spotify link by hand |

### You edited the site by hand

Any change to `site/` — a link in `config.js`, some CSS, the aim trainer —
goes live the same way:

```bash
git add -A
git commit -m "what you changed"
git push
```

If the change doesn't show up in your browser, run
`python tools/arx.py refresh` — that bumps the `?v=` token and forces every
visitor to re-fetch the CSS and JS.

---

## What changed in the move off Netlify

| Was | Now |
|---|---|
| Drag-and-drop deploys, no history | `git push`, full history, one-click rollback |
| `site/_headers` set cache policy | **Not supported by GitHub Pages.** The `?v=` cache-bust token does this job instead. The file is kept only so the site stays portable to Cloudflare Pages. |
| `netlify.toml` | Deleted — replaced by `.github/workflows/deploy.yml` |
| Netlify function read Spotify live, per visitor | Deleted. It never worked (it needed API credentials that were never set), and it added a network round-trip to every page load. The catalog is now baked into `releases.json` at deploy time. |
| Needed a Spotify developer app + client secret | **Nothing.** The tool reads the public artist page. |
| Leaderboard on Netlify Blobs | Already on Supabase — unaffected |

### One caveat worth knowing

The sync tool reads Spotify's public artist page rather than their official
API, which is why it needs no credentials. Spotify could change that page's
markup at some point and break it. If that happens the tool **fails loudly and
changes nothing** — the site keeps serving the last good playlist, and you can
still add a release by hand with `arx.py add <spotify-url>`, or by editing
`site/data/releases.json` directly. Nothing about the site's uptime depends on
it.
