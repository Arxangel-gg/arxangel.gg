/* ============================================================================
   ARXANGEL — modules/intro.js
   Cinematic "welcome" overlay shown once per browser session. Pure CSS motion
   (no canvas) so it is light. Click / tap / Esc enters; it also auto-dismisses.
   ========================================================================== */

const SEEN_KEY = "ax_intro_seen";
const AUTO_HIDE_MS = 3600;
const FADE_MS = 900;

export function init() {
  try { if (sessionStorage.getItem(SEEN_KEY) === "1") return; } catch {}

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const overlay = document.createElement("div");
  overlay.className = "intro";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "ARXANGEL welcome");
  overlay.innerHTML = `
    <div class="intro__card">
      <svg class="intro__emblem" viewBox="0 0 128 128" aria-hidden="true"><use href="#ax-emblem-glyph"/></svg>
      <p class="intro__title">The Arxangel Welcomes You</p>
      <p class="intro__sub"><b>Signal acquired.</b> Step forward.</p>
      <p class="intro__hint">Click / Tap to enter</p>
    </div>`;
  document.body.appendChild(overlay);

  // Lock scroll while the overlay is up.
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => overlay.classList.add("is-shown"));

  let done = false;
  const hide = () => {
    if (done) return; done = true;
    overlay.classList.remove("is-shown");
    overlay.classList.add("is-hidden");
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
    clearTimeout(auto);
    removeEventListener("keydown", onKey);
    setTimeout(() => { overlay.remove(); document.body.style.overflow = prevOverflow; }, FADE_MS);
  };

  const onKey = (e) => { if (["Escape", "Enter", " "].includes(e.key)) { e.preventDefault(); hide(); } };
  overlay.addEventListener("click", hide, { passive: true });
  addEventListener("keydown", onKey);

  const auto = setTimeout(hide, reduce ? 1300 : AUTO_HIDE_MS);
}
