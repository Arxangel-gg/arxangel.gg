/* ============================================================================
   ARXANGEL — main.js  (application entry, ES module)
   ----------------------------------------------------------------------------
   Responsibilities:
     • Apply embed mode early
     • Wire all CONFIG links into the markup (and hide empty ones)
     • Navigation: scrolled state, mobile drawer, offset smooth-scroll, active link
     • Scroll progress bar
     • Hero video gating (reduced-motion / data-saver / off-screen)
     • Live (Twitch) lazy facade
     • Share button + footer year
     • Carrd auto-height bridge (postMessage)
     • Lazy-load ONLY the feature modules enabled in CONFIG
   ========================================================================== */

// ?v= cache-bust token (also on the css links + js/main.js in index.html).
// Freshness is already guaranteed by netlify _headers (must-revalidate); bumping
// this is just an optional hard override to force every client to refetch.
import { CONFIG } from "./config.js?v=4";
import { env, $, $$, onReady } from "./env.js?v=4";

/* ---- Embed mode --------------------------------------------------------- */
if (env.isEmbed) document.documentElement.classList.add("is-embed");

/* ---- Wire CONFIG links into the DOM ------------------------------------- */
function wireLinks() {
  // Platform links: [data-link="twitch"] → CONFIG.links.twitch (blank → hidden).
  $$("[data-link]").forEach((el) => {
    const url = CONFIG.links[el.dataset.link];
    if (url) {
      el.href = url;
    } else if (el.hasAttribute("data-hide-if-empty")) {
      (el.closest("li") || el).remove(); // drop the whole <li> in lists
    }
  });
}

/* ---- Navigation --------------------------------------------------------- */
function initNav() {
  const nav = $("#nav");
  const toggle = $(".nav__toggle");
  const drawer = $("#nav-mobile");
  const navH = nav ? nav.querySelector(".nav__inner").offsetHeight : 72;

  // Glass background once scrolled past the hero fold
  const onScroll = () => nav?.classList.toggle("is-scrolled", window.scrollY > 40);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  // Mobile drawer
  if (toggle && drawer) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      drawer.hidden = !open;
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    drawer.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  }

  // Offset-aware smooth scrolling for in-page links + [data-scroll-to] buttons
  const scrollToTarget = (sel) => {
    const target = document.querySelector(sel);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - navH + 1;
    window.scrollTo({ top, behavior: env.reduceMotion ? "auto" : "smooth" });
  };
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest('a[href^="#"], [data-scroll-to]');
    if (!trigger) return;
    const sel = trigger.dataset.scrollTo || trigger.getAttribute("href");
    if (!sel || sel === "#") return;
    const target = document.querySelector(sel);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(sel);
    history.replaceState(null, "", sel);
  });

  // Active link highlight via IntersectionObserver
  const linkMap = new Map();
  $$(".nav__links a").forEach((a) => linkMap.set(a.getAttribute("href"), a));
  const sections = $$("main section[id]");
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        linkMap.forEach((a) => a.classList.remove("is-active"));
        linkMap.get("#" + en.target.id)?.classList.add("is-active");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => io.observe(s));
  }
}

