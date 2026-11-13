import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repairStartupArt } from '../tools/startup-art-compat.mjs';
const page = mark => `<title>Harbor</title><style>#harbor-boot > svg { width: 96px; }</style><div id="harbor-boot">\n${mark}\n</div><div id="root" inert></div><script>localStorage.getItem('harbor.custom-artwork.v1'); if (art && valid) showCustom();</script>`;
test('legacy SVG becomes the supplied mark while boot IDs and cache keys remain compatible', () => {
  const result = repairStartupArt(page('<svg viewBox="0 0 10 10"><path d="M0 0" /></svg>'));
  assert.ok(!result.includes('<svg'));
  assert.ok(result.includes('<title>Mutiny Media</title>'));
  assert.ok(result.includes('class="mutiny-boot-mark" src="/mutiny-mark.png"'));
  assert.ok(result.includes('harbor.custom-artwork.v1'));
  assert.ok(result.includes('<div id="root" inert>'));
  assert.ok(result.includes('if (false && art && valid)'));
});
test('already customized legacy image stays styled and is idempotent', () => {
  const result = repairStartupArt(page('<img class="mutiny-boot-mark" src="/old.png" alt="" />'));
  assert.ok(result.includes('#harbor-boot > .mutiny-boot-mark'));
  assert.equal(repairStartupArt(result), result);
});
test('unknown or duplicate boot layouts are refused', () => {
  assert.throws(() => repairStartupArt(page('<canvas />')));
  assert.throws(() => repairStartupArt(page('<svg></svg>') + page('<svg></svg>')));
});
