import type { AiModel } from "@/lib/ai-models";
import { safeProviderDetail } from "./openrouter-error";

export type AiService = "openrouter" | "groq" | "gemini";
export type AiRoute = AiService | boolean;
export type AiCredentials = { aiSearchProvider: AiService; aiSearchKey: string; aiGroqKey: string; aiGeminiKey: string };
export const AI_SERVICES = {
  openrouter: { label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", keys: "https://openrouter.ai/keys", field: "aiSearchKey", placeholder: "sk-or-…" },
  groq: { label: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", keys: "https://console.groq.com/keys", field: "aiGroqKey", placeholder: "gsk_…" },
  gemini: { label: "Gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", keys: "https://aistudio.google.com/apikey", field: "aiGeminiKey", placeholder: "AIza…" },
} as const;

// Curated text models documented with free-tier access on 2026-11-13.
// Availability and quotas depend on the account; a paid account may incur charges.
export const DIRECT_AI_MODELS: Record<"groq" | "gemini", AiModel[]> = {
  groq: [
    { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B · free tier", provider: "groq", free: true },
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B · free tier", provider: "groq", free: true },
  ],
  gemini: [
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite · free tier", provider: "gemini", free: true },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite · free tier", provider: "gemini", free: true },
  ],
};
export function aiService(route: AiRoute): AiService {
  if (route === true) return "groq";
  if (route === false) return "openrouter";
  if (Object.hasOwn(AI_SERVICES, route)) return route;
  throw new Error("Unknown AI provider. Choose a provider in AI settings.");
}
export function serviceKey(settings: AiCredentials): string {
  return settings[AI_SERVICES[aiService(settings.aiSearchProvider)].field].trim();
}
export function defaultServiceModel(provider: AiService, openrouterDefault: string): string {
  return provider === "openrouter" ? openrouterDefault : DIRECT_AI_MODELS[provider][0].id;
}

/** Direct HTTPS only: never forward credentials to a proxy or retry another provider. */
export async function aiCompletion(
  route: AiRoute, key: string, model: string, body: Record<string, unknown>, signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<string> {
  const provider = aiService(route);
  const config = AI_SERVICES[provider];
  if (!key.trim()) throw new Error(`Add your ${config.label} API key in AI settings.`);
  if (!model.trim()) throw new Error("Choose an AI model in settings.");
  if (provider !== "openrouter" && !DIRECT_AI_MODELS[provider].some(item => item.id === model))
    throw new Error(`Choose a supported ${config.label} free-tier model in AI settings.`);
  const deadline = AbortSignal.timeout(60000);
  let response: Response;
  try {
    response = await request(config.endpoint, {
      method: "POST", redirect: "error", credentials: "omit",
      headers: { Authorization: `Bearer ${key.trim()}`, "Content-Type": "application/json", ...(provider === "openrouter" ? { "X-Title": "Mutiny Media" } : {}) },
      body: JSON.stringify({ ...body, model }),
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    });
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw new Error(deadline.aborted ? `${config.label} timed out. Try again or choose another model.` : `${config.label} could not be reached. Check your connection and try again.`);
  }
  if (!response.ok) {
    const detail = safeProviderDetail(await response.text().catch(() => ""), key);
    const hint = response.status === 401 || response.status === 403 ? "Check this provider's API key and model permissions." : response.status === 429 ? "Free-tier quota or rate limit reached. Wait or choose another model." : response.status === 404 ? "Model unavailable. Choose another model in AI settings." : "Check your account quota and selected model.";
    throw new Error(`${config.label} HTTP ${response.status}. ${hint}${detail ? ` ${detail}` : ""}`);
  }
  let data: { choices?: { message?: { content?: unknown } }[]; error?: unknown };
  try { data = await response.json(); } catch { throw new Error(`${config.label} returned an unreadable reply. Try again.`); }
  if (!data || typeof data !== "object") throw new Error(`${config.label} returned an unreadable reply. Try again.`);
  if (data.error) throw new Error(`${config.label}: ${safeProviderDetail(JSON.stringify(data), key) || "Request failed."}`);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error(`${config.label} returned an empty reply. Try another model.`);
  return content;
}
