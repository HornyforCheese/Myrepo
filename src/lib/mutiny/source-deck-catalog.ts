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
  documentation?: string;
  sandbox?: boolean;
}>> = {
  EmbedMaster: {
    sandbox: false,
    movie: "https://embedmaster.link/movie/{id}",
    series: "https://embedmaster.link/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
  },
  "VidSrc 1": {
    movie: "https://vidsrc.sh/embed/movie/{id}",
    series: "https://vidsrc.sh/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
  },
  "VidSrc 2": {
    movie: "https://vidsrc.tw/embed/movie/{id}",
    series: "https://vidsrc.tw/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
  },
  "VidSrc 3": {
    movie: "https://vidsrc.ir/embed/movie/{id}",
    series: "https://vidsrc.ir/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
  },
  "VidCore 1": {
    movie: "https://vidcore.org/embed/movie/{tmdb}",
    series: "https://vidcore.org/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
  },
  PrimeSrc: {
    movie: "https://primesrc.me/embed/movie?imdb={imdb}",
    series: "https://primesrc.me/embed/tv?imdb={imdb}&season={season}&episode={episode}",
    accepts: "imdb-or-tmdb",
  },
  VidLink: {
    movie: "https://vidlink.pro/movie/{tmdb}",
    series: "https://vidlink.pro/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
  },
  VixSrc: {
    movie: "https://vixsrc.to/movie/{tmdb}",
    series: "https://vixsrc.to/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
  },
  VidFast: {
    movie: "https://vidfast.vc/movie/{id}",
    series: "https://vidfast.vc/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
  },
  Videasy: {
    movie: "https://player.videasy.net/movie/{tmdb}",
    series: "https://player.videasy.net/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
  },
  "Nxsha 1": {
    movie: "https://nxsha.screenscape.me/embed?tmdb={tmdb}&type=movie",
    series: "https://nxsha.screenscape.me/embed?tmdb={tmdb}&type=tv&s={season}&e={episode}",
    accepts: "tmdb",
  },
  // Three documented variants. These are NOT confirmed to be the same
  // backends selected by DuaFile's identically numbered entries.
  "RiveStream 1": {
    movie: "https://www.rivestream.app/embed?type=movie&id={tmdb}",
    series: "https://www.rivestream.app/embed?type=tv&id={tmdb}&season={season}&episode={episode}",
    accepts: "tmdb",
  },
  "RiveStream 2": {
    movie: "https://rivestream.pro/embed/torrent?type=movie&id={tmdb}",
    series: "https://rivestream.pro/embed/torrent?type=tv&id={tmdb}&season={season}&episode={episode}",
    accepts: "tmdb",
  },
  "RiveStream 3": {
    movie: "https://rivestream.pro/embed/agg?type=movie&id={tmdb}",
    series: "https://rivestream.pro/embed/agg?type=tv&id={tmdb}&season={season}&episode={episode}",
    accepts: "tmdb",
  },
  "NonTonGo": {
    movie: "https://www.nontongo.win/embed/movie/{id}",
    series: "https://www.nontongo.win/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://www.nontongo.win/",
  },
  "VidRock 1": {
    movie: "https://vidrock.to/movie/{tmdb}",
    series: "https://vidrock.to/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidrock.to/",
  },
  "VidRock 2": {
    movie: "https://vidrock.net/movie/{tmdb}",
    series: "https://vidrock.net/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidrock.net/",
  },
  "VidZee": {
    movie: "https://player.vidzee.wtf/embed/movie/{tmdb}",
    series: "https://player.vidzee.wtf/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://player.vidzee.wtf/",
  },
  "VidUp": {
    movie: "https://vidup.to/movie/{id}",
    series: "https://vidup.to/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://vidup.to/",
  },
  "MultiEmbed": {
    movie: "https://multiembed.mov/?video_id={tmdb}&tmdb=1",
    series: "https://multiembed.mov/?video_id={tmdb}&tmdb=1&s={season}&e={episode}",
    accepts: "tmdb",
    documentation: "https://www.superembed.stream/",
  },
  "Frembed": {
    movie: "https://frembed.uno/embed/movie/{id}",
    series: "https://frembed.uno/embed/serie/{id}?sa={season}&epi={episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://frembed.uno/api-docs",
  },
  "Fmov": {
    movie: "https://fmov.my/embed/movie/{tmdb}",
    series: "https://fmov.my/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://fmov.my/docs",
  },
  "Vidy": {
    movie: "https://vidy.st/movie/{tmdb}",
    series: "https://vidy.st/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://www.vidy.st/",
  },
  "FrameXTV": {
    movie: "https://framextv.cc/embed/{tmdb}",
    series: "https://framextv.cc/embed/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://framextv.cc/api",
  },
  "Stellar": {
    movie: "https://stellar.rip/en/watch/embed/movie/{tmdb}",
    series: "https://stellar.rip/en/watch/embed/tv/{tmdb}-{season}-{episode}",
    accepts: "tmdb",
    documentation: "https://stellar.rip/en/api",
  },
  "Ovidads": {
    movie: "https://0vidads.top/embed/movie/{tmdb}",
    series: "https://0vidads.top/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://0vidads.top/",
  },
  "VidStuck": {
    movie: "https://vidstuck.cc/embed/movie/{tmdb}",
    series: "https://vidstuck.cc/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidstuck.cc/",
  },
  "VidRift": {
    movie: "https://embed.vidrift.net/embed/movie/{tmdb}",
    series: "https://embed.vidrift.net/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidrift.net/docs/",
  },
  "Cinezo": {
    movie: "https://player.cinezo.live/embed/movie/{tmdb}",
    series: "https://player.cinezo.live/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://cinezo.live/",
  },
  "CineXtream": {
    movie: "https://cinextream.net/api/embed/movie/{tmdb}",
    series: "https://cinextream.net/api/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://cinextream.cc/",
  },
  "StreamVault": {
    movie: "https://streamvaultsrc.click/embed/movie/{tmdb}",
    series: "https://streamvaultsrc.click/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://streamvaultsrc.click/docs",
  },
  "VidCore 2": {
    movie: "https://vidcore.io/movie/{tmdb}",
    series: "https://vidcore.io/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidcore.io/",
  },
  "XPass": {
    movie: "https://play.xpass.top/e/movie/{id}",
    series: "https://play.xpass.top/e/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://play.xpass.top/",
  },
  "Embos": {
    movie: "https://embos.top/movie/?mid={tmdb}",
    series: "https://embos.top/tv/?mid={tmdb}&s={season}&e={episode}",
    accepts: "tmdb",
    documentation: "https://embos.top/",
  },
  "VidLux": {
    movie: "https://vidlux.xyz/embed/movie/{tmdb}",
    series: "https://vidlux.xyz/embed/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidlux.site/docs",
  },
  "VidNest": {
    movie: "https://vidnest.fun/movie/{tmdb}",
    series: "https://vidnest.fun/tv/{tmdb}/{season}/{episode}",
    accepts: "tmdb",
    documentation: "https://vidnest.fun/",
  },
  "CineSrc": {
    movie: "https://cinesrc.st/embed/movie/{tmdb}",
    series: "https://cinesrc.st/embed/tv/{tmdb}?s={season}&e={episode}",
    accepts: "tmdb",
    documentation: "https://cinesrc.st/docs",
  },
  "Mapple": {
    movie: "https://mapple.fun/watch/movie/{tmdb}?autoPlay=true",
    series: "https://mapple.fun/watch/tv/{tmdb}-{season}-{episode}?autoPlay=true",
    accepts: "tmdb",
    documentation: "https://mappletv.uk/docs/getting-started/endpoints",
  },
  "VidSrc 4": {
    movie: "https://vidsrc.me/embed/movie/{id}",
    series: "https://vidsrc.me/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://vidsrc.domains/",
  },
  "VidSrc 5": {
    movie: "https://vidsrc.io/embed/movie/{id}",
    series: "https://vidsrc.io/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://vidsrc.domains/",
  },
  "VidSrc 6": {
    movie: "https://vidsrc.gd/embed/movie/{id}",
    series: "https://vidsrc.gd/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://vidsrc.domains/",
  },
  "VidSrc 7": {
    movie: "https://vidsrc.bz/embed/movie/{id}",
    series: "https://vidsrc.bz/embed/tv/{id}/{season}/{episode}",
    accepts: "imdb-or-tmdb",
    documentation: "https://vidsrc.domains/",
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

function resolveEmbed(
  name: WebSourceName,
  media: MediaSelection,
  overrides: Partial<Record<WebSourceName, string>> = {},
): { url: string | null; reason: string; configured: boolean } {
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
    return { url, reason: "", configured: true };
  }
  if (!template || !validEmbedTemplate(template)) {
    return { url: null, reason: "Embed address not verified. Configure this provider to enable playback.", configured: false };
  }
  const { imdb, tmdb } = mediaIdentifiers(media);
  const id = known?.accepts === "tmdb" && !overrides[name] ? tmdb : (imdb || tmdb);
  if (media.type === "series" && (!Number.isInteger(media.season) || !Number.isInteger(media.episode) || (media.season ?? -1) < 0 || (media.episode ?? 0) < 1)) {
    return { url: null, reason: "Choose a specific season and episode first.", configured: true };
  }
  if (template.includes("{imdb}") && !imdb) return { url: null, reason: "This provider requires an IMDb ID for the selected title.", configured: true };
  if (template.includes("{tmdb}") && !tmdb) return { url: null, reason: "This provider requires a TMDB ID for the selected title.", configured: true };
  if (!id) return { url: null, reason: "The selected title has no supported IMDb/TMDB identifier. Try Addon Providers.", configured: true };
  const url = template.replace(/\{(imdb|tmdb|id|season|episode|type)\}/g, (_whole, key: string) => {
    const v: Record<string, string> = {
      imdb: imdb ?? "", tmdb: tmdb ?? "", id,
      season: String(media.season ?? ""), episode: String(media.episode ?? ""), type: media.type === "movie" ? "movie" : "tv",
    };
    return encodeURIComponent(v[key]);
  });
  if (!validEmbedUrl(url)) return { url: null, reason: "Embed URL was rejected by validation.", configured: false };
  return { url, reason: "", configured: true };
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

/** A configured URL is not proof of a live stream. Never guess a provider address. */
export function sourceConfigured(name: WebSourceName, overrides: Partial<Record<WebSourceName, string>> = {}): boolean {
  return !!(overrides[name] && validEmbedTemplate(overrides[name])) || !!VERIFIED_EMBEDS[name];
}

export function readyWebSources(media: MediaSelection, overrides: Partial<Record<WebSourceName, string>> = {}, excluded: readonly WebSourceName[] = []) {
  return WEB_SOURCE_NAMES.filter(name => !excluded.includes(name))
    .map(name => ({ name, result: embedFor(name, media, overrides) }))
    .filter(item => item.result.configured && item.result.url !== null)
    .sort((a, b) => Number(b.result.sandbox) - Number(a.result.sandbox));
}

/** Default protection stays enabled; the UI offers a separate per-host opt-in. */
export function embedFor(name: WebSourceName, media: MediaSelection, overrides: Partial<Record<WebSourceName, string>> = {}) {
  return { ...resolveEmbed(name, media, overrides), sandbox: overrides[name] ? true : (VERIFIED_EMBEDS[name]?.sandbox ?? true) };
}

const DEFAULT_PLAYER_SANDBOX = "allow-scripts allow-same-origin allow-presentation";
/** Consent is bound to one provider and exact title URL, not a global boolean. */
export function webCompatibilityKey(name: WebSourceName, url: string | null): string | null {
  return url && validEmbedUrl(url) ? `${name}|${url}` : null;
}
export function webIframeSandbox(consent: string | null, name: WebSourceName, url: string | null): string | undefined {
  const key = webCompatibilityKey(name, url);
  return key !== null && consent === key ? undefined : DEFAULT_PLAYER_SANDBOX;
}
