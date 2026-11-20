#!/usr/bin/env node
// Read-only, dependency-free DEX method-reference inventory for a local StreamPlay.cs3.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
const expected = '94d7ec68ed45cf3527fb71d92460047cd3d1d5de8c92aa912122f7ed1117e332';
const input = process.argv[2];
if (!input) { console.error('Usage: node android/tests/streamplay-abi.mjs /path/to/StreamPlay.cs3'); process.exit(2); }
const zip = readFileSync(input);
const sha = createHash('sha256').update(zip).digest('hex');
if (sha !== expected) throw Error('Unexpected StreamPlay binary digest: ' + sha);
const u16 = (b, o) => b.readUInt16LE(o);
const u32 = (b, o) => b.readUInt32LE(o);
let p = 0, dex;
while (p + 30 <= zip.length && u32(zip, p) === 0x04034b50) {
  const flags = u16(zip, p + 6), compression = u16(zip, p + 8), compressed = u32(zip, p + 18);
  const filenameLength = u16(zip, p + 26), extraLength = u16(zip, p + 28);
  if (flags & 8) throw Error('ZIP data descriptor not supported');
  const name = zip.toString('utf8', p + 30, p + 30 + filenameLength);
  const start = p + 30 + filenameLength + extraLength, end = start + compressed;
  if (end > zip.length) throw Error('Truncated ZIP');
  if (name === 'classes.dex') {
    if (compressed > 8 * 1024 * 1024) throw Error('Compressed DEX too large');
    dex = compression === 8 ? inflateRawSync(zip.subarray(start, end), {maxOutputLength: 16 * 1024 * 1024})
      : compression === 0 ? zip.subarray(start, end) : null;
  }
  p = end;
}
if (!dex || dex.toString('ascii', 0, 4) !== 'dex\n') throw Error('Missing or invalid classes.dex');
const count = offset => u32(dex, offset), table = offset => u32(dex, offset);
const strings = [];
function skipLeb(pos) {
  for (let i = 0; i < 5; i++) { const byte = dex[pos++]; if (byte < 128) return pos; }
  throw Error('Malformed DEX string length');
}
for (let i = 0; i < count(56); i++) {
  const offset = u32(dex, table(60) + 4 * i), start = skipLeb(offset);
  const end = dex.indexOf(0, start);
  if (end < 0) throw Error('Unterminated DEX string');
  strings.push(dex.toString('utf8', start, end));
}
const types = Array.from({length: count(64)}, (_, i) => strings[u32(dex, table(68) + 4 * i)]);
const protos = Array.from({length: count(72)}, (_, i) => {
  const offset = table(76) + 12 * i, ret = types[u32(dex, offset + 4)], params = u32(dex, offset + 8);
  const args = params ? Array.from({length: u32(dex, params)}, (_, j) => types[u16(dex, params + 4 + j * 2)]) : [];
  return '(' + args.join(',') + ')->' + ret;
});
const refs = new Map();
for (let i = 0; i < count(88); i++) {
  const offset = table(92) + 8 * i, owner = types[u16(dex, offset)];
  if (!owner?.startsWith('Lcom/lagradost/cloudstream3/')) continue;
  const method = strings[u32(dex, offset + 4)] + protos[u16(dex, offset + 2)];
  if (!refs.has(owner)) refs.set(owner, new Set());
  refs.get(owner).add(method);
}
const report = {sha256: sha, classCount: refs.size, methodCount: [...refs.values()].reduce((n, methods) => n + methods.size, 0),
  references: Object.fromEntries([...refs].sort(([a],[b]) => a.localeCompare(b)).map(([owner, methods]) => [owner, [...methods].sort()]))};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
