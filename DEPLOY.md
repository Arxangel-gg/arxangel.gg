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

## Part 1 — setup

Repo: <https://github.com/Arxangel-gg/arxangel.gg> (public)
Preview URL (once step 1 is done): <https://arxangel-gg.github.io/arxangel.gg/>

Everything is pushed and the workflows are in place. **One switch is left**, and
it can only be flipped by a human — GitHub deliberately won't let a workflow
token create a Pages site that has never existed:

### ⬅ The one thing you have to do

Open <https://github.com/Arxangel-gg/arxangel.gg/settings/pages>

Under **Build and deployment → Source**, change `Deploy from a branch` to
**GitHub Actions**. Don't pick a branch, don't save anything else — that
dropdown is the whole task.

Then tell me and I'll kick the deploy off, or hit **Re-run all jobs** on
<https://github.com/Arxangel-gg/arxangel.gg/actions> yourself.

> **A note on GitHub Desktop.** It had cloned the empty repo into a nested
> `arxangel.gg\` folder *inside* the project. That empty clone was removed and
> the real project folder now has the remote. If you want the project in
> Desktop: **File → Add local repository → `E:\Migrated\AppDev\Arxangel.gg`**.
> You don't need Desktop for anything — `RELEASE.bat` commits and pushes for you.

---

## Part 2 — the domain  ✅ DONE

`https://arxangel.gg` serves the site. Carrd is retired.

- Namecheap: four GitHub A records on `@`, `www` CNAME to `arxangel-gg.github.io`
- GitHub Settings -> Pages -> Custom domain: `arxangel.gg` (DNS check passed)
- Certificate: Let's Encrypt, `CN=arxangel.gg`, auto-renewing
- `www.arxangel.gg` 301-redirects to the apex

**`site/CNAME` must stay in the repo.** It preserves the custom domain across
deploys. Deleting it can silently un-set the domain on a future build.

> **Gotcha worth remembering.** The `CNAME` file alone does *not* register a
> custom domain when Pages is built by **GitHub Actions** — that only works for
> the older branch-based Pages. The domain has to be entered in
> Settings -> Pages once. Until it is, the domain returns
> "Site not found · GitHub Pages" even though DNS is perfect.

Re-check any time:

```bash
python tools/arx.py dns
```

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
