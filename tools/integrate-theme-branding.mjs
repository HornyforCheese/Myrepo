import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const replacements = [
  {
    "file": "src/lib/mutiny/brand-runtime.ts",
    "sha256": "5b176847ad846b1160089300e4ac511749d84d79fb079cd0f3ad3ebc0ff55d9d"
  },
  {
    "file": "src/components/custom-code-mount.tsx",
    "sha256": "6bc33eb6cbfd124c48ec4753b6e7d66004ae230620d31abe2477c56c77773223"
  }
];
/** Overlay files are pinned: fail before writing if a different revision is present. */
export function integrateThemeBranding(root) {
  const writes = [];
  for (const {file, sha256} of replacements) {
    const source = fs.readFileSync(path.join(kit, file), 'utf8').replace(/\r\n/g, '\n');
    const target = path.join(root, file);
    const old = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    if (old === source) continue;
    if (createHash('sha256').update(old).digest('hex') !== sha256) throw Error(`Unexpected theme source revision: ${file}`);
    writes.push([target, source]);
  }
  for (const [file, source] of writes) fs.writeFileSync(file, source);
  console.log(`Integrated community-theme branding (${writes.length} checked files).`);
}
