/** Persistent Android-only media preferences. No game-related configuration. */
const KEY = 'mutiny.android.preferences.v2';
export const defaults = Object.freeze({
  theme: 'midnight', accent: '#e9ae58', fontScale: 100, posterSize: 'medium',
  compact: false, reducedMotion: false,
  lowBandwidth: false, maxResolution: 0, preferredCodec: 'any',
  autoFallback: true, preferHevc: true,
  resumePlayback: true, subtitlesOffByDefault: false, keepScreenOn: true,
  seekBackSec: 10, seekForwardSec: 30, defaultPlaybackSpeed: 1, networkCacheMs: 0,
  animeAudio: 'any', animeSubtitles: 'any', dualAudio: false, uncensored: false,
  providerPriority: '', blockedProviders: ''
});
const validThemes = ['midnight', 'oled', 'light'];
const accents = ['#e9ae58','#61c3a9','#77a8ec','#e58baf','#cfadff'];
function sane(raw) {
  const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const result = {...defaults};
  result.theme = validThemes.includes(candidate.theme) ? candidate.theme : result.theme;
  result.accent = accents.includes(candidate.accent) ? candidate.accent : result.accent;
  result.fontScale = Number.isInteger(candidate.fontScale) && candidate.fontScale >= 85 && candidate.fontScale <= 140 ? candidate.fontScale : 100;
  result.posterSize = ['small','medium','large'].includes(candidate.posterSize) ? candidate.posterSize : 'medium';
  for(const flag of ['compact','reducedMotion','lowBandwidth','autoFallback','preferHevc','dualAudio','uncensored','resumePlayback','subtitlesOffByDefault','keepScreenOn']) {
    if(typeof candidate[flag] === 'boolean') result[flag] = candidate[flag];
  }
  for(const key of ['seekBackSec','seekForwardSec']) {
    if([5,10,15,30,60].includes(candidate[key])) result[key]=candidate[key];
  }
  if([0,2000,5000,10000,20000].includes(candidate.networkCacheMs)) result.networkCacheMs=candidate.networkCacheMs;
  if([0.5,0.75,1,1.25,1.5,2].includes(candidate.defaultPlaybackSpeed)) result.defaultPlaybackSpeed=candidate.defaultPlaybackSpeed;
  result.maxResolution = [0,360,480,720,1080,2160].includes(candidate.maxResolution) ? candidate.maxResolution : 0;
  result.preferredCodec = ['any','h264','hevc','av1'].includes(candidate.preferredCodec) ? candidate.preferredCodec : 'any';
  result.animeAudio = ['any','english-dub','japanese'].includes(candidate.animeAudio) ? candidate.animeAudio : 'any';
  result.animeSubtitles = ['any','english','none'].includes(candidate.animeSubtitles) ? candidate.animeSubtitles : 'any';
  for(const name of ['providerPriority','blockedProviders']) {
    if(typeof candidate[name] === 'string') result[name] = candidate[name].slice(0,500);
  }
  return result;
}
export function getPreferences(store=globalThis.localStorage) {
  try { return sane(JSON.parse(store.getItem(KEY) || '{}')); } catch { return {...defaults}; }
}
export function savePreferences(value,store=globalThis.localStorage) {
  const prefs=sane(value); store.setItem(KEY,JSON.stringify(prefs)); applyPreferences(prefs);
  globalThis.dispatchEvent?.(new Event('mutiny-preferences-changed')); return prefs;
}
export function applyPreferences(prefs=getPreferences()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.poster = prefs.posterSize;
  root.dataset.density = prefs.compact ? 'compact' : 'comfortable';
  root.style.setProperty('--gold',prefs.accent);
  root.style.setProperty('--font-scale',String(prefs.fontScale/100));
  root.classList.toggle('reduce-motion',prefs.reducedMotion);
}
export function normalizeProviderList(value) {
  return [...new Set(String(value||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))].slice(0,30);
}
export function isAnime(meta) {
  const genres=[...(meta?.genres||[]),...(meta?.genre||[])];
  return genres.some(x=>/anime|animation/i.test(String(x))) || /anime/i.test(String(meta?.name||''));
}
function getStreamLabel(stream) {return [stream?.title,stream?.name,stream?.description,stream?.providerName].filter(Boolean).join(' ').toLowerCase();}
export function streamResolution(stream) {
  const label = getStreamLabel(stream);
  const match = label.match(/(2160|1080|720|480|360)p?\b/);
  if (match) return Number(match[1]);
  if (/\b(4k|uhd)\b/i.test(label)) return 2160;
  if (/\bfhd\b/i.test(label)) return 1080;
  if (/\bhd\b/i.test(label)) return 720;
  return 0;
}
export function streamCodec(stream) {
  const label=getStreamLabel(stream);
  if (/\b(av1|av01)\b/.test(label)) return 'av1';
  if (/\b(hevc|x265|h265|h\.265)\b/.test(label)) return 'hevc';
  if (/\b(h264|h\.264|x264|avc)\b/.test(label)) return 'h264';
  return 'unknown';
}
function labelMatch(label, positives, negatives=[]) {
  return positives.some(term=>label.includes(term)) && !negatives.some(term=>label.includes(term));
}
export function streamEligible(stream, prefs=getPreferences(), anime=false) {
  const label=getStreamLabel(stream), resolution=streamResolution(stream), codec=streamCodec(stream);
  if (prefs.maxResolution && resolution > prefs.maxResolution) return false;
  if (anime) {
    if (prefs.animeAudio === 'english-dub' && !labelMatch(label,['english dub','eng dub','dubbed','dual audio','dual-audio'])) return false;
    if (prefs.animeAudio === 'japanese' && !labelMatch(label,['japanese','jpn audio','japanese audio','subbed','sub '])) return false;
    if (prefs.animeSubtitles === 'english' && !labelMatch(label,['english sub','eng sub','subbed','dual audio','dual-audio'])) return false;
    if (prefs.animeSubtitles === 'none' && /\b(hardsub|subbed|english sub)\b/.test(label)) return false;
    if (prefs.dualAudio && !labelMatch(label,['dual audio','dual-audio','multi audio','multi-audio'])) return false;
    if (prefs.uncensored && !label.includes('uncensored')) return false;
  }
  const blocked=normalizeProviderList(prefs.blockedProviders);
  if(blocked.some(x=>label.includes(x))) return false;
  // An unknown codec or resolution stays eligible. Never invent stream metadata.
  return true;
}
export function streamScore(stream,prefs=getPreferences()) {
  const label=getStreamLabel(stream), resolution=streamResolution(stream), codec=streamCodec(stream);
  let score=0;
  if(prefs.lowBandwidth) score += resolution ? Math.max(0,2300-resolution)/8 : -30;
  else score += resolution ? Math.min(resolution,2160)/8 : 0;
  if(prefs.preferredCodec!=='any') score += codec===prefs.preferredCodec ? 150 : codec==='unknown' ? 0 : -60;
  if(prefs.lowBandwidth && prefs.preferHevc && codec==='hevc') score+=75;
  if(/\b(1080p|720p|2160p)\b/.test(label)) score+=1;
  for(const [index,provider] of normalizeProviderList(prefs.providerPriority).entries()) {
    if(label.includes(provider)) score+=200-index*6;
  }
  const size = Number(stream?.behaviorHints?.videoSize || 0);
  if(size>0 && prefs.lowBandwidth) score -= Math.log2(size)/4;
  return score;
}
export function rankStreams(streams,prefs=getPreferences(),meta={}) {
  const anime=isAnime(meta);
  return (Array.isArray(streams)?streams:[]).filter(s=>streamEligible(s,prefs,anime))
    .map((stream,index)=>({stream,index,score:streamScore(stream,prefs)}))
    .sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.stream);
}
export function renderPreferenceSettings(parent,announce=()=>{}) {
  const doc=parent.ownerDocument;
  const section=doc.createElement('section'); section.className='feature-panel';
  const h=doc.createElement('h2'); h.textContent='Appearance, playback and anime'; section.append(h);
  const intro=doc.createElement('p');intro.className='note';intro.textContent='Personalise Mutiny Media on this device. Quality controls rank available sources; they cannot force a provider to offer a lower bitrate.';section.append(intro);
  let prefs=getPreferences();
  function commit(change){prefs=savePreferences({...prefs,...change});announce('Preferences saved');}
  function label(title,element){const wrap=doc.createElement('label');wrap.className='setting-field';wrap.append(doc.createTextNode(title));wrap.append(element);section.append(wrap);}
  function select(title,key,items){
    const field=doc.createElement('select');
    for(const [value,text] of items){const option=doc.createElement('option');option.value=String(value);option.textContent=text;field.append(option);}
    field.value=String(prefs[key]);field.addEventListener('change',()=>commit({[key]:/^(maxResolution|fontScale|seekBackSec|seekForwardSec|networkCacheMs|defaultPlaybackSpeed)$/.test(key)?Number(field.value):field.value}));label(title,field);
  }
  function check(title,key){const wrap=doc.createElement('label');wrap.className='setting-check';const field=doc.createElement('input');field.type='checkbox';field.checked=!!prefs[key];field.addEventListener('change',()=>commit({[key]:field.checked}));wrap.append(field,doc.createTextNode(title));section.append(wrap);}
  function text(title,key,placeholder){const field=doc.createElement('input');field.value=prefs[key];field.placeholder=placeholder;field.maxLength=500;field.addEventListener('change',()=>commit({[key]:field.value}));label(title,field);}
  function action(title,fn){const button=doc.createElement('button');button.type='button';button.textContent=title;button.addEventListener('click',fn);section.append(button);}
  select('Theme','theme',[['midnight','Midnight'],['oled','OLED black'],['light','Light']]);
  select('Accent colour','accent',accents.map((x,i)=>[x,['Gold','Mint','Blue','Rose','Violet'][i]]));
  select('Poster size','posterSize',[['small','Compact'],['medium','Standard'],['large','Large']]);
  select('Font size','fontScale',[[85,'85%'],[100,'100%'],[115,'115%'],[130,'130%'],[140,'140%']]);
  check('Compact layout','compact'); check('Reduce motion','reducedMotion');
  action('Randomise theme',()=>{const pick=values=>values[Math.floor(Math.random()*values.length)];prefs=savePreferences({...prefs,theme:pick(validThemes),accent:pick(accents),posterSize:pick(['small','medium','large'])});renderPreferenceSettings(parent,announce);section.remove();announce('Theme randomised');});
  check('Low-bandwidth mode (prefer smaller streams)','lowBandwidth');
  select('Maximum source resolution','maxResolution',[[0,'Any'],[360,'360p'],[480,'480p'],[720,'720p'],[1080,'1080p'],[2160,'2160p / 4K']]);
  select('Preferred codec','preferredCodec',[['any','Any'],['h264','H.264'],['hevc','H.265 / HEVC'],['av1','AV1']]);
  check('Prefer HEVC when bandwidth is limited','preferHevc');
  check('Automatic fallback when a source fails','autoFallback');
  const nativeHeading=doc.createElement('h3'); nativeHeading.textContent='Native player controls';section.append(nativeHeading);
  const nativeNote=doc.createElement('p');nativeNote.className='note';
  nativeNote.textContent='These settings configure libVLC for local files, magnets and direct video playback. Source quality settings above only rank provider results.';section.append(nativeNote);
  check('Resume playback where I stopped','resumePlayback');
  check('Turn subtitles off when playback starts','subtitlesOffByDefault');
  check('Keep screen awake during video playback','keepScreenOn');
  select('Rewind step','seekBackSec',[[5,'5 seconds'],[10,'10 seconds'],[15,'15 seconds'],[30,'30 seconds'],[60,'60 seconds']]);
  select('Forward skip step','seekForwardSec',[[5,'5 seconds'],[10,'10 seconds'],[15,'15 seconds'],[30,'30 seconds'],[60,'60 seconds']]);
  select('Default playback speed','defaultPlaybackSpeed',[[0.5,'0.5×'],[0.75,'0.75×'],[1,'1×'],[1.25,'1.25×'],[1.5,'1.5×'],[2,'2×']]);
  select('Network buffer','networkCacheMs',[[0,'Automatic'],[2000,'2 seconds'],[5000,'5 seconds'],[10000,'10 seconds'],[20000,'20 seconds']]);
  select('Anime audio preference','animeAudio',[['any','Any'],['english-dub','English dub'],['japanese','Japanese audio']]);
  select('Anime subtitles','animeSubtitles',[['any','Any'],['english','English subtitles'],['none','No forced subtitles']]);
  check('Require dual-audio labels for anime','dualAudio');check('Require uncensored labels for anime','uncensored');
  text('Prioritise source keywords (comma-separated)','providerPriority','e.g. preferred-addon, 720p');
  text('Hide sources containing keywords','blockedProviders','e.g. cam, low-quality');
  action('Export preferences',()=>{const data=JSON.stringify({format:'mutiny-android-preferences',version:2,preferences:getPreferences()},null,2);const link=doc.createElement('a');link.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));link.download='mutiny-media-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),2000);});
  const importInput=doc.createElement('input');importInput.type='file';importInput.accept='application/json,.json';importInput.setAttribute('aria-label','Import Mutiny settings');
  importInput.addEventListener('change',async()=>{try{const raw=await importInput.files?.[0]?.text();if(!raw)return;const data=JSON.parse(raw);if(data.format!=='mutiny-android-preferences'||data.version!==2)throw Error('Not a Mutiny Media settings file');prefs=savePreferences(data.preferences);announce('Preferences imported; reopen Settings to refresh controls')}catch(error){announce(error.message||'Invalid settings file')}});
  label('Import preferences',importInput);
  parent.append(section);
}
