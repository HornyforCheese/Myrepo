import test from 'node:test';
import assert from 'node:assert/strict';
import {rankStreams,animeStreamMatch} from '../app/src/main/assets/stream-preferences.js';

test('anime filters require separate evidence for requested properties', () => {
  for (const title of ['Dual audio · English subs','Japanese audio','English subtitles','Unlabelled']) {
    assert.equal(animeStreamMatch({title},{animeAudio:'sub'}).matches,false);
    assert.equal(animeStreamMatch({title},{animeAudio:'dub'}).matches,false);
  }
  assert.ok(animeStreamMatch({title:'Japanese audio / English subs'},{animeAudio:'sub'}).matches);
  assert.ok(animeStreamMatch({title:'English dubbed dual audio'},{animeAudio:'dub'}).matches);
  assert.ok(animeStreamMatch({title:'Dual audio'},{animeAudio:'dual'}).matches);
  assert.equal(animeStreamMatch({title:'not uncensored'},{animeRelease:'uncensored'}).matches,false);
});

test('negated provider labels never satisfy requested anime audio and subtitle filters', () => {
  for (const title of ['No English dub', 'Not English audio', 'Without dubbed English']) {
    assert.equal(animeStreamMatch({title}, {animeAudio:'dub'}).matches, false, title);
  }
  for (const title of ['No Japanese audio / English subs', 'Japanese audio / without subtitles']) {
    assert.equal(animeStreamMatch({title}, {animeAudio:'sub'}).matches, false, title);
  }
  for (const title of ['No dual audio', 'Not dual-audio', 'Without dual_audio']) {
    assert.equal(animeStreamMatch({title}, {animeAudio:'dual'}).matches, false, title);
  }
  assert.equal(animeStreamMatch({title:'English dub / Japanese audio / English subs'}, {animeAudio:'sub'}).matches, true);
  assert.equal(animeStreamMatch({title:'Dual audio / English dub'}, {animeAudio:'dual'}).matches, true);
});

test('quality preferences rank across providers and keep unknown sources available', () => {
  const rows = ['1080p','unknown','480p','720p','360p'].map(title=>({stream:{title}}));
  assert.deepEqual(rankStreams(rows,{quality:'720'}).map(x=>x.stream.title),['720p','480p','360p','1080p','unknown']);
  assert.equal(rankStreams(rows,{quality:'2160',lowBandwidth:true})[0].stream.title,'480p');
  assert.equal(rankStreams(rows,{}),rows);
});
