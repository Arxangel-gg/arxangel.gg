/* ============================================================================
   ARXANGEL — modules/flags.js
   Runtime feature flags. Controls visibility of [data-flag="NAME"] sections and
   [data-flag-link="NAME"] nav links, with this precedence (first wins):
     1. Personal per-device override  — ?NAME=on|off (persisted in localStorage;
        clear with ?NAME=auto). Only affects YOUR browser.
     2. Remote owner flag (site-wide)  — CONFIG.data.flagsUrl JSON, e.g.
        { "bets": false }. Edit that file in your own storage to flip a feature
        for EVERYONE, instantly, with no redeploy. Only you can edit it.
     3. CONFIG.features[NAME] default.
   Embedded micro-apps ([data-embed="<CONFIG.embeds key>"]) get their src injected
   only when their flag resolves on, so nothing loads while hidden.
   ========================================================================== */

const KEY = (name) => `ax.flag.${name}`;

export async function init(CONFIG) {
  const params = new URLSearchParams(location.search);

  // 1) URL → localStorage personal overrides (for any flag present in the DOM)
  const flagNames = new Set(
    [...document.querySelectorAll("[data-flag]")].map((el) => el.dataset.flag)
      .concat([...document.querySelectorAll("[data-flag-link]")].map((el) => el.dataset.flagLink))
  );
  flagNames.forEach((name) => {
    const v = params.get(name);
    if (v === "on" || v === "off") localStorage.setItem(KEY(name), v);
    else if (v === "auto" || v === "reset") localStorage.removeItem(KEY(name));
  });

  // 2) remote, owner-controlled, site-wide flags (safe if missing/offline)
  let remote = {};
  if (CONFIG.data && CONFIG.data.flagsUrl) {
    try {
      const r = await fetch(CONFIG.data.flagsUrl, { cache: "no-cache" });
      if (r.ok) remote = await r.json();
    } catch { /* ignore — fall back to defaults */ }
  }

  const resolve = (name) => {
    const local = localStorage.getItem(KEY(name));
    if (local === "on") return true;
    if (local === "off") return false;
    if (remote && typeof remote[name] === "boolean") return remote[name];
    return !!(CONFIG.features && CONFIG.features[name]);
  };

  // 3) apply to sections + nav links
  document.querySelectorAll("[data-flag]").forEach((el) => {
    const on = resolve(el.dataset.flag);
    el.hidden = !on;
    if (on) injectEmbeds(el, CONFIG);
  });
  document.querySelectorAll("[data-flag-link]").forEach((el) => {
    const on = resolve(el.dataset.flagLink);
    (el.closest("li") || el).hidden = !on;
  });
}

/* Inject iframe src from CONFIG.embeds[key] only when its section is shown. */
function injectEmbeds(root, CONFIG) {
  root.querySelectorAll("iframe[data-embed]").forEach((f) => {
    if (f.getAttribute("src")) return;
    const url = CONFIG.embeds && CONFIG.embeds[f.dataset.embed];
    if (!url) return;
    f.src = url + (url.includes("?") ? "&" : "?") + "transparent=true";
  });
}
