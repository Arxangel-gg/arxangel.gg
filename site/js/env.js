/* ============================================================================
   ARXANGEL — env.js
   Shared environment flags + tiny helpers. Imported by main.js and modules.
   No DOM mutation here — just facts about the runtime + utilities.
   ========================================================================== */

const mq = (q) => window.matchMedia(q).matches;

export const env = {
  reduceMotion: mq("(prefers-reduced-motion: reduce)"),
  saveData: !!(navigator.connection && navigator.connection.saveData),
  coarse: mq("(pointer: coarse)"),
  finePointer: mq("(pointer: fine)"),
  touch: mq("(hover: none)"),
  isMobile: mq("(max-width: 760px)") || Math.min(innerWidth, innerHeight) < 768,
  // True when nested in an iframe (e.g. embedded in Carrd) or forced via ?embed=1
  inIframe: (() => { try { return window.self !== window.top; } catch { return true; } })(),
  params: new URLSearchParams(location.search),
};

// "Widget"/embed mode is OPT-IN via ?embed=1 only. Being inside an iframe by
// itself does NOT strip the chrome — that lets the site run as a full-screen
// takeover when embedded (e.g. a full-viewport iframe inside Carrd).
env.isEmbed = ["1", "true"].includes(env.params.get("embed"));
env.transparent = env.params.get("transparent") === "true";

/* ---- helpers ------------------------------------------------------------- */
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Run fn now if DOM is ready, else on DOMContentLoaded. */
export const onReady = (fn) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else { fn(); }
};
