/* ============================================================================
   ARXANGEL — Netlify Function: /.netlify/functions/releases
   ----------------------------------------------------------------------------
   Auto-populates the site playlist from your Spotify catalog so EVERY future
   release appears with zero edits. The site calls this; if it isn't deployed or
   credentials are missing, the site falls back to /data/releases.json.

   SETUP (one time, ~2 min) — see README §7:
     1. https://developer.spotify.com/dashboard → Create app → copy Client ID/Secret
     2. Netlify → Site config → Environment variables, add:
          SPOTIFY_CLIENT_ID       = <your client id>
          SPOTIFY_CLIENT_SECRET   = <your client secret>
          SPOTIFY_ARTIST_ID       = 0aT62hqUqTkgTmeYfgUy4n   (optional; this is default)
     3. Redeploy. New Spotify releases then show up automatically (cached ~15 min).

   Uses the Client Credentials flow (public catalog data only — no user data).
   ========================================================================== */

const ARTIST = process.env.SPOTIFY_ARTIST_ID || "0aT62hqUqTkgTmeYfgUy4n";
const TTL = 15 * 60 * 1000;
let cache = { at: 0, data: null };

exports.handler = async () => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return json(503, { error: "Spotify credentials not configured" });

  if (cache.data && Date.now() - cache.at < TTL) return json(200, cache.data);

  try {
    const token = await getToken(id, secret);
    const albums = await getAllAlbums(ARTIST, token);

    const seen = new Set();
    const releases = [];
    for (const a of albums) {
      const key = (a.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      releases.push({
        title: a.name,
        type: cap(a.album_type),
        year: (a.release_date || "").slice(0, 4),
        releaseDate: a.release_date || "",
        cover: (a.images && a.images[0] && a.images[0].url) || "",
        spotifyType: "album",            // album embed plays the single/EP
        spotifyId: a.id,
        url: (a.external_urls && a.external_urls.spotify) || "",
      });
    }
    releases.sort((x, y) => (y.releaseDate || "").localeCompare(x.releaseDate || ""));

    cache = { at: Date.now(), data: releases };
    return json(200, releases);
  } catch (e) {
    return json(502, { error: String((e && e.message) || e) });
  }
};

async function getToken(id, secret) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("token request failed: " + r.status);
  return (await r.json()).access_token;
}

async function getAllAlbums(artist, token) {
  const out = [];
  let url = `https://api.spotify.com/v1/artists/${artist}/albums?include_groups=single,album&market=US&limit=50`;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error("albums request failed: " + r.status);
    const j = await r.json();
    out.push(...(j.items || []));
    url = j.next;
  }
  return out;
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=900, stale-while-revalidate=86400",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});
