#!/usr/bin/env node
/** Complete missing 1.0.1 overlay contracts using existing stores and public API adapters. */
import fs from 'node:fs';
import { sameSourceContent } from './source-content-compat.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrateThemeBranding } from './integrate-theme-branding.mjs';
import { integrateAiServices } from './integrate-ai-services.mjs';
import { brandBigPictureIntro, brandBigPictureBoot } from './big-picture-branding-compat.mjs';
const root = path.resolve(process.argv[2] ?? 'windows-src');
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
if (pkg.name !== 'mutiny-media' || pkg.version !== '1.0.1' || config.identifier !== 'app.mutiny.media') throw Error('Expected customized Windows 1.0.1');
const writes = new Map();
for (const [relative, rewrite] of [
  ['src/views/big-picture/bp-intro.tsx', brandBigPictureIntro],
  ['index-tv.html', brandBigPictureBoot],
]) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const after = rewrite(before);
  if (after !== before) writes.set(file, after);
}

function patch(relative, marker, edits) {
  const file = path.join(root, relative);
  const text = (writes.get(file) ?? fs.readFileSync(file, 'utf8')).toString().replace(/\r\n/g, '\n');
  if (text.includes(marker)) return;
  let next = text;
  for (const [before, after] of edits) {
    if (next.split(before).length !== 2) throw Error(`Unexpected 1.0.1 source anchor in ${relative}: ${before.slice(0, 80)}`);
    next = next.replace(before, after);
  }
  writes.set(file, next);
}
patch('src/lib/settings/types.ts', 'aiWebSource: "jina" | "keenable";', [
  ['  aiWebSearch: boolean;', '  aiWebSearch: boolean;\n  aiWebSource: "jina" | "keenable";\n  keenableKey: string;'],
  ['  classicCatalogSource: "all" | "stremio" | "nuvio";', '  classicCatalogSource: "all" | "stremio" | "nuvio";\n  nuvioAddonMode: "separate" | "combined";'],
]);
patch('src/lib/auth.tsx', 'export function readPrimaryStremioSession()', [[
  'export function readActiveStremioAuthKey()',
  `export function readPrimaryStremioSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem("harbor.profiles.v1") || "{}");
    const profiles: Profile[] = Array.isArray(saved.profiles) ? saved.profiles : [];
    const primary = profiles.find(profile => profile.isPrimary) ?? null;
    const id = stremioSourceProfileId(primary, profiles);
    return id ? readProfileSession(id) : null;
  } catch { return null; }
}

export function readActiveStremioAuthKey()`,
]]);
patch('src/lib/mutiny/desktop-actions.tsx', 'from "@/lib/mutiny/live-web"', [['from "@/lib/live-web"', 'from "@/lib/mutiny/live-web"']]);
patch('src/lib/mutiny/desktop-actions.tsx', 'import { DesktopMediaActions }', [
  ['import { WebSources } from "./web-sources";', 'import { WebSources } from "./web-sources";\nimport { DesktopMediaActions } from "./desktop-media-actions";'],
  ['          <WebSources />', '          <WebSources />\n          <DesktopMediaActions />'],
  ['fixed bottom-4 end-4 z-50 flex flex-wrap', 'fixed bottom-4 end-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap'],
]);
patch('src/chrome/nav-items.tsx', '// Mutiny: keep Movies, Shows and Anime adjacent.', [[
  `  {
    id: "kids",
    label: "nav.kids",
    render: (active) => (
      <Popcorn size={26} strokeWidth={2.2} className={active ? "" : "opacity-70"} />
    ),
    view: "kids",
  },
  {
    id: "anime",
    label: "nav.anime",
    render: (active, hovered) => (
      <NavLottie data={lotAnime} hovered={hovered} fallback={<AnimeIcon active={active} />} />
    ),
    view: "anime",
    parentalKey: "anime",
  },`,
  `  // Mutiny: keep Movies, Shows and Anime adjacent.
  {
    id: "anime",
    label: "nav.anime",
    render: (active, hovered) => (
      <NavLottie data={lotAnime} hovered={hovered} fallback={<AnimeIcon active={active} />} />
    ),
    view: "anime",
    parentalKey: "anime",
  },
  {
    id: "kids",
    label: "nav.kids",
    render: (active) => (
      <Popcorn size={26} strokeWidth={2.2} className={active ? "" : "opacity-70"} />
    ),
    view: "kids",
  },`,
]]);

