#!/usr/bin/env python3
# ============================================================================
#  ARXANGEL - RELEASE CONSOLE  (tools/arx.py)
# ----------------------------------------------------------------------------
#  The one tool you run when you've dropped a new track and the site needs to
#  catch up. It reads your PUBLIC Spotify artist page - no developer account,
#  no client secret, no environment variables - rebuilds data/releases.json,
#  bumps the cache-bust token, and pushes. GitHub Pages redeploys in ~1 minute.
#
#  USAGE
#    Double-click  RELEASE.bat             -> interactive menu (easiest)
#    python tools/arx.py                   -> same menu
#    python tools/arx.py publish           -> sync + push, no questions asked
#    python tools/arx.py sync              -> update releases.json only (no push)
#    python tools/arx.py add <spotify-url> -> add one release by hand
#    python tools/arx.py refresh           -> force a cache-bust + push
#    python tools/arx.py status            -> what's local vs what's live
#    python tools/arx.py dns               -> has arxangel.gg switched over yet?
#
#  Python 3.8+. Standard library only.
# ============================================================================

import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date

# --- paths ------------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
RELEASES_JSON = os.path.join(SITE, "data", "releases.json")
CONFIG_JS = os.path.join(SITE, "js", "config.js")

# Files carrying the ?v=<n> cache-bust token (see site/README section 10).
CACHE_BUST_FILES = [
    os.path.join(SITE, "index.html"),
    os.path.join(SITE, "js", "main.js"),
    os.path.join(SITE, "js", "modules", "ambient.js"),
]

# IMPORTANT: keep this a plain, honest, non-browser User-Agent.
# open.spotify.com server-renders the catalog into the HTML for crawlers, but
# serves an empty JavaScript shell to anything that looks like a real browser.
# Swapping this for a "realistic" Chrome UA silently breaks the whole sync.
UA = "ARXANGEL-release-sync/1.0 (+https://arxangel.gg)"

# --- pretty printing --------------------------------------------------------
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

if os.name == "nt":
    os.system("")  # enable ANSI escapes on Windows terminals

GOLD = "\033[38;5;179m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
BOLD = "\033[1m"
OFF = "\033[0m"


def say(msg=""):
    print(msg)


def ok(msg):
    say("  " + GREEN + "OK" + OFF + "  " + msg)


def warn(msg):
    say("  " + RED + "!!" + OFF + "  " + msg)


def step(msg):
    say("\n" + GOLD + ">>" + OFF + " " + BOLD + msg + OFF)


