import {rpc} from './engines.js';
import {freeModelOptions, setModelOptions} from './free-models.js';

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
function aiPanel(launcher, onSearchTitle) {
  const dialog = modal('Search with AI', launcher);
  dialog.append(element('p', 'Get movie, series and anime recommendations. Configure an AI provider and model before asking.', 'note'));
  const providerWrap = element('label', 'AI provider', 'quick-field');
  const provider = element('select');
  for (const [id, name] of [['openrouter','OpenRouter'], ['groq','Groq'], ['gemini','Gemini']]) {
    const option = element('option', name); option.value = id; provider.append(option);
  }
  providerWrap.append(provider); dialog.append(providerWrap);
  const modelWrap = element('label', 'Free / free-tier LLM model', 'quick-field');
  const model = element('select');
  model.setAttribute('aria-label', 'Free LLM model');
  modelWrap.append(model); dialog.append(modelWrap);
  const modelActions = element('div', undefined, 'quick-model-actions');
  const reloadModels = action(modelActions, 'Refresh free models', () => loadModels(model.value), 'model-refresh');
  dialog.append(modelActions);
  const modelNotice = status(dialog);
  let modelRequest = 0;
  async function loadModels(preferred = '') {
    const selectedProvider = provider.value, request = ++modelRequest;
    setModelOptions(model, freeModelOptions(selectedProvider), preferred);
    modelNotice.textContent = model.options.length + ' recent free choices · checking current availability…';
    reloadModels.disabled = true;
    try {
      const response = window.Mutiny ? await rpc('ai.freeModels', {provider: selectedProvider}) : null;
      if (!dialog.isConnected || request !== modelRequest || provider.value !== selectedProvider) return;
      const choices = freeModelOptions(selectedProvider, response);
      setModelOptions(model, choices, model.value || preferred);
      const status = response?.catalogueStatus === 'live' ? 'live zero-cost catalogue' :
        selectedProvider === 'openrouter' ? 'recent free-model snapshot; verify availability' :
        'documented free-tier list; account limits apply';
      modelNotice.textContent = choices.length + ' available choices (' + status + '). ' +
        (response?.notice || 'Free models have rate limits.');
    } catch {
      if (!dialog.isConnected || request !== modelRequest) return;
      const choices = freeModelOptions(selectedProvider);
      setModelOptions(model, choices, model.value || preferred);
      modelNotice.textContent = choices.length + ' recently listed free models. Live catalogue unavailable; a model might be retired.';
    } finally {
      if (dialog.isConnected && request === modelRequest) reloadModels.disabled = false;
    }
  }
  provider.addEventListener('change', () => { loadModels(); });
  const key = field(dialog, 'API key', 'password', 'Leave blank to keep the saved key');
  key.autocomplete = 'off'; key.spellcheck = false;
  const settingsStatus = status(dialog);
  const prompt = field(dialog, 'Ask about movies, series or anime', 'text', 'Sci-fi horror with an English dub…');
  prompt.maxLength = 2000;
  const list = element('div', undefined, 'quick-results');
  const actions = element('div', undefined, 'quick-modal-actions');
  const save = action(actions, 'Save AI settings', () => busy(async () => {
    await rpc('ai.save', {provider: provider.value, model: model.value.trim(), key: key.value});
    key.value = ''; settingsStatus.textContent = 'AI settings saved';
  }));
  const ask = action(actions, 'Find recommendations', () => busy(async () => {
    if (!prompt.value.trim()) throw Error('Describe what you want to watch');
    if (!model.value) throw Error('Choose a free/free-tier model');
    // Keep the selection and the native model actually used for this query in sync.
    await rpc('ai.save', {provider: provider.value, model: model.value, key: key.value});
    key.value = '';
    const suggestions = parseAiSuggestions(await rpc('ai.suggest', {query: prompt.value.trim(), kind: 'media'}));
    list.replaceChildren();
    if (!suggestions.length) list.append(element('p', 'No recommendations returned.', 'note'));
    for (const item of suggestions) {
      const card = element('div', undefined, 'quick-ai-result');
      card.append(element('strong', item.title), element('p', [item.year, item.reason].filter(Boolean).join(' · '), 'note'));
      action(card, 'Search title', () => { closeQuickDialog(); onSearchTitle(item.title); });
      list.append(card);
    }
  }), 'primary');
  async function busy(fn) {
    if (nativeRequired(settingsStatus)) return;
    save.disabled = ask.disabled = true;
    settingsStatus.textContent = 'Working…';
    try { await fn(); if (dialog.isConnected && settingsStatus.textContent === 'Working…') settingsStatus.textContent = ''; }
    catch (error) { if (dialog.isConnected) settingsStatus.textContent = error?.message || 'AI request failed'; }
    finally { save.disabled = ask.disabled = false; }
  }
  dialog.append(actions, list);
  if (window.Mutiny) rpc('ai.config').then(value => {
    if (!dialog.isConnected) return;
    if (['openrouter','groq','gemini'].includes(value.provider)) provider.value = value.provider;
    loadModels(value.model || '');
    settingsStatus.textContent = value.hasKey ? 'An API key is saved on this device.' : 'No API key saved.';
  }).catch(() => { if (dialog.isConnected) {settingsStatus.textContent = 'AI settings unavailable';loadModels();} });
  else loadModels();
  prompt.focus();
}
/** Five actions from the Windows home toolbar, adapted for native Android. */
export function renderHomeActions({openWebSources, openLocalVideo, openSettings, onSearchTitle}) {
  const section = element('section', undefined, 'home-quick-actions');
  section.setAttribute('aria-label', 'Mutiny Media quick actions');
  section.append(element('h2', 'Quick actions'));
  const grid = element('div', undefined, 'quick-action-grid');
  const buttons = [
    ['🌐', 'Web Sources', 'Browse streaming sources', openWebSources],
    ['🎬', 'Local Video', 'Open a file on your device', openLocalVideo],
    ['🧲', 'Stream Magnet', 'Play a magnet link', () => magnetPanel(grid.querySelector('[data-quick-action="Stream Magnet"]'))],
    ['⚙️', 'Settings', 'Appearance and integrations', openSettings],
    ['✨', 'Search with AI', 'Find movies and anime with AI', () => aiPanel(grid.querySelector('[data-quick-action="Search with AI"]'), onSearchTitle)],
  ];
  for (const [symbol, name, description, handler] of buttons) {
    const item = action(grid, '', handler, 'quick-action');
    item.dataset.quickAction = name;
    item.replaceChildren(element('span', symbol, 'quick-action-icon'), element('strong', name), element('small', description));
  }
  section.append(grid); return section;
}
