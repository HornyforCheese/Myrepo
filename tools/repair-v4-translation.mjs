#!/usr/bin/env node
/** Compatibility adaptation for archived Mutiny v4 patch against upstream v1.0.1-beta.
 * The archived diff assumes useT() uses useMemo, but this tagged source returns a direct callback.
 * Pre: strip only the incompatible translate.ts hunk from the patch.
 * Post: preserve exactly the intended visible brand mapping using current function anchors.
 * Fail closed on changed/ambiguous source. Keep contributors attribution untouched.
 */
import fs from 'node:fs';
import path from 'node:path';

const [stage, rootArg] = process.argv.slice(2);
const root = path.resolve(rootArg ?? '.');
if (!['--pre','--post'].includes(stage)) throw Error('Usage: node repair-v4-translation.mjs --pre <v4-kit-root> | --post <Windows-1.0.1-source-root>');
function oneReplace(input, find, replacement, label) {
  const start=input.indexOf(find);
  if (start < 0 || input.indexOf(find,start+find.length)>=0) throw Error(`Unexpected ${label} source anchor; refusing to guess.`);
  return input.slice(0,start)+replacement+input.slice(start+find.length);
}
if (stage==='--pre') {
  const file=path.join(root,'legacy','mutiny-complete-update','mutiny-complete.patch');
  const original=fs.readFileSync(file,'utf8');
  const begin='diff --git a/src/lib/i18n/translate.ts b/src/lib/i18n/translate.ts\n';
  const pos=original.indexOf(begin);
  if(pos<0){if(!original.includes('diff --git a/src/lib/i18n/translate.ts')) { console.log('Translation hunk already isolated.');process.exit(0);}throw Error('Unrecognised translation patch header.');}
  if(original.indexOf(begin,pos+1)>=0) throw Error('Multiple translation hunks; refusing to edit.');
  const end=original.indexOf('\ndiff --git ',pos+begin.length);
  if(end<0)throw Error('Cannot locate end of translation patch; no changes made.');
  const result=original.slice(0,pos)+original.slice(end+1);
  if(result.length>=original.length || result.includes(begin))throw Error('Translation patch isolation failed.');
  fs.writeFileSync(file,result,'utf8');
  console.log(`Isolated one incompatible 1.0.1 translation hunk (${original.length-result.length} bytes).`);
} else {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if(pkg.name!=='mutiny-media'||pkg.version!=='1.0.1'||manifest.productName!=='Mutiny Media'||manifest.version!=='1.0.1')throw Error('Expected customized Mutiny Media Windows 1.0.1, refusing modification.');
  const file=path.join(root,'src','lib','i18n','translate.ts');
  const old=fs.readFileSync(file,'utf8');
  if(old.includes('function displayBrand(value: string, key: string)')){ console.log('Visible translation branding already patched.');process.exit(0);}
  const fn=`function displayBrand(value: string, key: string): string {\n  if (key === "by Harbor contributors") return value;\n  return value.replace(/\\bHarbor\\b/g, "Mutiny Media");\n}\n\n`;
  let updated=oneReplace(old,'export function t(key: string, vars?: Vars): string {',fn+'export function t(key: string, vars?: Vars): string {','t() declaration');
  updated=oneReplace(updated,'return interpolate(resolve(getUiLanguage(), key, vars), vars);','return interpolate(displayBrand(resolve(getUiLanguage(), key, vars), key), vars);','t() body');
  updated=oneReplace(updated,'return reverseFor(getUiLanguage()).get(value) ?? value;',
    'const reverse = reverseFor(getUiLanguage());\n  const original = value.replace(/\\bMutiny Media\\b/g, "Harbor");\n  return reverse.get(value) ?? reverse.get(original) ?? value;','sourceTranslationKey()');
  updated=oneReplace(updated,'return (key: string, vars?: Vars) => interpolate(resolve(lang, key, vars, region), vars);',
    'return (key: string, vars?: Vars) => interpolate(displayBrand(resolve(lang, key, vars, region), key), vars);','useT() body');
  fs.writeFileSync(file,updated,'utf8');
  console.log('Translated UI labels now display Mutiny Media; legacy translation keys and attribution preserved.');
}