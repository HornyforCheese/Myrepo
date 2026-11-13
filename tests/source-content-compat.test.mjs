import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameSourceContent } from '../tools/source-content-compat.mjs';
test('Windows and Unix TypeScript line endings compare as the same source',()=>{
  const unix=Buffer.from('export const title = "Mutiny Media";\n');
  const windows=Buffer.from('export const title = "Mutiny Media";\r\n');
  for(const file of ['helper.ts','actions.tsx']) assert.equal(sameSourceContent(file,unix,windows),true);
});
test('customized source and binary assets still reject nonidentical content',()=>{
  assert.equal(sameSourceContent('helper.ts',Buffer.from('const x=1;\n'),Buffer.from('const x=2;\r\n')),false);
  assert.equal(sameSourceContent('logo.png',Buffer.from([13,10,0,1]),Buffer.from([10,0,1])),false);
  assert.equal(sameSourceContent('logo.png',Buffer.from([13,10,0,1]),Buffer.from([13,10,0,1])),true);
});
