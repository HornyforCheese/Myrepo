import {rpc} from './engines.js';

let activeDialog = null;
export function closeQuickDialog() {
  if (!activeDialog) return false;
  const dialog = activeDialog;
  activeDialog = null;
  if (dialog.open) dialog.close();
  dialog.remove();
  return true;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function action(parent, label, handler, className) {
  const button = element('button', label, className);
  button.type = 'button';
  button.addEventListener('click', handler);
  parent.append(button);
  return button;
}
function modal(title, launcher) {
  closeQuickDialog();
  const dialog = element('dialog', undefined, 'quick-modal');
  const top = element('div', undefined, 'quick-modal-head');
  const heading = element('h2', title);
  top.append(heading);
  action(top, 'Close', () => closeQuickDialog(), 'quick-close');
  dialog.append(top);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeQuickDialog(); launcher?.focus(); });
  document.body.append(dialog);
  activeDialog = dialog;
  dialog.showModal();
  return dialog;
}
function status(parent) {
  const node = element('p', '', 'note');
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  parent.append(node);
  return node;
}
function field(parent, label, type = 'text', placeholder = '') {
  const wrapper = element('label', label, 'quick-field');
  const input = element('input');
  input.type = type;
  input.placeholder = placeholder;
  wrapper.append(input); parent.append(wrapper);
  return input;
}
export function normalizeMagnetInput(input) {
  const value = String(input ?? '').trim();
  if (value.length > 20000) throw Error('Magnet link is too long');
  if (/^[a-f0-9]{40}$/i.test(value)) return 'magnet:?xt=urn:btih:' + value;
  if (/^[a-z2-7]{32}$/i.test(value)) return 'magnet:?xt=urn:btih:' + value;
  if (/^magnet:\?.*xt=urn:btih:(?:[a-f0-9]{40}|[a-z2-7]{32})(?:&.*)?$/i.test(value)) return value;
  throw Error('Enter a valid magnet link or 40-character infohash');
}
export function parseAiSuggestions(raw) {
  const value = String(raw ?? '');
  const start = value.indexOf('['), end = value.lastIndexOf(']');
  if (start < 0 || end <= start) throw Error('AI response did not contain a list');
  const items = JSON.parse(value.slice(start, end + 1));
  if (!Array.isArray(items)) throw Error('AI response was not a list');
  return items.slice(0, 8).filter(item => item && typeof item.title === 'string' && item.title.trim())
    .map(item => ({title: item.title.trim().slice(0, 160), year: String(item.year ?? '').slice(0, 8), reason: String(item.reason ?? '').slice(0, 400)}));
}
function nativeRequired(output) {
  if (window.Mutiny) return false;
  output.textContent = 'Native features are available in the installed Android app, not the browser preview.';
  return true;
}
function magnetPanel(launcher) {
  const dialog = modal('Stream magnet link', launcher);
  dialog.append(element('p', 'Paste a magnet URI or BitTorrent v1 infohash. Choose a video file once the torrent metadata loads.', 'note'));
  const magnet = field(dialog, 'Magnet link or infohash', 'text', 'magnet:?xt=urn:btih:…');
  magnet.autocomplete = 'off'; magnet.spellcheck = false; magnet.maxLength = 20000;
  const result = element('div', undefined, 'quick-results');
  const feedback = status(dialog);
  async function show() {
    const state = await rpc('torrent.status');
    if (!dialog.isConnected) return;
    result.replaceChildren();
    result.append(element('p', state.error || [state.stage, state.name].filter(Boolean).join(' · ') || 'No active torrent.', 'note'));
    if (Number(state.total) > 0) {
      const progress = element('progress');
      progress.max = state.total; progress.value = Math.min(state.done || 0, state.total);
      result.append(progress);
    }
    if (state.stage === 'choose-file' && Array.isArray(state.files)) {
      for (const item of state.files) action(result, item.name || 'Video file', () => run(() => rpc('torrent.select', {index: item.index}).then(show)));
    }
    if (['ready', 'downloading'].includes(state.stage)) action(result, '▶ Play selected video', () => run(async () => {
      await rpc('torrent.play'); closeQuickDialog();
    }), 'primary');
  }
  async function run(operation) {
    if (nativeRequired(feedback)) return;
    submit.disabled = refresh.disabled = stop.disabled = true;
    feedback.textContent = 'Working…';
    try { await operation(); if (dialog.isConnected) feedback.textContent = ''; }
    catch (error) { if (dialog.isConnected) feedback.textContent = error?.message || 'Torrent operation failed'; }
    finally { submit.disabled = refresh.disabled = stop.disabled = false; }
  }
  const row = element('div', undefined, 'quick-modal-actions');
  const submit = action(row, 'Load magnet', () => run(async () => {
    await rpc('torrent.add', {magnet: normalizeMagnetInput(magnet.value)});
    await show();
  }), 'primary');
  const refresh = action(row, 'Refresh status', () => run(show));
  const stop = action(row, 'Stop', () => run(async () => { await rpc('torrent.stop'); await show(); }));
  dialog.append(row, result);
  magnet.focus();
}
function aiPanel(launcher,onSearchTitle,openSettings) {
  const dialog=modal('Search with AI',launcher);
  const tabs=element('div',undefined,'ai-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','AI mode');
  const chat=element('section',undefined,'ai-mode-panel'),titles=element('section',undefined,'ai-mode-panel');
  chat.id='ai-chat-panel';titles.id='ai-titles-panel';
  chat.setAttribute('role','tabpanel');titles.setAttribute('role','tabpanel');
  const chatTab=action(tabs,'Chat',()=>show('chat')),titleTab=action(tabs,'Title Search',()=>show('titles'));
  for(const [button,panel] of [[chatTab,chat],[titleTab,titles]]) {
    button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
  }
  function show(selected) {
    for(const [button,panel,name] of [[chatTab,chat,'chat'],[titleTab,titles,'titles']]){
      const active=selected===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;panel.hidden=!active;
    }
  }
  dialog.append(tabs);
  chat.append(element('p','Ask about movies, series or anime and ask follow-up questions.','note'));
  const log=element('div',undefined,'ai-conversation');log.setAttribute('role','log');log.setAttribute('aria-live','polite');
  const chatForm=element('form',undefined,'ai-chat-form');
  const chatInput=element('textarea');chatInput.setAttribute('aria-label','Message to AI');chatInput.placeholder='Find an English-dubbed sci-fi anime…';chatInput.rows=3;chatInput.maxLength=2000;
  const send=element('button','Send','primary');send.type='submit';chatForm.append(chatInput,send);
  const chatFeedback=status(chat),messages=[];
  chatForm.addEventListener('submit',async event=>{
    event.preventDefault();const content=chatInput.value.trim();if(!content||nativeRequired(chatFeedback))return;
    send.disabled=true;chatFeedback.textContent='Thinking…';
    const next=[...messages.slice(-11),{role:'user',content}];
    try{
      const answer=String(await rpc('ai.chat',{messages:next}));if(!dialog.isConnected)return;
      for(const [role,value] of [['user',content],['assistant',answer]]){
        const bubble=element('div',undefined,'ai-bubble ai-'+role);
        bubble.append(element('strong',role==='user'?'You':'Mutiny Media'),element('p',value));log.append(bubble);
      }
      messages.splice(0,messages.length,...next,{role:'assistant',content:answer});
      if(messages.length>12)messages.splice(0,messages.length-12);
      chatInput.value='';chatFeedback.textContent='';log.scrollTop=log.scrollHeight;
    }catch(error){if(dialog.isConnected)chatFeedback.textContent=error?.message||'Chat failed. Check AI settings.';}
    finally{send.disabled=false;}
  });
  chat.append(log,chatForm);
  titles.append(element('p','AI recommendations shown as titles only. Tap a title to search the catalog.','note'));
  const titleForm=element('form',undefined,'ai-chat-form'),titleInput=element('input');
  titleInput.type='search';titleInput.maxLength=2000;titleInput.placeholder='Mind-bending sci-fi with an English dub';
  titleInput.setAttribute('aria-label','Describe titles to find');
  const find=element('button','Find titles','primary');find.type='submit';titleForm.append(titleInput,find);
  const titleFeedback=status(titles),results=element('div',undefined,'quick-results');
  titleForm.addEventListener('submit',async event=>{
    event.preventDefault();const query=titleInput.value.trim();if(!query||nativeRequired(titleFeedback))return;
    find.disabled=true;titleFeedback.textContent='Searching…';
    try{
      const suggestions=parseAiSuggestions(await rpc('ai.suggest',{query,kind:'media'}));if(!dialog.isConnected)return;
      results.replaceChildren();if(!suggestions.length)results.append(element('p','No titles returned.','note'));
      for(const item of suggestions)action(results,item.title,()=>{closeQuickDialog();onSearchTitle(item.title);},'ai-title-result');
      titleFeedback.textContent='';
    }catch(error){if(dialog.isConnected)titleFeedback.textContent=error?.message||'Title search failed. Check AI settings.';}
    finally{find.disabled=false;}
  });
  titles.append(titleForm,results);dialog.append(chat,titles);
  const footer=element('div',undefined,'ai-setup-hint');
  const note=element('p','Provider, free model and API key are configured in Settings.','note');
  footer.append(note);action(footer,'AI settings',()=>{closeQuickDialog();openSettings('ai');});dialog.append(footer);
  if(window.Mutiny)rpc('ai.config').then(config=>{
    if(dialog.isConnected&&!config.hasKey)note.textContent='Add an API key and free model under Settings → AI to begin.';
  }).catch(()=>{});
  show('chat');chatInput.focus();
}
/** Media-only Android quick actions. */
export function renderHomeActions({openLocalVideo, openSettings, onSearchTitle}) {
  const section = element('section', undefined, 'home-quick-actions');
  section.setAttribute('aria-label', 'Mutiny Media quick actions');
  section.append(element('h2', 'Quick actions'));
  const grid = element('div', undefined, 'quick-action-grid');
  const buttons = [
    ['✨','Search with AI','Chat or find media titles',()=>aiPanel(grid.querySelector('[data-quick-action="Search with AI"]'),onSearchTitle,openSettings)],
    ['🎬','Local Video','Open a file on your device',openLocalVideo],
    ['🧲','Stream Magnet','Play a magnet link',()=>magnetPanel(grid.querySelector('[data-quick-action="Stream Magnet"]'))],
    ['⚙️','Settings','Personalise your media app',()=>openSettings()],
  ];
  for (const [symbol, name, description, handler] of buttons) {
    const item = action(grid, '', handler, 'quick-action');
    item.dataset.quickAction = name;
    item.replaceChildren(element('span', symbol, 'quick-action-icon'), element('strong', name), element('small', description));
  }
  section.append(grid); return section;
}
