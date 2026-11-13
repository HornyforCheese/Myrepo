import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_LIB||'typescript');
const source=fs.readFileSync(new URL('../src/lib/mutiny/theme-branding.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('module','exports',js)(module,module.exports);
const {brandDisplayText,brandThemeCss}=module.exports;
test('community theme display labels handle all casing and possessives',()=>{
  for(const value of ['Harbor','HARBOR','harbor'])assert.equal(brandDisplayText('Open '+value+' settings'),'Open Mutiny Media settings');
  assert.equal(brandDisplayText("Harbor's player"),"Mutiny Media's player");
});
test('upstream attribution, real title names, URLs and selector identifiers are preserved',()=>{
  for(const value of ['by Harbor contributors','Copyright Harbor','Pearl Harbor','https://harborcommunity.site/themes','harbor://play','data-harbor-sidebar','harbor.custom-themes.v1'])assert.equal(brandDisplayText(value),value);
});
test('Apple TV+ generated lowercase wordmark is branded without changing its selectors or style',()=>{
  const css='/* Harbor author note */ html[data-theme-layout="sidebar"] [data-harbor-sidebar-label]::after {content: "harbor+"; font-size: 22px; color: var(--harbor-accent)}';
  assert.equal(brandThemeCss(css),css.replace('"harbor+"','"Mutiny Media+"'));
});
test('nested rules, escaped text, multiple strings and important content retain CSS structure',()=>{
  const css=String.raw`@media(min-width:500px){.harbor-brand::before{content:'H\61 rbor' " player" !important;color:red}.other::after{content:"HARBOR"}}`;
  const result=brandThemeCss(css);
  assert.ok(result.includes("content:'Mutiny Media' \" player\" !important;color:red"));
  assert.ok(result.includes('content:"Mutiny Media"'));
  assert.equal(brandThemeCss(result),result);
});
test('content variables and their indirection change while unrelated font families and keys do not',()=>{
  const css=':root{--brand:"HARBOR";--label:var(--brand);--font:"Harbor Sans";--harbor-accent:red}.harbor-brand:after{content:var(--label)}';
  assert.equal(brandThemeCss(css),css.replace('"HARBOR"','"Mutiny Media"'));
});
test('asset URLs, attribute selectors, comments, quoted semicolons and SVG data remain intact',()=>{
  const css='[title="Harbor"]::after{content:url("data:image/svg+xml;<svg>Harbor</svg>") "Harbor; player";background:url("https://harborcommunity.site/image.png")}/* content:"Harbor" */';
  assert.equal(brandThemeCss(css),css.replace('"Harbor; player"','"Mutiny Media; player"'));
});
test('no branding declarations leaves a theme byte-for-byte unchanged',()=>{
  const css='@import url("https://example.org/harbor.css");.harbor-card[data-app="Harbor"]{background:blue;font-family:"Harbor Sans";--storage-key:"harbor.theme.v1"}';
  assert.equal(brandThemeCss(css),css);
});
