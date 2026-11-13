import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { AiModelSelect } from "@/views/settings/ai-model-select";
import { ExtLink, KeyField } from "@/views/settings/shared";
import { AI_SERVICES, defaultServiceModel, type AiService } from "./ai-services";
import { useAiModels } from "./use-ai-models";
import openrouterLogo from "@/assets/ai-logos/openrouter.png";
import groqLogo from "@/assets/ai-logos/groq.png";
import geminiLogo from "@/assets/ai-logos/gemini.png";
const logos = { openrouter: openrouterLogo, groq: groqLogo, gemini: geminiLogo };

export function AiProviderSettings() {
  const { settings, update } = useSettings();
  const provider = settings.aiSearchProvider;
  const { models, status, error, refresh } = useAiModels(provider);
  const [drafts, setDrafts] = useState({ aiSearchKey: settings.aiSearchKey, aiGroqKey: settings.aiGroqKey, aiGeminiKey: settings.aiGeminiKey });
  const [saved, setSaved] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <div className="space-y-4">
    <p className="text-sm text-ink-muted">Choose your AI provider for Ask AI and search. Free-tier models require your own key and have account, regional and usage limits. A paid account may be billed by the provider.</p>
    <label className="flex flex-col gap-2 text-sm font-semibold">AI provider
      <select value={provider} onChange={event => {
        const next = event.target.value as AiService;
        update({ aiSearchProvider: next, aiSearchModel: defaultServiceModel(next, DEFAULT_AI_MODEL) });
      }} className="rounded-lg border border-edge bg-elevated p-3 text-ink">
        {Object.entries(AI_SERVICES).map(([id, config]) => <option key={id} value={id}>{config.label}</option>)}
      </select>
    </label>
    {(Object.keys(AI_SERVICES) as AiService[]).map(id => {
      const config = AI_SERVICES[id];
      return <KeyField key={id} label={`${config.label} API key`} iconSrc={logos[id]} placeholder={config.placeholder}
        value={drafts[config.field]} onChange={value => setDrafts(current => ({ ...current, [config.field]: value }))}
        onSave={() => {
          update({ [config.field]: drafts[config.field].trim() }); setSaved(id);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setSaved(""), 1800);
        }} saved={saved === id} help={<span><ExtLink href={config.keys}>Get a {config.label} API key</ExtLink>. Sent only to {config.label} when that provider is selected.</span>} />;
    })}
    {provider === "openrouter" && <button type="button" onClick={refresh} disabled={status === "loading"} className="text-sm text-accent disabled:opacity-50">Refresh free OpenRouter models</button>}
    {error && <p role="status" className="text-sm text-danger">Unable to verify OpenRouter free models: {error}</p>}
    {status === "loading" && <p role="status" className="text-sm text-ink-muted">Checking free models…</p>}
    {status === "ready" && !models.some(model => model.id === settings.aiSearchModel) && <p role="status" className="text-sm text-danger">Choose an available model for {AI_SERVICES[provider].label} below.</p>}
    {!!models.length && <AiModelSelect value={settings.aiSearchModel} onChange={id => { if (models.some(model => model.id === id)) update({ aiSearchModel: id }); }} models={models} defaultModel={defaultServiceModel(provider, DEFAULT_AI_MODEL)} />}
    <p className="text-xs text-ink-muted">OpenRouter lists verified zero-price text models. Groq and Gemini list documented free-tier text models; availability can change. Keys are saved locally using the app’s existing settings storage.</p>
  </div>;
}
