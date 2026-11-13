import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_LIB || 'typescript');
test('welcome keeps the greeting and dismissal but has no audio element or playback handler',()=>{
  const source=fs.readFileSync(new URL('../src/lib/mutiny/desktop-actions.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('actions.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const welcome=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='FirstLaunchWelcome');
  assert.ok(welcome);
  let audio=false,play=false;
  function walk(node){
    if ((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(tree)==='audio') audio=true;
    if (ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='play') play=true;
    ts.forEachChild(node,walk);
  }
  walk(welcome);assert.equal(audio,false);assert.equal(play,false);
  assert.match(welcome.getText(tree),/Ahoy, mateys!/);assert.match(welcome.getText(tree),/method="dialog"/);
  assert.ok(!source.includes('mutiny-ahoy.mp3'));
});