patch('src/views/big-picture/bp-top-bar.tsx', '// Mutiny: Movies, Shows and Anime remain adjacent.', [[
  `  {
    kind: "anime",
    label: "Anime",
    icon: (a) => <AnimeIcon active={a} />,
    hiddenByAnime: true,
    parentalKey: "anime",
  },
  { kind: "shows", label: "Shows", icon: (a) => <TvIcon active={a} />, parentalKey: "shows" },
  {
    kind: "movies",
    label: "Movies",
    icon: (a) => <MoviesIcon active={a} />,
    parentalKey: "movies",
  },`,
  `  // Mutiny: Movies, Shows and Anime remain adjacent.
  {
    kind: "movies",
    label: "Movies",
    icon: (a) => <MoviesIcon active={a} />,
    parentalKey: "movies",
  },
  { kind: "shows", label: "Shows", icon: (a) => <TvIcon active={a} />, parentalKey: "shows" },
  {
    kind: "anime",
    label: "Anime",
    icon: (a) => <AnimeIcon active={a} />,
    hiddenByAnime: true,
    parentalKey: "anime",
  },`,
]]);

patch('src-tauri/src/browser.rs', '// Remote add-on pages never open verification popups automatically.', [[
  '                .initialization_script(&init_script);',
  `                .initialization_script(&init_script)
                // Remote add-on pages never open verification popups automatically.
                // A user must follow an explicit in-app/browser action instead.
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny);`,
]]);

patch('src-tauri/src/cf_solver.rs', '// MUTINY_MANUAL_CF_COMMANDS', [
  ['use std::time::{Duration, Instant};', 'use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};'],
  [`pub fn cf_invalidate(host: &str) {
    cf_cache().lock().unwrap().remove(host);
}`,
  `pub fn cf_invalidate(host: &str) {
    cf_cache().lock().unwrap().remove(host);
}

// MUTINY_MANUAL_CF_COMMANDS
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingChallenge {
    host: String,
    url: String,
    detected_at: u64,
}

fn pending_challenges() -> &'static Mutex<HashMap<String, PendingChallenge>> {
    static PENDING_CHALLENGES: OnceLock<Mutex<HashMap<String, PendingChallenge>>> = OnceLock::new();
    PENDING_CHALLENGES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn cf_note_challenge(url: &str) {
    let Ok(parsed) = Url::parse(url) else { return; };
    let Some(host) = parsed.host_str().map(str::to_ascii_lowercase) else { return; };
    let detected_at = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    pending_challenges().lock().unwrap().insert(host.clone(), PendingChallenge {
        host, url: url.to_string(), detected_at,
    });
}

#[tauri::command]
pub fn cf_pending_challenges() -> Vec<PendingChallenge> {
    let mut values: Vec<_> = pending_challenges().lock().unwrap().values().cloned().collect();
    values.sort_by(|a, b| b.detected_at.cmp(&a.detected_at));
    values
}

#[tauri::command]
pub fn cf_dismiss_challenge(url: String) -> Result<(), String> {
    let host = host_of(&url).ok_or_else(|| "challenge URL has no host".to_string())?;
    pending_challenges().lock().unwrap().remove(&host.to_ascii_lowercase());
    Ok(())
}

fn validate_manual_url(url: &str) -> Result<String, String> {
    let parsed = Url::parse(url).map_err(|_| "enter a valid HTTPS provider URL".to_string())?;
    if parsed.scheme() != "https" || !parsed.username().is_empty() || parsed.password().is_some() || parsed.port().is_some() {
        return Err("only public HTTPS provider URLs without credentials or custom ports are allowed".into());
    }
    let host = parsed.host_str().ok_or_else(|| "challenge URL has no host".to_string())?.to_ascii_lowercase();
    if host == "localhost" || host.ends_with(".local") || host.ends_with(".internal") || host.parse::<std::net::IpAddr>().is_ok() || !host.contains('.') {
        return Err("local and IP-address provider URLs are not allowed".into());
    }
    Ok(host)
}

#[tauri::command]
pub async fn cf_solve_manual(app: AppHandle, url: String) -> Result<String, String> {
    let host = validate_manual_url(&url)?;
    cf_fetch(app, url).await?;
    if cf_cached(&host).is_none() { return Err("The page loaded but no Cloudflare clearance was received. Retry verification or use another provider.".into()); }
    pending_challenges().lock().unwrap().remove(&host);
    Ok(host)
}`],
]);

