import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const java = name => readFileSync(new URL('../app/src/main/java/app/mutiny/media/' + name, import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');

test('CS3 worker is a private isolated process and fails closed', () => {
  assert.match(manifest, /<service android:name="\.CloudStreamWorker" android:exported="false" android:isolatedProcess="true"/);
  const worker = java('CloudStreamWorker.java');
  assert.match(worker, /CloudStreamRequest\.validate\(new JSONObject\(encoded\)\)/);
  assert.match(worker, /CloudStream provider execution is not yet supported/);
  assert.doesNotMatch(worker, /DexClassLoader|InMemoryDexClassLoader/);
});

test('CS3 transport bounds requests, responses, wait and disconnects', () => {
  const transport = java('CloudStreamTransport.java');
  assert.match(transport, /CloudStreamRequest\.validate\(request\)/);
  assert.match(transport, /TIMEOUT_SECONDS = 8/);
  assert.match(transport, /replies\.poll\(TIMEOUT_SECONDS, TimeUnit\.SECONDS\)/);
  assert.match(transport, /onServiceDisconnected\(/);
  assert.match(transport, /onBindingDied\(/);
  assert.match(transport, /MAX_REPLY_BYTES/);
  assert.match(transport, /context\.unbindService\(connection\)/);
});
