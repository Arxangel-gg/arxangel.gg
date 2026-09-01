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

## Part 2 — pointing arxangel.gg at it

Right now `arxangel.gg` serves the **old Carrd page**. Do this once you've seen
the site working at the preview URL above.

**Your DNS is at Namecheap**, not Cloudflare. (The domain resolves to a
Cloudflare IP, but that's *Carrd's* CDN sitting in front of their hosting, not
anything you control — so there are no proxy or SSL-mode settings to worry
about. This is simpler than it looks.)

Go to **Namecheap → Domain List → `arxangel.gg` → Manage → Advanced DNS**.

### 2a. Remove the old records — NOT optional

Adding the new records is only half of it. DNS **round-robins across every A
record on a host**, so any leftover address keeps taking a share of your
traffic. Delete exactly these two:

| Delete | Type | Host | Value | Why |
|---|---|---|---|---|
| ❌ | A Record | `@` | `172.66.0.70` | Carrd. Left in place, ~20% of visitors get the old page. |
| ❌ | CNAME Record | `www` | `arxangel.gg.` | Duplicate: a host may only ever have **one** CNAME, and this old one wins over the new one. |

**Leave everything else alone**, in particular:

| Keep | Type | Host | Why |
|---|---|---|---|
| ✅ | CNAME | `beastroad` | A different project on its own subdomain — unrelated. |
| ✅ | TXT | `_github-pages-…` | GitHub's domain verification. Protects you from domain takeover. |
| ✅ | TXT | `@` (`v=spf1 …`) | Email forwarding. Deleting it breaks mail. |

### 2b. Add GitHub's records

Four **A Records**, all with host `@`:

| Type | Host | Value |
|---|---|---|
| A Record | `@` | `185.199.108.153` |
| A Record | `@` | `185.199.109.153` |
| A Record | `@` | `185.199.110.153` |
| A Record | `@` | `185.199.111.153` |

One **CNAME Record**:

| Type | Host | Value |
|---|---|---|
| CNAME Record | `www` | `arxangel-gg.github.io.` |

Leave TTL on `Automatic`. Namecheap usually applies changes within half an
hour, sometimes a couple of minutes.

### 2c. Check it landed

```bash
python tools/arx.py dns
```

That tells you in plain English whether the records are live, what the domain is
actually serving, and whether the custom domain is switched on yet. Run it as
often as you like — it changes nothing.

### 2d. Switch the domain on

The domain is parked in `CNAME.pending` at the repo root, where it has no
effect. That's deliberate: it keeps the `github.io` preview working while DNS is
still pointed at Carrd. Once `arx.py dns` says the records are live:

```bash
git mv CNAME.pending site/CNAME
git commit -m "Point Pages at arxangel.gg"
git push
```

(Or say the word and I'll run it.)

Then back in **Settings → Pages**, wait for the certificate to be issued — a few
minutes, occasionally up to an hour — and tick **Enforce HTTPS**.

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
