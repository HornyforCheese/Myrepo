import { useEffect, useRef, useState } from "react";
import {
  AiSearchError,
  aiSuggest,
  resolveAiSuggestions,
  type AiErrorDescriptor,
  type AiResult,
} from "@/lib/ai-search";
import { useSettings } from "@/lib/settings";
import { useAiModels } from "@/lib/mutiny/use-ai-models";
import { aiKey } from "@/lib/ai-models";
import { liveWebContext } from "@/lib/mutiny/live-web";

export type AiStatus = "idle" | "loading" | "done" | "error";

export function useAiSuggest(query: string, runSignal = 0) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<AiStatus>("idle");
  const [results, setResults] = useState<AiResult[]>([]);
  const [error, setError] = useState<AiErrorDescriptor | null>(null);
  const [ranQuery, setRanQuery] = useState("");
  const reqRef = useRef(0);
  const activeKey = aiKey(settings);

  useEffect(() => {
    reqRef.current += 1;
    setStatus("idle");
    setResults([]);
    setError(null);
    setRanQuery("");
  }, [query, settings.aiSearchProvider, settings.aiSearchModel, activeKey]);

  const { models, status: catalogStatus } = useAiModels(settings.aiSearchProvider);
  const model = models.find(({ id }) => id === settings.aiSearchModel);

  useEffect(() => {
    if (!runSignal || !query.trim() || !activeKey || !model) return;
    void run();
  }, [runSignal, model?.id]);

  const run = async () => {
    if (!activeKey || !model) return;
    const id = ++reqRef.current;
    setStatus("loading");
    setError(null);
    setRanQuery(query);
    try {
      let webContext: string | undefined;
      if (settings.aiWebSearch) {
        try {
          const { context } = await liveWebContext(query, settings);
          webContext = context || undefined;
        } catch {
          webContext = undefined;
        }
      }
      const suggestions = await aiSuggest(
        activeKey,
        model.id,
        settings.aiSearchProvider,
        query,
        webContext,
      );
      if (id !== reqRef.current) return;
      if (suggestions.length === 0) {
        setResults([]);
        setStatus("done");
        return;
      }
      const metas = await resolveAiSuggestions(suggestions);
      if (id !== reqRef.current) return;
      setResults(metas);
      setStatus("done");
    } catch (e) {
      if (id !== reqRef.current) return;
      if (e instanceof AiSearchError) {
        setError({
          messageKey: e.messageKey,
          ...(e.values ? { values: e.values } : {}),
          ...(e.detail ? { detail: e.detail } : {}),
        });
      } else {
        const detail = e instanceof Error ? e.message : typeof e === "string" ? e : undefined;
        setError({
          messageKey: "AI search failed.",
          ...(detail ? { detail } : {}),
        });
      }
      setStatus("error");
    }
  };

  return { status, results, error, ranQuery, run, model, catalogStatus };
}
