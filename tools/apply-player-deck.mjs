#!/usr/bin/env node
/** Transactional Windows source integration: no binary patching, no installer replacement. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
const target = targetIndex >= 0 ? args[targetIndex + 1] : null;
const verifyOnly = args.includes("--verify");
const restore = args.includes("--rollback");
const kitMarker = "// MUTINY_SOURCE_DECK_V2";
if (!target || !fs.existsSync(target)) {
  console.error("Usage: node tools/apply-player-deck.mjs --target \"C:\\path\\to\\HarborSource\" [--verify|--rollback]");
  process.exit(2);
}
const source = path.resolve(target);
const failEarly = (message) => { console.error(`FAILED: ${message}`); process.exit(1); };
// Never apply this Windows-only patch to an Android project or to a later Harbor release.
const packagePath = path.join(source, "package.json");
if (!fs.existsSync(packagePath)) failEarly(`Missing package.json: ${packagePath}. Not the editable Windows project.`);
let packageInfo;
try { packageInfo = JSON.parse(fs.readFileSync(packagePath, "utf8")); }
catch { failEarly("Invalid Windows package.json. Source left unchanged."); }
if (packageInfo.name !== "mutiny-media" || packageInfo.version !== "1.0.1") {
  failEarly(`Expected Mutiny Media Windows 1.0.1; found ${packageInfo.name ?? "unknown"} ${packageInfo.version ?? "unknown"}. No files changed.`);
}
const tauriPath = path.join(source, "src-tauri", "tauri.conf.json");
if (!fs.existsSync(tauriPath)) {
  failEarly("Missing src-tauri/tauri.conf.json. Android or incomplete source checkout rejected.");
}
let tauri;
try { tauri = JSON.parse(fs.readFileSync(tauriPath, "utf8")); }
catch { failEarly("Invalid Windows Tauri manifest. Source unchanged."); }
if (tauri.version !== "1.0.1" || tauri.productName !== "Mutiny Media" || tauri.identifier !== "app.mutiny.media") {
  failEarly("Expected Mutiny Media 1.0.1 Windows Tauri productName, version and identifier. Source unchanged.");
}
const original = path.join(source, "src", "views", "play-picker.tsx");
const modulePaths = [
  "src/lib/mutiny/source-deck-catalog.ts",
  "src/lib/mutiny/source-deck.tsx",
];
const logoPath = "public/mutiny-mark.png";
const backupRoot = path.join(path.dirname(source), "MutinyMedia-player-backups");
const manifestPath = path.join(backupRoot, "player-deck-last.json");
const checksum = (data) => crypto.createHash("sha256").update(data).digest("hex");
const read = (p) => fs.readFileSync(p, "utf8");
const writeAtomic = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.mutiny-tmp-${process.pid}`;
  try { fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); }
  finally { if (fs.existsSync(tmp)) fs.rmSync(tmp); }
};
const fail = (message) => { console.error(`FAILED: ${message}`); process.exit(1); };
const expectedWiring = [
  kitMarker,
  "function AddonPlayPicker({",
  "export function PlayPicker(props: Parameters<typeof AddonPlayPicker>[0])",
  "<MutinySourceDeck",
  "mutiny-addon-stream-select",
];
const verify = () => {
  if (!fs.existsSync(original)) throw new Error("Windows play-picker.tsx not found. This is not a HarborSource checkout.");
  const text = read(original);
  for (const required of expectedWiring) if (!text.includes(required)) throw new Error(`Missing player integration: ${required}`);
  for (const rel of modulePaths) {
    const actual = path.join(source, rel);
    const staged = path.join(kit, rel);
    if (!fs.existsSync(actual)) throw new Error(`Missing ${rel}`);
    if (checksum(fs.readFileSync(actual)) !== checksum(fs.readFileSync(staged))) throw new Error(`Modified or outdated installed module: ${rel}`);
  }
  if (!fs.existsSync(path.join(source, logoPath))) throw new Error("Mutiny Media logo asset is missing: " + logoPath);
  console.log("PASS: Mutiny Media source deck v2 installed, the original addon picker is preserved.");
};
if (verifyOnly) { try { verify(); process.exit(0); } catch(error) { fail(String(error)); } }
if (restore) {
  if (!fs.existsSync(manifestPath)) fail(`No recorded backup manifest: ${manifestPath}`);
  const m = JSON.parse(read(manifestPath));
  if (m.source !== source) fail(`Backup belongs to a different checkout: ${m.source}`);
  // Validate EVERY destination and backup before changing a single file.
  // A partially completed rollback could destroy a user's installation.
  for (const item of m.items) {
    const dst = path.join(source, item.relativePath);
    if (!fs.existsSync(dst) || checksum(fs.readFileSync(dst)) !== item.installedHash) {
      fail(`Refusing rollback; a source file changed since application: ${item.relativePath}`);
    }
    if (item.originalPath && !fs.existsSync(item.originalPath)) {
      fail(`Refusing rollback; backup file missing: ${item.originalPath}`);
    }
  }
  for (const item of m.items.slice().reverse()) {
    const dst = path.join(source, item.relativePath);
    if (item.originalPath) writeAtomic(dst, fs.readFileSync(item.originalPath));
    else fs.rmSync(dst);
  }
  fs.rmSync(manifestPath);
  console.log("Rollback completed. Original Windows picker restored.");
  process.exit(0);
}
if (!fs.existsSync(original)) fail("Missing src/views/play-picker.tsx. Provide the actual Windows source folder, not the installed EXE directory.");
const old = read(original);
if (old.includes(kitMarker)) { try { verify(); console.log("Already installed. Nothing overwritten."); process.exit(0); } catch(error) { fail(String(error)); } }
if (old.includes("// MUTINY_SOURCE_DECK_V1")) {
  fail("Previous source deck V1 is installed. Roll it back using its original 04-ROLLBACK.cmd before applying this V2 kit. No files changed.");
}
const anchor = /export\s+function\s+PlayPicker\s*\(\s*\{/g;
const matches = [...old.matchAll(anchor)];
if (matches.length !== 1) fail(`Integration anchor mismatch: expected exactly one exported PlayPicker, found ${matches.length}. Source unchanged.`);
if (old.includes("function AddonPlayPicker({")) fail("AddonPlayPicker already exists. Source unchanged.");
if (!/from ["'](?:@\/lib\/view|\.\.\/lib\/view)["']/.test(old)) fail("Expected Harbor navigation import missing. Source unchanged.");
const importLine = 'import { MutinySourceDeck } from "@/lib/mutiny/source-deck";\n';
// Keep the original picker while adding an actual dropdown of its available streams.
const pickerHeader = /<PickerHeader\b[\s\S]*?\/>/g;
const addonDropdown = `
        {!isDownload && displayStreams.length > 0 && (
          <div className="rounded-2xl border border-edge bg-surface px-4 py-3" data-mutiny="mutiny-addon-stream-select">
            <label htmlFor="mutiny-addon-stream-select" className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink-muted">Addon Providers · Choose stream</label>
            <select id="mutiny-addon-stream-select" defaultValue=""
              onChange={(event) => {
                const index = Number(event.currentTarget.value);
                const chosen = Number.isInteger(index) && index >= 0 ? displayStreams[index] : undefined;
                if (chosen) playManually(chosen);
              }}
              className="w-full rounded-xl border border-edge bg-elevated px-3 py-3 text-sm text-ink">
              <option value="">Select an installed addon stream…</option>
              {displayStreams.map((stream, index) => (
                <option key={stream.addonId + ':' + index} value={index}>
                  {(stream.addonName || 'Addon') + ' · ' + (stream.name || stream.title || stream.tier || 'Stream')}
                </option>
              ))}
            </select>
          </div>
        )}`;
const wrapper = `\n${kitMarker}\n// Keep downloads and changes to an already-running player on their original path.\nexport function PlayPicker(props: Parameters<typeof AddonPlayPicker>[0]) {\n  if (props.intent === "download" || props.playerActive || props.autoPlay) return <AddonPlayPicker {...props} />;\n  return <MutinySourceDeck meta={props.meta} episode={props.episode} addonPicker={<AddonPlayPicker {...props} />} />;\n}\n`;
const eol = old.includes("\r\n") ? "\r\n" : "\n";
const normalized = old.replace(/\r\n/g, "\n");
const headerMatches = [...normalized.matchAll(pickerHeader)];
if (headerMatches.length !== 1) fail(`Addon dropdown anchor mismatch: found ${headerMatches.length} PickerHeader elements. Source unchanged.`);
if (!normalized.includes("const displayStreams") || !normalized.includes("const playManually")) fail("Addon source results or playback handler changed. Source unchanged.");
let updated = importLine + normalized.replace(anchor, "function AddonPlayPicker({").replace(pickerHeader, (match) => match + addonDropdown) + wrapper;
if (eol === "\r\n") updated = updated.replace(/\n/g, "\r\n");
const writes = [
  { relativePath: "src/views/play-picker.tsx", data: updated },
  ...modulePaths.map((relativePath) => ({relativePath, data: read(path.join(kit, relativePath))})),
];
// The 1.0.1 customisation overlay normally includes this logo; stage it if absent.
// Avoid overwriting any user's newer artwork.
if (!fs.existsSync(path.join(source, logoPath))) {
  writes.push({ relativePath: logoPath, data: fs.readFileSync(path.join(kit, logoPath)) });
}
// Refuse to replace existing custom modules; these may belong to later user changes.
for (const item of writes.slice(1)) {
  const dst = path.join(source, item.relativePath);
  if (fs.existsSync(dst)) fail(`Refusing to overwrite existing module: ${item.relativePath}. Reconcile manually.`);
}
fs.mkdirSync(backupRoot, {recursive:true});
const id = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(backupRoot, `deck-${id}`);
fs.mkdirSync(backupDir, {recursive: true});
const manifest = { source, created: new Date().toISOString(), items: [] };
try {
  for (const item of writes) {
    const dst = path.join(source, item.relativePath);
    let originalPath = null;
    if (fs.existsSync(dst)) {
      originalPath = path.join(backupDir, item.relativePath);
      fs.mkdirSync(path.dirname(originalPath), {recursive:true});
      fs.copyFileSync(dst, originalPath);
    }
    // Persist rollback information before writing any new file.
    manifest.items.push({ relativePath: item.relativePath, originalPath, installedHash: checksum(Buffer.from(item.data)) });
    writeAtomic(manifestPath, JSON.stringify(manifest, null, 2));
    writeAtomic(dst, item.data);
  }
  verify();
  console.log(`Applied successfully. Backups: ${backupDir}`);
} catch (error) {
  console.error("Apply failed. Restoring previous files:", error);
  for (const item of manifest.items.slice().reverse()) {
    const dst = path.join(source, item.relativePath);
    if (item.originalPath && fs.existsSync(item.originalPath)) writeAtomic(dst, read(item.originalPath));
    else if (fs.existsSync(dst) && checksum(fs.readFileSync(dst)) === item.installedHash) fs.rmSync(dst);
  }
  fs.rmSync(manifestPath, { force:true });
  process.exit(1);
}
