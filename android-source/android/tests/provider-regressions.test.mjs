import test from 'node:test';
import assert from 'node:assert/strict';
import { addonBase } from '../app/src/main/assets/model.js';
import { metadataCandidates, dedupeMedia } from '../app/src/main/assets/search.js';
import { rankStreams, defaults } from '../app/src/main/assets/preferences.js';

test('Stremio deep links preserve encoded addon paths and reject unsafe hosts', () => {
  assert.equal(addonBase('stremio://addon.example/secret%2Fkey/manifest.json'),'https://addon.example/secret%2Fkey');
  assert.equal(addonBase('https://addon.example/manifest.json'),'https://addon.example');
  assert.throws(()=>addonBase('stremio://127.0.0.1/manifest.json'));
  assert.throws(()=>addonBase('stremio://addon.example/manifest.json?token=unsafe'));
});

test('third-party title IDs use only add-ons with compatible metadata resources', () => {
  const addons=[
    {base:'https://first.example',manifest:{resources:[{name:'meta',types:['movie'],idPrefixes:['tmdb:']}] }},
    {base:'https://second.example',manifest:{resources:['stream']}},
    {base:'https://third.example',manifest:{resources:['meta'],types:['series']}},
  ];
  const result=metadataCandidates({id:'tmdb:603',type:'movie',_sourceBase:'https://first.example'},addons);
  assert.deepEqual(result,['https://first.example/meta/movie/tmdb%3A603.json']);
  assert.deepEqual(metadataCandidates({id:'not-an-id',type:'movie'},[]),[]);
  assert.deepEqual(metadataCandidates({id:'tt0133093',type:'movie'},[]),['https://v3-cinemeta.strem.io/meta/movie/tt0133093.json']);
});

test('deduplication keeps catalog metadata for a title that is not in Cinemeta',()=>{
  const items=[
    {id:'tmdb:603',name:'The Matrix',type:'movie',poster:'',_sourceBase:'https://addon.example'},
    {id:'tmdb:603',name:'The Matrix',type:'movie',poster:'https://posters.example/film.jpg'}
  ];
  const result=dedupeMedia(items);
  assert.equal(result.length,1);
  assert.equal(result[0]._sourceBase,'https://addon.example');
  assert.equal(result[0].poster,'https://posters.example/film.jpg');
});

test('stream source priority matches the actual add-on provider name',()=>{
  const choices=[
    {name:'720p',title:'H264',providerName:'Backup'},
    {name:'720p',title:'H264',providerName:'Preferred Provider'}
  ];
  assert.equal(rankStreams(choices,{...defaults,providerPriority:'preferred provider'})[0].providerName,'Preferred Provider');
});
