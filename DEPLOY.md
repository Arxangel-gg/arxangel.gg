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

## Part 1 — one-time setup  ✅ DONE

Repo: <https://github.com/Arxangel-gg/arxangel.gg> (public)
Live preview: <https://arxangel-gg.github.io/arxangel.gg/>

This is already wired up — the remote is set, everything is pushed, and
`deploy.yml` uses `enablement: true` so GitHub Pages switched itself on without
anyone visiting Settings. Nothing here needs redoing.

> **A note on GitHub Desktop.** It had cloned the empty repo into a nested
> `arxangel.gg\` folder *inside* the project. That empty clone was removed and
> the real project folder now has the remote instead. If you want the project in
> Desktop, use **File → Add local repository →**
> `E:\Migrated\AppDev\Arxangel.gg`. You don't need Desktop for anything —
> `RELEASE.bat` does the committing and pushing for you.

---

## Part 2 — pointing arxangel.gg at it

Right now `arxangel.gg` still serves the **old Carrd page**. This step retires
it. Do it once you're happy with how the site looks at
<https://arxangel-gg.github.io/arxangel.gg/>.

**This is the only part that needs you.** It's four DNS records and two
settings — everything else is already done and running.

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

One `CNAME` for `www` → `arxangel-gg.github.io`

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

### 4d. Switch the domain on

The domain is parked in `CNAME.pending` at the repo root, where it has no
effect — that's deliberate, so the `github.io` preview URL keeps working while
you get DNS right. Once the records above are saved, activate it:

```bash
git mv CNAME.pending site/CNAME
git commit -m "Point Pages at arxangel.gg"
git push
```

(Or just say the word and I'll run it.)

Then in **Settings → Pages**, wait for the certificate to be issued (a few
minutes, occasionally up to an hour), and tick **Enforce HTTPS**.

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
