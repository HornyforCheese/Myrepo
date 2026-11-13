import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const replacements = [
  {
    "file": "src/lib/ai-models.ts",
    "sha256": "088fc17dd654cc92806165d98e0aaadbd460ac56c644a546d13bc1a151acb280"
  },
  {
    "file": "src/lib/settings/types.ts",
    "sha256": "7bb8b722228aea2313b0637e1f49c273f4c36b40a7f2f796573f3308abc42aaf"
  },
  {
    "file": "src/lib/settings/defaults.ts",
    "sha256": "f36ba9abb3d206ba9b41eba9a27a507e10572c16780fb011df0f54b3e650d8ac"
  },
  {
    "file": "src/lib/settings/load.ts",
    "sha256": "967677448ad0e2489d79b77196e6aa6ca958c3c9af535ed4a3bdf4f4f36469f3"
  },
  {
    "file": "src/lib/ai-search.ts",
    "sha256": "f24212e05c890c8ee00097cc0cabf46427cbf3d8caaa288604fea281f7b87fa9"
  },
  {
    "file": "src/lib/ai-episode-search.ts",
    "sha256": "f5d963cb7e5a9a51bfca0b5ce95943ed7f8e834a91f6d9d7e1e2b2686f6e7d98"
  },
  {
    "file": "src/views/detail/series-episodes/episode-ai-mode.tsx",
    "sha256": "07eba88c3092ff790afb411a76d949ed267b822aeb3ffb1784b1153dfee5948e"
  },
  {
    "file": "src/views/detail/anime-episodes.tsx",
    "sha256": "5f0a2713c4484fb4626181a0b24ee72fbecd94ad9949cbb8f858f3d6814c7a28"
  },
  {
    "file": "src/views/detail/anime-episodes/use-anime-ai-search.ts",
    "sha256": "a6b5f3a6aa1e9773bb3c24968bbc97b8a3551412f529c4fd363ee6a6cc964a30"
  },
  {
    "file": "src/lib/games/ai-search.ts",
    "sha256": "7afc87d60633626de4d8418bb92a2b3f077631c46ee4670d229b428c6627dc3e"
  },
  {
    "file": "src/views/games/game-ai-search.tsx",
    "sha256": "ad11891a4295d52eaaccccbef126db5b887baabccf632f9a0a9c9cfd85c695bb"
  },
  {
    "file": "src/components/search/ai-search/use-ai-suggest.ts",
    "sha256": "3649cfc858573540386d4bd56dcdaef85793d59cab13d9941ea51334231bdb99"
  },
  {
    "file": "src/components/search/ai-search-section.tsx",
    "sha256": "3c9dce3b4157da21dc77042249e5a809e97e5ffe6890324e56523d95509e7978"
  },
  {
    "file": "src/components/search/ai-mode-button.tsx",
    "sha256": "3366af751191301129a74654da6f3e25653fae62f2292c5c189a64db56475af0"
  },
  {
    "file": "src/views/settings/ai-search-section.tsx",
    "sha256": "e02d9df7af51aab964da08ba116689e36d967150a031061dac84c65b1f2a02ad"
  },
  {
    "file": "src/lib/mutiny/desktop-actions.tsx",
    "sha256": "9401b63d7adc6f84631bb5fd857cec54a86b09f0e7de3a99e40fd6c9d5d01013"
  }
];
/** Overlay files are pinned: fail before writing if a different revision is present. */
export function integrateAiServices(root) {
  const writes = [];
  for (const {file, sha256} of replacements) {
    const source = fs.readFileSync(path.join(kit, file), 'utf8').replace(/\r\n/g, '\n');
    const target = path.join(root, file);
    const old = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    if (old === source) continue;
    if (createHash('sha256').update(old).digest('hex') !== sha256) throw Error(`Unexpected AI source revision: ${file}`);
    writes.push([target, source]);
  }
  // Existing AI entry-point visibility must include accounts with only a Gemini key.
  for (const relative of ['src/components/search/search-overlay.tsx', 'src/views/mobile/mobile-search.tsx', 'src/views/detail/series-episodes.tsx']) {
    const file = path.join(root, relative);
    const old = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const before = 'settings.aiSearchKey.trim() || settings.aiGroqKey.trim()';
    const after = before + ' || settings.aiGeminiKey.trim()';
    if (old.includes(after)) continue;
    if (old.split(before).length !== 2) throw Error(`Unexpected AI visibility anchor: ${relative}`);
    writes.push([file, old.replace(before, after)]);
  }
  for (const [file, source] of writes) fs.writeFileSync(file, source);
  console.log(`Integrated direct AI services (${writes.length} checked files).`);
}
