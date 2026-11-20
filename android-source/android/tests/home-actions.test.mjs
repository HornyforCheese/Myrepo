import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMagnetInput, parseAiSuggestions } from '../app/src/main/assets/home-actions.js';

test('the magnet home action normalises supported BitTorrent v1 identifiers',()=>{
  const hash='0123456789abcdef0123456789abcdef01234567';
  assert.equal(normalizeMagnetInput(hash),'magnet:?xt=urn:btih:'+hash);
  assert.equal(normalizeMagnetInput('magnet:?xt=urn:btih:'+hash+'&dn=Media'), 'magnet:?xt=urn:btih:'+hash+'&dn=Media');
  assert.throws(()=>normalizeMagnetInput('http://example.com/file.torrent'),/valid magnet/);
  assert.throws(()=>normalizeMagnetInput('magnet:?xt=urn:btmh:123'),/valid magnet/);
});
test('Search with AI only presents bounded structured media suggestions',()=>{
  assert.deepEqual(parseAiSuggestions('[{"title":"A Film","year":2026,"reason":"Thriller"}]'),[{title:'A Film',year:'2026',reason:'Thriller'}]);
  assert.deepEqual(parseAiSuggestions('[]'),[]);
  assert.throws(()=>parseAiSuggestions('not valid'),/did not contain a list/);
});
