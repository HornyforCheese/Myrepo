#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req = createRequire(import.meta.url);
let ts;
try { ts = req(process.env.MUTINY_TYPESCRIPT_PATH || 'typescript'); }
catch { ts = req('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
const run = (script,...args) => execFileSync(process.execPath,[path.join(root,'tools',script),...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_PATH:process.env.NODE_PATH || '/opt/nvm/versions/node/v22.16.0/lib/node_modules'}});
const base=fs.mkdtempSync(path.join(os.tmpdir(),'mutiny-brand-test-'));
const source=path.join(base,'HarborSource');
function save(rel,text){const p=path.join(source,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);return p;}
function read(rel){return fs.readFileSync(path.join(source,rel),'utf8');}
const css='button[aria-label="Harbor home"] { color: aqua; }';
save('src/index.css',css);
const code= `import React from 'react';
const keep = { tab:'harbor',storage:'harbor.settings',event:'harbor:nuvio-state-changed',css:'harbor-nav-expand',url:'https://harborcommunity.site' };
export const nav = [{label:'Harbor account',anchorTitle:'Harbor Relay',blurb:"Classic. Was Harbor's original pair.",keywords:['harbor account']}];
export function Settings(){return <div><button aria-label="Harbor home">{t('Harbor Relay')}</button><p>Open Harbor on other devices</p></div>;}
`;
const runtime = `export function startMutinyBranding(): () => void {
  const brand = (value: string) => value.replace(/\\bHarbor\\b/g, "Mutiny Media");
  const normalize = (_node: Node) => {};
  normalize(document.body);
  const obs = new MutationObserver(() => {});
  obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["title","aria-label","placeholder"]});
  return () => obs.disconnect();
}
`;
const packager = `const FILES = [ [join(APP, "target", "release", "harbor.exe"), "harbor.exe"] ];`;
const manifest={name:'Harbor Stream Blocker',short_name:'Harbor Blocker',description:'Blocks ads in Harbor',manifest_version:3,permissions:['declarativeNetRequest']};
save('package.json',JSON.stringify({name:'mutiny-media',version:'1.0.1'}));
save('src-tauri/tauri.conf.json',JSON.stringify({productName:'Mutiny Media',mainBinaryName:'MutinyMedia',version:'1.0.1',identifier:'app.mutiny.media'}));
save('src/views/settings/nav.tsx',code);
save('src/lib/mutiny/brand-runtime.ts',runtime);
save('src-tauri/src/lib.rs',`pub fn id() -> &'static str { "harbor://window-activity" }\nfn html() { let _ = b"<title>Harbor</title>"; }\n`);
save('src-tauri/resources/harbor-stream-blocker/manifest.json',JSON.stringify(manifest));
save('installer/scripts/make-payload.mjs',packager);
save('src/lib/settings/defaults.ts',`export const STORAGE_KEY='harbor.settings';`);
save('src/lib/settings/load.ts',`export function load(){ return localStorage.getItem('harbor.settings'); }`);
save('src/views/play-picker.tsx',`export function PlayPicker(){return null;}`);
save('src/components/player/transport/bitrate-meter.tsx',`export function BitrateMeter(){return null;}`);
save('src/views/settings/integrations-hub.tsx',`export const EVENTS='harbor:nuvio-state-changed';`);
const nonBrand = ['src/lib/settings/defaults.ts','src/lib/settings/load.ts','src/views/play-picker.tsx','src/components/player/transport/bitrate-meter.tsx','src/views/settings/integrations-hub.tsx'];
const before = Object.fromEntries(nonBrand.map(x=>[x,read(x)]));

console.log('PASS 1: Syntax and version safety');
assert.match(run('brand-windows-1.0.1.mjs',source,'--check'),/file\(s\) would be updated/);
const applyOut=run('brand-windows-1.0.1.mjs',source,'--apply');
assert.match(applyOut,/Backups saved to/);
const backup=applyOut.match(/Backups saved to (.+)/)?.[1]?.trim();
assert.ok(backup&&fs.existsSync(path.join(backup,'branding-backup-manifest.json')));
const afterCode=read('src/views/settings/nav.tsx');
const parsed=ts.createSourceFile('nav.tsx',afterCode,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(x=>x.messageText).join('; '));
assert.match(afterCode,/label:'Mutiny Media account'/);
assert.match(afterCode,/anchorTitle:'Public relay'/);
assert.match(afterCode,/aria-label="Mutiny Media home"/);
assert.match(read('src/index.css'),/Mutiny Media home/);
assert.match(read('src/index.css'),/Harbor home/);
assert.match(afterCode,/Open Mutiny Media on other devices/);
assert.match(afterCode,/\.replace\(/); // Retains old translation key and converts final display string
const brandedRuntime = read('src/lib/mutiny/brand-runtime.ts');
assert.match(brandedRuntime,/normalize\(document\.head\)/);
assert.match(brandedRuntime,/obs\.observe\(document\.head/);
assert.equal(ts.createSourceFile('brand-runtime.ts',brandedRuntime,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS).parseDiagnostics.length,0);
assert.match(read('src-tauri/src/lib.rs'),/<title>Mutiny Media<\/title>/);
assert.equal(JSON.parse(read('src-tauri/tauri.conf.json')).version,'1.0.1');
console.log('PASS 1: TypeScript parsed, app version pinned, Rust and runtime window titles branded.');

console.log('PASS 2: Settings / provider / playback / extension compatibility guards');
for(const p of nonBrand)assert.equal(read(p),before[p],`${p} must not change`);
assert.match(afterCode,/tab:'harbor'/);
assert.match(afterCode,/harbor\.settings/);
assert.match(afterCode,/harbor:nuvio-state-changed/);
assert.match(read('src-tauri/src/lib.rs'),/harbor:\/\/window-activity/);
assert.match(read('installer/scripts/make-payload.mjs'),/join\(APP, "target", "release", "MutinyMedia.exe"\)/);
assert.match(read('installer/scripts/make-payload.mjs'),/"harbor\.exe"/); // Legacy custom-installer ABI
const ext = JSON.parse(read('src-tauri/resources/harbor-stream-blocker/manifest.json'));
assert.equal(ext.name,'Mutiny Media Stream Blocker');
assert.equal(ext.short_name,'Mutiny Media Blocker');
assert.deepEqual(ext.permissions,manifest.permissions);
assert.equal(ext.manifest_version,3);
console.log('PASS 2: Relevant source contracts unchanged; extension manifest identity/display separated.');

console.log('PASS 3: Residual display scan / idempotency / rollback');
for(const m of afterCode.matchAll(/(?:label|anchorTitle|blurb):\s*(?:"([^"]*)"|'([^']*)')/g)) assert.doesNotMatch(m[1]??m[2],/\bHarbor\b/i);
assert.doesNotMatch(read('src-tauri/src/lib.rs'),/<title>Harbor<\/title>/);
assert.doesNotMatch(ext.name,/harbor/i);
assert.match(run('brand-windows-1.0.1.mjs',source,'--apply'),/0 file\(s\) selected/);
run('rollback-branding.mjs',backup);
assert.equal(read('src/views/settings/nav.tsx'),code);
assert.equal(read('installer/scripts/make-payload.mjs'),packager);
assert.equal(read('src/index.css'),css);
assert.equal(read('src/lib/mutiny/brand-runtime.ts'),runtime);
assert.deepEqual(JSON.parse(read('src-tauri/resources/harbor-stream-blocker/manifest.json')),manifest);
assert.match(read('src-tauri/src/lib.rs'),/<title>Harbor<\/title>/);
console.log('PASS 3: Visible branding removed from fixture; idempotent and exact rollback.');

fs.writeFileSync(path.join(source,'src-tauri/tauri.conf.json'),JSON.stringify({productName:'Mutiny Media',mainBinaryName:'MutinyMedia',version:'1.0.3'}));
assert.throws(()=>run('brand-windows-1.0.1.mjs',source,'--apply'));
assert.equal(read('src/views/settings/nav.tsx'),code);
fs.rmSync(base,{recursive:true,force:true});
console.log('ALL THREE STATIC VALIDATION PASSES COMPLETED. Live Windows playback/addon runtime NOT tested.');
