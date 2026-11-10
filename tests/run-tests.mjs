import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let ts;
for (const candidate of [
  process.env.TYPESCRIPT_LIB,
  'typescript',
  path.join(process.env.MUTINY_SOURCE_ROOT || '', 'node_modules', 'typescript'),
  process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'typescript') : null,
].filter(Boolean)) {
  try { ts = require(candidate); break; } catch { /* try next installation */ }
}
if (!ts) {
  try {
    const globalRoot = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    ts = require(path.join(globalRoot, 'typescript'));
  } catch { /* handled below */ }
}
if (!ts) throw new Error('TypeScript not found. Install dependencies in the Mutiny Windows source (pnpm install).');
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = [
  'src/lib/mutiny/source-deck-catalog.ts',
  'src/lib/mutiny/source-deck.tsx',
];
for (const asset of assets) {
  const raw = fs.readFileSync(path.join(kit, asset),'utf8');
  const output = ts.transpileModule(raw, {fileName:asset, compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  const fatal = (output.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(fatal.length,0,`Syntax errors in ${asset}: ${fatal.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
}
const raw=fs.readFileSync(path.join(kit,assets[0]),'utf8');
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const catalog = { exports: {} };
new Function('module','exports',js)(catalog,catalog.exports);
const { WEB_SOURCE_NAMES, DOCUMENTED_WEB_SOURCE_NAMES, mediaIdentifiers, validEmbedTemplate, embedFor } = catalog.exports;
assert.equal(WEB_SOURCE_NAMES.length,57);
assert.equal(new Set(WEB_SOURCE_NAMES).size,57);
assert.equal(DOCUMENTED_WEB_SOURCE_NAMES.length,14);
assert.equal(new Set(DOCUMENTED_WEB_SOURCE_NAMES).size,14);
assert.ok(DOCUMENTED_WEB_SOURCE_NAMES.every((name)=>WEB_SOURCE_NAMES.includes(name)));
for(const name of DOCUMENTED_WEB_SOURCE_NAMES) {
  const film = embedFor(name,{id:'tmdb:movie:533535',tmdb:'533535',imdb:'tt12345678',type:'movie'});
  const ep = embedFor(name,{id:'tmdb:tv:1399',tmdb:'1399',imdb:'tt12345678',type:'series',season:2,episode:3});
  assert.ok(film.url?.startsWith('https://'),`No documented movie URL for ${name}`);
  assert.ok(ep.url?.startsWith('https://'),`No documented episode URL for ${name}`);
  assert.equal(film.configured,true);
  assert.equal(ep.configured,true);
}
assert.equal(embedFor('PrimeSrc',{id:'tmdb:movie:533535',type:'movie'}).url,'https://primesrc.me/embed/movie?tmdb=533535');
assert.equal(embedFor('PrimeSrc',{id:'tmdb:tv:1399',type:'series',season:1,episode:2}).url,'https://primesrc.me/embed/tv?tmdb=1399&season=1&episode=2');
assert.equal(embedFor('VidLink',{id:'mal:5',type:'series',mal:5,absoluteEpisode:3,animeAudio:'dub',season:1,episode:3}).url,'https://vidlink.pro/anime/5/3/dub?fallback=true');
assert.equal(embedFor('VidLink',{id:'mal:5',type:'series',mal:5,absoluteEpisode:3,animeAudio:'sub',season:1,episode:3}).url,'https://vidlink.pro/anime/5/3/sub?fallback=true');
assert.equal(embedFor('VidCore 1',{id:'mal:5',type:'series',season:1,episode:3}).url,null);
assert.deepEqual(mediaIdentifiers({id:'tmdb:tv:1399',type:'series',imdb:'tt12345678'}),{imdb:'tt12345678',tmdb:'1399'});
assert.deepEqual(mediaIdentifiers({id:'tt12345678',type:'movie'}),{imdb:'tt12345678',tmdb:null});
assert.deepEqual(mediaIdentifiers({id:'tmdb:movie:555',type:'movie'}),{imdb:null,tmdb:'555'});
assert.equal(validEmbedTemplate('javascript:alert({id})'),false);
assert.equal(validEmbedTemplate('http://127.0.0.1:8000/movie/{id}'),false);
assert.equal(validEmbedTemplate('https://example.test/embed/{id}'),true);
assert.equal(embedFor('EmbedMaster',{id:'tt12345678',type:'movie'}).url,'https://embedmaster.link/movie/tt12345678');
assert.equal(embedFor('PrimeSrc',{id:'tt12345678',type:'series',season:2,episode:4}).url,'https://primesrc.me/embed/tv?imdb=tt12345678&season=2&episode=4');
assert.equal(embedFor('VidCore 1',{id:'tt12345678',type:'movie'}).url,null);
assert.equal(embedFor('VidSrc 1',{id:'tt12345678',type:'series',season:1}).url,null);
assert.equal(embedFor('Mapple',{id:'tt12345678',type:'movie'}).configured,false);
assert.equal(embedFor('Mapple',{id:'tt12345678',type:'movie'},{Mapple:'https://example.test/embed/{imdb}'}).url,'https://example.test/embed/tt12345678');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mutiny-deck-test-'));
const target=path.join(temp,'HarborSource');
const picker=path.join(target,'src','views','play-picker.tsx');
fs.mkdirSync(path.dirname(picker),{recursive:true});
fs.writeFileSync(path.join(target,"package.json"), JSON.stringify({name:"mutiny-media",version:"1.0.1"}));
fs.mkdirSync(path.join(target,"src-tauri"), {recursive:true});
fs.writeFileSync(path.join(target,"src-tauri","tauri.conf.json"), JSON.stringify({productName:"Mutiny Media",version:"1.0.1",identifier:"app.mutiny.media"}));
const before='import { useView } from "@/lib/view";\nconst displayStreams = [];\nconst playManually = () => {};\nexport function PlayPicker({meta}: {meta:{id:string}}) { return (\n      <section>\n        <PickerHeader\n          meta={metaForDisplay}\n          episode={episode}\n          absoluteEpisode={animeAbsoluteEpisode}\n        />\n      </section>\n); }\n';
fs.writeFileSync(picker,before);
const apply=path.join(kit,'tools','apply-player-deck.mjs');
const run=(...args)=>execFileSync(process.execPath,[apply,'--target',target,...args],{stdio:'pipe',encoding:'utf8'});
assert.match(run(),/Applied successfully/);
assert.match(run('--verify'),/PASS/);
assert.match(run(),/Already installed/);
// Reject rollback if the user has since edited the installed source.
fs.appendFileSync(picker, '\n// changed after integration');
assert.throws(()=>run('--rollback'));
fs.writeFileSync(picker,fs.readFileSync(picker,'utf8').replace('\n// changed after integration',''));
assert.match(fs.readFileSync(picker,'utf8'),/export function PlayPicker\(props/);
assert.match(fs.readFileSync(picker,'utf8'),/mutiny-addon-stream-select/);
const integrated = ts.transpileModule(fs.readFileSync(picker,'utf8'), {fileName:'play-picker.tsx',compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal((integrated.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
run('--rollback');
assert.equal(fs.readFileSync(picker,'utf8'),before);
for(const f of assets)assert.equal(fs.existsSync(path.join(target,f)),false);
const bad='function AnotherPicker() { return null; }';fs.writeFileSync(picker,bad);
assert.throws(()=>run());
assert.equal(fs.readFileSync(picker,'utf8'),bad);
// A mismatch must never patch Android or Windows 1.0.3 source.
fs.writeFileSync(picker,before);
fs.writeFileSync(path.join(target,"package.json"), JSON.stringify({name:"harbor",version:"1.0.3"}));
assert.throws(()=>run());
assert.equal(fs.readFileSync(picker,'utf8'),before);
fs.rmSync(temp,{recursive:true,force:true});
console.log('PASS: TypeScript syntax, 57 hosts, 14 documented URL adapters, anime dub/sub, PrimeSrc TMDB fallback, apply/verify/idempotence/rollback, safe failure.');
