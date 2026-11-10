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
  const auditPath=path.join(root,'legacy','mutiny-complete-update','audit-fixes.patch');
  const source=fs.readFileSync(auditPath,'utf8');
  let next=source;
  for(const rel of ['scripts/capstan-stage.mjs','src/components/search/ai-search/use-ai-suggest.ts']) {
    const begin=`diff --git a/${rel} b/${rel}\n`;
    const pos=next.indexOf(begin);
    if(pos<0 || next.indexOf(begin,pos+1)>=0) throw Error(`Expected exactly one ${rel} audit patch; refusing to guess.`);
    const following=next.indexOf('\ndiff --git ',pos+begin.length);
    const stop=following<0?next.length:following+1;
    next=next.slice(0,pos)+next.slice(stop);
  }
  if ((source.match(/^diff --git /gm)||[]).length!==7 || (next.match(/^diff --git /gm)||[]).length!==5) throw Error('Audit patch isolation changed unexpected files.');
  fs.writeFileSync(auditPath,next,'utf8');
  console.log('Isolated two 1.0.1 audit-fix mismatches for guarded post-integration (5 other patch sections retained).');
  const lowScript=path.join(root,'tools','apply-low-bandwidth.mjs');
  const low=fs.readFileSync(lowScript,'utf8');
  const newer='lines.push(...bufferMpvLines(bufferSizeFor(s), opts?.totalPhysBytes));';
  const tagged='lines.push(...bufferMpvLines(bufferSizeFor(s)));';
  if (low.split(newer).length!==3) throw Error('Expected two 1.0.1 mpv buffer anchors in low-bandwidth patch');
  fs.writeFileSync(lowScript,low.split(newer).join(tagged),'utf8');
  console.log('Adapted low-bandwidth MPV patch to verified v1.0.1 buffer signature.');

} else {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if(pkg.name!=='mutiny-media'||pkg.version!=='1.0.1'||manifest.productName!=='Mutiny Media'||manifest.version!=='1.0.1')throw Error('Expected customized Mutiny Media Windows 1.0.1, refusing modification.');
  const file=path.join(root,'src','lib','i18n','translate.ts');
  const old=fs.readFileSync(file,'utf8');
  if(old.includes('function displayBrand(value: string, key: string)')){ console.log('Visible translation branding already patched.'); }
  else {
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

  const capstanFile=path.join(root,'scripts','capstan-stage.mjs');
  const capstanOriginal=fs.readFileSync(capstanFile,'utf8');
  const helper=`function dexToolsReady() {
  if (!existsSync(dexLib)) return false;
  const names = jarsIn(dexLib).filter((name) => statSync(join(dexLib, name)).size > 0);
  return DEX_KEEP.every((prefix) => {
    const required = prefix === "asm-" ? /^asm-\\d/ : new RegExp(\`^\${prefix}-v?\\\\d\`);
    return names.some((name) => required.test(name));
  });
}

`;
  if (!capstanOriginal.includes('function dexToolsReady()')) {
    const needle='function dexJarNames() {';
    let staged=oneReplace(capstanOriginal,needle,helper+needle,'capstan dexJarNames()');
    const oldStart='const gaps = [["libs", libs], ["dex tools", dexLib]].filter(([, path]) => !existsSync(path));';
    const newStart=`const gaps = [
    ["libs", () => ["NewPipeExtractor-v0.26.5.jar", "nanojson-e9d656d.jar"].every((name) => {
      const file = join(libs, name);
      return existsSync(file) && statSync(file).size > 0;
    })],
    ["dex tools", dexToolsReady],
  ].filter(([, ready]) => !ready());`;
    staged=oneReplace(staged,oldStart,newStart,'capstan jar readiness');
    staged=oneReplace(staged,'for (const [label, path] of gaps) {\n      if (!existsSync(path)) {',
      'for (const [label, ready] of gaps) {\n      if (!ready()) {','capstan dependency retry check');
    staged=oneReplace(staged,'\`no \${label} at \${path}, and tools/deps.sh did not produce it\`',
      '\`incomplete \${label} at \${src} after running tools/deps.sh\`','capstan missing jar diagnostic');
    fs.writeFileSync(capstanFile,staged,'utf8');
    console.log('Updated capstan jar integrity check using exact 1.0.1 source anchors.');
  }

  const suggestFile=path.join(root,'src','components','search','ai-search','use-ai-suggest.ts');
  const suggestOriginal=fs.readFileSync(suggestFile,'utf8');
  if (!suggestOriginal.includes('useFreeOpenRouterModels')) {
    let next=oneReplace(suggestOriginal,
      'import { aiIsGroq, aiKey } from "@/lib/ai-models";',
      'import { useFreeOpenRouterModels } from "@/lib/mutiny/use-free-openrouter-models";', 'AI search provider import');
    next=oneReplace(next,'const activeKey = aiKey(settings);',
      'const activeKey = settings.aiSearchKey.trim();\n  const { models, status: catalogStatus } = useFreeOpenRouterModels();\n  const model = models.find(({ id }) => id === settings.aiSearchModel) ?? models[0];', 'AI search model selection');
    next=oneReplace(next,'if (!runSignal || !query.trim() || !activeKey.trim()) return;',
      'if (!runSignal || !query.trim() || !activeKey || !model) return;', 'AI search run condition');
    next=oneReplace(next,'}, [runSignal]);','}, [runSignal, model?.id]);', 'AI search run dependency');
    next=oneReplace(next,'const run = async () => {',
      'const run = async () => {\n    if (!activeKey || !model) return;', 'AI search preflight');
    next=oneReplace(next,'settings.aiSearchModel,\n        aiIsGroq(settings),','model.id,\n        false,','AI search OpenRouter routing');
    next=oneReplace(next,'return { status, results, error, ranQuery, run };',
      'return { status, results, error, ranQuery, run, model, catalogStatus };','AI search return contract');
    fs.writeFileSync(suggestFile,next,'utf8');
    console.log('Pinned OpenRouter-only AI search routing and catalog model metadata.');
  }

}