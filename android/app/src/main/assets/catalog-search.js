import { jsonRequest } from './model.js';

export const CINEMETA = 'https://v3-cinemeta.strem.io';

function searchable(catalog, type) {
  if (catalog?.type !== type || !catalog.id || typeof catalog.id !== 'string') return false;
  const extras = Array.isArray(catalog.extra) ? catalog.extra : [];
  return extras.some(extra => extra?.name === 'search') && extras.every(extra => !extra?.isRequired || extra.name === 'search');
}

export function titleKey(meta) {
  const global = /^tt\d+$/.test(meta.id);
  return JSON.stringify([meta.type, global ? '' : meta.catalogBase || CINEMETA, meta.id]);
}

export async function searchCatalogs(type, query, addons, request = jsonRequest, current = () => true) {
  const catalogs = [{base:CINEMETA, id:'top', name:'Cinemeta'}];
  let failures = 0;
  const hydrated = [];
  for (let offset = 0; offset < addons.length && current(); offset += 6) {
    const batch = await Promise.all(addons.slice(offset,offset + 6).map(async addon => {
      if (!addon?.manifest || Array.isArray(addon.manifest.catalogs)) return addon;
      try {
        const manifest = await request(addon.base + '/manifest.json');
        if (manifest?.id !== addon.manifest.id || !Array.isArray(manifest.resources)) throw Error('Invalid manifest');
        return {...addon, manifest:{...addon.manifest, catalogs:Array.isArray(manifest.catalogs) ? manifest.catalogs : []}};
      } catch { failures++; return addon; }
    }));
    hydrated.push(...batch);
  }
  for (const addon of hydrated) {
    const list = addon?.manifest?.catalogs;
    if (!Array.isArray(list)) continue;
    for (const catalog of list.filter(item => searchable(item, type))) {
      if (!catalogs.some(item => item.base === addon.base && item.id === catalog.id))
        catalogs.push({base:addon.base, id:catalog.id, name:addon.manifest.name});
    }
  }
  const found = new Map();
  for (let offset = 0; offset < catalogs.length && current(); offset += 6) {
    const batch = catalogs.slice(offset, offset + 6);
    const responses = await Promise.allSettled(batch.map(async catalog => {
      const data = await request(catalog.base + '/catalog/' + type + '/' + encodeURIComponent(catalog.id) + '/search=' + encodeURIComponent(query) + '.json');
      if (!Array.isArray(data?.metas)) throw Error('Malformed catalogue');
      return data.metas;
    }));
    responses.forEach((result, index) => {
      if (result.status === 'rejected') { failures++; return; }
      const catalog = batch[index];
      for (const meta of result.value.slice(0,100)) {
        if (meta?.type !== type || typeof meta.id !== 'string' || !meta.id || typeof meta.name !== 'string') continue;
        const entry = {...meta, catalogBase:catalog.base, sourceNames:[catalog.name]};
        const key = titleKey(entry), previous = found.get(key);
        if (!previous) found.set(key, entry);
        else if (!previous.sourceNames.includes(catalog.name)) previous.sourceNames.push(catalog.name);
      }
    });
  }
  return {metas:[...found.values()], failures, hydrated};
}
