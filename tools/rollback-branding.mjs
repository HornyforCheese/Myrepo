#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const [backupPath] = process.argv.slice(2);
if (!backupPath) {
  console.error('Usage: node tools/rollback-branding.mjs "C:\\path\\to\\mutiny-branding-backup-ID"');
  process.exit(2);
}
const backup = fs.realpathSync(backupPath);
const record = JSON.parse(fs.readFileSync(path.join(backup,'branding-backup-manifest.json'),'utf8'));
if (record.version !== '1.0.1' || !Array.isArray(record.changed)) throw new Error('Invalid Mutiny Media 1.0.1 branding backup');
const root = fs.realpathSync(record.target);
const sha = raw => createHash('sha256').update(raw).digest('hex');
for (const entry of record.changed) {
  const dest = path.resolve(root,entry.path), src = path.resolve(backup,entry.path);
  if (!dest.startsWith(root+path.sep) || !src.startsWith(backup+path.sep)) throw new Error('Unsafe file path in backup manifest');
  if (!fs.existsSync(dest)||!fs.existsSync(src)) throw new Error(`Missing source or backup: ${entry.path}`);
  if (sha(fs.readFileSync(src)) !== entry.beforeSha256) throw new Error(`Corrupt backup: ${entry.path}`);
  if (sha(fs.readFileSync(dest)) !== entry.afterSha256) throw new Error(`Changed since branding was applied, refusing to overwrite: ${entry.path}`);
}
for (const entry of record.changed) {
  const dest = path.resolve(root,entry.path), src = path.resolve(backup,entry.path);
  fs.copyFileSync(src,dest);
}
console.log(`Reverted ${record.changed.length} files from verified 1.0.1 backup: ${backup}`);
