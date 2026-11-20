import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, addonBase, selectionFor, sourcesFor, streamId, supportsStreams, jsonRequest } from '../app/src/main/assets/model.js';
import { DOCUMENTED_WEB_SOURCE_NAMES } from '../app/src/main/assets/source-deck-catalog.js';

test('preserves the release’s 42 configured provider adapters', () => {
  assert.equal(DOCUMENTED_WEB_SOURCE_NAMES.length, 42);
  const sources = sourcesFor({ id: 'tt0133093', type: 'movie', moviedb_id: 603 });
  assert.equal(sources.length, 42);
  assert.ok(sources.every(source => safeUrl(source.result.url)));
  assert.ok(sources.every(source => !source.result.url.includes('{')));
});
test('series never exposes a source before an episode is selected', () => {
  const meta = { id: 'tt0944947', type: 'series', moviedb_id: 1399 };
  assert.deepEqual(sourcesFor(meta), []);
  assert.equal(streamId(meta), null);
  const selected = { season: 2, episode: 4, id: 'tt0944947:2:4' };
  assert.equal(streamId(meta, selected), 'tt0944947:2:4');
  const urls = sourcesFor(meta, selected);
  assert.ok(urls.some(source => source.result.url.includes('/1399/2/4')));
  assert.ok(urls.every(source => source.result.url.includes('4')));
});
test('missing TMDB mapping does not substitute an IMDb number', () => {
  const meta = { id: 'tt0133093', type: 'movie' };
  assert.equal(selectionFor(meta).tmdb, undefined);
  assert.ok(!sourcesFor(meta).some(source => source.name === 'VidLink'));
  assert.equal(selectionFor({ ...meta, moviedb_id: 'bad' }).tmdb, undefined);
});
test('rejects local, credential-bearing, non-HTTPS, and malformed URLs', () => {
  for (const url of ['http://example.com/x', 'file:///x', 'javascript:alert(1)', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://foo.local/x', 'https://foo.localhost/x', 'https://foo.internal/x', 'https://localhost./x', 'https://user:secret@example.com/x', 'https://example.com:444/x']) assert.equal(safeUrl(url), false, url);
  assert.equal(safeUrl('https://example.com/a.mp4'), true);
});
test('addon manifest produces an exact transport base', () => {
  assert.equal(addonBase('https://example.com/token/manifest.json'), 'https://example.com/token');
  for (const url of ['https://example.com', 'https://example.com/manifest.json?secret=x', 'https://127.0.0.1/manifest.json']) assert.throws(() => addonBase(url));
});
test('filters add-on stream capabilities by type and ID prefix', () => {
  const manifest = { resources: [{ name: 'stream', types: ['series'], idPrefixes: ['tt'] }] };
  assert.equal(supportsStreams(manifest, 'series', 'tt12345:2:3'), true);
  assert.equal(supportsStreams(manifest, 'movie', 'tt12345'), false);
  assert.equal(supportsStreams(manifest, 'series', 'tmdb:1'), false);
  assert.equal(supportsStreams({ resources: ['stream'], types: ['movie'] }, 'series', 'tt12345'), false);
});
test('fetch failures and unsafe redirects are explicit errors', async () => {
  await assert.rejects(jsonRequest('https://example.com/x', async () => ({ ok: false, status: 503 })), /503/);
  await assert.rejects(jsonRequest('https://example.com/x', async () => ({ ok: true, url: 'http://example.com/redirect' })), /Unsafe/);
  const result = await jsonRequest('https://example.com/x', async () => ({ ok: true, text: async () => '{"metas":[]}' }));
  assert.deepEqual(result, { metas: [] });
});
