import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_LIB || 'typescript');
function load(file, imports = {}) {
  const source = fs.readFileSync(new URL('../'+file, import.meta.url),'utf8');
  const js = ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',js)(name=>{if(name in imports)return imports[name];throw Error('Unexpected import '+name);},m,m.exports);
  return m.exports;
}
const catalog=load('src/lib/mutiny/source-deck-catalog.ts');
const {createWebTmdbResolver}=load('src/lib/mutiny/web-media-ids.ts',{'@/lib/safe-fetch':{safeFetch:()=>{throw Error('unexpected live request')}}});
const response = meta => new Response(JSON.stringify({meta}),{status:200});
test('automatic sources have actual configured title URLs; missing entries are not guessed',()=>{
  const media={id:'tt1254207',tmdb:'10378',type:'movie'};
  const ready=catalog.readyWebSources(media);
  assert.equal(ready.length,42);
  assert.equal(ready[0].result.sandbox,true);
  assert.notEqual(ready[0].name,"EmbedMaster","Automatic should prefer hosts without a mandatory compatibility acknowledgement");
  assert.ok(ready.every(p=>catalog.validEmbedUrl(p.result.url)));
  assert.ok(!ready.some(p=>p.name==='Atlantic'));
  assert.equal(catalog.sourceConfigured('Atlantic'),false);
  assert.equal(catalog.sourceConfigured('Mapple'),true);
  assert.equal(catalog.readyWebSources(media,{},ready.map(p=>p.name)).length,0);
  assert.equal(catalog.readyWebSources({id:'unknown',type:'movie'}).length,0);
});
test('each configured episode URL preserves the selected season and episode',()=>{
  const ready=catalog.readyWebSources({id:'tt12345678',tmdb:'99999',type:'series',season:2,episode:7});
  assert.equal(ready.length,42);
  for(const {name,result}of ready){assert.ok(!/[{}]/.test(result.url),name);assert.ok(result.url.includes('2')&&result.url.includes('7'),name);}
});
test('exact Cinemeta IDs resolve without API keys and concurrent lookups coalesce',async()=>{
  let count=0;
  const resolve=createWebTmdbResolver(async(url,init)=>{
    count++;assert.equal(url,'https://v3-cinemeta.strem.io/meta/movie/tt1254207.json');assert.ok(init.signal);
    await new Promise(r=>setTimeout(r,2));
    return response({id:'tt1254207',imdb_id:'tt1254207',type:'movie',moviedb_id:10378});
  });
  assert.deepEqual(await Promise.all([resolve('tt1254207','movie'),resolve('tt1254207','movie')]),['10378','10378']);
  assert.equal(await resolve('tt1254207','movie'),'10378');assert.equal(count,1);
});
test('ID resolver rejects mismatched identities, wrong media types, and invalid IDs',async()=>{
  for(const meta of [
    {imdb_id:'tt9999999',type:'movie',moviedb_id:10378},
    {imdb_id:'tt1254207',type:'series',moviedb_id:10378},
    {imdb_id:'tt1254207',type:'movie',moviedb_id:'bad'},
    {imdb_id:'tt1254207',type:'movie',moviedb_id:0},
  ]){const resolve=createWebTmdbResolver(async()=>response(meta));assert.equal(await resolve('tt1254207','movie'),null);}
  const resolve=createWebTmdbResolver(()=>{throw Error('must not fetch invalid IDs')});
  assert.equal(await resolve('a title string','movie'),null);
  assert.equal(await resolve('tmdb:movie:10378','movie'),'10378');
  assert.equal(await resolve('tmdb:tv:10378','movie'),null);
});
test('metadata failures recover instead of poisoning future lookups',async()=>{
  let count=0;
  const resolve=createWebTmdbResolver(async()=>++count===1?new Response('',{status:503}):response({imdb_id:'tt1254207',type:'movie',moviedb_id:10378}));
  assert.equal(await resolve('tt1254207','movie'),null);
  assert.equal(await resolve('tt1254207','movie'),'10378');
});
test('iframe protection remains default and normal-frame compatibility requires an explicit per-host opt-in',()=>{
  const source=fs.readFileSync(new URL('../src/lib/mutiny/source-deck.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('deck.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const frames=[];
  function walk(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(tree)==='iframe')frames.push(n);ts.forEachChild(n,walk);}walk(tree);
  assert.equal(frames.length,1);
  const attrs=frames[0].attributes.properties;
  const sandbox=attrs.find(a=>a.name?.getText(tree)==='sandbox');assert.ok(sandbox);
  assert.match(sandbox.getText(tree),/webIframeSandbox\(compatibilityConsent, provider, current.url\)/);
  assert.match(source,/\[compatibilityConsent, setCompatibilityConsent\] = useState<string \| null>\(null\)/);
  assert.match(source,/setCompatibilityConsent\(null\)/);
  assert.match(source,/Compatibility mode for \{provider\}/);
});

test('normal-frame opt-in cannot transfer to another provider, title, or invalid URL',()=>{
  const a='https://embedmaster.link/movie/tt1254207';
  const b='https://embedmaster.link/movie/tt1727587';
  const consent=catalog.webCompatibilityKey('EmbedMaster',a);
  assert.equal(typeof catalog.webIframeSandbox(null,'EmbedMaster',a),'string');
  assert.equal(catalog.webIframeSandbox(consent,'EmbedMaster',a),undefined);
  assert.equal(typeof catalog.webIframeSandbox(consent,'EmbedMaster',b),'string');
  assert.equal(typeof catalog.webIframeSandbox(consent,'VidFast',a),'string');
  assert.equal(typeof catalog.webIframeSandbox(null,'EmbedMaster',null),'string');
  assert.equal(catalog.webCompatibilityKey('EmbedMaster','http://127.0.0.1/'),null);
});
