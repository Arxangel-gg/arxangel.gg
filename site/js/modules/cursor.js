/* ============================================================================
   ARXANGEL — modules/cursor.js
   Gold "crosshair" cursor for precise pointers. Smoothly follows the mouse,
   flares on click, and locks onto interactive targets. Retires itself if the
   user switches to a touch device. Only loaded on (pointer:fine) & not embedded.
   ========================================================================== */

export function init() {
  const fine = matchMedia("(pointer:fine)");
  if (!fine.matches) return;

  const root = document.documentElement;
  const el = document.createElement("div");
  el.className = "ax-xhair";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="22" class="ring outer"/>
      <circle cx="50" cy="50" r="8"  class="ring inner"/>
      <line x1="50" y1="6"  x2="50" y2="18" class="tick"/>
      <line x1="50" y1="82" x2="50" y2="94" class="tick"/>
      <line x1="6"  y1="50" x2="18" y2="50" class="tick"/>
      <line x1="82" y1="50" x2="94" y2="50" class="tick"/>
      <circle cx="50" cy="50" r="1.6" class="dot"/>
    </svg>
    <span class="ax-xhair__flash"></span>`;
  document.body.appendChild(el);
  const flash = el.querySelector(".ax-xhair__flash");
  root.classList.add("ax-cursor-on");

  let x = -9999, y = -9999, tx = x, ty = y, raf = 0, paused = false;

  const tick = () => {
    raf = 0;
    tx += (x - tx) * 0.24;
    ty += (y - ty) * 0.24;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    if (Math.abs(x - tx) > 0.1 || Math.abs(y - ty) > 0.1) { if (!paused) raf = requestAnimationFrame(tick); }
  };
  const moveTo = (px, py) => {
    x = px; y = py;
    if (!raf && !paused) raf = requestAnimationFrame(tick);
    if (el.style.opacity !== "1") el.style.opacity = "1";
  };
  const isEditable = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

  addEventListener("mousemove", (e) => {
    moveTo(e.clientX, e.clientY);
    el.classList.toggle("is-aim", !!(e.target.closest && e.target.closest('a,button,[role="button"],[data-aim],input,label')));
    el.style.display = isEditable(e.target) ? "none" : "block";
  }, { passive: true });

  addEventListener("mousedown", () => {
    el.classList.remove("is-fire");
    void flash.offsetWidth;     // restart the flash animation
    el.classList.add("is-fire");
  }, { passive: true });

  addEventListener("mouseleave", () => (el.style.opacity = "0"), { passive: true });
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    if (paused && raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { passive: true });

  // Retire on switch to coarse pointer.
  fine.addEventListener?.("change", (e) => {
    if (!e.matches) { root.classList.remove("ax-cursor-on"); el.remove(); if (raf) cancelAnimationFrame(raf); }
  });
}
