/* ============================================================================
   ARXANGEL — modules/audio.js  (AMBIENT VISIT SOUND)
   ----------------------------------------------------------------------------
   The single ("SUMMONED") now plays from the Spotify embed in the release card.
   This module only owns the soft *ambient* cue (the "Summoned ASMR" atmosphere):
     • optionally starts on the visitor's first interaction (ambientAutoplay)
     • is toggled by the floating sound pill (play → then mute/unmute)
     • AUTO-DUCKS: pauses itself the moment focus enters an embedded player
       (Spotify / Twitch / Bets iframe) so the ambient never clashes with a track
   preload="none" → nothing is fetched until it actually starts.
   ========================================================================== */

export function init(CONFIG, env) {
  const url = CONFIG.audio.ambientTrackUrl;
  if (!url) return;

  const audio = new Audio();
  audio.src = url;
  audio.preload = "none";
  audio.crossOrigin = "anonymous";
  audio.loop = false;
  audio.playsInline = true;
  audio.volume = CONFIG.audio.ambientVolume ?? 0.22;

  let started = false;
  const play = async () => { try { await audio.play(); started = true; } catch { /* needs a gesture */ } };

  /* ---- Floating sound pill ---------------------------------------------- */
  if (CONFIG.features.soundToggle) {
    const pill = document.createElement("button");
    pill.className = "sound-pill is-off";
    pill.type = "button";
    pill.setAttribute("aria-label", "Toggle ambient sound");
    pill.innerHTML = `<span class="sound-pill__dot" aria-hidden="true"></span><span class="sound-pill__label">Enable sound</span>`;
    document.body.appendChild(pill);
    const label = pill.querySelector(".sound-pill__label");
    requestAnimationFrame(() => pill.classList.add("is-shown"));

    pill.addEventListener("click", () => {
      if (audio.paused) play();            // first press starts the ambient cue
      else audio.muted = !audio.muted;     // later presses mute/unmute
    });

    const sync = () => {
      const live = !audio.paused && !audio.muted;
      pill.classList.toggle("is-off", !live);
      label.textContent = audio.paused ? "Enable sound" : audio.muted ? "Unmute" : "Sound on";
    };
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("volumechange", sync);
  }

  /* ---- Optional ambient autoplay (first gesture) ------------------------- */
  if (CONFIG.features.ambientAutoplay) {
    const start = () => { if (!started) play(); };
    start(); // try immediately; most browsers will need the gesture below
    const events = ["pointerdown", "keydown", "touchstart"];
    const onGesture = () => { start(); events.forEach((e) => removeEventListener(e, onGesture, true)); };
    events.forEach((e) => addEventListener(e, onGesture, { once: true, capture: true, passive: true }));
  }

  /* ---- Auto-duck: pause when an embedded player takes focus -------------- */
  // A click into a cross-origin iframe (Spotify/Twitch/Bets) blurs the page and
  // makes that iframe the activeElement — our cue to step aside.
  addEventListener("blur", () => {
    requestAnimationFrame(() => {
      const el = document.activeElement;
      if (el && el.tagName === "IFRAME" && !audio.paused) audio.pause();
    });
  }, true);

  addEventListener("pagehide", () => { try { audio.pause(); } catch {} }, { once: true });
}
