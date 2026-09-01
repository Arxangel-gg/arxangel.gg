/* ============================================================================
   ARXANGEL — modules/share.js
   Robust "Share transmission". Tries the native Web Share sheet first; if that
   is unavailable OR blocked (e.g. inside a cross-origin iframe, which silently
   throws), it falls back to a small popover with Copy + social targets — so the
   button ALWAYS does something. Copy has an execCommand fallback for non-HTTPS.
   ========================================================================== */

export function init(CONFIG) {
  const btn = document.querySelector("[data-share]");
  if (!btn) return;

  const url = (CONFIG.brand && CONFIG.brand.url) || location.href.split("#")[0];
  const title = "ARXΛNGΞL";
  const text = (CONFIG.brand && CONFIG.brand.shareText) || "ARXΛNGΞL — The Consequence.";
  const enc = encodeURIComponent;

  // --- popover ---
  const pop = document.createElement("div");
  pop.className = "share-pop";
  pop.hidden = true;
  pop.innerHTML = `
    <button class="share-pop__item" type="button" data-copy>Copy link</button>
    <a class="share-pop__item" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}">Share to X</a>
    <a class="share-pop__item" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}">Facebook</a>
    <a class="share-pop__item" target="_blank" rel="noopener" href="https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}">Reddit</a>`;
  document.body.appendChild(pop);

  const toast = (() => {
    const t = document.createElement("div");
    t.className = "share-toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
    let timer = 0;
    return (msg) => { t.textContent = msg; t.classList.add("is-shown"); clearTimeout(timer); timer = setTimeout(() => t.classList.remove("is-shown"), 2200); };
  })();

  const place = () => {
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.min(Math.max(8, r.left), innerWidth - pop.offsetWidth - 8) + "px";
    // open above the button (it lives in the footer near the bottom)
    pop.style.top = Math.max(8, r.top - pop.offsetHeight - 10) + "px";
  };
  const setOpen = (open) => { pop.hidden = !open; if (open) place(); };

  btn.addEventListener("click", async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; /* blocked → popover */ }
    }
    setOpen(pop.hidden);
  });

  pop.querySelector("[data-copy]").addEventListener("click", async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy"); ta.remove();
      }
      toast("Link copied"); setOpen(false);
    } catch { toast("Copy failed"); }
  });

  // dismiss on outside click / Esc; reposition while open
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  addEventListener("scroll", () => { if (!pop.hidden) place(); }, { passive: true });
  addEventListener("resize", () => { if (!pop.hidden) place(); }, { passive: true });
}