# ============================================================================
#  Spotify - public catalog reader (NO credentials)
# ----------------------------------------------------------------------------
#  open.spotify.com server-renders a <script id="initialState"> blob on artist
#  and album pages. It is plain JSON on some routes and base64 on others, so we
#  try both. This is the same public data the web player shows a logged-out
#  visitor; we are not authenticating and not touching user data.
# ============================================================================

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def initial_state(url):
    html = fetch(url)
    m = re.search(r'id="initialState"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        raise RuntimeError("Spotify page layout changed - no initialState found")
    raw = m.group(1).strip()
    try:
        return json.loads(base64.b64decode(raw))
    except Exception:
        return json.loads(raw)


def artist_releases(artist_id):
    """Every single/album/EP on the artist page, newest first."""
    d = initial_state("https://open.spotify.com/artist/" + artist_id)
    disc = d["entities"]["items"]["spotify:artist:" + artist_id]["discography"]
    out = []
    seen = set()
    # `singles` and `albums` are already ordered newest-first by Spotify.
    for group in ("singles", "albums", "compilations"):
        for item in (disc.get(group) or {}).get("items", []):
            # Some groups nest the real record under releases.items[0].
            rec = item
            if isinstance(item, dict) and "releases" in item:
                rec = (item["releases"].get("items") or [item])[0]
            uri = rec.get("uri", "")
            if not uri.startswith("spotify:album:"):
                continue
            aid = uri.split(":")[-1]
            if aid in seen:
                continue
            seen.add(aid)
            out.append({
                "album_id": aid,
                "name": rec.get("name", ""),
                "type": rec.get("type") or "SINGLE",
            })
    return out


def album_detail(album_id):
    """Exact release date, primary track id, and 640px cover for one release."""
    d = initial_state("https://open.spotify.com/album/" + album_id)
    al = d["entities"]["items"]["spotify:album:" + album_id]

    dt = al.get("date") or {}
    y, mo, dy = dt.get("year"), dt.get("month"), dt.get("day")
    if y and mo and dy:
        iso = "%04d-%02d-%02d" % (y, mo, dy)
    elif y and mo:
        iso = "%04d-%02d-01" % (y, mo)
    elif y:
        iso = "%04d-01-01" % y
    else:
        iso = ""

    track_id = ""
    tracks = (al.get("tracksV2") or al.get("tracks") or {}).get("items", [])
    for t in tracks:
        tt = t.get("track") or t
        uri = tt.get("uri", "")
        if uri.startswith("spotify:track:"):
            track_id = uri.split(":")[-1]
            break

    cover = ""
    sources = (al.get("coverArt") or {}).get("sources", [])
    for want in (640, 300, 64):
        hit = [s for s in sources if s.get("width") == want]
        if hit:
            cover = hit[0]["url"]
            break
    # Always prefer the 640px variant - the grid renders covers at 640.
    cover = re.sub(r"/ab67616d0000(1e02|4851)", "/ab67616d0000b273", cover)

    return {
        "name": al.get("name", ""),
        "type": al.get("type") or "SINGLE",
        "releaseDate": iso,
        "cover": cover,
        "track_id": track_id,
        "is_prerelease": bool(al.get("isPreRelease")),
    }


def oembed(url):
    """Credential-free metadata for one track/album URL (manual `add` path)."""
    j = json.loads(fetch("https://open.spotify.com/oembed?url=" + url))
    thumb = re.sub(r"/ab67616d0000(1e02|4851)", "/ab67616d0000b273",
                   j.get("thumbnail_url", ""))
    thumb = thumb.replace("image-cdn-fa.spotifycdn.com", "i.scdn.co")
    return {"title": j.get("title", ""), "cover": thumb}


# ============================================================================
#  releases.json
# ============================================================================

def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or "release"


def read_releases():
    with open(RELEASES_JSON, encoding="utf-8") as f:
        doc = json.load(f)
    return doc, doc.get("releases", [])


def write_releases(doc, releases):
    doc["releases"] = releases
    with open(RELEASES_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")


def artist_id_from_config():
    try:
        with open(CONFIG_JS, encoding="utf-8") as f:
            m = re.search(r'artistId:\s*"([A-Za-z0-9]+)"', f.read())
        if m:
            return m.group(1)
    except OSError:
        pass
    return "0aT62hqUqTkgTmeYfgUy4n"


def build_entry(det, album_id, existing=None):
    """Compose one releases.json entry, preserving hand-tuned fields."""
    existing = existing or {}
    spotify_id = det["track_id"] or album_id
    spotify_type = "track" if det["track_id"] else "album"

    entry = {
        "id": existing.get("id") or slugify(det["name"]),
        # Keep your stylised title (e.g. SUMMONED) over Spotify's "Summoned".
        "title": existing.get("title") or det["name"],
        "type": existing.get("type") or det["type"].capitalize(),
        "year": det["releaseDate"][:4],
        "releaseDate": det["releaseDate"],
        "cover": det["cover"] or existing.get("cover", ""),
        "spotifyType": spotify_type,
    }
    entry["spotifyTrack" if spotify_type == "track" else "spotifyId"] = spotify_id
    if existing.get("featured"):
        entry["featured"] = True

    links = dict(existing.get("links") or {})
    links["spotify"] = "https://open.spotify.com/%s/%s" % (spotify_type, spotify_id)
    entry["links"] = links
    return entry


def sync(verbose=True):
    """Rebuild releases.json from the live Spotify catalog.

    Returns (added_titles, total) or (None, None) if nothing was written.
    """
    artist = artist_id_from_config()
    step("Reading Spotify catalog  " + DIM + "(artist " + artist + ")" + OFF)

    try:
        catalog = artist_releases(artist)
    except (urllib.error.URLError, RuntimeError, KeyError, ValueError) as e:
        warn("Could not read the Spotify catalog: %s" % e)
        warn("releases.json left untouched. Try again, or use: "
             "python tools/arx.py add <spotify-url>")
        return None, None

    if not catalog:
        warn("Spotify returned an empty catalog - leaving releases.json untouched.")
        return None, None

    doc, old = read_releases()
    by_title = {(r.get("title") or "").strip().lower(): r for r in old}
    old_titles = set(by_title)

    entries = []
    for rec in catalog:
        try:
            det = album_detail(rec["album_id"])
        except Exception as e:
            warn("Skipped '%s' (%s)" % (rec["name"], e))
            continue
        if det["is_prerelease"]:
            say("  " + DIM + ".. " + det["name"] +
                " is a pre-save/pre-release - skipping until it drops" + OFF)
            continue
        prev = by_title.get(det["name"].strip().lower())
        entries.append(build_entry(det, rec["album_id"], prev))
        if verbose:
            is_new = det["name"].strip().lower() not in old_titles
            tag = (GREEN + "NEW" + OFF) if is_new else (DIM + "   " + OFF)
            say("  %s %s  %s" % (tag, det["releaseDate"], det["name"]))

    if not entries:
        warn("Nothing usable came back - leaving releases.json untouched.")
        return None, None

    entries.sort(key=lambda r: r.get("releaseDate", ""), reverse=True)
    new_titles = set((r.get("title") or "").strip().lower() for r in entries)
    added = sorted(new_titles - old_titles)

    write_releases(doc, entries)
    return added, len(entries)


def add_by_url(url):
    """Manual escape hatch: add one release from a Spotify link."""
    m = re.search(r"open\.spotify\.com/(track|album)/([A-Za-z0-9]+)", url)
    if not m:
        warn("That doesn't look like a Spotify track or album link.")
        return False
    kind, sid = m.group(1), m.group(2)

    step("Looking up %s %s" % (kind, sid))
    det = None
    if kind == "album":
        try:
            det = album_detail(sid)
        except Exception:
            det = None
    if det is None:
        meta = oembed("https://open.spotify.com/%s/%s" % (kind, sid))
        if not meta["title"]:
            warn("Spotify returned no metadata for that link.")
            return False
        when = input("  Release date for '%s' [YYYY-MM-DD, blank = today]: "
                     % meta["title"]).strip()
        det = {
            "name": meta["title"],
            "type": "SINGLE",
            "cover": meta["cover"],
            "track_id": sid if kind == "track" else "",
            "is_prerelease": False,
            "releaseDate": when or date.today().isoformat(),
        }

    doc, releases = read_releases()
    key = det["name"].strip().lower()
    prev = next((r for r in releases
                 if (r.get("title") or "").strip().lower() == key), None)
    entry = build_entry(det, sid, prev)
    releases = [r for r in releases
                if (r.get("title") or "").strip().lower() != key]
    releases.append(entry)
    releases.sort(key=lambda r: r.get("releaseDate", ""), reverse=True)
    write_releases(doc, releases)
    ok("%s: %s  (%s)" % ("Updated" if prev else "Added",
                         entry["title"], entry["releaseDate"]))
    return True


# ============================================================================
#  Cache-bust + git
# ============================================================================

def bump_cache_token():
    """Bump ?v=N everywhere so browsers re-fetch CSS/JS immediately.

    GitHub Pages serves assets with a 10-minute cache and gives us no way to
    set headers, so this token is what makes an update show up right away.
    """
    current = 0
    for path in CACHE_BUST_FILES:
        try:
            with open(path, encoding="utf-8") as f:
                for n in re.findall(r"\?v=(\d+)", f.read()):
                    current = max(current, int(n))
        except OSError:
            pass

    nxt = current + 1
    touched = 0
    for path in CACHE_BUST_FILES:
        try:
            with open(path, encoding="utf-8") as f:
                src = f.read()
        except OSError:
            continue
        new = re.sub(r"\?v=\d+", "?v=%d" % nxt, src)
        if new != src:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(new)
            touched += 1
    return current, nxt, touched


def git(*args, **kw):
    check = kw.pop("check", True)
    return subprocess.run(["git", "-C", ROOT] + list(args),
                          capture_output=True, text=True, check=check)


def git_ready():
    try:
        git("rev-parse", "--git-dir")
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False, "This folder isn't a git repo yet."
    if not git("remote", check=False).stdout.strip():
        return False, "No GitHub remote yet - see DEPLOY.md step 2."
    return True, ""


def publish(message):
    step("Publishing to GitHub Pages")
    fine, why = git_ready()
    if not fine:
        warn(why)
        return False

    if not git("status", "--porcelain").stdout.strip():
        say("  " + DIM + "Nothing changed - the site already matches Spotify." + OFF)
        return True

    git("add", "-A")
    try:
        git("commit", "-m", message)
    except subprocess.CalledProcessError as e:
        warn("Commit failed:\n" + (e.stdout or "") + (e.stderr or ""))
        return False

    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    try:
        git("push", "origin", branch)
    except subprocess.CalledProcessError as e:
        warn("Push failed:\n" + (e.stdout or "") + (e.stderr or ""))
        warn("If this is the first push, run:  git push -u origin " + branch)
        return False

    ok("Pushed. GitHub Pages rebuilds in about a minute.")
    say("  " + DIM + "Watch it: your repo -> Actions tab" + OFF)
    return True


# ============================================================================
#  Commands
# ============================================================================

SIGNOFF = "\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>"


def cmd_sync(push):
    added, total = sync()
    if total is None:
        return 1

    say()
    if added:
        ok("%d new release(s) added: %s" % (len(added), ", ".join(added)))
    else:
        ok("Already up to date - %d releases on file." % total)

    if not push:
        say("\n  " + DIM + "Nothing pushed. Run 'publish' when you're ready." + OFF)
        return 0

    if added:
        bump_cache_token()
    msg = ("Add release: " + ", ".join(added)) if added else "Refresh site content"
    return 0 if publish(msg + SIGNOFF) else 1


def cmd_refresh():
    step("Forcing a cache refresh")
    old, new, touched = bump_cache_token()
    ok("Cache token ?v=%d -> ?v=%d  (%d file(s))" % (old, new, touched))
    return 0 if publish("Force cache refresh (v%d)" % new + SIGNOFF) else 1


def cmd_status():
    step("Local")
    try:
        _, releases = read_releases()
        for r in releases:
            say("  %-12s %s" % (r.get("releaseDate", "?"), r.get("title", "?")))
        say("  " + DIM + "%d releases in site/data/releases.json" % len(releases) + OFF)
    except OSError as e:
        warn(str(e))

    step("Spotify")
    try:
        cat = artist_releases(artist_id_from_config())
        say("  %d releases live: %s" % (len(cat), ", ".join(c["name"] for c in cat)))
    except Exception as e:
        warn("Couldn't reach Spotify: %s" % e)

    step("Git")
    fine, why = git_ready()
    if not fine:
        warn(why)
    else:
        dirty = git("status", "--porcelain").stdout.strip()
        say("  Remote: " + git("remote", "get-url", "origin").stdout.strip())
        say("  " + ("Uncommitted changes waiting to publish."
                    if dirty else "Clean - everything is pushed."))
    return 0


# GitHub Pages' four apex A records. If arxangel.gg resolves to these, DNS is
# pointed at GitHub; anything else means the cutover hasn't landed (or hasn't
# propagated yet).
GITHUB_PAGES_IPS = {
    "185.199.108.153", "185.199.109.153",
    "185.199.110.153", "185.199.111.153",
}


def _resolve_doh(name):
    """Resolve via DNS-over-HTTPS so we bypass the OS/ISP cache.

    getaddrinfo() reports whatever the local resolver has cached, which during
    a cutover is routinely minutes-to-hours stale and makes it look like the
    change didn't work. Google's public DoH endpoint answers from upstream.
    """
    url = "https://dns.google/resolve?name=%s&type=A" % name
    j = json.loads(fetch(url, timeout=15))
    return sorted(a["data"] for a in j.get("Answer", []) if a.get("type") == 1)


def _probe(url):
    """GET a URL, returning the body even for 4xx (which urlopen raises on)."""
    try:
        return fetch(url, timeout=15), None
    except urllib.error.HTTPError as e:
        try:
            return e.read().decode("utf-8", "replace"), None
        except Exception:
            return None, e
    except Exception as e:
        return None, e


def cmd_dns():
    """Tell you, plainly, whether the arxangel.gg cutover has happened."""
    step("Checking arxangel.gg  " + DIM + "(via DNS-over-HTTPS, cache-free)" + OFF)
    try:
        ips = _resolve_doh("arxangel.gg")
    except Exception as e:
        warn("Could not resolve arxangel.gg: %s" % e)
        return 1
    if not ips:
        warn("No A records found at all.")
        return 1

    say("  Resolves to: " + ", ".join(ips))
    on_github = bool(set(ips) & GITHUB_PAGES_IPS)
    missing = GITHUB_PAGES_IPS - set(ips)
    # Anything that ISN'T GitHub is a leftover record still in the rotation.
    # DNS round-robins across every A record, so even one stray address sends a
    # share of visitors to the old host.
    strays = [ip for ip in ips if ip not in GITHUB_PAGES_IPS]

    if missing:
        warn("Missing GitHub A record(s): " + ", ".join(sorted(missing)))
    elif on_github:
        ok("All four GitHub A records are live.")

    if strays:
        warn("LEFTOVER record(s) still in rotation: " + ", ".join(strays))
        say("  " + RED + "  ~%d%% of visitors will land on the OLD site."
            % (len(strays) * 100 // len(ips)) + OFF)
        say("  " + DIM + "Delete these A records at Namecheap, then re-run." + OFF)
    elif not on_github:
        warn("Not pointing at GitHub Pages at all.")
        say("  " + DIM + "Add the four A records - see DEPLOY.md part 2." + OFF)

    step("Checking what the domain actually serves")
    # http first: until GitHub issues the certificate, https fails outright and
    # would mask what is really going on.
    served, err = _probe("http://arxangel.gg")
    if served is None:
        warn("Couldn't reach arxangel.gg : %s" % err)
    elif "Site not found" in served and "GitHub Pages" in served:
        # DNS is right, but Pages has no idea which repo owns this hostname.
        warn('GitHub says "Site not found".')
        say("  DNS reaches GitHub, but the custom domain isn't registered.")
        say("  " + BOLD + "Fix: repo Settings -> Pages -> Custom domain ->"
            " enter arxangel.gg -> Save." + OFF)
        say("  " + DIM + "A CNAME file alone does NOT do this when Pages is"
            " built by GitHub Actions." + OFF)
    elif "carrd" in served.lower() or "light only" in served:
        warn("Still serving the OLD CARRD page.")
    elif "data-music-grid" in served or "Transmissions" in served:
        ok("Serving the flagship site.")
    else:
        say("  " + DIM + "Served something unrecognised (%d bytes)." % len(served) + OFF)

    step("HTTPS certificate")
    body, err = _probe("https://arxangel.gg")
    if body is not None:
        ok("HTTPS works - certificate is issued and valid.")
    else:
        warn("HTTPS not ready: %s" % err)
        say("  " + DIM + "Normal for a few minutes after the domain is"
            " registered; GitHub requests the cert automatically." + OFF)

    step("CNAME file")
    live = os.path.join(SITE, "CNAME")
    pending = os.path.join(ROOT, "CNAME.pending")
    if os.path.exists(live):
        ok("site/CNAME ships with the build (keeps the domain set across deploys).")
    elif os.path.exists(pending):
        say("  " + DIM + "Parked at CNAME.pending - preview URL still works." + OFF)
    else:
        warn("No CNAME file anywhere.")
    return 0


MENU = """
{gold}  ARXANGEL - RELEASE CONSOLE{off}
{dim}  ---------------------------------------------------{off}
  1)  New song is out  {dim}- sync from Spotify and publish{off}
  2)  Preview only     {dim}- update releases.json, don't push{off}
  3)  Force refresh    {dim}- bust caches and republish{off}
  4)  Add by link      {dim}- paste a Spotify URL{off}
  5)  Status           {dim}- local vs Spotify vs git{off}
  6)  Domain check     {dim}- has arxangel.gg switched over yet?{off}
  0)  Exit
"""


def menu():
    say(MENU.format(gold=GOLD, dim=DIM, off=OFF))
    choice = input("  Choose: ").strip()
    if choice == "1":
        return cmd_sync(push=True)
    if choice == "2":
        return cmd_sync(push=False)
    if choice == "3":
        return cmd_refresh()
    if choice == "4":
        url = input("  Spotify link: ").strip()
        if add_by_url(url):
            if input("  Publish now? [Y/n]: ").strip().lower() in ("", "y", "yes"):
                bump_cache_token()
                return 0 if publish("Add release (manual)" + SIGNOFF) else 1
        return 0
    if choice == "5":
        return cmd_status()
    if choice == "6":
        return cmd_dns()
    return 0


USAGE = """  Commands:
    publish   sync from Spotify, bump caches, commit and push
    sync      update releases.json only (no push)
    refresh   force a cache-bust and republish
    add URL   add one release from a Spotify link
    status    compare local / Spotify / git
    dns       check whether arxangel.gg has switched over to GitHub Pages
"""


def main(argv):
    cmd = (argv[0] if argv else "").lower()
    try:
        if cmd in ("", "menu"):
            rc = menu()
            if os.name == "nt" and not os.environ.get("ARX_NO_PAUSE"):
                input("\n  Press Enter to close...")
            return rc
        if cmd == "publish":
            return cmd_sync(push=True)
        if cmd == "sync":
            return cmd_sync(push=False)
        if cmd == "refresh":
            return cmd_refresh()
        if cmd == "status":
            return cmd_status()
        if cmd == "dns":
            return cmd_dns()
        if cmd == "add":
            if len(argv) < 2:
                warn("Usage: python tools/arx.py add <spotify-url>")
                return 2
            return 0 if add_by_url(argv[1]) else 1
        warn("Unknown command: " + cmd)
        say(USAGE)
        return 2
    except KeyboardInterrupt:
        say("\n  Cancelled.")
        return 130


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
