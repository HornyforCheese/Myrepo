/** Mutiny source deck. Names reflect the user-provided DuaFile server selector.
 *  Names alone are NOT proof that those hosts expose a working embed API.
 */
export const WEB_SOURCE_NAMES = [
  "EmbedMaster", "NonTonGo", "VidStorm", "VidSrc 1", "VidCore 1", "VidRock 1",
  "VidZee", "VidUp", "PrimeSrc", "MultiEmbed", "VidSrc 2", "MoviesAPI",
  "VidFast", "2Embed", "Frembed", "VidSrc 3", "VidLink", "Nxsha 1",
  "Fmov", "Vidy", "FrameXTV", "Stellar", "Ovidads", "VidStuck",
  "ZxcStream", "Atlantic", "VidRift", "Cinezo", "CineXtream", "StreamVault",
  "Vidmario", "Velarium", "VidCore 2", "VidFlix", "Videasy", "Nxsha 2",
  "XPass", "ModiPlay", "MoviePire", "VaPlayer", "Cineby", "Embos",
  "VidSrc 4", "VidSrc 5", "VidSrc 6", "VidSrc 7", "VixSrc", "VidRock 2",
  "VidLux", "AnyEmbed", "VidNest", "RiveStream 1", "RiveStream 2",
  "RiveStream 3", "CineSrc", "CinemaOS", "Mapple",
] as const;

export type WebSourceName = (typeof WEB_SOURCE_NAMES)[number];
export type MediaSelection = {
  id: string;
  type: "movie" | "series";
  season?: number;
  episode?: number;
  /** Only use identifiers independently confirmed for this selected title. */
  imdb?: string | null;
  tmdb?: string | null;
  /** Optional MyAnimeList identity for VidLink's documented anime endpoint. */
  mal?: number | null;
  absoluteEpisode?: number;
  animeAudio?: "dub" | "sub";
};

/** These published embed URL formats have been checked against provider documentation.
 *  This does not confirm live catalogue availability for any individual title.
 */
const VERIFIED_EMBEDS: Partial<Record<WebSourceName, {
  movie: string;
  series: string;
  accepts: "imdb-or-tmdb" | "tmdb";
  sandbox: boolean;
}>> = {
  EmbedMaster: {
    movie: "https://embedmaster.link/movie/{id}",
    series: "https://embedmaster.link/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    // EmbedMaster documentation says its player does not work in sandboxed iframes.
    sandbox: false,
  },
  "VidSrc 1": {
    movie: "https://vidsrc.sh/embed/movie/{id}",
    series: "https://vidsrc.sh/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  "VidSrc 2": {
    movie: "https://vidsrc.tw/embed/movie/{id}",
    series: "https://vidsrc.tw/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  "VidSrc 3": {
    movie: "https://vidsrc.ir/embed/movie/{id}",
    series: "https://vidsrc.ir/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  "VidCore 1": {
    movie: "https://vidcore.org/embed/movie/{tmdb}",
    series: "https://vidcore.org/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    sandbox: true,
  },
  PrimeSrc: {
    movie: "https://primesrc.me/embed/movie?imdb={imdb}",
    series: "https://primesrc.me/embed/tv?imdb={imdb}&season={season}&episode={episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  VidLink: {
    movie: "https://vidlink.pro/movie/{tmdb}",
    series: "https://vidlink.pro/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    sandbox: true,
  },
  VixSrc: {
    movie: "https://vixsrc.to/movie/{id}",
    series: "https://vixsrc.to/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  VidFast: {
    movie: "https://vidfast.vc/movie/{id}",
    series: "https://vidfast.vc/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  Videasy: {
    movie: "https://player.videasy.ws/embed/movie/{id}",
    series: "https://player.videasy.ws/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    sandbox: true,
  },
  "Nxsha 1": {
    movie: "https://nxsha.screenscape.me/embed?tmdb={tmdb}&type=movie",
    series: "https://nxsha.screenscape.me/embed?tmdb={tmdb}&type=tv&s={season}&e={episode}",
    accepts: "tmdb",
    sandbox: true,
  },
  // Three documented variants. These are NOT confirmed to be the same
  // backends selected by DuaFile's identically numbered entries.
  "RiveStream 1": {
    movie: "https://www.rivestream.app/embed?type=movie&id={tmdb}",
    series: "https://www.rivestream.app/embed?type=tv&id={tmdb}&season={season}&episode={episode}",
    accepts: "tmdb",
    sandbox: true,
  },
  "RiveStream 2": {
    movie: "https://rivestream.pro/embed/torrent?type=movie&id={tmdb}",
    series: "https://rivestream.pro/embed/torrent?type=tv&id={tmdb}&season={season}&episode={episode}",
    accepts: "tmdb",
    sandbox: true,
  },
  "RiveStream 3": {
    movie: "https://rivestream.pro/embed/agg?type=movie&id={tmdb}",
    series: "https://rivestream.pro/embed/agg?type=tv&id={tmdb}&season={season}&episode={episode}",
    accepts: "tmdb",
    sandbox: true,
  },
};