patch('src-tauri/src/http_fetch.rs', '// Mutiny records Cloudflare challenges; only the settings action may open the solver.', [
  [`            eprintln!("[cf] challenge detected ({}) for {}", status, args.url);
            if let Ok(solved) = crate::cf_solver::cf_fetch(app, args.url.clone()).await {
                return Ok(HarborFetchResponse {
                    status: 200,
                    ok: true,
                    body: solved,
                    content_type: None,
                    headers: HashMap::new(),
                    url: None,
                });
            }`,
  `            // Mutiny records Cloudflare challenges; only the settings action may open the solver.
            eprintln!("[cf] challenge detected ({}) for {}; awaiting manual verification", status, args.url);
            crate::cf_solver::cf_note_challenge(&args.url);`],
]);

patch('src-tauri/src/capstan.rs', '// CloudStream challenges are queued for explicit user action in Streaming Sources settings.', [
  [`    tokio::time::timeout(CHALLENGE_CEILING, crate::cf_solver::cf_fetch(app, url))
        .await
        .map_err(|_| format!("challenge for {host} timed out"))??;
    crate::cf_solver::cf_cached(&host)
        .ok_or_else(|| format!("{host} loaded but handed back no clearance cookie"))`,
  `    // CloudStream challenges are queued for explicit user action in Streaming Sources settings.
    crate::cf_solver::cf_note_challenge(&url);
    let _ = app;
    Err(format!("manual Cloudflare verification required for {host}; open Settings > Streaming sources > Cloudflare"))`],
]);

patch('src-tauri/src/lib.rs', 'cf_solver::cf_pending_challenges,', [
  ['            cf_solver::cf_report,', `            cf_solver::cf_report,
            cf_solver::cf_pending_challenges,
            cf_solver::cf_dismiss_challenge,
            cf_solver::cf_solve_manual,`],
]);

patch('src/views/settings/streaming-sources-panel.tsx', 'import { CloudflareManualTab }', [
  ['import { HomeServersTab } from "./streaming-sources-panel/home-servers-tab";', 'import { HomeServersTab } from "./streaming-sources-panel/home-servers-tab";\nimport { CloudflareManualTab } from "@/lib/mutiny/cloudflare-manual-tab";'],
  ['type Tab = "services" | "home-servers" | "filters" | "sorting" | "picker";', 'type Tab = "services" | "home-servers" | "filters" | "sorting" | "picker" | "cloudflare";'],
  ['    { id: "picker" as const, label: t("Picker") },', '    { id: "picker" as const, label: t("Picker") },\n    { id: "cloudflare" as const, label: t("Cloudflare") },'],
  ['        {tab === "picker" && <PickerTab />}', '        {tab === "picker" && <PickerTab />}\n        {tab === "cloudflare" && <CloudflareManualTab />}'],
]);

patch('scripts/fetch-binaries.mjs', '// Windows runner compatibility: tar.exe handles ZIP archives without PowerShell/.NET overloads.', [[
  `    } else if (process.platform === "win32") {
      execFileSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", \`Expand-Archive -LiteralPath "\${archive}" -DestinationPath "\${outDir}" -Force\`],
        { stdio: "inherit" },
      );`,
  `    } else if (process.platform === "win32") {
      // Windows runner compatibility: tar.exe handles ZIP archives without PowerShell/.NET overloads.
      execFileSync("tar", ["-xf", archive, "-C", outDir], { stdio: "inherit" });`,
]]);

