import { controls, rpc } from './engines.js';
import {renderHomeActions, closeQuickDialog} from './home-actions.js';
import { getPreferences, applyPreferences, rankStreams, normalizeProviderList, renderPreferenceSettings } from './preferences.js';
import { collectionPicker, collectionManager } from './collections.js';
import { searchAcrossProviders, metadataCandidates } from './search.js';
import { safeUrl, addonBase, sourcesFor, streamId, supportsStreams, jsonRequest } from './model.js';

applyPreferences();
const main = document.querySelector('#main');
const dialog = document.querySelector('#detail');
const detail = document.querySelector('#detail-body');
const API = 'https://v3-cinemeta.strem.io';
let page = 'home', type = 'movie', pageToken = 0, detailToken = 0;
let saved = read('mutiny.android.library.v1', []);
let addons = read('mutiny.android.addons.v1', []);
let current = null, episode = null, sourceIndex = 0, streamToken = 0;
let toastTimer;
function read(key, fallback) { try { const data = JSON.parse(localStorage.getItem(key)); return Array.isArray(data) ? data : fallback; } catch { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Unable to save. Your device storage may be full.'); } }
function el(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
function button(text, action, className) { const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node; }
function toast(message) { const node = document.querySelector('#toast'); node.textContent = message; node.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => node.style.display = 'none', 4500); }
function native(action, url) { if (url && !safeUrl(url)) return toast('Unsupported address. Only public HTTPS sources can be opened.'); location.href = `mutiny://${action}${url ? '?url=' + encodeURIComponent(url) : ''}`; }
function picture(url, title) { const img = el('img'); img.alt = title || ''; img.loading = 'lazy'; if (safeUrl(url)) img.src = url; return img; }
function stateBox(target, message, retry) { target.replaceChildren(el('p', message, 'empty')); if (retry) target.append(button('Try again', retry)); }
function setPage(next) {
  page = next; pageToken++; detailToken++; streamToken++;
  if (dialog.open) dialog.close();
  closeQuickDialog();
  document.querySelectorAll('.header-nav').forEach(node => {
    const selected=node.dataset.page===page;
    node.classList.toggle('active',selected);
    node.setAttribute('aria-current',selected?'page':'false');
  });
  main.replaceChildren(); window.scrollTo(0, 0);
  if (page === 'home') home();
  if (page === 'search') search();
  if (page === 'library') library();
  if (page === 'settings') settings();
}
function filters(callback) {
  const chips = el('div', null, 'chips');
  for (const [value, label] of [['movie', 'Movies'], ['series', 'Series']]) chips.append(button(label, () => { type = value; callback(); }, value === type ? 'selected' : ''));
  return chips;
}
function grid(metas) {
  const node = el('div', null, 'grid');
  for (const meta of metas.filter(meta => meta && typeof meta.id === 'string').slice(0, 100)) {
    const card = button('', () => openTitle(meta), 'card');
    card.append(picture(meta.poster, meta.name), el('strong', meta.name || 'Untitled'), el('small', [meta.releaseInfo || meta.year, meta.type === 'series' ? 'Series' : 'Movie'].filter(Boolean).join(' · ')));
    node.append(card);
  }
  return node;
}
function home() {
  const hero = el('section', null, 'hero');
  hero.append(el('span', 'Your next great escape', 'eyebrow'), el('h1', 'A world of stories.\nOne place to start.'), el('p', 'Find something worth watching. Bring your sources. Make it your own.'), button('Explore the catalog  →', () => setPage('search'), 'primary'));
  const actions=renderHomeActions({
    openWebSources: () => {setPage('search');toast('Search for a title and open Web Sources in its details.');},
    openLocalVideo: () => native('local'),
    openSettings: () => setPage('settings'),
    onSearchTitle: query => window.dispatchEvent(new CustomEvent('mutiny-search-title',{detail:query})),
  });
  main.append(hero,actions,filters(() => setPage('home')), el('h2', type === 'movie' ? 'Popular movies' : 'Popular series'));
  const results = el('section'); main.append(results);
  loadCatalog(results, `${API}/catalog/${type}/top.json`, pageToken);
}
async function loadCatalog(target, url, token) {
  stateBox(target, 'Loading titles…');
  try {
    const data = await jsonRequest(url);
    if (token !== pageToken) return;
    if (!Array.isArray(data.metas) || !data.metas.length) return stateBox(target, 'No titles found. Try another search.');
    target.replaceChildren(grid(data.metas));
    if (page === 'home') target.append(el('p', 'Catalog metadata provided by Cinemeta. Source availability varies by title.', 'note'));
  } catch (error) {
    if (token === pageToken) stateBox(target, 'Could not load the catalog. Check your connection and try again.', () => loadCatalog(target, url, token));
  }
}
function search() {
  main.append(el('span', 'Find your next watch', 'eyebrow'), el('h1', 'Search'));
  const form = el('form'), input = el('input'); input.type = 'search'; input.placeholder = 'Movies, shows, and more'; input.setAttribute('aria-label', 'Search titles'); input.maxLength = 150;
  const submit = el('button', 'Search', 'primary'); submit.type = 'submit'; form.append(input, submit);
  const results = el('section');
  const run = () => {
    const query = input.value.trim();
    if (!query) return;
    const token = ++pageToken;
    stateBox(results,'Searching Cinemeta and installed add-on catalogs…');
    searchAcrossProviders(query,type,addons,saved).then(data=>{
      if(token!==pageToken||page!=='search')return;
      if(!data.metas.length)return stateBox(results,'No matching titles found. Try a different search or provider.');
      results.replaceChildren(el('p',data.sources.length?'Results from '+data.sources.join(', '):'Results from your saved library','note'),grid(data.metas));
      if(data.failed)results.append(el('p',data.failed+' catalog request(s) failed. Available results are shown.','note'));
    }).catch(error=>{if(token===pageToken)stateBox(results,'Search failed: '+error.message,run);});
  };
  const chips = filters(() => { [...chips.children].forEach((node, i) => node.classList.toggle('selected', i === (type === 'movie' ? 0 : 1))); run(); });
  form.addEventListener('submit', event => { event.preventDefault(); run(); input.blur(); });
  main.append(form, chips, results); stateBox(results, 'Search the movie and series catalog by title.');
}
function library() {
  main.append(el('span','Collected by you','eyebrow'),el('h1','My library'),el('p','Your saved titles and collections stay on this device. Cloud library imports are optional.'));
  if (!saved.length) main.append(el('p','Your library is waiting. Save a title to build your library.','empty'),button('Discover titles',()=>setPage('home'),'primary'));
  else main.append(el('h2','All saved titles'),grid(saved));
  collectionManager(main,saved,grid,toast);
}
function closeTitle() { detailToken++; streamToken++; current = null; dialog.close(); if (page === 'library') setPage('library'); }
document.querySelector('#close-detail').addEventListener('click', closeTitle);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeTitle(); });
window.mutinyBack = () => { if (closeQuickDialog()) return true; if (dialog.open) { closeTitle(); return true; } if (page !== 'home') { setPage('home'); return true; } return false; };
async function openTitle(meta) {
  const token = ++detailToken; streamToken++;
  current = { ...meta }; episode = null; sourceIndex = 0;
  detail.replaceChildren(el('p', 'Loading title…')); if (!dialog.open) dialog.showModal();
  let resolved = false;
  for(const url of metadataCandidates(meta,addons)) {
    try {
      const data = await jsonRequest(url);
      if(token !== detailToken)return;
      if(!data?.meta || data.meta.id !== meta.id || data.meta.type !== meta.type) continue;
      current = {...meta,...data.meta};
      resolved = true; break;
    } catch { /* Try the next provider without losing the catalog's metadata. */ }
  }
  if(token !== detailToken)return;
  if(!resolved && metadataCandidates(meta,addons).length)toast('Full title details unavailable. Showing catalog metadata.');
  renderTitle();
}
function renderTitle() {
  const meta = current;
  detail.replaceChildren();
  const heading = el('div', null, 'detail-head'), text = el('div');
  text.append(el('span', meta.type === 'series' ? 'Series' : 'Movie', 'eyebrow'), el('h1', meta.name || 'Untitled'), el('p', [meta.releaseInfo, meta.imdbRating && `IMDb ${meta.imdbRating}`].filter(Boolean).join(' · ')));
  heading.append(picture(meta.poster, meta.name), text);
  const save = button('', () => {
    const found = saved.some(item => item.id === meta.id && item.type === meta.type);
    saved = found ? saved.filter(item => item.id !== meta.id || item.type !== meta.type) : [{ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster, releaseInfo: meta.releaseInfo }, ...saved].slice(0, 500);
    write('mutiny.android.library.v1', saved); if(window.Mutiny) rpc('account.bookmark',{meta,removed:found}).catch(e=>toast('Saved on device. Cloud sync: '+e.message)); save.textContent = found ? '♡  Save to library' : '♥  Saved to library';
  });
  save.textContent = saved.some(item => item.id === meta.id && item.type === meta.type) ? '♥  Saved to library' : '♡  Save to library';
  detail.append(heading, save, el('p', meta.description || 'No description available.', 'overview'));
  detail.append(collectionPicker(meta,toast));
  if (meta.type === 'series') episodePicker(meta);
  const sources = el('section', null, 'source-section'); sources.id = 'sources'; detail.append(sources); renderSources();
}
function episodePicker(meta) {
  const episodes = Array.isArray(meta.videos) ? meta.videos.filter(video => Number.isInteger(Number(video.season)) && Number(video.season) >= 0 && Number.isInteger(Number(video.episode)) && Number(video.episode) > 0).sort((a, b) => a.season - b.season || a.episode - b.episode) : [];
  if (!episodes.length) { detail.append(el('p', 'Episode metadata is unavailable. Try again when connected.', 'note')); return; }
  const seasons = [...new Set(episodes.map(item => Number(item.season)))];
  const label = el('label', 'Season'); label.htmlFor = 'season';
  const select = el('select'); select.id = 'season'; seasons.forEach(value => { const option = el('option', `Season ${value}`); option.value = String(value); select.append(option); });
  const preferred = seasons.find(value => value > 0) ?? seasons[0]; select.value = String(preferred);
  const list = el('div'); list.id = 'episodes'; list.setAttribute('aria-label', 'Episodes');
  const update = () => {
    episode = null; sourceIndex = 0; streamToken++; list.replaceChildren();
    for (const video of episodes.filter(item => Number(item.season) === Number(select.value))) {
      const node = button(`E${video.episode}  ·  ${video.title || video.name || 'Episode ' + video.episode}`, () => {
        episode = video; sourceIndex = 0; streamToken++; [...list.children].forEach(child => child.classList.toggle('selected', child === node)); renderSources();
      }); list.append(node);
    }
    if (document.querySelector('#sources')) renderSources();
  };
  select.addEventListener('change', update); detail.append(label, select, list); update();
}
function renderSources() {
  const target = document.querySelector('#sources'); if (!target || !current) return;
  target.replaceChildren(el('h2', 'Choose a source'));
  if (current.type === 'series' && !episode) { target.append(el('p', 'Select an episode above to see its sources.', 'note')); return; }
  if (episode) target.append(el('p', `Season ${episode.season} · Episode ${episode.episode}`, 'eyebrow'));
  const tabs = el('div', null, 'chips');
  const web = button('Web sources', () => { web.classList.add('selected'); addon.classList.remove('selected'); renderWeb(body); }, 'selected');
  const addon = button('Add-on providers', () => { addon.classList.add('selected'); web.classList.remove('selected'); renderStreams(body); });
  tabs.append(web, addon); const body = el('div'); target.append(tabs, body); renderWeb(body);
}
function renderWeb(target) {
  streamToken++;
  const prefs=getPreferences(), blocked=normalizeProviderList(prefs.blockedProviders);
  const priority=normalizeProviderList(prefs.providerPriority);
  const available=sourcesFor(current,episode).filter(item=>!blocked.some(word=>item.name.toLowerCase().includes(word)))
    .sort((a,b)=>{const score=x=>{const n=priority.indexOf(x.name.toLowerCase());return n===-1?0:priority.length-n;};return score(b)-score(a);});
  target.replaceChildren();
  if (!available.length) return target.append(el('p', 'No configured web source accepts this title’s identifiers. Try Add-on providers.', 'note'));
  const label = el('label', 'Provider'); label.htmlFor = 'provider';
  const select = el('select'); select.id = 'provider';
  available.forEach((item, index) => { const option = el('option', index === 0 ? `Automatic · ${item.name}` : item.name); option.value = String(index); select.append(option); });
  sourceIndex = Math.min(sourceIndex, available.length - 1); select.value = String(sourceIndex);
  select.addEventListener('change', () => sourceIndex = Number(select.value));
  const row = el('div', null, 'row');
  row.append(button('▶  Play source', () => native('web', available[sourceIndex].result.url), 'primary'), button('Try next source', () => { sourceIndex = (sourceIndex + 1) % available.length; select.value = String(sourceIndex); toast(`Selected ${available[sourceIndex].name}. Tap Play source.`); }));
  target.append(label, select, el('p', `${available.length} sources configured for this title. Playback depends on each provider and has not been verified.`, 'note'), row, button('Open in browser ↗', () => native('external', available[sourceIndex].result.url)), el('p', 'Web sources may show third-party ads or require a browser. Pop-up windows are blocked in the app.', 'note'));
}
async function renderStreams(target) {
  const token=++streamToken, id=streamId(current,episode), mediaType=current.type==='series'?'series':'movie';
  const matching=addons.filter(addon=>supportsStreams(addon.manifest,mediaType,id||''));
  target.replaceChildren();
  if(!matching.length)return target.append(el('p','No installed Stremio-compatible add-on offers streams for this title. Add a manifest in Settings.','note'));
  stateBox(target,'Asking add-on providers…');
  const results=await Promise.allSettled(matching.map(async addon=>({addon,data:await jsonRequest(`${addon.base}/stream/${mediaType}/${encodeURIComponent(id)}.json`)})));
  if(token!==streamToken||!target.isConnected)return;
  target.replaceChildren();
  let failures=0,unsupported=0;
  const collected=[];
  for(const result of results){
    if(result.status!=='fulfilled'){failures++;continue;}
    const {addon,data}=result.value;
    if(!Array.isArray(data.streams))continue;
    for(const stream of data.streams.slice(0,80)){
      if(!stream||typeof stream!=='object')continue;
      const hash=String(stream.infoHash||''), url=stream.url||stream.externalUrl;
      if(/^[a-f0-9]{40}$/i.test(hash)){collected.push({...stream,providerName:addon.manifest.name,kind:'torrent'});continue;}
      if(!safeUrl(url)){unsupported++;continue;}
      const rawHeaders=stream.behaviorHints?.proxyHeaders?.request??stream.headers??{};
      const headers={};let invalidHeaders=rawHeaders===null||typeof rawHeaders!=='object'||Array.isArray(rawHeaders);
      if(!invalidHeaders)for(const [key,value] of Object.entries(rawHeaders)){
        if(!['user-agent','referer'].includes(key.toLowerCase())||typeof value!=='string'||value.length>512||/[\r\n]/.test(value)){invalidHeaders=true;break;}
        headers[key]=value;
      }
      if(invalidHeaders){unsupported++;continue;}
      collected.push({...stream,providerName:addon.manifest.name,kind:stream.externalUrl?'external':'https',url,headers});
    }
  }
  const prefs=getPreferences(), ranked=rankStreams(collected,prefs,current);
  if(!ranked.length)target.append(el('p','No streams match your preferences or the provider results. Adjust filters in Settings if needed.','note'));
  ranked.forEach((stream,index)=>{
    const box=el('div',null,'box');box.append(el('strong',stream.name||stream.providerName||'Stream'),el('p',stream.title||stream.description||'', 'small'));
    const info=[stream.providerName,stream.kind==='torrent'?'Torrent':stream.kind==='external'?'External page':'Direct video'].filter(Boolean).join(' · ');
    box.append(el('p',info,'note'));
    if(stream.kind==='torrent'){
      box.append(button('▶ Stream torrent',async()=>{try{await rpc('torrent.add',{magnet:'magnet:?xt=urn:btih:'+stream.infoHash,fileIndex:stream.fileIdx??-1,meta:{...current,videoId:id,season:episode?.season,episode:episode?.episode}});closeTitle();setPage('settings');toast('Torrent added. Open Media engines to select a file or play.')}catch(error){toast(error.message)}} ,'primary'));
    }else if(stream.kind==='external'){
      box.append(button('Open source ↗',()=>native('external',stream.url),'primary'));
    }else{
      box.append(button('▶ Play video',()=>{
        if(!window.Mutiny)return native('video',stream.url);
        const signature=value=>JSON.stringify(Object.entries(value.headers||{}).sort(([a],[b])=>a.localeCompare(b)));
        const fallbackUrls=prefs.autoFallback?ranked.filter(other=>other.kind==='https'&&other.url!==stream.url&&signature(other)===signature(stream)&&(Object.keys(stream.headers||{}).length===0||new URL(other.url).origin===new URL(stream.url).origin)).map(other=>other.url).slice(0,5):[];
        return rpc('video.play',{url:stream.url,headers:stream.headers||{},fallbackUrls,lowBandwidth:prefs.lowBandwidth,meta:{...current,videos:undefined,videoId:id,season:episode?.season,episode:episode?.episode}}).catch(error=>toast(error.message));
      },'primary'));
      if (/\.(mp4|mkv|webm|mov|m4v|avi)$/i.test(new URL(stream.url).pathname) && !Object.keys(stream.headers||{}).length) {
        box.append(button('Download video',()=>rpc('download.start',{url:stream.url,title:current.name}).then(()=>toast('Download added to Android Download Manager.')).catch(error=>toast(error.message))));
      }
      box.append(button('Open in another app',()=>native('external',stream.url)));
    }
    target.append(box);
  });
  if(failures)target.append(el('p',failures+' provider request(s) failed; working sources are still shown.','note'));
  if(unsupported)target.append(el('p',unsupported+' stream(s) require unsupported headers or protocols.','note'));
  if(prefs.lowBandwidth)target.append(el('p','Low-bandwidth mode prefers smaller streams when providers label their resolution. It cannot transcode remote videos.','note'));
  target.append(button('Refresh sources',()=>renderStreams(target)));
}
function settings() {
  main.append(el('span', 'Make it yours', 'eyebrow'),el('h1','Settings'));
  renderPreferenceSettings(main,toast);
  controls(main,openTitle);
  main.append(el('h2', 'Add-on providers'), el('p', 'Connect a Stremio-compatible provider using its HTTPS manifest address.'));
  const form = el('form'), input = el('input'); input.type = 'url'; input.placeholder = 'https://provider.example/manifest.json'; input.setAttribute('aria-label', 'Add-on manifest URL'); input.required = true;
  const submit = el('button', 'Add', 'primary'); submit.type = 'submit'; form.append(input, submit); main.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault(); submit.disabled = true; const token = pageToken;
    try {
      const base = addonBase(input.value);
      if (addons.some(addon => addon.base === base)) throw Error('This add-on is already installed.');
      const manifest = await jsonRequest(base + '/manifest.json');
      if (!manifest || typeof manifest.id !== 'string' || typeof manifest.name !== 'string' || !Array.isArray(manifest.resources)) throw Error('This is not a valid add-on manifest.');
      addons.push({ base, manifest: { id: manifest.id, name: manifest.name, resources: manifest.resources, types: manifest.types, catalogs: manifest.catalogs } });
      write('mutiny.android.addons.v1', addons); toast('Add-on installed.'); if (page === 'settings' && pageToken === token) setPage('settings');
    } catch (error) { toast(error.name === 'AbortError' ? 'Provider timed out. Try again.' : error.message || 'Could not connect to this add-on.'); }
    finally { submit.disabled = false; }
  });
  if (!addons.length) main.append(el('p', 'No add-on providers installed.', 'note'));
  for (const addon of addons) {
    const row = el('div', null, 'addon box'), text = el('div'); text.append(el('strong', addon.manifest.name), el('p', new URL(addon.base).host, 'small'));
    row.append(text, button('Remove', () => { addons = addons.filter(item => item.base !== addon.base); write('mutiny.android.addons.v1', addons); setPage('settings'); })); main.append(row);
  }
  main.append(el('h2', 'On this device'), button('Open local video', () => native('local')), el('p', 'Choose a video with Android’s file picker. No broad storage permission is needed.', 'note'));
  const directLabel = el('label', 'Play a direct HTTPS video address'); directLabel.htmlFor = 'direct-url';
  const direct = el('form'), address = el('input'); address.id = 'direct-url'; address.type = 'url'; address.placeholder = 'https://example.com/video.mp4'; address.required = true;
  const play = el('button', 'Play'); play.type = 'submit'; direct.append(address, play); direct.addEventListener('submit', event => { event.preventDefault(); native('video', address.value.trim()); }); main.append(directLabel, direct);
  main.append(el('h2', 'About this preview'), el('p', 'Mutiny Media 1.0.2-dev · Android preview', 'note'), el('p', 'Android 8 or newer. Reuses the 42 configured web-source adapters from the linked Windows release. Metadata comes from Cinemeta. Local library and add-ons are stored on this device. Open Settings for accounts, torrents, appearance, anime preferences and AI.', 'note'), el('p', 'Source hosts and add-ons receive requests when used. Install only providers you trust. Some video codecs need an external player.', 'note'));
  main.append(button('Clear saved library', () => { saved = []; write('mutiny.android.library.v1', saved); toast('Saved library cleared.'); }));
}
window.addEventListener('mutiny-library-import', event=>{
  for(const item of event.detail||[]){
    if(!item?.id||!['movie','series'].includes(item.type))continue;
    if(!saved.some(old=>old.id===item.id&&old.type===item.type))saved.push(item);
  }
  saved=saved.slice(0,2000);write('mutiny.android.library.v1',saved);
  if(page==='library')setPage('library');else toast('Cloud library merged into My library.');
});
window.addEventListener('mutiny-addons-import',async event=>{
  let imported=0,failed=0;
  for(const item of (event.detail||[]).slice(0,100)){
    try{
      const raw=item.manifestUrl||item.manifest_url||item.url||item.transportUrl||item.transport_url;
      const base=addonBase(String(raw||''));
      if(addons.some(addon=>addon.base===base))continue;
      const manifest=await jsonRequest(base+'/manifest.json');
      if(!manifest||typeof manifest.id!=='string'||typeof manifest.name!=='string'||!Array.isArray(manifest.resources))throw Error('Invalid manifest');
      addons.push({base,manifest:{id:manifest.id,name:manifest.name,resources:manifest.resources,types:manifest.types,catalogs:manifest.catalogs}});imported++;
    }catch{failed++;}
  }
  write('mutiny.android.addons.v1',addons);toast(imported+' add-ons imported'+(failed?', '+failed+' skipped':''));
});
window.addEventListener('mutiny-search-title',event=>{
  const query=String(event.detail||'').slice(0,150);if(!query)return;
  setPage('search');const input=main.querySelector('input[type=search]');
  if(input){input.value=query;input.closest('form')?.requestSubmit();}
});
document.querySelectorAll('.header-nav').forEach(node => node.addEventListener('click', () => setPage(node.dataset.page)));
document.querySelector('#brand').addEventListener('click', event => { event.preventDefault(); setPage('home'); });
setPage('home');
