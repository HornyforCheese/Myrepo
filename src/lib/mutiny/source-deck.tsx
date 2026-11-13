import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronDown, Globe2, Play, Puzzle, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useView, type PlayEpisode } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { useImdbId } from "@/views/play-picker/use-imdb-id";
import type { Meta } from "@/lib/cinemeta";
import { resolveWebTmdbId } from "./web-media-ids";
import { openUrl } from "@/lib/window";
import {
  WEB_SOURCE_NAMES,
  DOCUMENTED_WEB_SOURCE_NAMES,
  embedFor,
  sourceConfigured,
  readyWebSources,
  webCompatibilityKey,
  webIframeSandbox,
  validEmbedTemplate,
  type WebSourceName,
} from "./source-deck-catalog";

type SourceDeckProps = {
  meta: Meta;
  episode?: PlayEpisode;
  addonPicker: ReactNode;
};

const STORAGE_KEY = "mutiny:source-deck:templates:v1";
function readTemplates(): Partial<Record<WebSourceName, string>> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Partial<Record<WebSourceName, string>> = {};
    for (const name of WEB_SOURCE_NAMES) {
      const value = (raw as Record<string, unknown>)[name];
      if (typeof value === "string" && validEmbedTemplate(value)) out[name] = value;
    }
    return out;
  } catch { return {}; }
}
function persistTemplates(templates: Partial<Record<WebSourceName, string>>): boolean {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); return true; }
  catch { return false; }
}

/** Web-first source selector placed at the Windows PlayPicker entry point.
 * The native AddonPlayPicker is mounted unmodified when the second tab is selected.
 */
