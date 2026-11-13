import { enrichWithContent, type WebHit } from "@/lib/jina-search";
import type { Settings } from "@/lib/settings/types";

/** Keenable contract: https://docs.keenable.ai/api-reference/openapi.json */
export async function liveWebContext(
  query: string,
  settings: Pick<Settings, "aiWebSource" | "keenableKey" | "jinaKey">,
): Promise<{ hits: WebHit[]; context: string }> {
  const text = query.trim().slice(0, 2000);
  if (!text) return { hits: [], context: "" };
  if (settings.aiWebSource !== "keenable") return enrichWithContent(text, settings.jinaKey);
  const key = settings.keenableKey.trim();
  const response = await fetch(`https://api.keenable.ai/v1/search${key ? "" : "/public"}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Keenable-Title": "Mutiny Media",
      ...(key ? { "X-API-Key": key } : {}),
    },
    body: JSON.stringify({ query: text, max_results: 8, snippet_max_length: 800, mode: "realtime" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Web search failed (HTTP ${response.status})`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !Array.isArray((data as { results?: unknown }).results)) {
    throw new Error("Web search returned an invalid result list");
  }
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  for (const item of (data as { results: unknown[] }).results.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || typeof row.title !== "string") continue;
    try {
      const url = new URL(row.url);
      if (url.protocol !== "https:" || url.username || url.password || seen.has(url.href)) continue;
      seen.add(url.href);
      hits.push({ url: url.href, title: row.title.slice(0, 300), snippet: typeof row.snippet === "string" ? row.snippet.slice(0, 800) : "" });
    } catch { continue; }
    if (hits.length === 8) break;
  }
  return { hits, context: hits.map((hit, i) => `[${i + 1}] ${hit.title} — ${hit.url}\n${hit.snippet}`).join("\n\n") };
}
