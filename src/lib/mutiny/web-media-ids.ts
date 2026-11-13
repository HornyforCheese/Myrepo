import { safeFetch } from "@/lib/safe-fetch";

/** Resolve exact external IDs; never guess a match from a title search. */
export function createWebTmdbResolver(request: typeof safeFetch) {
  const cache = new Map<string, string>();
  const pending = new Map<string, Promise<string | null>>();
  return async function resolve(id: string, type: "movie" | "series"): Promise<string | null> {
    const native = /^tmdb:(movie|tv|series):(\d{1,12})$/.exec(id);
    if (native) return (native[1] === "movie") === (type === "movie") ? native[2] : null;
    if (!/^tt\d{5,12}$/i.test(id)) return null;
    const key = `${type}:${id.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key)!;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= 16) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const work = (async () => {
      try {
        const response = await request(`https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(id)}.json`, { signal: controller.signal });
        if (!response.ok) return null;
        const text = await response.text();
        if (text.length > 2_000_000) return null;
        const meta = JSON.parse(text)?.meta;
        if (!meta || meta.type !== type || (meta.imdb_id ?? meta.id)?.toLowerCase() !== id.toLowerCase()) return null;
        const tmdb = String(meta.moviedb_id ?? "");
        if (!/^[1-9]\d{0,11}$/.test(tmdb)) return null;
        if (cache.size >= 256) cache.delete(cache.keys().next().value!);
        cache.set(key, tmdb);
        return tmdb;
      } catch { return null; }
      finally { clearTimeout(timer); }
    })();
    pending.set(key, work);
    try { return await work; }
    finally { pending.delete(key); }
  };
}
export const resolveWebTmdbId = createWebTmdbResolver(safeFetch);
