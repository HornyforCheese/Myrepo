import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_LIB || 'typescript');
const source = fs.readFileSync(new URL('../src/lib/mutiny/local-video.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module = {exports:{}};
new Function('module','exports',js)(module,module.exports);
const { chooseLocalVideo } = module.exports;

test('native video picker hands the exact filesystem path to playback once', async () => {
  const path = String.raw`C:\Users\Test User\Videos\été movie.mkv`;
  const played = [];
  const result = await chooseLocalVideo(async options => {
    assert.equal(options.multiple, false);
    assert.equal(options.directory, false);
    for (const extension of ['mp4', 'mkv', 'webm', 'avi', 'mov', 'ts'])
      assert.ok(options.filters[0].extensions.includes(extension));
    return path;
  }, value => played.push(value));
  assert.equal(result, true);
  assert.deepEqual(played, [path]);
});

test('cancelling or malformed picker responses never launch the player', async () => {
  for (const result of [null, '', '   ', ['a.mp4'], []]) {
    assert.equal(await chooseLocalVideo(async () => result, () => assert.fail('unexpected playback')), false);
  }
});

test('native picker failures propagate for actionable UI errors', async () => {
  const failure = new Error('dialog unavailable');
  await assert.rejects(chooseLocalVideo(async () => {throw failure;}, () => assert.fail('unexpected playback')), error => error === failure);
});
