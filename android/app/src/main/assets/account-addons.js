import { addonBase } from './model.js';

const ACCOUNTS = ['stremio', 'nuvio'];

function manifestAddress(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  return item.transportUrl || item.transport_url || item.manifestUrl ||
    item.manifest_url || item.url || '';
}
function validManifest(manifest) {
  return !!manifest && typeof manifest.id === 'string' &&
    typeof manifest.name === 'string' && Array.isArray(manifest.resources);
}
function cleanManifest(manifest) {
  return {
    id: manifest.id, name: manifest.name, resources: manifest.resources,
    types: manifest.types, idPrefixes:manifest.idPrefixes, catalogs:Array.isArray(manifest.catalogs) ? manifest.catalogs : []
  };
}

/** One visible provider per HTTPS manifest, with all account origins preserved. */
export function combineProviderAddons(localAddons = [], accountAddons = []) {
  const merged = new Map();
  for (const addon of [...localAddons, ...accountAddons]) {
    if (!addon || typeof addon.base !== 'string' || !validManifest(addon.manifest)) continue;
    const origin = ACCOUNTS.includes(addon.account) ? addon.account : 'device';
    const existing = merged.get(addon.base);
    if (existing) {
      if (!existing.origins.includes(origin)) existing.origins.push(origin);
    } else {
      merged.set(addon.base, {base: addon.base, manifest: addon.manifest, catalogKey:addon.catalogKey, origins: [origin]});
    }
  }
  return [...merged.values()];
}

/** Keep the previous account snapshot on a transient sync error, but never after logout or user switch. */
export async function reconcileAccountAddons(previous = [], payload = {}, loadManifest, refresh = false) {
  const addons = [], stats = {};
  for (const account of ACCOUNTS) {
    const state = payload?.[account];
    if (!state?.signedIn) { stats[account] = {count: 0, signedIn: false}; continue; }
    const user = String(state.user || '');
    const profile = Number(state.profile || 1);
    if (!user) continue;
    if (!Array.isArray(state.addons)) {
      const cached = previous.filter(item => item.account === account && item.user === user && (item.profile || 1) === profile);
      addons.push(...cached);
      stats[account] = {count: cached.length, signedIn: true, error: String(state.error || 'Sync unavailable')};
      continue;
    }
    const previousForUser = new Map(previous
      .filter(item => item.account === account && item.user === user && (item.profile || 1) === profile && validManifest(item.manifest))
      .map(item => [item.base, item]));
    const addresses = new Set();
    let skipped = 0;
    for (const item of state.addons.slice(0, 200)) {
      try { addresses.add(addonBase(String(manifestAddress(item)))); }
      catch { skipped++; }
    }
    const bases = [...addresses];
    const imported = [];
    // Small batches limit network activity and avoid one failing addon blocking the others.
    for (let i = 0; i < bases.length; i += 8) {
      const batch = await Promise.all(bases.slice(i, i + 8).map(async base => {
        const old = previousForUser.get(base);
        if (old && !refresh) return old;
        try {
          const manifest = await loadManifest(base + '/manifest.json');
          if (!validManifest(manifest)) return old || null;
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base));
          const catalogKey = 'addon:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
          return {base, catalogKey, account, user, profile, manifest: cleanManifest(manifest)};
        } catch { return old || null; }
      }));
      for (const result of batch) {
        if (result) imported.push(result);
        else skipped++;
      }
    }
    addons.push(...imported);
    stats[account] = {count: imported.length, signedIn: true, skipped};
  }
  return {addons, stats};
}
