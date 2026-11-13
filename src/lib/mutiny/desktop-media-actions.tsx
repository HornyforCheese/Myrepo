import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { FileVideo, Magnet, X } from "lucide-react";
import { emitOpenLocalFile } from "@/lib/deep-link";
import { parseMagnet } from "@/lib/torrent/magnet";
import { chooseLocalVideo } from "./local-video";

const MagnetCard = lazy(() => import("@/components/search/magnet-card").then(module => ({ default: module.MagnetCard })));
const actionStyle = "mutiny-quick-action";

export function DesktopMediaActions() {
  const [picking, setPicking] = useState(false);
  const [localError, setLocalError] = useState("");
  const [magnetOpen, setMagnetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [magnetError, setMagnetError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (magnetOpen && !el.open) { el.showModal(); input.current?.focus(); }
    else if (!magnetOpen && el.open) el.close();
  }, [magnetOpen]);

  async function openLocal() {
    if (picking) return;
    setPicking(true); setLocalError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      await chooseLocalVideo(options => open(options), path => {
        if (mounted.current) emitOpenLocalFile(path);
      });
    } catch {
      if (mounted.current) setLocalError("Could not open the video file picker. Please try again.");
    } finally { if (mounted.current) setPicking(false); }
  }
  function closeMagnet() {
    setMagnetOpen(false); setSubmitted(""); setDraft(""); setMagnetError("");
    requestAnimationFrame(() => launcher.current?.focus());
  }
  function submitMagnet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = draft.trim();
    if (!parseMagnet(raw)) {
      setSubmitted(""); setMagnetError("Enter a valid magnet link or torrent infohash."); return;
    }
    setMagnetError(""); setSubmitted(raw);
  }
  return <>
    <button type="button" className={actionStyle} disabled={picking} onClick={() => void openLocal()}>
      <FileVideo size={16} aria-hidden="true" /> {picking ? "Opening…" : "Local video"}
    </button>
    <button ref={launcher} type="button" className={actionStyle} aria-haspopup="dialog" aria-expanded={magnetOpen} onClick={() => setMagnetOpen(true)}>
      <Magnet size={16} aria-hidden="true" /> Stream magnet link
    </button>
    {localError && <p role="alert" className="basis-full text-right text-xs text-danger">{localError}</p>}
    <dialog ref={dialog} aria-labelledby="mutiny-magnet-title" onCancel={event => { event.preventDefault(); closeMagnet(); }} className="m-auto w-[min(680px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-2xl border border-edge bg-canvas p-6 text-ink shadow-2xl backdrop:bg-black/70">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="mutiny-magnet-title" className="font-display text-xl font-bold">Stream magnet link</h2>
        <button type="button" aria-label="Close magnet dialog" onClick={closeMagnet} className="rounded-lg border border-edge p-2"><X size={18} aria-hidden="true" /></button>
      </div>
      <p className="mb-4 text-sm text-ink-muted">Paste a magnet link or infohash. If the torrent contains multiple videos, choose which file to play.</p>
      <form onSubmit={submitMagnet} className="space-y-3">
        <label htmlFor="mutiny-magnet-input" className="block text-sm font-semibold">Magnet link or infohash</label>
        <textarea ref={input} id="mutiny-magnet-input" rows={3} value={draft} autoComplete="off" spellCheck={false} placeholder="magnet:?xt=urn:btih:…" onChange={event => { setDraft(event.target.value); setSubmitted(""); setMagnetError(""); }} className="w-full resize-y rounded-xl border border-edge bg-elevated p-3 text-sm outline-none focus:border-accent" />
        {magnetError && <p role="alert" className="text-sm text-danger">{magnetError}</p>}
        <button type="submit" disabled={!draft.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-canvas disabled:opacity-50">Load magnet</button>
      </form>
      {submitted && <div className="mt-5"><Suspense fallback={<p className="text-sm text-ink-muted">Loading torrent tools…</p>}><MagnetCard key={submitted} raw={submitted} onClose={closeMagnet} /></Suspense></div>}
    </dialog>
  </>;
}