patch('src/components/search/ai-search/use-ai-suggest.ts', 'from "@/lib/mutiny/live-web"', [
  ['import { enrichWithContent } from "@/lib/jina-search";', 'import { liveWebContext } from "@/lib/mutiny/live-web";'],
  ['await enrichWithContent(query, settings.jinaKey)', 'await liveWebContext(query, settings)'],
]);
// Official upstream release moved the identical DLL; retain the original SHA-256 pin.
patch('scripts/fetch-libmpv.mjs', '"libmpv-windows-x64"', [[
  '"community-build-dependencies-0.9.132"', '"libmpv-windows-x64"',
]]);
patch('src/views/settings/player-panel/bandwidth-section.tsx', '// Mutiny: bandwidth controls are owned by UltraLowBandwidthCard.', [[
  'import { targetKbps } from "@/lib/mutiny/low-bandwidth";', '// Mutiny: bandwidth controls are owned by UltraLowBandwidthCard.',
]]);
patch('src/views/play-picker/use-addons.ts', 'combinedAccountAddons', [
  ['import { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";\nimport { combinedAccountAddons } from "@/lib/mutiny/combined-addons";'],
  ['      const merged: Addon[] = [];', '      const combined = await combinedAccountAddons(settings.nuvioAddonMode === "combined");\n      if (cancelled) return;\n      const merged: Addon[] = [];'],
  ['[...stremioAddons, ...installed]', '[...stremioAddons, ...installed, ...combined]'],
  ['    settings.rdKey,', '    settings.nuvioAddonMode,\n    settings.rdKey,'],
  ['`set(${settings.tbKey.slice(0, 8)}…)`', '"set"'],
]);
patch('src/lib/addons.ts', 'const combined = await combinedAccountAddons();', [
  ['export async function gatherCatalogAddons(authKey: string | null): Promise<Addon[]> {', 'export async function gatherCatalogAddons(authKey: string | null): Promise<Addon[]> {\n  const { combinedAccountAddons } = await import("@/lib/mutiny/combined-addons");\n  const combined = await combinedAccountAddons();'],
  ['return [...stremio, ...localFull.filter((a): a is Addon => a != null)];', 'return [...stremio, ...localFull.filter((a): a is Addon => a != null), ...combined]\n    .filter((addon, index, all) => all.findIndex(other => other.transportUrl === addon.transportUrl) === index);'],
]);
for (const relative of ['src/lib/mutiny/live-web.ts', 'src/lib/mutiny/combined-addons.ts', 'src/themes/midnight/midnight-preset.ts', 'src/assets/ai-logos/keenable.png', 'src/lib/mutiny/openrouter-error.ts', 'src/lib/mutiny/theme-branding.ts', 'src/lib/mutiny/ai-services.ts', 'src/lib/mutiny/use-ai-models.ts', 'src/lib/mutiny/ai-provider-settings.tsx', 'src/lib/mutiny/local-video.ts', 'src/lib/mutiny/desktop-media-actions.tsx', 'src/lib/mutiny/cloudflare-manual-tab.tsx', 'src/lib/mutiny/interface-polish.css']) {
  const file = path.join(root, relative);
  const data = fs.readFileSync(path.join(kit, relative));
  if (fs.existsSync(file) && !sameSourceContent(relative, fs.readFileSync(file), data)) throw Error(`Refusing to overwrite customized module: ${relative}`);
  writes.set(file, data);
}
// Every anchor is checked before writing. Retain originals for exact recovery.
const backup = path.join(root, '.mutiny-1.0.1-contract-backup');
for (const [file, text] of writes) {
  const relative = path.relative(root, file);
  if (fs.existsSync(file)) {
    const copy = path.join(backup, relative);
    if (!fs.existsSync(copy)) { fs.mkdirSync(path.dirname(copy), { recursive: true }); fs.copyFileSync(file, copy); }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
console.log(`Completed Windows 1.0.1 source contracts (${writes.size} files).`);

integrateAiServices(root);

// The welcome is silent; do not bundle the unused voice clip.
fs.rmSync(path.join(root, "public/mutiny-ahoy.mp3"), { force: true });

integrateThemeBranding(root);
