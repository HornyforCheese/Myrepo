import { mediaIdentifiers, readyWebSources, validEmbedUrl } from './source-deck-catalog.js';

export function safeUrl(value) {
  if (typeof value !== 'string' || !validEmbedUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase().replace(/\.$/, '');
  return host !== 'localhost' && !host.endsWith('.localhost') && !/^[\d.]+$/.test(host);
}
export function addonBase(raw) {
  const url = new URL(raw.trim().replace(/^stremio:\/\//i,'https://'));
  if (!safeUrl(url.href) || url.search || url.hash || !url.pathname.endsWith('/manifest.json')) throw Error('Use a public HTTPS manifest.json URL without query parameters.');
  return url.href.slice(0, -'/manifest.json'.length);
}
export function selectionFor(meta, episode) {
  const type = meta.type === 'series' ? 'series' : 'movie';
  const id = String(meta.imdb_id || meta.id || '');
  const selection = { id, type };
  const identifiers = mediaIdentifiers(selection);
  if (identifiers.imdb) selection.imdb = identifiers.imdb;
  const tmdb = String(meta.moviedb_id ?? '');
  // Only accept mappings belonging to this exact metadata record.
  if (/^[1-9]\d{0,11}$/.test(tmdb)) selection.tmdb = tmdb;
  if (type === 'series' && episode) {
    selection.season = Number(episode.season);
    selection.episode = Number(episode.episode);
  }
  return selection;
}
export function sourcesFor(meta, episode) { return readyWebSources(selectionFor(meta, episode)); }
export function streamId(meta, episode) {
  if (meta.type !== 'series') return String(meta.id);
  if (!episode || !Number.isInteger(Number(episode.season)) || Number(episode.season) < 0 || !Number.isInteger(Number(episode.episode)) || Number(episode.episode) < 1) return null;
  return episode.id || `${meta.id}:${episode.season}:${episode.episode}`;
}
export function supportsStreams(manifest, type, id) {
  return Array.isArray(manifest.resources) && manifest.resources.some(resource => {
    if (resource === 'stream') return (!Array.isArray(manifest.types) || manifest.types.includes(type)) &&
      (!Array.isArray(manifest.idPrefixes) || manifest.idPrefixes.some(prefix => typeof prefix === 'string' && id.startsWith(prefix)));
    return resource && resource.name === 'stream' && (!Array.isArray(resource.types) || resource.types.includes(type)) && (!Array.isArray(resource.idPrefixes) || resource.idPrefixes.some(prefix => id.startsWith(prefix)));
  });
}
export async function jsonRequest(url, fetcher = fetch) {
  if (!safeUrl(url)) throw Error('A public HTTPS address is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw Error(`Server returned ${response.status}.`);
    if (response.url && !safeUrl(response.url)) throw Error('Unsafe redirect.');
    const body = await response.text();
    if (body.length > 5_000_000) throw Error('Response is too large.');
    return JSON.parse(body);
  } finally { clearTimeout(timeout); }
}
