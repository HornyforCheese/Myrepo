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
for (const relative of ['src/lib/mutiny/live-web.ts', 'src/lib/mutiny/combined-addons.ts', 'src/themes/midnight/midnight-preset.ts', 'src/assets/ai-logos/keenable.png', 'src/lib/mutiny/openrouter-error.ts', 'src/lib/mutiny/theme-branding.ts', 'src/lib/mutiny/ai-services.ts', 'src/lib/mutiny/use-ai-models.ts', 'src/lib/mutiny/ai-provider-settings.tsx', 'src/lib/mutiny/local-video.ts', 'src/lib/mutiny/desktop-media-actions.tsx']) {
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
