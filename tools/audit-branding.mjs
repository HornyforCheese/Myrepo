#!/usr/bin/env node
/** Best-effort UI-string scanner; intentionally does NOT alter source or third-party licenses. */
import fs from 'node:fs';
import path from 'node:path';
const source = process.argv[2] ? path.resolve(process.argv[2]) : null;
const dest = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve('mutiny-branding-residuals.csv');
if (!source || !fs.existsSync(path.join(source,'package.json')) || !fs.existsSync(path.join(source,'src-tauri','tauri.conf.json'))) {
  console.error('Expected Windows Mutiny source checkout, not Android or an installed EXE.'); process.exit(2);
}
const root = fs.realpathSync(source);
const omit = new Set(['node_modules','target','.git','dist','build','vendor','assets','resources']);
function* walk(folder) {
 if (!fs.existsSync(folder)) return;
 for (const ent of fs.readdirSync(folder,{withFileTypes:true})) {
   const full = path.join(folder,ent.name);
   if (ent.isDirectory() && !omit.has(ent.name)) yield* walk(full);
   else if (ent.isFile() && /\.(?:tsx?|jsx?|html?|css|json|rs|nsh|nsi)$/i.test(ent.name)) yield full;
 }
}
const markers = [
  /(?:\b(?:label|anchorTitle|title|sub|placeholder|tooltip|aria-label|alt|caption|description|name|helpText)\b)\s*[:=]\s*["'`][^"'`]*harbor/ig,
  /(?:<title>|<h[1-6]>|>)[^<>]*\bharbor\b[^<>]*</ig,
  /\b(?:document\.title|\.title\(|\.tooltip\()\s*[=(]?\s*["'`][^"'`]*harbor/ig,
  /\bcontent\s*:\s*["'`][^"'`]*harbor/ig,
  /(?:\bt\(|\btranslate\()\s*["'`][^"'`]*harbor/ig,
];
const rows=[['file','line','category','text']];
let total=0;
for (const folder of ['src','src-tauri','installer/src-tauri','installer/ui']) for (const file of walk(path.join(root,folder))) {
 const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
 for (let i=0;i<lines.length;i++) {
  const line=lines[i];
  if (!/harbor/i.test(line) || /^\s*(?:\/\/|\*|#)/.test(line)) continue;
  if (!markers.some(re=>{re.lastIndex=0;return re.test(line)})) continue;
  rows.push([path.relative(root,file),String(i+1),'likely-visible',line.trim().slice(0,400)]);total++;
 }
}
for (const file of [path.join(root,'index.html')]) if(fs.existsSync(file)) {
 const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
 lines.forEach((ln,i)=> {if (/harbor/i.test(ln) && /<title>|<meta|>[^<>]*harbor/i.test(ln)) {rows.push(['index.html',String(i+1),'likely-visible',ln.trim().slice(0,400)]);total++}});
}
const esc=s=>'"'+String(s).replaceAll('"','""').replaceAll('\r',' ').replaceAll('\n',' ')+'"';
fs.writeFileSync(dest, rows.map(row=>row.map(esc).join(',')).join('\n')+'\n','utf8');
console.log(`${total} candidate visible legacy-brand lines -> ${dest}`);
console.log('Manual review is required: the scan excludes internal API identifiers, third-party assets and license notices.');
