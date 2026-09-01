/* ============================================================================
   ARXANGEL — modules/reveal.js
   Reveals [data-reveal] elements as they scroll into view. Honors a per-element
   stagger via data-reveal-delay. (Not loaded at all under reduced-motion.)
   ========================================================================== */

export function init() {
  // Marks that the reveal pipeline is alive — disables the HTML failsafe timer.
  document.documentElement.classList.add("reveal-active");

  const items = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!items.length) return;

  // Apply per-element stagger.
  items.forEach((el) => {
    const d = el.dataset.revealDelay;
    if (d) el.style.setProperty("--reveal-delay", d);
  });

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-visible"); obs.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });

  items.forEach((el) => io.observe(el));
}
