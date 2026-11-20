import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,getPreferences,savePreferences,streamResolution,streamCodec,rankStreams,streamEligible,isAnime,normalizeProviderList} from '../app/src/main/assets/preferences.js';
import {createCollection,collectionKey,getCollections,toggleCollection,removeCollection} from '../app/src/main/assets/collections.js';
import {dedupeMedia} from '../app/src/main/assets/search.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()};};
test('settings are validated, persisted and safely normalised',()=>{
  const storage=memory();
  const p=savePreferences({...defaults,theme:'oled',maxResolution:720,fontScale:115},storage);
  assert.equal(getPreferences(storage).theme,'oled');assert.equal(p.maxResolution,720);
  storage.setItem('mutiny.android.preferences.v2',JSON.stringify({theme:'malicious',accent:'url(data:x)',fontScale:-100}));
  assert.deepEqual([getPreferences(storage).theme,getPreferences(storage).accent,getPreferences(storage).fontScale],['midnight','#e9ae58',100]);
});
test('stream ranking favours bandwidth-conscious sources only when configured',()=>{
  const list=[{name:'4K H264',title:'2160p x264'},{name:'720p HEVC',title:'720p HEVC'},{name:'480p H264',title:'480p x264'}];
  assert.equal(rankStreams(list,{...defaults,lowBandwidth:false})[0].name,'4K H264');
  assert.equal(rankStreams(list,{...defaults,lowBandwidth:true,preferHevc:false})[0].name,'480p H264');
  assert.deepEqual(rankStreams(list,{...defaults,maxResolution:720}).map(x=>x.name),['720p HEVC','480p H264']);
  assert.equal(streamResolution(list[0]),2160);assert.equal(streamCodec(list[1]),'hevc');
});
test('anime labels are treated as hints, not fabricated track metadata',()=>{
  const meta={name:'An anime',genres:['Anime']};
  assert.equal(isAnime(meta),true);
  const dubbed={name:'Anime 720p English Dub Dual Audio Uncensored'};
  const subbed={name:'Anime 1080p Japanese Subbed'};
  assert.equal(streamEligible(dubbed,{...defaults,animeAudio:'english-dub',dualAudio:true,uncensored:true},true),true);
  assert.equal(streamEligible(subbed,{...defaults,animeAudio:'english-dub'},true),false);
  assert.deepEqual(normalizeProviderList('Alpha, alpha, Beta'),['alpha','beta']);
});
test('collections support create, membership, and removal',()=>{
  const previous=globalThis.localStorage;
  globalThis.localStorage=memory();
  try{
    const id=createCollection('Watch later');
    const item={type:'movie',id:'tt0133093'};
    assert.equal(collectionKey(item),'movie:tt0133093');
    assert.equal(toggleCollection(id,item),true);
    assert.equal(getCollections()[0].ids[0],'movie:tt0133093');
    assert.equal(toggleCollection(id,item),false);
    removeCollection(id);assert.equal(getCollections().length,0);
  }finally{globalThis.localStorage=previous;}
});
test('cross-provider search deduplicates titles with the same movie ID',()=>{
  const list=[{id:'tt0133093',type:'movie',name:'The Matrix',poster:''},{id:'tt0133093',type:'movie',name:'The Matrix',poster:'https://test.example/poster.jpg'},{id:'tt1',type:'movie',name:'Other film'}];
  const result=dedupeMedia(list);
  assert.equal(result.length,2);assert.equal(result[0].poster,'https://test.example/poster.jpg');
});
