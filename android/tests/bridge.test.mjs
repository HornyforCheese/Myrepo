import test from 'node:test';
import assert from 'node:assert/strict';
import {rpc} from '../app/src/main/assets/engines.js';

test('native bridge rejects overload promptly and recovers slots after failure or duplicate replies', async () => {
  const previous = globalThis.window, ids = [];
  const bridge = {postMessage(raw) { ids.push(JSON.parse(raw).id); }};
  globalThis.window = {Mutiny:bridge};
  try {
    const batch = Array.from({length:16},()=>rpc('account.status'));
    await assert.rejects(rpc('account.status'),/busy/);
    bridge.onmessage({data:'malformed'});
    for (const id of ids) {
      const data = JSON.stringify({id,result:true});
      bridge.onmessage({data}); bridge.onmessage({data});
    }
    assert.deepEqual(await Promise.all(batch), Array(16).fill(true));
    await assert.rejects(rpc('oversize',{value:'a'.repeat(150000)}), /limit/);
    bridge.postMessage = () => {throw Error('Disconnected')};
    for (let i=0;i<18;i++) await assert.rejects(rpc('account.status'),/Disconnected/);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
