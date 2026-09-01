/* ============================================================================
   ARXANGEL — SITE CONFIGURATION  ★ EDIT THIS FILE ★
   ----------------------------------------------------------------------------
   This is the single source of truth for links, media paths, and feature
   toggles. You normally never need to touch the HTML/CSS/JS to update the site
   — change values here and (for music) in /data/releases.json.

   RULES OF THUMB
   • A link left as "" (empty string) hides its button automatically.
   • Toggles are true/false. Turn a whole feature off without deleting code.
   • Paths are relative to index.html.
   ========================================================================== */

export const CONFIG = {

  /* ---- Brand identity (used for SEO/share text & the share console) ------- */
  brand: {
    name: "ARXANGEL",
    domain: "arxangel.gg",
    url: "https://arxangel.gg",
    shareText: "ARXΛNGΞL — The Consequence.",
    tagline: "Ordained by Chaos. Forged in Fire. Unleashed in Glory.",
  },

  /* ---- Feature toggles ---------------------------------------------------- */
  /* Flip any of these to false to disable the feature site-wide. */
  features: {
    intro:          true,   // cinematic "ARXANGEL WELCOMES YOU" overlay (once/session)
    ambientFX:      true,   // canvas embers + dust + comets
    crosshair:      true,   // custom gaming crosshair cursor (desktop pointers only)
    quotes:         true,   // rotating transmission line, bottom of screen
    soundToggle:    true,   // floating sound on/off pill
    ambientAutoplay:true,   // softly start the ambient ASMR cue on first interaction
    liveEmbed:      true,   // Twitch "tune in" section (lazy facade → loads on click)
    bets:           true,   // ARXΛNGΞL Bets section — DEFAULT shown. Toggle site-wide
                            // without redeploying via data.flagsUrl (see below), or
                            // personally with ?bets=on / ?bets=off / ?bets=auto.
    scrollProgress: true,   // thin top scroll-progress bar
  },

  /* ---- Background media (hero) ------------------------------------------- */
  /* Two encodes are shipped; the browser picks the first it supports.
     Poster shows instantly + as a fallback when video can't/shouldn't play. */
  media: {
    videoWebm:  "media/bg.webm",
    videoMp4:   "media/bg.mp4",
    poster:     "media/poster.jpg",
  },

  /* ---- Ambient visit sound (NOT a playlist track — atmosphere only) ------
     The soft "Summoned (ASMR)" cue that sets the mood when someone arrives.
     It starts on the visitor's first interaction (features.ambientAutoplay) and
     is controlled by the floating sound pill. The actual single plays from
     Spotify in the SUMMONED card (see streaming.spotify). It auto-ducks (pauses)
     the moment a visitor engages the Spotify/Twitch player, so they never clash. */
  audio: {
    ambientTrackUrl:
      "https://glkkdqmeumaxfjlctxuo.supabase.co/storage/v1/object/public/playlistarxangel/Arxangel%20-%20Summoned%20-%20ASMR.mp3",
    ambientVolume: 0.22,    // 0–1, soft background level
  },

  /* ---- Music / playlist --------------------------------------------------- */
  music: {
    artistUrl: "https://open.spotify.com/artist/0aT62hqUqTkgTmeYfgUy4n",
    artistId:  "0aT62hqUqTkgTmeYfgUy4n",
    featuredTitle: "SUMMONED",   // pinned first in the playlist; "" = newest first
    // OPTIONAL zero-touch auto-populate: a Netlify function (see README §7) that
    // reads your whole Spotify catalog, so EVERY future release appears with no
    // edits. If it isn't deployed (or has no credentials) the site falls back to
    // data.releasesUrl. Set to "" to disable and use only releases.json.
    releasesEndpoint: "/.netlify/functions/releases",
  },

  /* ---- Primary platform links (nav + community). "" hides the button. ----- */
  links: {
    twitch:    "https://twitch.tv/arxangel_gg",
    discord:   "",   // ← paste your Discord invite to light up "JOIN THE ORDER"
    youtube:   "",
    x:         "https://x.com/arxangel_gg",
    spotify:   "https://open.spotify.com/artist/0aT62hqUqTkgTmeYfgUy4n",
    steam:     "https://steamcommunity.com/profiles/76561198083345465/",
    instagram: "",
    tiktok:    "",
    email:     "",
  },

  /* ---- Embeds ------------------------------------------------------------- */
  embeds: {
    twitchChannel: "arxangel_gg",
    // Twitch refuses to load unless the embedding host is whitelisted. The current
    // host is added automatically; list any OTHER ancestor domains here too —
    // your custom domain AND, if you embed the site in Carrd, your Carrd domain
    // (e.g. "yoursite.carrd.co"), since Twitch sits two iframes deep.
    twitchParents: ["arxangel.gg", "roaring-sundae-d0aff7.netlify.app", "localhost"],
    // Optional existing micro-apps (kept off by default to stay fast & premium).
    consoleUrl: "https://sunny-sunshine-29825a.netlify.app",
    betsUrl:    "https://marvelous-biscotti-6276f1.netlify.app",
  },

  /* ---- Data sources ------------------------------------------------------- */
  data: {
    releasesUrl: "data/releases.json", // discography grid (future singles/EPs)
    quotesUrl:   "",                    // optional remote JSON; blank = use fallback

    // ★ OWNER-ONLY, NO-REDEPLOY FEATURE TOGGLES (site-wide).
    // Point this at a tiny JSON you control (e.g. your Supabase "misc" bucket,
    // alongside quotes.json). Example file contents:  { "bets": false }
    // Whatever it says overrides the `features` defaults above for ALL visitors,
    // instantly, with no redeploy. Only you can edit it (it lives in your storage).
    // Leave blank to just use the `features` defaults. A bad/missing file is
    // ignored safely. (404 while you haven't created it yet = defaults are used.)
    flagsUrl:    "https://glkkdqmeumaxfjlctxuo.supabase.co/storage/v1/object/public/misc/flags.json",
  },

  /* ---- Transmission lines (rotating quote). Used if quotesUrl is blank. ---- */
  quotesFallback: [
    "Order from chaos. Light from fire. Victory from orbit.",
    "We're not loud — we're final.",
    "Precision under fire. Sacred vibes.",
    "Aim true. Strike once.",
    "Clarity before cadence.",
    "Spare the ego, save the squad.",
    "Make distance holy.",
  ],
};
