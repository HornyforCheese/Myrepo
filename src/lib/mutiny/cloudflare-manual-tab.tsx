import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

type PendingChallenge = {
  host: string;
  url: string;
  detectedAt: number;
};

function safeChallengeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && host.includes(".") && host !== "localhost" && !host.endsWith(".local")
      && !host.endsWith(".internal") && !host.startsWith("[") && !/^(?:\d+\.){3}\d+$/.test(host);
  } catch { return false; }
}

export function CloudflareManualTab() {
  const [pending, setPending] = useState<PendingChallenge[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try { setPending(await invoke<PendingChallenge[]>("cf_pending_challenges")); }
    catch (error) { setMessage(`Could not read pending challenges: ${String(error)}`); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const solve = async (challengeUrl: string) => {
    if (!safeChallengeUrl(challengeUrl)) {
      setMessage("Enter a public HTTPS provider address. Local, IP-address and credential-bearing URLs are not allowed.");
      return;
    }
    setBusy(challengeUrl); setMessage("A verification window is opening. Complete the provider check, then return here.");
    try {
      const host = await invoke<string>("cf_solve_manual", { url: challengeUrl });
      setMessage(`Verification completed for ${host}. Retry that provider or stream.`);
      setUrl("");
      await refresh();
    } catch (error) {
      setMessage(`Verification was not completed: ${String(error)}`);
    } finally { setBusy(null); }
  };

  const dismiss = async (challengeUrl: string) => {
    await invoke("cf_dismiss_challenge", { url: challengeUrl });
    await refresh();
  };

  return (
    <section className="flex flex-col gap-6" aria-label="Manual Cloudflare verification">
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-accent" size={22} aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Manual Cloudflare verification</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-muted">Mutiny Media never opens verification windows automatically. When a provider reports a challenge, start it here only when you are ready. Verification applies to that provider host for a limited time.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input value={url} onChange={(event) => setUrl(event.target.value)} type="url" spellCheck={false}
            placeholder="https://provider.example/…" aria-label="Provider challenge URL"
            className="min-w-0 flex-1 rounded-xl border border-edge bg-elevated px-4 py-3 text-sm text-ink outline-none focus:border-accent" />
          <button type="button" disabled={busy !== null || !safeChallengeUrl(url)} onClick={() => void solve(url)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-canvas disabled:cursor-not-allowed disabled:opacity-40">
            <ExternalLink size={16} aria-hidden="true" /> Start verification
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-ink-muted" role="status">{message}</p>}
      </div>

      <div className="rounded-2xl border border-edge bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-base font-bold text-ink">Pending provider checks</h2><p className="mt-1 text-xs text-ink-muted">Challenges detected during provider, source or stream requests appear here.</p></div>
          <button type="button" onClick={() => void refresh()} className="rounded-lg border border-edge p-2 text-ink-muted hover:text-ink" aria-label="Refresh pending challenges"><RefreshCw size={16} /></button>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {pending.length === 0 && <div className="rounded-xl border border-dashed border-edge px-4 py-5 text-center text-sm text-ink-muted">No provider is waiting for verification.</div>}
          {pending.map((challenge) => <div key={challenge.url} className="flex flex-col gap-3 rounded-xl border border-edge bg-elevated p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{challenge.host}</div><div className="mt-1 truncate text-xs text-ink-subtle" title={challenge.url}>{challenge.url}</div></div>
            <button type="button" disabled={busy !== null} onClick={() => void solve(challenge.url)} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-canvas disabled:opacity-40">Verify manually</button>
            <button type="button" onClick={() => void dismiss(challenge.url)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-edge px-3 py-2 text-xs text-ink-muted"><Trash2 size={13} /> Dismiss</button>
          </div>)}
        </div>
      </div>
    </section>
  );
}
