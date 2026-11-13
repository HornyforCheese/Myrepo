/** Display only the provider's message, never headers or raw request metadata. */
export function safeProviderDetail(raw: string, key = ""): string {
  let message = raw;
  try {
    const data = JSON.parse(raw) as { error?: { message?: unknown }; message?: unknown };
    const value = data.error?.message ?? data.message;
    message = typeof value === "string" ? value : "";
  } catch {
    // Plain-text provider responses are useful too; HTML error pages are not.
    if (/<(?:html|!doctype)/i.test(raw)) message = "Provider returned an HTML error page.";
  }
  if (key.trim()) message = message.split(key.trim()).join("[redacted]");
  return message
    .replace(/sk-[a-z0-9_-]+/gi, "[redacted]")
    .replace(/Bearer\s+[^\s,;"<>]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/\S+/gi, "[provider URL omitted]")
    .replace(/\p{Cc}/gu, " ")
    .trim()
    .slice(0, 500);
}

export async function openRouterError(
  response: Response,
  model: string,
  key: string,
): Promise<string> {
  const detail = safeProviderDetail(await response.text().catch(() => ""), key);
  const hint =
    response.status === 404
      ? "No route was found for this model. Refresh free models and select another; also check OpenRouter privacy/provider restrictions."
      : response.status === 401 || response.status === 403
        ? "Check your API key and OpenRouter permissions."
        : response.status === 402 || response.status === 429
          ? "Check your usage limits or select another free model."
          : "Try again or select another free model.";
  return `OpenRouter HTTP ${response.status} · ${model}. ${hint}${detail ? ` Provider: ${detail}` : ""}`;
}
