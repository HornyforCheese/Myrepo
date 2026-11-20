import test from 'node:test';
import assert from 'node:assert/strict';
import {combineProviderAddons, reconcileAccountAddons} from '../app/src/main/assets/account-addons.js';

const manifest = {id:'org.example.provider',name:'Example',resources:['stream'],types:['movie']};
const loader = async url => {
  assert.ok(url.endsWith('/manifest.json'));
  return manifest;
};
test('two signed-in accounts combine shared provider without duplicates',async()=>{
  const payload={
    stremio:{signedIn:true,user:'st-user',addons:[{transportUrl:'https://same.example/manifest.json'},{transportUrl:'https://other.example/manifest.json'}]},
    nuvio:{signedIn:true,user:'nu-user',addons:[{url:'https://same.example/manifest.json'}]}
  };
  const updated=await reconcileAccountAddons([],payload,loader);
  assert.equal(updated.addons.length,3);
  const combined=combineProviderAddons([],updated.addons);
  assert.equal(combined.length,2);
  assert.deepEqual(combined.find(a=>a.base==='https://same.example').origins,['stremio','nuvio']);
});
test('local provider remains installed after cloud accounts disconnect',async()=>{
  const local=[{base:'https://same.example',manifest}];
  const old=[{base:'https://same.example',manifest,account:'stremio',user:'one'}];
  const disconnected=await reconcileAccountAddons(old,{stremio:{signedIn:false},nuvio:{signedIn:false}},loader);
  assert.equal(disconnected.addons.length,0);
  assert.deepEqual(combineProviderAddons(local,disconnected.addons)[0].origins,['device']);
});
test('failed sync retains only matching account owner and successful other account',async()=>{
  const prior=[{base:'https://cached.example',manifest,account:'stremio',user:'same'}];
  const sync=await reconcileAccountAddons(prior,{
    stremio:{signedIn:true,user:'same',error:'Temporary network issue'},
    nuvio:{signedIn:true,user:'different',addons:[{manifest_url:'https://new.example/manifest.json'}]}
  },loader);
  assert.equal(sync.addons.length,2);
  assert.equal(sync.stats.stremio.error,'Temporary network issue');
  const switched=await reconcileAccountAddons(prior,{stremio:{signedIn:true,user:'another',error:'Offline'}},loader);
  assert.equal(switched.addons.length,0);
});
test('reject invalid or local manifests, preserve valid configured URLs',async()=>{
  const sync=await reconcileAccountAddons([],{
    stremio:{signedIn:true,user:'one',addons:[
      {transportUrl:'stremio://example.org/private%2Fkey/manifest.json'},
      {transportUrl:'http://insecure.example/manifest.json'},
      {url:'https://127.0.0.1/manifest.json'}
    ]}
  },loader);
  assert.equal(sync.addons.length,1);
  assert.equal(sync.addons[0].base,'https://example.org/private%2Fkey');
  assert.equal(sync.stats.stremio.skipped,2);
});
