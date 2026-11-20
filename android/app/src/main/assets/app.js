import { controls, rpc } from './engines.js';
import { safeUrl, addonBase, sourcesFor, streamId, supportsStreams, jsonRequest } from './model.js';

const main = document.querySelector('#main');
const dialog = document.querySelector('#detail');
const detail = document.querySelector('#detail-body');
const API = 'https://v3-cinemeta.strem.io';
let page = 'home', type = 'movie', pageToken = 0, detailToken = 0;
let saved = read('mutiny.android.library.v1', []);
let addons = read('mutiny.android.addons.v1', []);
let current = null, episode = null, sourceIndex = 0, streamToken = 0;
let toastTimer;
let settingsSection = null;
let aiReturnPage = 'search';
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
  settingsSection = null;
  if (dialog.open) dialog.close();
  document.querySelectorAll('nav button').forEach(node => node.classList.toggle('active', node.dataset.page === page));
  main.replaceChildren(); window.scrollTo(0, 0);
  if (page === 'home') home();
  if (page === 'search') search();
  if (page === 'anime') animeDiscover();
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
  const quick = el('section', null, 'home-shortcuts');
  quick.append(el('h2', 'Quick actions'));
  const actions = el('div', null, 'grid');
  actions.append(
    button('Search with AI', () => aiSearch(), 'box'),
    button('Local video', () => native('local'), 'box'),
    button('Stream URL', () => { const url = prompt('Enter a direct HTTPS video URL'); if (url?.trim()) native('video', url.trim()); }, 'box'),
    button('Magnet link', async () => {
      const magnet = prompt('Enter a magnet link');
      if (!magnet?.trim()) return;
      if (!magnet.trim().startsWith('magnet:?xt=urn:btih:')) return toast('Enter a valid magnet link.');
      try { await rpc('torrent.add', {magnet:magnet.trim(),fileIndex:-1}); toast('Magnet link submitted.'); }
      catch(e) { toast(e.message || 'Torrent service unavailable.'); }
    }, 'box'),
    button('Search providers', () => { setPage('settings'); settings('addons'); }, 'box')
  );
  quick.append(actions);
  main.append(hero, quick, filters(() => setPage('home')), el('h2', type === 'movie' ? 'Popular movies' : 'Popular series'));
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
    loadCatalog(results, `${API}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`, token);
  };
  const chips = filters(() => { [...chips.children].forEach((node, i) => node.classList.toggle('selected', i === (type === 'movie' ? 0 : 1))); run(); });
  form.addEventListener('submit', event => { event.preventDefault(); run(); input.blur(); });
  const shortcuts = el('section', null, 'discover-shortcuts');
  shortcuts.append(el('h2', 'Quick actions'));
  const actions = el('div', null, 'grid');
  actions.append(
    button('Search with AI', () => aiSearch(), 'box'),
    button('Local video', () => native('local'), 'box'),
    button('Stream URL', () => {
      const url = prompt('Enter a direct HTTPS video URL');
      if (url?.trim()) native('video', url.trim());
    }, 'box'),
    button('Magnet link', async () => {
      const magnet = prompt('Enter a magnet link');
      if (!magnet?.trim()) return;
      if (!/^magnet:\?xt=urn:btih:/i.test(magnet.trim())) return toast('Enter a valid BitTorrent magnet link.');
      try { await rpc('torrent.add', {magnet:magnet.trim(),fileIndex:-1}); toast('Magnet link submitted.'); }
      catch(e) { toast(e.message || 'Torrent service is unavailable.'); }
    }, 'box'),
    button('Search providers', () => { setPage('settings'); settings('addons'); }, 'box')
  );
  shortcuts.append(actions);
  const anime = el('section', null, 'anime-discovery');
  anime.append(el('h2', 'Anime'), el('p', 'Search anime titles in the catalog. Dub, sub and uncensored filters require provider metadata.', 'note'));
  anime.append(button('Browse anime', () => setPage('anime'), 'box'));
  main.append(shortcuts, form, chips, anime, results); stateBox(results, 'Search movies, series and anime by title.');
}
function isAnimeMeta(meta) {
  return Array.isArray(meta?.genres) && meta.genres.some(genre => /^anime$/i.test(String(genre)));
}
function animeStreamTags(stream) {
  const label = [stream.name, stream.title, stream.description].filter(Boolean).join(' ');
  const dub = /\b(english[ ._-]*dub(?:bed)?|eng[ ._-]*dub(?:bed)?|dubbed[ ._-]*english)\b/i.test(label);
  const sub = /\b(english[ ._-]*sub(?:bed|titles?)?|eng[ ._-]*sub(?:bed)?|japanese[ ._-]*audio|jpn[ ._-]*audio|subbed)\b/i.test(label);
  const dual = /\bdual[ ._-]*audio\b/i.test(label) && /\b(eng(?:lish)?|jpn|japanese)\b/i.test(label);
  const uncensored = /\buncensored\b/i.test(label);
  return {dub,sub,dual,uncensored, audioKnown:dub||sub||dual, releaseKnown:uncensored||/\bcensored\b/i.test(label)};
}
function animeStreamMatch(stream, preferences) {
  const tags = animeStreamTags(stream);
  const audio = preferences.animeAudio || 'any';
  const release = preferences.animeRelease || 'any';
  const audioMatch = audio === 'any' || (audio === 'dub' && (tags.dub || tags.dual)) ||
    (audio === 'sub' && (tags.sub || tags.dual)) || (audio === 'dual' && tags.dual);
  return {matches:audioMatch && (release !== 'uncensored' || tags.uncensored), tags};
}
function animeFiltersPanel(onChange) {
  const panel = el('section', null, 'anime-stream-preferences');
  panel.append(el('h3', 'Anime stream filters'));
  preferenceChoice(panel, 'Audio', 'Match provider labels only; unknown tracks are excluded', 'animeAudio', [['any','Any'],['dub','English dub'],['sub','Japanese with subtitles'],['dual','Dual audio']], 'any', onChange);
  preferenceChoice(panel, 'Release', 'Require an explicit uncensored label; content is not independently verified', 'animeRelease', [['any','Any'],['uncensored','Uncensored only']], 'any', onChange);
  panel.append(el('p', 'Provider labels are unverified. Audio tracks and censorship cannot be confirmed from stream titles alone.', 'note'));
  return panel;
}
function animeDiscover() {
  main.append(el('span', 'Anime discovery', 'eyebrow'), el('h1', 'Anime'), el('p', 'Search titles tagged Anime in the catalogue. Untagged titles are excluded.', 'note'));
  main.append(button('‹ Back to Discover', () => setPage('search')));
  const form = el('form'), input = el('input');
  input.type = 'search'; input.placeholder = 'Anime title or keyword'; input.value = 'anime'; input.maxLength = 150;
  input.setAttribute('aria-label', 'Search anime titles');
  const submit = el('button', 'Search anime', 'primary'); submit.type = 'submit'; form.append(input, submit);
  const preferencePanel = el('section', null, 'anime-preferences');
  preferencePanel.append(el('h2', 'Anime preferences'));
  preferenceChoice(preferencePanel, 'Audio preference', 'Filter provider streams using explicit audio labels. Unlabelled streams are excluded when filtering.', 'animeAudio', [['any','Any'],['dub','English dub'],['sub','Japanese with subtitles'],['dual','Dual audio']], 'any');
  preferenceChoice(preferencePanel, 'Release preference', 'Only show explicitly labelled uncensored streams when enabled.', 'animeRelease', [['any','Any'],['uncensored','Prefer uncensored']], 'any');
  preferencePanel.append(el('p', 'Preferences filter stream labels supplied by add-ons. Unknown or incorrectly labelled streams cannot be verified.', 'note'));
  const typeRow = el('div', null, 'chips'), results = el('section');
  let animeType = 'series', token = 0;
  const updateType = () => {
    typeRow.replaceChildren();
    for (const [value, name] of [['series', 'Series'], ['movie', 'Films']])
      typeRow.append(button(name, () => { animeType = value; updateType(); run(); }, animeType === value ? 'selected' : ''));
  };
  const run = async () => {
    const query = input.value.trim();
    if (!query) return stateBox(results, 'Enter an anime title or keyword.');
    const request = ++token, pageRequest = pageToken;
    stateBox(results, 'Searching anime titles…');
    try {
      const data = await jsonRequest(`${API}/catalog/${animeType}/top/search=${encodeURIComponent(query)}.json`);
      if (request !== token || page !== 'anime' || pageRequest !== pageToken) return;
      if (!Array.isArray(data.metas) || !data.metas.length) return stateBox(results, 'No matching titles found.');
      const anime = data.metas.filter(isAnimeMeta);
      if (!anime.length) return stateBox(results, 'No titles explicitly tagged Anime were found. The catalogue may omit genre tags.');
      results.replaceChildren(grid(anime), el('p', 'Only titles with an Anime genre tag are shown. Stream language and release labels depend on the installed providers.', 'note'));
    } catch (error) {
      if (request === token && page === 'anime') stateBox(results, 'Anime search failed. Check your connection and retry.', run);
    }
  };
  form.addEventListener('submit', event => { event.preventDefault(); run(); });
  updateType();
  main.append(form, typeRow, preferencePanel, results);
  run();
}
function library() {
  main.append(el('span', 'Collected by you', 'eyebrow'), el('h1', 'My library'), el('p', 'Your saved titles stay on this device.'));
  if (!saved.length) return main.append(el('p', 'Your library is waiting. Open a title and tap Save to library.', 'empty'), button('Discover titles', () => setPage('home'), 'primary'));
  main.append(grid(saved));
}
function closeTitle() { detailToken++; streamToken++; current = null; dialog.close(); if (page === 'library') setPage('library'); }
document.querySelector('#close-detail').addEventListener('click', closeTitle);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeTitle(); });
window.mutinyBack = () => {
  if (dialog.open) { closeTitle(); return true; }
  if (page === 'settings' && settingsSection) { settings(); return true; }
  if (page === 'ai') { setPage(aiReturnPage); return true; }
  if (page === 'anime') { setPage('search'); return true; }
  if (page !== 'home') { setPage('home'); return true; }
  return false;
};
async function openTitle(meta) {
  const token = ++detailToken; streamToken++;
  current = { ...meta }; episode = null; sourceIndex = 0;
  detail.replaceChildren(el('p', 'Loading title…')); if (!dialog.open) dialog.showModal();
  try {
    const data = await jsonRequest(`${API}/meta/${meta.type === 'series' ? 'series' : 'movie'}/${encodeURIComponent(meta.id)}.json`);
    if (token !== detailToken) return;
    if (!data.meta || data.meta.id !== meta.id || data.meta.type !== meta.type) throw Error('Metadata did not match.');
    current = data.meta;
  } catch {
    if (token !== detailToken) return;
    toast('Full title details could not load. Some sources may be unavailable.');
  }
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
const animeStreamCache = new Map();
function renderSources() {
  const target = document.querySelector('#sources'); if (!target || !current) return;
  target.replaceChildren(el('h2', 'Choose a source'));
  if (current.type === 'series' && !episode) { target.append(el('p', 'Select an episode above to see its sources.', 'note')); return; }
  if (episode) target.append(el('p', `Season ${episode.season} · Episode ${episode.episode}`, 'eyebrow'));
  const tabs = el('div', null, 'chips'), body = el('div');
  const show = (mode) => {
    web.classList.toggle('selected', mode === 'web');
    addon.classList.toggle('selected', mode === 'addon');
    if (mode === 'web') renderWeb(body); else renderStreams(body);
  };
  const web = button('Web sources', () => show('web'));
  const addon = button('Add-on providers', () => show('addon'));
  tabs.append(web, addon); target.append(tabs);
  if (isAnimeMeta(current)) {
    const filters = animeFiltersPanel(() => {
      if (addon.classList.contains('selected')) renderStreams(body);
      else renderWeb(body);
    });
    target.append(filters);
  }
  target.append(body);
  show(isAnimeMeta(current) ? 'addon' : 'web');
}
function renderWeb(target) {
  streamToken++;
  target.replaceChildren();
  const prefs = getPreferences();
  if (isAnimeMeta(current) && (prefs.animeAudio && prefs.animeAudio !== 'any' || prefs.animeRelease === 'uncensored')) {
    target.append(el('p', 'Web Sources do not provide verified audio or release metadata. Clear anime filters to use these sources.', 'note'));
    return;
  }
  const available = sourcesFor(current, episode);
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
async function renderStreams(target, forceRefresh = false) {
  const token = ++streamToken;
  const id = streamId(current, episode), mediaType = current.type === 'series' ? 'series' : 'movie';
  const matching = addons.filter(addon => supportsStreams(addon.manifest, mediaType, id || ''));
  const key = JSON.stringify([mediaType,id,matching.map(addon=>addon.base)]);
  target.replaceChildren();
  if (!matching.length) return target.append(el('p', 'No installed add-on offers streams for this title. Add a Stremio-compatible HTTPS manifest in Settings.', 'note'));
  let results;
  const cached = animeStreamCache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.at < 300000) results = cached.results;
  else {
    stateBox(target, 'Asking add-on providers…');
    results = await Promise.allSettled(matching.map(async addon => ({ addon, data: await jsonRequest(`${addon.base}/stream/${mediaType}/${encodeURIComponent(id)}.json`) })));
    if (token !== streamToken || !target.isConnected) return;
    animeStreamCache.set(key, {at:Date.now(),results});
    if (animeStreamCache.size > 20) animeStreamCache.delete(animeStreamCache.keys().next().value);
  }
  if (token !== streamToken || !target.isConnected) return;
  target.replaceChildren();
  let count = 0, failures = 0, unsupported = 0, filtered = 0, unknown = 0;
  const animeMode = isAnimeMeta(current), animePrefs = getPreferences();
  if (animeMode && (animePrefs.animeAudio && animePrefs.animeAudio !== 'any' || animePrefs.animeRelease === 'uncensored'))
    target.append(el('p', 'Anime filters use unverified provider labels. Unknown metadata is excluded.', 'note'));
  for (const result of results) {
    if (result.status !== 'fulfilled') { failures++; continue; }
    const { addon, data } = result.value;
    if (!Array.isArray(data.streams)) continue;
    for (const stream of data.streams.slice(0, 80)) {
      if (animeMode) {
        const match = animeStreamMatch(stream, animePrefs);
        if (!match.matches) {
          filtered++;
          if (!match.tags.audioKnown || !match.tags.releaseKnown) unknown++;
          continue;
        }
      }
      if (window.Mutiny && /^[a-f0-9]{40}$/i.test(stream.infoHash||'')) {
        count++;
        target.append(button('Download ' + (stream.title||stream.name||'torrent'),async()=>{try{await rpc('torrent.add',{magnet:'magnet:?xt=urn:btih:'+stream.infoHash,fileIndex:stream.fileIdx??-1,meta:current});closeTitle();setPage('settings')}catch(e){toast(e.message)}}));
        continue;
      }
      const url = stream.url || stream.externalUrl;
      if (!safeUrl(url) || stream.behaviorHints?.proxyHeaders || stream.headers || stream.infoHash) { unsupported++; continue; }
      count++;
      const box = el('div', null, 'box');
      box.append(el('strong', stream.name || addon.manifest.name || 'Stream'), el('p', stream.title || stream.description || '', 'small'));
      if (animeMode) {
        const tags = animeStreamTags(stream);
        box.append(el('p', 'Provider labels: ' + [tags.dub?'English dub':null,tags.sub?'Subbed':null,tags.dual?'Dual audio':null,tags.uncensored?'Uncensored':null].filter(Boolean).join(', ').replace(/^$/,'Unknown audio/release'), 'note'));
      }
      box.append(button(stream.externalUrl ? 'Open source ↗' : '▶  Play video', () => window.Mutiny && !stream.externalUrl ? rpc('video.play',{url,meta:{...current,videos:undefined,videoId:streamId(current,episode),season:episode?.season,episode:episode?.episode}}).catch(e=>toast(e.message)) : native(stream.externalUrl ? 'external' : 'video', url), 'primary'));
      if (!stream.externalUrl) box.append(button('Open in another app', () => native('external', url)));
      target.append(box);
    }
  }
  if (!count) target.append(el('p', filtered ? 'No streams matched the selected anime preferences. Adjust the filters to include unknown sources.' : 'No playable HTTPS streams were returned for this title.', 'note'));
  if (filtered) target.append(el('p', `${filtered} stream(s) excluded by anime filters; ${unknown} have incomplete labels.`, 'note'));
  if (failures) target.append(el('p', `${failures} provider request(s) failed. Check your connection or try again.`, 'note'));
  if (unsupported) target.append(el('p', `${unsupported} stream(s) require torrent support, custom headers, or an unsupported protocol.`, 'note'));
  target.append(button('Refresh sources', () => renderStreams(target, true)));
}
const SETTINGS_KEY = 'mutiny.android.preferences.v1';
function getPreferences() {
  try { const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function preferenceControl(parent, label, description, key, initial, onChange) {
  const wrap = el('label', null, 'settings-option');
  const text = el('span', null, 'settings-option-text');
  text.append(el('strong', label), el('small', description));
  const input = el('input'); input.type = 'checkbox'; input.checked = getPreferences()[key] ?? initial;
  input.addEventListener('change', () => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getPreferences(), [key]: input.checked })); onChange?.(input.checked); toast('Preference saved.'); }
    catch { input.checked = !input.checked; toast('Unable to save preference.'); }
  });
  wrap.append(text, input); parent.append(wrap);
}
function preferenceChoice(parent, label, description, key, values, initial, onChange) {
  const wrap = el('label', null, 'settings-choice');
  wrap.append(el('strong', label), el('small', description));
  const select = el('select');
  for (const [value, title] of values) { const option = el('option', title); option.value = value; select.append(option); }
  const stored = getPreferences()[key];
  select.value = values.some(([value]) => value === stored) ? stored : initial;
  select.addEventListener('change', () => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getPreferences(), [key]: select.value })); onChange?.(select.value); toast('Preference saved.'); }
    catch { toast('Unable to save preference.'); }
  });
  wrap.append(select); parent.append(wrap);
}
function renderPreferences(parent, id) {
  if (id === 'interface') {
    preferenceChoice(parent, 'Language', 'Language used by the interface', 'language', [['en','English'],['es','Español'],['fr','Français']], 'en');
    preferenceChoice(parent, 'Theme', 'Choose the interface colour scheme', 'theme', [['dark','Dark'],['light','Light'],['system','System']], 'dark', value => document.documentElement.dataset.theme = value);
    preferenceControl(parent, 'Reduce animations', 'Disable nonessential movement', 'reduceMotion', false, value => document.documentElement.classList.toggle('reduce-motion', value));
    preferenceControl(parent, 'Compact cards', 'Display smaller content cards', 'compactCards', false, value => document.documentElement.classList.toggle('compact-cards', value));
  } else if (id === 'player') {
    preferenceChoice(parent, 'Preferred video quality', 'Preference for compatible streams', 'quality', [['auto','Automatic'],['480','480p'],['720','720p'],['1080','1080p'],['2160','4K']], 'auto');
    preferenceChoice(parent, 'Preferred audio', 'Language preference for supported sources', 'audioLanguage', [['auto','Automatic'],['en','English'],['ja','Japanese']], 'auto');
    preferenceControl(parent, 'Prefer subtitles', 'Request subtitles when available', 'subtitles', false);
    parent.append(el('h2', 'Anime stream preferences'));
    preferenceChoice(parent, 'Anime audio', 'Used for explicitly labelled add-on streams', 'animeAudio', [['any','Any'],['dub','English dub'],['sub','Japanese with subtitles'],['dual','Dual audio']], 'any');
    preferenceChoice(parent, 'Anime release', 'Require explicit uncensored labels when selected', 'animeRelease', [['any','Any'],['uncensored','Uncensored only']], 'any');
    preferenceControl(parent, 'Low-bandwidth preference', 'Prefer lower-bitrate sources where supported', 'lowBandwidth', false);
    parent.append(el('p', 'Playback preferences are saved locally. Stream selection and the native player do not yet honour every preference.', 'note'));
  } else if (id === 'general') {
    preferenceControl(parent, 'Sync over mobile data', 'Allow future account synchronisation on mobile networks', 'mobileSync', true);
    preferenceControl(parent, 'Remember last section', 'Keep your Settings navigation preference', 'rememberSection', true);
    parent.append(el('p', 'Stremio and Nuvio account sign-in are not available in this build.', 'note'));
  } else if (id === 'ai') {
    aiSettings(parent);
  } else if (id === 'android') {
    preferenceControl(parent, 'Keep screen awake', 'Saved preference; native WakeLock integration pending', 'keepAwake', false);
    parent.append(el('p', 'Auto-start and background service permissions require native Android integration.', 'note'));
  } else if (id === 'server') {
    preferenceChoice(parent, 'Preferred network mode', 'Saved preference for future streaming connections', 'networkMode', [['auto','Automatic'],['wifi','Prefer Wi-Fi'],['mobile','Mobile data']], 'auto');
    parent.append(el('p', 'Server and torrent connection limits require native integration.', 'note'));
  } else if (id === 'cloudstream') {
    parent.append(el('p', 'CloudStream CS3 installation and execution are not available in this branch yet.', 'note'));
  }
}
function aiSettings(parent) {
  parent.append(el('p', 'Keys are stored in Android secure storage, not browser preferences. A provider account and API key are required.', 'note'));
  const provider = el('select');
  for (const id of ['openrouter','groq','gemini']) { const opt = el('option', id === 'openrouter' ? 'OpenRouter' : id === 'groq' ? 'Groq' : 'Gemini'); opt.value=id; provider.append(opt); }
  const model = el('input'); model.placeholder='Model ID (from your provider)'; model.setAttribute('aria-label','AI model ID');
  const key = el('input'); key.type='password'; key.placeholder='API key (leave blank to retain saved key)'; key.setAttribute('aria-label','AI API key');
  const status = el('p','Loading AI configuration…','note');
  const load = async () => {
    try { const config=await rpc('ai.config'); provider.value=config.provider; model.value=config.model||''; status.textContent=config.hasKey?'An API key is saved for this provider.':'No API key saved for this provider.'; }
    catch(e) { status.textContent='AI settings unavailable: '+e.message; }
  };
  provider.addEventListener('change', () => { model.value=''; key.value=''; status.textContent='Enter the model ID and key for '+provider.value+'.'; });
  const save = button('Save AI credentials', async () => {
    save.disabled=true;
    try { const result=await rpc('ai.save',{provider:provider.value,model:model.value.trim(),key:key.value.trim()}); key.value='';status.textContent=result.hasKey?'AI credentials saved securely.':'Model saved; add an API key to use AI search.'; }
    catch(e){status.textContent='Unable to save: '+e.message;}
    finally {save.disabled=false;}
  },'primary');
  const clear = button('Remove saved API key', async () => {
    if(!confirm('Remove the saved key for '+provider.value+'?'))return;
    try {await rpc('ai.save',{provider:provider.value,model:model.value.trim(),clearKey:true});key.value='';status.textContent='API key removed.';}catch(e){status.textContent=e.message;}
  });
  parent.append(el('label','Provider'),provider,el('label','Model'),model,el('label','API key'),key,save,clear,status);
  load();
}
const AI_HISTORY_KEY = 'mutiny.android.ai.history.v1';
const aiHistory = read(AI_HISTORY_KEY, []).filter(item => item && ['You','Pirate assistant'].includes(item.role) && typeof item.message === 'string').slice(-100);
function saveAiHistory() {
  try { localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiHistory.slice(-100))); }
  catch { toast('Unable to save AI conversation. Device storage may be full.'); }
}
async function searchAiWeb(query) {
  const endpoint = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrlimit=5&prop=extracts&exintro=1&explaintext=1&exsentences=3&format=json&origin=*';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, {signal:controller.signal});
    if (!response.ok) throw Error('Search returned HTTP ' + response.status);
    const data = await response.json();
    return Object.values(data.query?.pages || {}).filter(p => p.title && Number.isInteger(p.pageid)).map(p => ({
      title:p.title, url:'https://en.wikipedia.org/?curid=' + p.pageid, excerpt:String(p.extract || '').slice(0,700)
    }));
  } finally { clearTimeout(timer); }
}

