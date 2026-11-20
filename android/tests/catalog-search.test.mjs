import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalogs } from '../app/src/main/assets/catalog-search.js';

test('search preserves custom IDs per origin and combines matching IMDb titles across responding catalogues', async () => {
  const addons = ['one','two','offline','broken'].map(name => ({base:'https://' + name + '.example',manifest:{name,catalogs:[
    {id:'top 1',type:'movie',extra:[{name:'search'}]},
    {id:'unsupported',type:'movie',extra:[{name:'search'},{name:'genre',isRequired:true}]}
  ]}}));
  const result = await searchCatalogs('movie','A&B',addons,async url => {
    assert.ok(url.endsWith('/search=A%26B.json'));
    assert.ok(!url.includes('unsupported'));
    if (url.includes('offline')) throw Error('offline');
    if (url.includes('broken')) return {};
    return {metas:['tt12345','local'].map(id => ({id,type:'movie',name:'Same title'})).concat([null])};
  });
  assert.equal(result.failures,2);
  assert.equal(result.metas.length,4);
  assert.deepEqual(result.metas[0].sourceNames,['Cinemeta','one','two']);
});

test('legacy add-ons recover missing catalogue declarations from their own manifest', async () => {
  const old = {base:'https://addon.example',manifest:{id:'old',name:'Old'}};
  const urls = [];
  const result = await searchCatalogs('series','show',[old],async url => {
    urls.push(url);
    if (url.endsWith('/manifest.json')) return {id:'old',resources:['catalog'],catalogs:[{type:'series',id:'shows',extra:[{name:'search'}]}]};
    return {metas:[]};
  });
  assert.ok(urls.some(url => url.includes('/catalog/series/shows/')));
  assert.equal(result.hydrated[0].manifest.catalogs.length,1);
  assert.equal(old.manifest.catalogs,undefined);
});