export function MutinySourceDeck({ meta, episode, addonPicker }: SourceDeckProps) {
  const { exitPickerToDetail } = useView();
  const { settings } = useSettings();
  const resolvedImdb = useImdbId(meta, settings.tmdbKey);
  const [tab, setTab] = useState<"web" | "addons">("web");
  const [sourceChoice, setSourceChoice] = useState<WebSourceName | "Automatic">("Automatic");
  const [excluded, setExcluded] = useState<WebSourceName[]>([]);
  const [showUnconfigured, setShowUnconfigured] = useState(false);
  const [resolvedTmdb, setResolvedTmdb] = useState<{ key: string; id: string | null } | null>(null);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [animeAudio, setAnimeAudio] = useState<"dub" | "sub">("dub");
  const [playing, setPlaying] = useState(false);
  const [compatibilityConsent, setCompatibilityConsent] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Partial<Record<WebSourceName, string>>>(readTemplates);
  const [editing, setEditing] = useState(false);
  const [templateDraft, setTemplateDraft] = useState("");
  const [error, setError] = useState("");
  const isAnimeMovie = meta.type === "anime" && /movie|film/i.test(meta.animeFormat ?? "");
  const isSeries = meta.type === "series" || meta.type === "tv" || (meta.type === "anime" && !isAnimeMovie);
  const malId = meta.malId ?? Number(/^mal:(\d+)$/.exec(meta.id)?.[1] ?? 0);
  const hasAnimeIdentity = Number.isInteger(malId) && malId > 0;
  const verifiedImdb = /^tt\d{5,12}$/i.test(meta.id) ? meta.id : (resolvedImdb.verified ? resolvedImdb.id : null);
  const lookupId = verifiedImdb ?? meta.id;
  const lookupType = isSeries ? "series" : "movie";
  const lookupKey = `${lookupType}:${lookupId}`;
  const tmdbId = resolvedTmdb?.key === lookupKey ? resolvedTmdb.id : null;
  useEffect(() => {
    let cancelled = false;
    void resolveWebTmdbId(lookupId, lookupType).then(id => {
      if (!cancelled) setResolvedTmdb({ key: lookupKey, id });
    });
    return () => { cancelled = true; };
  }, [lookupId, lookupType, lookupKey]);
  useEffect(() => { setExcluded([]); }, [meta.id, episode?.season, episode?.episode, animeAudio]);
  const media = useMemo(() => ({
    id: meta.id,
    tmdb: tmdbId,
    type: isSeries ? "series" as const : "movie" as const,
    season: episode?.imdbSeason ?? episode?.season,
    episode: episode?.imdbEpisode ?? episode?.episode,
    imdb: verifiedImdb,
    mal: hasAnimeIdentity ? malId : null,
    absoluteEpisode: episode?.absoluteNumber ?? episode?.episode,
    animeAudio,
  }), [meta.id, tmdbId, isSeries, episode?.season, episode?.episode, episode?.imdbSeason, episode?.imdbEpisode, episode?.absoluteNumber, verifiedImdb, hasAnimeIdentity, malId, animeAudio]);
  const ready = useMemo(() => readyWebSources(media, templates, excluded), [media, templates, excluded]);
  const provider = sourceChoice === "Automatic" ? (ready[0]?.name ?? "EmbedMaster") : sourceChoice;
  const current = useMemo(() => embedFor(provider, media, templates), [provider, media, templates]);
  const allowUnrestrictedEmbed = webIframeSandbox(compatibilityConsent, provider, current.url) === undefined;
  const filteredHosts = useMemo(() => WEB_SOURCE_NAMES.filter((name) => (showUnconfigured || sourceConfigured(name, templates)) && name.toLowerCase().includes(search.trim().toLowerCase())), [search, showUnconfigured, templates]);
  // The host player may have an additional Play control. These hosts document
  // a documented autoplay option for four integrations; an iframe load still does not prove playback.
  const iframeUrl = useMemo(() => {
    if (!current.url) return null;
    const param = provider === "EmbedMaster" ? "autoplay=on"
      : provider === "VidFast" ? "autoPlay=true"
      : provider === "Videasy" ? "autoplay=1"
      : provider === "VixSrc" ? "autoplay=true" : null;
    if (!param) return current.url;
    return `${current.url}${current.url.includes("?") ? "&" : "?"}${param}`;
  }, [current.url, provider]);
  useEffect(() => { setPlaying(false); setError(""); setMenu(false); setCompatibilityConsent(null); }, [provider, current.url]);
  useEffect(() => { if (tab === "addons") setPlaying(false); }, [tab]);

  const selectProvider = (name: WebSourceName) => {
    setPlaying(false); setCompatibilityConsent(null); setSourceChoice(name); setMenu(false); setEditing(false); setSearch("");
  };
  const saveTemplate = () => {
    if (templateDraft.trim() && !validEmbedTemplate(templateDraft.trim())) {
      setError("Enter a public HTTPS embed URL template containing {id}, {imdb} or {tmdb}.");
      return;
    }
    const next = { ...templates };
    if (templateDraft.trim()) next[provider] = templateDraft.trim(); else delete next[provider];
    if (!persistTemplates(next)) {
      setError("Could not save the provider template on this device.");
      return;
    }
    setTemplates(next); setError(""); setEditing(false); setPlaying(false);
  };

  return (
    <main className="absolute inset-0 z-[60] overflow-y-auto bg-canvas text-ink" aria-label="Mutiny Media source deck">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs tracking-wide text-ink-muted">
            <button type="button" onClick={() => exitPickerToDetail(meta)} aria-label="Back to title" className="rounded-xl border border-edge bg-elevated px-3 py-2 text-ink hover:bg-surface">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <img src="/mutiny-mark.png" className="size-7 rounded-md object-contain" alt="" aria-hidden="true"/><span className="font-semibold text-ink">MUTINY MEDIA</span><span>/</span><span>Player</span><span>/</span><span>Source Deck</span>
          </div>
          <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent">WEB-FIRST PLAYBACK</div>
        </div>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[.2em] text-ink-subtle">NOW PLAYING</div>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">{meta.name}</h1>
            <p className="mt-1 text-xs text-ink-muted">
              {isSeries ? (episode ? `Season ${episode.season ?? "?"} · Episode ${episode.episode ?? "?"}` : "Choose an episode before streaming") : "Movie"}
              {" · "}Choose a source, then press Play
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted"><span className="size-2 rounded-full bg-accent"/> Source selector ready</div>
        </header>

        <section className="relative overflow-visible rounded-2xl border border-edge bg-surface shadow-2xl">
          <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 pt-3 sm:px-5" role="tablist" aria-label="Playback sources">
            <button type="button" role="tab" aria-selected={tab === "web"} onClick={() => { setTab("web"); setMenu(true); }}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === "web" ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
              <Globe2 size={16} aria-hidden="true"/> Web Sources <span className="rounded bg-elevated px-2 py-0.5 text-[10px] text-ink-subtle">{DOCUMENTED_WEB_SOURCE_NAMES.length} preconfigured</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "addons"} onClick={() => { setTab("addons"); setMenu(false); }}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === "addons" ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
              <Puzzle size={16} aria-hidden="true"/> Addon Providers <span className="rounded bg-elevated px-2 py-0.5 text-[10px] text-ink-subtle">Stremio · Nuvio · CloudStream</span>
            </button>
          </div>

          {tab === "web" ? (
            <div role="tabpanel" aria-label="Web Sources" className="min-w-0">
              <div className="relative z-30 border-b border-edge p-4 sm:p-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-muted">Select web server</div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative min-w-0 flex-1">
                    <button type="button" aria-expanded={menu} aria-controls="mutiny-web-host-menu" onClick={() => setMenu((value) => !value)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-edge bg-elevated px-4 py-3 text-left hover:border-accent/60">
                      <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink">{sourceChoice === "Automatic" ? `Automatic · ${provider}` : provider}</span>
                        <span className="block truncate text-[11px] text-ink-subtle">{current.configured ? "No URL setup needed" : "No verified embed URL"}</span></span>
                      <ChevronDown className="shrink-0 text-ink-muted" size={16} aria-hidden="true"/>
                    </button>
                    {menu && (
                      <div id="mutiny-web-host-menu" className="absolute inset-x-0 top-full z-[100] mt-1 overflow-hidden rounded-xl border border-edge bg-elevated shadow-2xl">
                        <label className="flex items-center gap-2 px-3 pt-3 text-xs text-ink-muted"><input type="checkbox" checked={showUnconfigured} onChange={event => setShowUnconfigured(event.target.checked)} />Show entries without a verified URL</label>
                        <div className="p-2"><input autoFocus type="search" aria-label="Search web providers" placeholder="Search preconfigured hosts..." value={search} onChange={(e) => setSearch(e.target.value)}
                          className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent"/></div>
                        <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Web host options">
                          <button type="button" role="option" aria-selected={sourceChoice === "Automatic"} onClick={() => { setPlaying(false); setCompatibilityConsent(null); setSourceChoice("Automatic"); setExcluded([]); setMenu(false); }} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-accent hover:bg-surface">Automatic · choose a ready source</button>
                          {filteredHosts.length === 0 && <p className="px-4 py-3 text-sm text-ink-subtle">No providers match your search.</p>}
                          {filteredHosts.map((name) => {
                            const value = embedFor(name, media, templates);
                            return <button type="button" role="option" aria-selected={sourceChoice === name} key={name} onClick={() => selectProvider(name)}
                              className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-surface ${provider === name ? "text-accent" : "text-ink"}`}>
                              <span>{name}</span><span className="text-[10px] text-ink-subtle">{value.configured ? "URL mapped" : "Setup"}</span>
                            </button>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-edge px-4 py-3 text-xs font-semibold hover:bg-elevated" onClick={() => { setTemplateDraft(templates[provider] ?? ""); setEditing(true); setPlaying(false); }}>
                    <SlidersHorizontal size={15} aria-hidden="true"/> Advanced URL settings
                  </button>
                </div>
                {provider === "VidLink" && hasAnimeIdentity && isSeries && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-ink-muted">Anime audio preference:</span>
                    <button type="button" aria-pressed={animeAudio === "dub"} onClick={() => setAnimeAudio("dub")}
                      className={`rounded-lg border px-3 py-1.5 ${animeAudio === "dub" ? "border-accent text-accent" : "border-edge text-ink-muted"}`}>English dub</button>
                    <button type="button" aria-pressed={animeAudio === "sub"} onClick={() => setAnimeAudio("sub")}
                      className={`rounded-lg border px-3 py-1.5 ${animeAudio === "sub" ? "border-accent text-accent" : "border-edge text-ink-muted"}`}>Subtitled</button>
                    <span className="text-ink-subtle">Fallback is enabled when the preferred audio is unavailable.</span>
                  </div>
                )}
                {current.url && (
                  <label className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-ink-muted">
                    <input type="checkbox" checked={allowUnrestrictedEmbed} onChange={(event) => { setPlaying(false); setCompatibilityConsent(event.target.checked ? webCompatibilityKey(provider, current.url) : null); }} />
                    Compatibility mode for {provider}: use a normal iframe if this host rejects a sandbox. The host can run scripts without iframe sandbox restrictions; I understand the risk.
                  </label>
                )}
                {editing && <div className="mt-3 rounded-xl border border-edge bg-canvas p-3">
                  <label htmlFor="mutiny-embed-template" className="block text-xs font-semibold">Embed URL template (HTTPS)</label>
                  <input id="mutiny-embed-template" type="text" spellCheck={false} placeholder="https://example.com/embed/movie/{imdb}" value={templateDraft} onChange={(e) => setTemplateDraft(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-edge bg-elevated p-3 font-mono text-xs outline-none focus:border-accent"/>
                  <p className="mt-2 text-[11px] text-ink-muted">Variables: {"{imdb}"}, {"{tmdb}"}, {"{id}"}, {"{season}"}, {"{episode}"}, {"{type}"}. Blank and Save restores the documented default, if one exists.</p>
                  <div className="mt-3 flex gap-2"><button type="button" onClick={saveTemplate} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-canvas">Save</button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-edge px-3 py-2 text-xs">Cancel</button></div>
                </div>}
              </div>

              <div className="relative aspect-video min-h-[240px] w-full rounded-b-2xl bg-black sm:min-h-[320px]">
                {!playing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_center,rgba(31,19,54,0.38),#050508_70%)]">
                    <div className="absolute left-4 top-4 rounded-lg border border-edge bg-black/70 px-3 py-2 text-[10px] font-bold text-ink-muted">WEB SOURCE · {provider}</div>
                    <button type="button" aria-label={`Play ${meta.name} using ${provider}`} onClick={() => {
                        if (!current.url) setError(current.reason);
                        else if (!current.sandbox && !allowUnrestrictedEmbed) setError("This provider requires compatibility mode. Enable compatibility mode for this provider or choose another provider.");
                        else { setPlaying(true); setError(""); }
                      }}
                      className="flex size-20 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_0_0_8px_rgba(52,235,171,.10)] transition-transform hover:scale-105 active:scale-95">
                      <Play fill="currentColor" size={31} aria-hidden="true"/>
                    </button>
                    <span className="text-center text-[11px] font-bold uppercase tracking-widest text-ink-subtle">{current.url ? "Source selected · ready to play" : "Source needs setup or a matching ID"}</span>
                  </div>
                ) : current.url ? (
                  <iframe key={iframeUrl ?? current.url} title={`${provider} player for ${meta.name}`} src={iframeUrl ?? current.url}
                    className="absolute inset-0 size-full border-0 bg-black" allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
                    sandbox={webIframeSandbox(compatibilityConsent, provider, current.url)}/>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge p-4 text-xs sm:px-5">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{playing ? `Embedded player opened: ${provider}` : `${provider} selected`}</div>
                  <div className="mt-1 max-w-2xl text-ink-muted">{current.reason || (allowUnrestrictedEmbed ? "Compatibility mode is enabled for this host. Availability and playback depend on the provider." : "Iframe sandbox enabled. If the host rejects it, enable compatibility mode for this provider.")}</div>
                </div>
                {current.url && <button type="button" onClick={() => {
                  setPlaying(false);
                  openUrl(iframeUrl ?? current.url!);
                }} className="rounded-lg border border-edge bg-elevated px-3 py-2 text-ink">Open in browser</button>}
                <button type="button" onClick={() => {
                  const nextExcluded = [...excluded, provider];
                  const next = readyWebSources(media, templates, nextExcluded);
                  if (!next.length) { setError("No more preconfigured sources match this title. Try Addon Providers."); return; }
                  setExcluded(nextExcluded); setSourceChoice("Automatic"); setPlaying(false); setError("");
                }} className="rounded-lg border border-edge bg-elevated px-3 py-2 text-ink">Try next source</button>
                {playing && <button type="button" onClick={() => setPlaying(false)} className="flex items-center gap-2 rounded-lg border border-edge bg-elevated px-3 py-2 text-ink"><X size={14} aria-hidden="true"/> Stop / change server</button>}
              </div>
              {error && <p role="alert" className="border-t border-edge px-5 py-3 text-sm text-danger">{error}</p>}
            </div>
          ) : (
            <div role="tabpanel" aria-label="Addon Providers" className="min-w-0">
              <div className="border-b border-edge px-5 py-3 text-xs text-ink-muted">
                Choose a result from your configured add-ons. Mutiny uses the existing native playback pipeline, ranking, filters and playback history.
              </div>
              <div className="relative h-[min(70vh,840px)] min-h-[420px] overflow-hidden bg-canvas">{addonPicker}</div>
            </div>
          )}
        </section>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2"><Globe2 size={14} className="text-accent"/> Priority: Web → Addons</span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2">{allowUnrestrictedEmbed ? <Globe2 size={14} className="text-accent"/> : <ShieldCheck size={14} className="text-accent"/>} {allowUnrestrictedEmbed ? "Provider compatibility mode" : "Iframe sandbox enabled"}</span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2">Preconfigured sources · no URL setup</span>
        </div>
      </div>
    </main>
  );
}
