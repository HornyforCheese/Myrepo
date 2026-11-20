/** Universal searchable catalog for Cinemeta and installed Stremio-compatible add-ons. */
import {jsonRequest,safeUrl} from './model.js';
const CINEMETA='https://v3-cinemeta.strem.io';
const key=meta=>{
  const imdb=String(meta?.imdb_id||meta?.id||'').match(/tt\d{5,12}/);
  if(imdb)return imdb[0].toLowerCase();
  return [String(meta?.name||'').trim().toLowerCase().replace(/[^a-z0-9]/g,''),String(meta?.year||meta?.releaseInfo||'').slice(0,4),meta?.type||'movie'].join('|');
};
export function dedupeMedia(items) {
  const seen=new Map();
  for(const meta of items) {
    if(!meta||typeof meta.id!=='string'||!meta.id||typeof meta.name!=='string'||!meta.name)continue;
    const id=key(meta);
    if(!seen.has(id)){seen.set(id,meta);continue;}
    const old=seen.get(id);
    // Prefer complete metadata while retaining an identifying catalog ID.
    const value={...old,description:old.description||meta.description,poster:old.poster||meta.poster,releaseInfo:old.releaseInfo||meta.releaseInfo,year:old.year||meta.year};
    seen.set(id,value);
  }
  return [...seen.values()].slice(0,200);
}
function hasCatalog(manifest,type,catalog) {
  const supports=Array.isArray(manifest?.resources)&&manifest.resources.some(item=>item==='catalog'||item?.name==='catalog');
  return supports && Array.isArray(manifest.catalogs) && catalog.type===type && typeof catalog.id==='string' &&
    (catalog.extraSupported?.includes('search')||catalog.extra?.some(item=>item?.name==='search'));
}
export async function searchAcrossProviders(query,type,addons=[],saved=[]) {
  const text=String(query||'').trim().slice(0,150);if(!text)return {metas:[],sources:[],failed:0};
  const calls=[{name:'Cinemeta',url:`${CINEMETA}/catalog/${type}/top/search=${encodeURIComponent(text)}.json`,base:''}];
  for(const addon of addons.slice(0,20)){
    if(!safeUrl(addon?.base)||!addon.manifest)continue;
    for(const catalog of (addon.manifest.catalogs||[]).filter(c=>hasCatalog(addon.manifest,type,c)).slice(0,3)) {
      calls.push({name:String(addon.manifest.name||'Add-on'),base:addon.base,url:`${addon.base}/catalog/${type}/${encodeURIComponent(catalog.id)}/search=${encodeURIComponent(text)}.json`});
    }
  }
  const results=await Promise.allSettled(calls.map(async call=>({name:call.name,data:await jsonRequest(call.url)})));
  const metas=saved.filter(item=>item.type===type&&String(item.name||'').toLowerCase().includes(text.toLowerCase()));
  const sources=[],errors=[];
  results.forEach((result,index)=>{
    if(result.status!=='fulfilled'){errors.push(calls[index].name);return;}
    const data=result.value.data;
    if(Array.isArray(data?.metas)) {metas.push(...data.metas.filter(item=>item?.type===type).map(item=>({...item,...(calls[index].base?{_sourceBase:calls[index].base}:{})})));sources.push(result.value.name);}
  });
  return {metas:dedupeMedia(metas),sources:[...new Set(sources)],failed:errors.length};
}

/** Resolve metadata from the catalog that supplied a title, then compatible add-ons.
 * Cinemeta is used for IMDb identifiers only; it cannot resolve arbitrary plugin IDs.
 */
export function metadataCandidates(meta,addons=[]) {
  const type=meta?.type==='series'?'series':'movie',id=String(meta?.id||'');
  if(!id||id.length>200) return [];
  const candidates=[],seen=new Set();
  const add=base=> {
    if(!safeUrl(base)||seen.has(base))return;
    seen.add(base);candidates.push(`${base}/meta/${type}/${encodeURIComponent(id)}.json`);
  };
  if(/^tt\d{5,12}$/i.test(id))add(CINEMETA);
  const matching=addons.filter(addon=>{
    if(!safeUrl(addon?.base)||!addon?.manifest)return false;
    const manifest=addon.manifest;
    if(Array.isArray(manifest.types)&&!manifest.types.includes(type))return false;
    return Array.isArray(manifest.resources)&&manifest.resources.some(resource=>
      resource==='meta'||(resource?.name==='meta'&&
      (!Array.isArray(resource.types)||resource.types.includes(type))&&
      (!Array.isArray(resource.idPrefixes)||resource.idPrefixes.some(prefix=>id.startsWith(prefix)))
    ));
  });
  const preferred=matching.find(item=>item.base===meta?._sourceBase);
  if(preferred)add(preferred.base);
  matching.forEach(addon=>add(addon.base));
  return candidates.slice(0,5);
}
