#!/usr/bin/env node
/** Keep the archived UI overlay on the pinned 1.0.1 native ABI.
 * The overlay's lib.rs is from another revision (native_module, optional music)
 * while Cargo.toml, mpv, capstan and the frontend bridge remain at 1.0.1.
 * Restore the actual upstream entry point, retaining its original license and
 * all working commands, then register the overlay's real Lite Browser command.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(process.argv[2] ?? 'windows-src');
const revision = 'd862943d27ca10beca26d0d53e7bf6be66688968';
const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
if (head !== revision) throw Error('Native repair requires the exact pinned Windows 1.0.1 checkout');
let source = execFileSync('git', ['-C', root, 'show', `${revision}:src-tauri/src/lib.rs`], {encoding:'utf8',maxBuffer:4*1024*1024}).replace(/\r\n/g,'\n');
for (const [before, after] of [
 ['mod browser_args;', '#[cfg(any(target_os = "windows", test))]\nmod lite_browser_policy;\nmod browser_args;'],
 ['            browser::browser_open,', '            browser::browser_open,\n            browser::lite_browser_open,'],
 ['<title>Harbor</title>', '<title>Mutiny Media</title>'],
]) {
 if (source.split(before).length !== 2) throw Error(`Pinned native anchor changed: ${before}`);
 source = source.replace(before, after);
}
const file = path.join(root,'src-tauri/src/lib.rs');
const backup=path.join(root,'.mutiny-1.0.1-contract-backup/src-tauri/src/lib.rs');
if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(file,backup)}
fs.writeFileSync(file,source);
// Fail early on missing root modules rather than waiting for native compilation.
for(const match of source.matchAll(/^mod (\w+);$/gm)) {
 const name=match[1],base=path.join(root,'src-tauri/src',name);
 if(!fs.existsSync(base+'.rs')&&!fs.existsSync(path.join(base,'mod.rs'))) throw Error(`Missing native module: ${name}`);
}
for(const name of ['capstan_ping','capstan_search','capstan_load','capstan_load_links','capstan_install']) {
 if(!source.includes(`capstan::${name},`)) throw Error(`Missing CloudStream command: ${name}`);
}
console.log('Restored coherent pinned 1.0.1 native entry point, CloudStream commands, music/games and Lite Browser.');
