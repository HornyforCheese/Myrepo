import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repairNuvioHookOrder } from '../tools/nuvio-hook-compat.mjs';
const pinned = `export function NuvioSyncedAddonsCard() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const state = loadNuvioState();
  const isConnected = state.session != null;
  useEffect(() => {
    if (isConnected) sync();
  }, [isConnected]);
  if (!isConnected) {
    return null;
  }
  return <Card />;
}`;
test('pinned card preserves hooks and connection behavior without inventing settings', () => {
  const result = repairNuvioHookOrder(pinned);
  assert.equal(result.replace('  // Mutiny hooks order fix: pinned 1.0.1 has no conditional settings hook.\n', ''), pinned);
  assert.ok(!result.includes('useSettings'));
  assert.equal(repairNuvioHookOrder(result), result);
});
test('archived conditional hook is moved above the early return exactly once', () => {
  const original = `function NuvioSyncedAddonsCard(){
  const state = loadNuvioState();
  if (!state) return null;
  const { settings, update } = useSettings();
  const addonMode = settings.nuvioAddonMode;
}`;
  const result = repairNuvioHookOrder(original);
  assert.equal(result.match(/useSettings\(\)/g).length, 1);
  assert.ok(result.indexOf('useSettings()') < result.indexOf('if (!state)'));
  assert.ok(result.includes('const addonMode = settings.nuvioAddonMode;'));
});
test('unknown or duplicate hook layouts are rejected', () => {
  assert.throws(() => repairNuvioHookOrder(pinned.replace('state.session != null', 'state.connected')));
  assert.throws(() => repairNuvioHookOrder(pinned.replace('  const state', '  useSettings();\n  const state')));
  assert.throws(() => repairNuvioHookOrder(pinned + '\n  const state = loadNuvioState();'));
});
