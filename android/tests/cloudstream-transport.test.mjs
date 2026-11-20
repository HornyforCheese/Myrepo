import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const java = name => readFileSync(new URL('../app/src/main/java/app/mutiny/media/' + name, import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');

test('CS3 worker is a private isolated process and fails closed', () => {
  assert.match(manifest, /<service android:name="\.CloudStreamWorker" android:exported="false" android:isolatedProcess="true"/);
  const worker = java('CloudStreamWorker.java');
  assert.match(worker, /CloudStreamRequest\.validate\(new JSONObject\(encoded\)\)/);
  assert.match(worker, /CloudStream host ABI is not implemented/);
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

test('StreamPlay requests are pinned to an imported v715 package', () => {
  const api = java('NativeApi.java');
  const store = java('CloudStreamPackageStore.java');
  assert.match(api, /case "cs3\.request":/);
  assert.match(api, /94d7ec68ed45cf3527fb71d92460047cd3d1d5de8c92aa912122f7ed1117e332/);
  assert.match(api, /CloudStreamPackageStore\.isInstalled\(context, hash\)/);
  assert.match(api, /CloudStreamTransport\.request\(context, args\.getJSONObject\("request"\)\)/);
  assert.match(store, /static synchronized boolean isInstalled\(/);
  assert.match(store, /CloudStreamArchive\.hasFileHash\(new File\(directory\(context\), sha256 \+ "\.cs3"\), sha256, MAX_BYTES\)/);
  assert.match(java('CloudStreamArchive.java'), /MessageDigest\.getInstance\("SHA-256"\)/);
});

test('StreamPlay archive descriptor crosses IPC and is hashed in isolated worker', () => {
  const transport = java('CloudStreamTransport.java');
  const worker = java('CloudStreamWorker.java');
  assert.match(transport, /ParcelFileDescriptor\\.open\\(archive, ParcelFileDescriptor\\.MODE_READ_ONLY\\)/);
  assert.match(transport, /data\\.putParcelable\\("archive", archiveFd\\)/);
  assert.match(worker, /HandlerThread\\("streamplay-archive-worker"\\)/);
  assert.match(worker, /MessageDigest\\.getInstance\\("SHA-256"\\)/);
  assert.match(worker, /expected\\.equals\\(CloudStreamArchive\\.asHex\\(digest\\.digest\\(\\)\\)\\)/);
  assert.doesNotMatch(worker, /DexClassLoader|InMemoryDexClassLoader/);
});
