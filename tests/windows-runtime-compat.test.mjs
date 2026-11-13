import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_LIB || 'typescript');
function load(relative, mocks) {
  const text = fs.readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', js)(module, module.exports, name => {
    if (!(name in mocks)) throw Error('Unexpected dependency: ' + name);
    return mocks[name];
  });
  return module.exports;
}
const emptyJina = { enrichWithContent: async () => ({ hits: [], context: '' }) };
test('Keenable uses its public documented route and rejects unsafe or duplicate result URLs', async () => {
  const saved = globalThis.fetch; let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ results: [
      { title: 'Valid result', url: 'https://example.org/film', snippet: 'Reference' },
      { title: 'Duplicate', url: 'https://example.org/film' },
      { title: 'Script', url: 'javascript:alert(1)' },
      { title: 'Credential URL', url: 'https://user:secret@example.org' },
    ] });
  };
  try {
    const { liveWebContext } = load('src/lib/mutiny/live-web.ts', { '@/lib/jina-search': emptyJina });
    const result = await liveWebContext('  films  ', { aiWebSource: 'keenable', keenableKey: '', jinaKey: '' });
    assert.equal(request.url, 'https://api.keenable.ai/v1/search/public');
    assert.equal(request.options.headers['X-Keenable-Title'], 'Mutiny Media');
    assert.equal(JSON.parse(request.options.body).query, 'films');
    assert.equal(result.hits.length, 1);
    assert.match(result.context, /Reference/);
  } finally { globalThis.fetch = saved; }
});
test('authenticated search keeps credentials in the API header and sanitizes failures', async () => {
  const saved = globalThis.fetch; let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return new Response('secret response', { status: 401 }); };
  try {
    const { liveWebContext } = load('src/lib/mutiny/live-web.ts', { '@/lib/jina-search': emptyJina });
    await assert.rejects(liveWebContext('films', { aiWebSource: 'keenable', keenableKey: 'test-key', jinaKey: '' }), /HTTP 401/);
    assert.equal(request.url, 'https://api.keenable.ai/v1/search');
    assert.equal(request.options.headers['X-API-Key'], 'test-key');
    assert.ok(!request.options.body.includes('test-key'));
  } finally { globalThis.fetch = saved; }
});
test('Jina selection uses the existing Jina enrichment instead of a second credential store', async () => {
  let args;
  const { liveWebContext } = load('src/lib/mutiny/live-web.ts', { '@/lib/jina-search': { enrichWithContent: async (...input) => { args = input; return { hits: [], context: 'existing Jina context' }; } } });
  const result = await liveWebContext('films', { aiWebSource: 'jina', jinaKey: 'jina-key', keenableKey: '' });
  assert.deepEqual(args, ['films', 'jina-key']);
  assert.equal(result.context, 'existing Jina context');
});
test('separate account mode never reads or queries another account', async () => {
  const { combinedAccountAddons } = load('src/lib/mutiny/combined-addons.ts', {});
  assert.deepEqual(await combinedAccountAddons(false), []);
});
test('combined mode respects the selected Nuvio slot, survives partial failure and deduplicates', async () => {
  let selected;
  const { combinedAccountAddons } = load('src/lib/mutiny/combined-addons.ts', {
    '@/lib/auth': { readPrimaryStremioSession: () => ({ authKey: 'fixture-key' }) },
    '@/lib/addons': { userAddons: async () => { throw Error('Account unavailable'); } },
    '@/lib/addon-store': { fetchManifestAt: async url => ({ id: url, name: 'Fixture' }), filterEnabled: values => values },
    '@/lib/nuvio/nuvio-client': { isNuvioSignedIn: () => true, loadNuvioState: () => ({ activeProfileIndex: 3 }) },
    '@/lib/nuvio/nuvio-sync': { pullAddonsFromNuvio: async id => { selected = id; return [{ url: 'https://example.org/manifest.json' }, { url: 'https://example.org/manifest.json' }]; } },
  });
  const addons = await combinedAccountAddons(true);
  assert.equal(selected, 'nuvio-3');
  assert.equal(addons.length, 1);
  assert.equal(addons[0].manifest.id, 'https://example.org/manifest.json');
});