/** Documented URL formats only. These have NOT passed per-title playback tests. */
export const DOCUMENTED_WEB_SOURCE_NAMES = Object.keys(VERIFIED_EMBEDS) as WebSourceName[];

export function mediaIdentifiers(media: MediaSelection): { imdb: string | null; tmdb: string | null } {
  // IDs come from the selected title's catalogue record, never from a title search guess.
  const derivedImdb = /(?:^|:)tt\d{5,12}(?:$|:)/i.exec(media.id)?.[0].match(/tt\d{5,12}/i)?.[0] ?? null;
  const derivedTmdb = /^(?:tmdb:(?:(?:movie|series|tv):)?)?(\d{1,12})$/.exec(media.id)?.[1] ?? null;
  const imdb = media.imdb && /^tt\d{5,12}$/i.test(media.imdb) ? media.imdb : derivedImdb;
  const tmdb = media.tmdb && /^\d{1,12}$/.test(media.tmdb) ? media.tmdb : derivedTmdb;
  return { imdb, tmdb };
}

/** Reject private/local addresses and credentials in user-supplied web embed templates. */
export function validEmbedTemplate(raw: string): boolean {
  try {
    if (!raw.includes("{imdb}") && !raw.includes("{tmdb}") && !raw.includes("{id}")) return false;
    const test = raw.replace(/\{(?:imdb|tmdb|id|season|episode|type)\}/g, "1");
    const url = new URL(test);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    // Disallow literal IPv4/IPv6 hosts, including private network targets.
    if (/^(?:\d+\.){3}\d+$/.test(host) || host.startsWith("[")) return false;
    if (/[{}]/.test(test)) return false;
    return true;
  } catch {
    return false;
  }
}

export function embedFor(
  name: WebSourceName,
  media: MediaSelection,
  overrides: Partial<Record<WebSourceName, string>> = {},
): { url: string | null; reason: string; sandbox: boolean; configured: boolean } {
  const known = VERIFIED_EMBEDS[name];
  let template = overrides[name] || (known && (media.type === "movie" ? known.movie : known.series));
  // PrimeSrc officially accepts either IMDb or TMDB identifiers as query parameters.
  // Without this, TMDB-only catalogue entries fail even when PrimeSrc supports them.
  const availableIds = mediaIdentifiers(media);
  if (name === "PrimeSrc" && !overrides[name] && !availableIds.imdb && availableIds.tmdb) {
    template = media.type === "movie"
      ? "https://primesrc.me/embed/movie?tmdb={tmdb}"
      : "https://primesrc.me/embed/tv?tmdb={tmdb}&season={season}&episode={episode}";
  }
  if (name === "VidLink" && !overrides[name] && media.type === "series"
      && Number.isInteger(media.mal) && (media.mal ?? 0) > 0
      && Number.isInteger(media.absoluteEpisode) && (media.absoluteEpisode ?? 0) > 0) {
    const audio = media.animeAudio === "sub" ? "sub" : "dub";
    const url = `https://vidlink.pro/anime/${media.mal}/${media.absoluteEpisode}/${audio}?fallback=true`;
    return { url, reason: "", sandbox: true, configured: true };
  }
  if (!template || !validEmbedTemplate(template)) {
    return { url: null, reason: "Embed address not verified. Configure this provider to enable playback.", sandbox: true, configured: false };
  }
  const { imdb, tmdb } = mediaIdentifiers(media);
  const id = known?.accepts === "tmdb" && !overrides[name] ? tmdb : (imdb || tmdb);
  if (media.type === "series" && (!Number.isInteger(media.season) || !Number.isInteger(media.episode) || (media.season ?? -1) < 0 || (media.episode ?? 0) < 1)) {
    return { url: null, reason: "Choose a specific season and episode first.", sandbox: known?.sandbox ?? true, configured: true };
  }
  if (template.includes("{imdb}") && !imdb) return { url: null, reason: "This provider requires an IMDb ID for the selected title.", sandbox: known?.sandbox ?? true, configured: true };
  if (template.includes("{tmdb}") && !tmdb) return { url: null, reason: "This provider requires a TMDB ID for the selected title.", sandbox: known?.sandbox ?? true, configured: true };
  if (!id) return { url: null, reason: "The selected title has no supported IMDb/TMDB identifier. Try Addon Providers.", sandbox: known?.sandbox ?? true, configured: true };
  const url = template.replace(/\{(imdb|tmdb|id|season|episode|type)\}/g, (_whole, key: string) => {
    const v: Record<string, string> = {
      imdb: imdb ?? "", tmdb: tmdb ?? "", id,
      season: String(media.season ?? ""), episode: String(media.episode ?? ""), type: media.type === "movie" ? "movie" : "tv",
    };
    return encodeURIComponent(v[key]);
  });
  if (!validEmbedUrl(url)) return { url: null, reason: "Embed URL was rejected by validation.", sandbox: true, configured: false };
  return { url, reason: "", sandbox: overrides[name] ? true : (known?.sandbox ?? true), configured: true };
}

export function validEmbedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.startsWith("[") || /^(?:\d+\.){3}\d+$/.test(host)) return false;
    return host.includes(".");
  } catch { return false; }
}
