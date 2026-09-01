/* ============================================================================
   ARXANGEL — modules/releases.js  (THE MUSIC / playlist)
   ----------------------------------------------------------------------------
   Renders the playlist grid. Releases come from, in priority order:
     1. CONFIG.music.releasesEndpoint — the optional Netlify function that reads
        your whole Spotify catalog (new drops appear with ZERO edits).
     2. CONFIG.data.releasesUrl (data/releases.json) — the no-backend fallback.
   Tapping any cover opens a CENTERED MODAL player (always in view, no scrolling
   needed) with that track's Spotify embed. SUMMONED is pinned first; the most
   recent release gets a "Latest" tag.
   ========================================================================== */

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function init(CONFIG) {
  const grid = document.querySelector("[data-music-grid]");
  if (!grid) return;
  const empty = document.querySelector("[data-music-empty]");

  let releases = (await load(CONFIG)).map(normalize).filter((r) => r.spotifyId && r.title);
  if (!releases.length) { if (empty) empty.hidden = false; return; }

  const featured = (CONFIG.music?.featuredTitle || "").toLowerCase();
  releases.sort((a, b) => {
    const af = a.title.toLowerCase() === featured ? 1 : 0;
    const bf = b.title.toLowerCase() === featured ? 1 : 0;
    if (af !== bf) return bf - af;
    return (b.date || "").localeCompare(a.date || "");
  });
  let latest = -1, latestDate = "";
  releases.forEach((r, i) => { if ((r.date || "") > latestDate) { latestDate = r.date || ""; latest = i; } });

  grid.innerHTML = releases.map((r, i) => card(r, i === latest, i)).join("");
  if (empty) empty.hidden = true;

  // Surface the newest transmission in the hero as an announce pill.
  const announce = document.querySelector("[data-hero-announce]");
  if (announce && latest >= 0) {
    const r = releases[latest];
    announce.innerHTML =
      `<a class="announce" href="#music">` +
      `<span class="announce__dot" aria-hidden="true"></span>` +
      `<span class="announce__tag">New</span> ${esc(r.title)} — out now` +
      `</a>`;
    announce.hidden = false;
  }

  const modal = buildModal();

  grid.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-play]");
    if (!trigger) return;
    const title = trigger.closest(".track")?.querySelector(".track__title")?.textContent || "";
    modal.open(trigger.dataset.play, title, trigger);
  });
}

/* ---- data loading ------------------------------------------------------- */
async function load(CONFIG) {
  const ep = CONFIG.music?.releasesEndpoint;
  if (ep) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch(ep, { cache: "no-cache", signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) return j; }
    } catch { /* not deployed / no creds / timeout — fall through */ }
  }
  try {
    const r = await fetch(CONFIG.data.releasesUrl, { cache: "no-cache" });
    const j = await r.json();
    return Array.isArray(j) ? j : j.releases || [];
  } catch { return []; }
}

function normalize(r) {
  const spotifyType = r.spotifyType || "track";
  const spotifyId = r.spotifyId || r.spotifyTrack || "";
  return {
    title: r.title || "",
    type: r.type || "Single",
    year: r.year || (r.releaseDate || "").slice(0, 4) || "",
    cover: r.cover || "assets/img/key-art.jpg",
    spotifyType,
    spotifyId,
    url: r.url || r.links?.spotify || (spotifyId ? `https://open.spotify.com/${spotifyType}/${spotifyId}` : ""),
    date: r.releaseDate || r.year || "",
  };
}

function card(r, isLatest, i) {
  const meta = [r.type, r.year].filter(Boolean).join(" · ");
  return `<article class="track" style="--i:${i}">
      <button class="track__art" type="button" data-play="${esc(r.spotifyType)}/${esc(r.spotifyId)}" aria-label="Play ${esc(r.title)}">
        <img src="${esc(r.cover)}" alt="${esc(r.title)} cover" loading="lazy" decoding="async" width="640" height="640"
             onerror="this.onerror=null;this.src='assets/img/key-art.jpg'">
        ${isLatest ? `<span class="track__tag">Latest</span>` : ""}
        <span class="track__play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5.5v13l11-6.5z"/></svg>
        </span>
      </button>
      <div class="track__info">
        <h3 class="track__title">${esc(r.title)}</h3>
        <p class="track__meta">${esc(meta)}</p>
        <a class="track__open" href="${esc(r.url)}" target="_blank" rel="noopener">Open in Spotify <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
}

/* ---- Centered modal player --------------------------------------------- */
function buildModal() {
  const el = document.createElement("div");
  el.className = "player-modal";
  el.hidden = true;
  el.innerHTML = `
    <div class="player-modal__backdrop" data-close></div>
    <div class="player-modal__panel" role="dialog" aria-modal="true" aria-label="Now playing">
      <div class="player-modal__head">
        <span class="player-modal__title"></span>
        <button class="player-modal__close" type="button" data-close aria-label="Close player">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="player-modal__embed"></div>
    </div>`;
  document.body.appendChild(el);

  const titleEl = el.querySelector(".player-modal__title");
  const embed = el.querySelector(".player-modal__embed");
  const closeBtn = el.querySelector(".player-modal__close");
  let lastTrigger = null;
  let prevOverflow = "";

  const close = () => {
    el.classList.remove("is-open");
    embed.innerHTML = "";              // stop playback
    document.body.style.overflow = prevOverflow;
    setTimeout(() => { el.hidden = true; }, 300);
    lastTrigger?.focus?.();
  };

  const open = (path, title, trigger) => {
    lastTrigger = trigger || null;
    titleEl.textContent = title || "";
    const f = document.createElement("iframe");
    f.src = `https://open.spotify.com/embed/${path}?utm_source=generator`;
    f.loading = "lazy";
    f.setAttribute("frameborder", "0");
    f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    f.title = title ? `${title} — Spotify player` : "Spotify player";
    embed.innerHTML = "";
    embed.appendChild(f);
    el.hidden = false;
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => { el.classList.add("is-open"); closeBtn.focus(); });
  };

  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.classList.contains("is-open")) close(); });

  return { open, close };
}
