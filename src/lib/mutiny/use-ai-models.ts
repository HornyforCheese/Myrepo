import { useFreeOpenRouterModels } from "./use-free-openrouter-models";
import { providerForModel, type AiModel } from "@/lib/ai-models";
import { DIRECT_AI_MODELS, type AiService } from "./ai-services";

/** OpenRouter prices are verified live; direct providers use a documented free-tier list. */
export function useAiModels(provider: AiService) {
  const catalog = useFreeOpenRouterModels();
  const models: AiModel[] = provider === "openrouter" ? catalog.models.map(model => ({
    id: model.id, label: model.label, provider: providerForModel(model.id), free: true, recommended: model.toolCalling,
  })) : DIRECT_AI_MODELS[provider];
  return { ...catalog, models, status: provider === "openrouter" ? catalog.status : "ready" as const, error: provider === "openrouter" ? catalog.error : "" };
}
