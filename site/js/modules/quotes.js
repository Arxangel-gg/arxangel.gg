/* ============================================================================
   ARXANGEL — modules/quotes.js
   A single rotating "transmission" line pinned to the bottom of the viewport.
   Uses CONFIG.quotesFallback, optionally replaced by a remote JSON list.
   ========================================================================== */

export async function init(CONFIG) {
  let quotes = (CONFIG.quotesFallback || []).slice();

  // Optional remote source (array, or { quotes: [...] }).
  if (CONFIG.data.quotesUrl) {
    try {
      const res = await fetch(CONFIG.data.quotesUrl, { cache: "force-cache" });
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.quotes || []).map(String).filter((s) => s.trim());
      if (list.length) quotes = list;
    } catch { /* keep fallback */ }
  }
  if (!quotes.length) return;

  const host = document.createElement("div");
  host.className = "quote-line";
  host.setAttribute("aria-hidden", "true");
  host.innerHTML = `<span class="quote-line__text"></span>`;
  document.body.appendChild(host);
  const el = host.querySelector(".quote-line__text");

  let i = Math.floor(Math.random() * quotes.length);
  const show = () => { el.textContent = "“" + quotes[i] + "”"; el.classList.add("is-active"); };

  let timer = null;
  const cycle = () => {
    el.classList.remove("is-active");           // fade out
    setTimeout(() => { i = (i + 1) % quotes.length; show(); }, 700);
  };
  const start = () => { if (!timer) timer = setInterval(cycle, 6500); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  show();
  start();

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()), { passive: true });
}