function aiSearch() {
  const returnPage = page === 'home' ? 'home' : page === 'ai' ? aiReturnPage : 'search';
  aiReturnPage = returnPage;
  page = 'ai'; pageToken++; detailToken++; streamToken++;
  const viewToken = pageToken;
  if (dialog.open) dialog.close();
  document.querySelectorAll('nav button').forEach(node => node.classList.toggle('active', node.dataset.page === returnPage));
  main.replaceChildren(el('h1', 'Search with AI'), el('p', 'Optional live Wikipedia lookup supplies sourced context to the AI. Results may be incomplete or outdated.', 'note'));
  main.append(button(returnPage === 'home' ? '‹ Back to Home' : '‹ Back to Discover', () => setPage(returnPage)));
  const companion = el('div', null, 'ai-companion');
  const pirate = el('span', '🏴‍☠️', 'ai-pirate'); pirate.setAttribute('role', 'img'); pirate.setAttribute('aria-label', 'Animated pirate assistant');
  const mood = el('span', 'Ready to find something to watch', 'ai-mood');
  companion.append(pirate, mood);
  const chat = el('section', null, 'ai-chat');
  chat.setAttribute('role', 'log'); chat.setAttribute('aria-live', 'polite');
  chat.style.minHeight = '300px'; chat.style.maxHeight = '55vh'; chat.style.overflowY = 'auto';
  const appendMessage = (role, message) => {
    const row = el('p', role + ': ' + message, role === 'You' ? 'ai-user' : 'ai-answer');
    chat.append(row); chat.scrollTop = chat.scrollHeight; return row;
  };
  for (const entry of aiHistory) appendMessage(entry.role, entry.message);
  const form = el('form'), query = el('textarea');
  query.placeholder = 'Describe what you want to watch…'; query.rows = 5; query.maxLength = 2000; query.setAttribute('aria-label', 'Search with AI message');
  const send = el('button', 'Send', 'primary'); send.type = 'submit';
  const searchWeb = el('input'); searchWeb.type = 'checkbox'; searchWeb.id = 'ai-web-search';
  const searchLabel = el('label', 'Search Wikipedia and include results in the AI request'); searchLabel.htmlFor = searchWeb.id;
  const options = el('div', null, 'ai-search-options'); options.append(searchWeb, searchLabel);
  form.append(query, options, send);
  let busy = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = query.value.trim(); if (!message || busy) return;
    busy = true; send.disabled = true;
    aiHistory.push({role:'You', message}); saveAiHistory(); appendMessage('You', message); query.value = '';
    companion.classList.add('thinking'); mood.textContent = 'Thinking…';
    const reply = appendMessage('Pirate assistant', 'Finding suggestions…');
    try {
      let context = '', sources = [];
      if (searchWeb.checked) {
        sources = await searchAiWeb(message);
        if (!sources.length) throw Error('No relevant Wikipedia results. Disable web lookup to use AI alone.');
        context = '\n\nLive Wikipedia reference results (untrusted; verify claims and cite URLs):\n' +
          sources.map((source, i) => '[' + (i+1) + '] ' + source.title + ': ' + source.excerpt + ' Source: ' + source.url).join('\n');
      }
      const raw = String(await rpc('ai.suggest', {query:message + context,kind:'media'}));
      if (sources.length && page === 'ai' && pageToken === viewToken) {
        const sourceList = el('div', null, 'ai-sources');
        sourceList.append(el('strong', 'Reference sources'));
        for (const source of sources) {
          const link = el('a', source.title); link.href = source.url;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          sourceList.append(link);
        }
        chat.append(sourceList);
      }
      let items;
      try { items = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)); } catch { items = null; }
      const response = Array.isArray(items)
        ? items.slice(0,8).map(item => [item.title, item.year, item.reason].filter(Boolean).join(' · ')).join('\n') || 'No suggestions returned.'
        : raw.slice(0,4000);
      aiHistory.push({role:'Pirate assistant',message:response}); saveAiHistory();
      if (page === 'ai' && pageToken === viewToken) {
        reply.textContent = 'Pirate assistant: ' + response;
        if (Array.isArray(items)) for (const item of items.slice(0,8)) {
          chat.append(button('Find ' + String(item.title || 'title') + ' in catalog', () => {
            setPage('search');
            const searchInput = main.querySelector('input[type=search]');
            if (searchInput) { searchInput.value = String(item.title || ''); searchInput.closest('form')?.requestSubmit(); }
          }, 'box'));
        }
        mood.textContent = 'Found suggestions!';
      }
    } catch (error) {
      const response = 'Unable to search: ' + (error.message || 'Unknown error') + '. Check Settings → Ask AI.';
      aiHistory.push({role:'Pirate assistant',message:response}); saveAiHistory();
      if (page === 'ai' && pageToken === viewToken) { reply.textContent = 'Pirate assistant: ' + response; mood.textContent = 'Something went wrong'; }
    } finally {
      busy = false;
      if (page === 'ai' && pageToken === viewToken) { send.disabled = false; companion.classList.remove('thinking'); chat.scrollTop = chat.scrollHeight; }
    }
  });
  main.append(companion, chat, form,
    button('Configure AI', () => { setPage('settings'); settings('ai'); }),
    button('Clear conversation', () => { aiHistory.length = 0; saveAiHistory(); aiSearch(); }));
}
function settingsBackup(parent) {
  const backup = button('Export settings', () => {
    const data = JSON.stringify({ format:'mutiny-settings-v1', preferences:getPreferences(), addons }, null, 2);
    const blob = new Blob([data], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = el('a'); anchor.href = url; anchor.download = 'mutiny-media-settings.json';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  const picker = el('input'); picker.type='file'; picker.accept='.json,application/json'; picker.setAttribute('aria-label','Import settings JSON');
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0]; if (!file) return;
    if (file.size > 1024 * 1024) return toast('Settings file exceeds 1 MB.');
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== 'mutiny-settings-v1' || !parsed.preferences || typeof parsed.preferences !== 'object' || Array.isArray(parsed.preferences)) throw Error('Unsupported settings file.');
      const allowed = ['language','theme','reduceMotion','compactCards','quality','audioLanguage','subtitles','lowBandwidth','mobileSync','rememberSection','aiProvider','keepAwake','networkMode','animeAudio','animeRelease'];
      const preferences = Object.fromEntries(Object.entries(parsed.preferences).filter(([key,value]) => allowed.includes(key) && (typeof value === 'boolean' || typeof value === 'string')));
      if (!confirm('Import preferences from this file? Current preferences will be replaced.')) return;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
      applySavedAppearance(); toast('Preferences imported.'); settings();
    } catch (error) { toast(error.message || 'Unable to import settings.'); }
    finally { picker.value=''; }
  });
  parent.append(el('h2','Backup & restore'),backup,picker);
  parent.append(el('p','Export includes installed add-on addresses for reference. Import restores preferences only, not accounts, credentials or add-ons.', 'note'));
  parent.append(button('Reset preferences', () => {
    if (!confirm('Reset all Mutiny Media preferences to defaults? Your library and add-ons will remain.')) return;
    localStorage.removeItem(SETTINGS_KEY); applySavedAppearance(); toast('Preferences reset.'); settings();
  }));
}
function settings(initialSection) {
  // Clear the old category and record whether a subsection is open.
  settingsSection = initialSection || null;
  main.replaceChildren();
  const heading = el('h1', 'Settings');
  main.append(heading);
  const panel = el('section', null, 'settings-panel');
  const sections = [
    ['♧', 'Addons', 'Manage installed and community addons', 'addons'],
    ['◉', 'General Settings', 'Accounts, sync, support, and account links', 'general'],
    ['☁', 'Ask AI', 'OpenRouter, Groq, and Gemini', 'ai'],
    ['✿', 'CloudStream', 'Repositories, extensions, and provider catalogs', 'cloudstream'],
    ['◎', 'Interface Settings', 'Language preferences and UI toggles', 'interface'],
    ['▷', 'Player Settings', 'Subtitles, hardware decoding, and playback tools', 'player'],
    ['☁', 'Streaming Server', 'Configure connections, cache, and peer limits', 'server'],
    ['♟', 'Android Settings', 'Auto-start, WakeLock, and foreground service', 'android'],
    ['ⓘ', 'Info & About', 'App version, directories, and diagnostics', 'about']
  ];
  const back = button('‹  All settings', () => settings(), 'settings-back');
  function openSection(id) {
    settingsSection = id;
    main.replaceChildren(el('h1', sections.find(item => item[3] === id)?.[1] || 'Settings'), back);
    if (id === 'addons') {
      main.append(el('p', 'Connect a Stremio-compatible provider using its HTTPS manifest address.'));
  const form = el('form'), input = el('input'); input.type = 'url'; input.placeholder = 'https://provider.example/manifest.json'; input.setAttribute('aria-label', 'Add-on manifest URL'); input.required = true;
  const submit = el('button', 'Add', 'primary'); submit.type = 'submit'; form.append(input, submit); main.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault(); submit.disabled = true; const token = pageToken;
    try {
      const base = addonBase(input.value);
      if (addons.some(addon => addon.base === base)) throw Error('This add-on is already installed.');
      const manifest = await jsonRequest(base + '/manifest.json');
      if (!manifest || typeof manifest.id !== 'string' || typeof manifest.name !== 'string' || !Array.isArray(manifest.resources)) throw Error('This is not a valid add-on manifest.');
      addons.push({ base, manifest: { id: manifest.id, name: manifest.name, resources: manifest.resources, types: manifest.types } });
      write('mutiny.android.addons.v1', addons); toast('Add-on installed.'); if (page === 'settings' && pageToken === token) openSection('addons');
    } catch (error) { toast(error.name === 'AbortError' ? 'Provider timed out. Try again.' : error.message || 'Could not connect to this add-on.'); }
    finally { submit.disabled = false; }
  });
  if (!addons.length) main.append(el('p', 'No add-on providers installed.', 'note'));
  for (const addon of addons) {
    const row = el('div', null, 'addon box'), text = el('div'); text.append(el('strong', addon.manifest.name), el('p', new URL(addon.base).host, 'small'));
    row.append(text, button('Remove', () => { addons = addons.filter(item => item.base !== addon.base); write('mutiny.android.addons.v1', addons); openSection('addons'); })); main.append(row);
  }

    } else if (id === 'about') {
  main.append(el('h2', 'On this device'), button('Open local video', () => native('local')), el('p', 'Choose a video with Android’s file picker. No broad storage permission is needed.', 'note'));
  const directLabel = el('label', 'Play a direct HTTPS video address'); directLabel.htmlFor = 'direct-url';
  const direct = el('form'), address = el('input'); address.id = 'direct-url'; address.type = 'url'; address.placeholder = 'https://example.com/video.mp4'; address.required = true;
  const play = el('button', 'Play'); play.type = 'submit'; direct.append(address, play); direct.addEventListener('submit', event => { event.preventDefault(); native('video', address.value.trim()); }); main.append(directLabel, direct);
  main.append(el('h2', 'About this preview'), el('p', 'Mutiny Media 1.0.1 · Android preview', 'note'), el('p', 'Android 8 or newer. Reuses the 42 configured web-source adapters from the linked Windows release. Metadata comes from Cinemeta. Local library and add-ons are stored on this device. Account, torrent and AI integrations remain under development.', 'note'), el('p', 'Source hosts and add-ons receive requests when used. Install only providers you trust. Some video codecs need an external player.', 'note'));
  main.append(button('Clear saved library', () => { saved = []; write('mutiny.android.library.v1', saved); toast('Saved library cleared.'); }));
    } else {
      renderPreferences(main, id);
      if (id === 'general') settingsBackup(main);
    }
  }
  if (initialSection) { openSection(initialSection); return; }
  for (const [symbol, name, description, id] of sections) {
    const card = button('', () => openSection(id), 'settings-card');
    const symbolNode = el('span', symbol, 'settings-symbol');
    const labels = el('span', null, 'settings-labels');
    labels.append(el('strong', name), el('small', description));
    card.append(symbolNode, labels, el('span', '›', 'settings-chevron'));
    panel.append(card);
  }
  const filter = el('input'); filter.type = 'search'; filter.placeholder = 'Search settings'; filter.setAttribute('aria-label', 'Search settings');
  filter.addEventListener('input', () => {
    const query = filter.value.trim().toLowerCase();
    for (const card of panel.children) card.hidden = !card.textContent.toLowerCase().includes(query);
  });
  main.append(filter, panel);
}

function applySavedAppearance() {
  const preferences = getPreferences();
  document.documentElement.dataset.theme = preferences.theme || 'dark';
  document.documentElement.classList.toggle('reduce-motion', !!preferences.reduceMotion);
  document.documentElement.classList.toggle('compact-cards', !!preferences.compactCards);
}
applySavedAppearance();
document.querySelectorAll('nav button').forEach(node => node.addEventListener('click', () => setPage(node.dataset.page)));
document.querySelector('#local').addEventListener('click', () => native('local'));
document.querySelector('#brand').addEventListener('click', event => { event.preventDefault(); setPage('home'); });
setPage('home');