/* ---- Scroll progress bar ------------------------------------------------ */
function initScrollProgress() {
  if (!CONFIG.features.scrollProgress) { $(".scroll-progress")?.remove(); return; }
  const bar = $(".scroll-progress__bar");
  if (!bar) return;
  let ticking = false;
  const update = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`;
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---- Hero video gating -------------------------------------------------- */
function initHeroVideo() {
  const video = $("#hero-video");
  if (!video) return;
  // Respect data-saver and reduced-motion: keep the poster, skip playback.
  if (env.reduceMotion || env.saveData) {
    video.removeAttribute("autoplay");
    video.pause();
    return;
  }
  // Save battery/CPU: pause when the hero scrolls out of view.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.05 });
    io.observe(video);
  }
}

/* ---- Live (Twitch) lazy facade ------------------------------------------ */
function initLive() {
  const section = $("[data-live]");
  if (!section) return;
  if (!CONFIG.features.liveEmbed || !CONFIG.embeds.twitchChannel) { section.remove(); return; }
  section.hidden = false;

  const facade = $("[data-live-play]", section);
  facade?.addEventListener("click", () => {
    // Twitch refuses to frame the player unless EVERY ancestor domain is listed
    // as a &parent=. We collect: the configured list + the current host + every
    // ancestor origin (so it works when the whole site is itself embedded in
    // Carrd) + the referrer host, as a belt-and-suspenders fallback.
    const hosts = new Set(CONFIG.embeds.twitchParents || []);
    hosts.add(location.hostname);
    try { for (const o of location.ancestorOrigins || []) hosts.add(new URL(o).hostname); } catch {}
    try { if (document.referrer) hosts.add(new URL(document.referrer).hostname); } catch {}
    const parents = [...hosts].filter(Boolean).map((p) => `&parent=${encodeURIComponent(p)}`).join("");

    const iframe = document.createElement("iframe");
    iframe.src = `https://player.twitch.tv/?channel=${encodeURIComponent(CONFIG.embeds.twitchChannel)}${parents}&muted=false&autoplay=true`;
    iframe.title = "ARXANGEL live on Twitch";
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    facade.replaceWith(iframe);
  }, { once: true });
}

/* ---- Carrd auto-height bridge ------------------------------------------- */
/* When embedded, tell the parent how tall we are so the iframe can resize.
   The Carrd parent script listens for { type:"AX_CONSOLE_RESIZE", height }. */
function initEmbedBridge() {
  if (!env.isEmbed) return;
  const post = () => {
    const height = Math.ceil(document.body.scrollHeight);
    parent.postMessage({ type: "AX_CONSOLE_RESIZE", height }, "*");
  };
  if ("ResizeObserver" in window) new ResizeObserver(post).observe(document.body);
  addEventListener("load", post);
  addEventListener("resize", post, { passive: true });
  // Re-send if the parent announces itself late.
  addEventListener("message", (e) => { if (e.data?.type === "AX_REQUEST_CONTEXT") post(); });
  setTimeout(post, 400);
}

/* ---- Lazy-load the enabled feature modules ------------------------------ */
function loadFeatures() {
  const f = CONFIG.features;

  // Reveal animations (core); skip entirely for reduced-motion (CSS shows content).
  if (!env.reduceMotion) import("./modules/reveal.js?v=4").then((m) => m.init());

  // Releases: the auto-populating playlist + modal player.
  import("./modules/releases.js?v=4").then((m) => m.init(CONFIG)).catch(() => {});

  // Feature flags: show/hide the Bets section etc. (remote + per-device).
  import("./modules/flags.js?v=4").then((m) => m.init(CONFIG)).catch(() => {});

  // Share transmission (native sheet → popover fallback).
  import("./modules/share.js?v=4").then((m) => m.init(CONFIG)).catch(() => {});

  // Audio: the ambient visit sound + optional sound pill.
  import("./modules/audio.js?v=4").then((m) => m.init(CONFIG, env)).catch(() => {});

  if (f.intro && !env.isEmbed) import("./modules/intro.js?v=4").then((m) => m.init()).catch(() => {});
  if (f.ambientFX && !env.reduceMotion && !env.saveData && !env.isEmbed) import("./modules/ambient.js?v=4").then((m) => m.init(env)).catch(() => {});
  if (f.crosshair && env.finePointer && !env.isEmbed) import("./modules/cursor.js?v=4").then((m) => m.init()).catch(() => {});
  if (f.quotes && !env.isEmbed) import("./modules/quotes.js?v=4").then((m) => m.init(CONFIG)).catch(() => {});
}

/* ---- Boot --------------------------------------------------------------- */
onReady(() => {
  $("[data-year]") && ($("[data-year]").textContent = new Date().getFullYear());
  wireLinks();
  initNav();
  initScrollProgress();
  initHeroVideo();
  initLive();
  initEmbedBridge();
  loadFeatures();
});
