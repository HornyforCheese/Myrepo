import {rpc} from './engines.js';
import {freeModelOptions,setModelOptions} from './free-models.js';

/** All model selection and API credentials live in Settings, never in the AI search dialog. */
export function renderAiSettings(parent,announce=()=>{}) {
  const doc=parent.ownerDocument,section=doc.createElement('section');
  section.className='settings-card';
  const heading=doc.createElement('h2');heading.textContent='AI providers & free models';section.append(heading);
  const intro=doc.createElement('p');intro.className='note';
  intro.textContent='Configure the shared model for AI chat and title search. Free-tier limits and availability depend on the provider.';
  section.append(intro);
  const field=(title,tag='input')=>{
    const wrap=doc.createElement('label');wrap.className='setting-field';wrap.append(doc.createTextNode(title));
    const control=doc.createElement(tag);wrap.append(control);section.append(wrap);return control;
  };
  const provider=field('AI provider','select');
  for(const [id,name] of [['openrouter','OpenRouter'],['groq','Groq'],['gemini','Google Gemini']]){
    const option=doc.createElement('option');option.value=id;option.textContent=name;provider.append(option);
  }
  const model=field('Free / free-tier LLM model','select');
  model.setAttribute('aria-label','Free LLM model');
  const key=field('Provider API key');
  key.type='password';key.autocomplete='off';key.spellcheck=false;
  key.placeholder='Leave empty to preserve saved key';
  const modelStatus=doc.createElement('p');modelStatus.className='note';
  const feedback=doc.createElement('p');feedback.className='note';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const actions=doc.createElement('div');actions.className='settings-actions';
  const save=doc.createElement('button');save.type='button';save.className='primary';save.textContent='Save AI settings';
  const refresh=doc.createElement('button');refresh.type='button';refresh.textContent='Refresh free models';
  actions.append(save,refresh);section.append(modelStatus,actions,feedback);
  parent.append(section);
  let request=0;const remembered=new Map();
  async function loadModels(preferred='') {
    const current=provider.value,serial=++request;
    setModelOptions(model,freeModelOptions(current),preferred||remembered.get(current)||'');
    modelStatus.textContent='Checking free model catalogue…';
    refresh.disabled=true;
    try {
      const live=window.Mutiny?await rpc('ai.freeModels',{provider:current}):null;
      if(!section.isConnected||request!==serial||provider.value!==current)return;
      const options=freeModelOptions(current,live);
      setModelOptions(model,options,preferred||remembered.get(current)||model.value);
      modelStatus.textContent=options.length+' choices · '+(live?.catalogueStatus==='live'?'Live zero-cost OpenRouter catalogue':'Recent free/free-tier options; availability is not guaranteed')+'. '+(live?.notice||'');
    } catch {
      if(!section.isConnected||request!==serial)return;
      modelStatus.textContent='Live catalogue unavailable. Showing recent free models; eligibility and availability are unverified.';
    } finally { if(serial===request)refresh.disabled=false; }
  }
  model.addEventListener('change',()=>remembered.set(provider.value,model.value));
  provider.addEventListener('change',()=>{feedback.textContent='Choose and save a model for this provider.';loadModels();});
  refresh.addEventListener('click',()=>loadModels(model.value));
  save.addEventListener('click',async()=>{
    if(!window.Mutiny){feedback.textContent='The Android app is required to save credentials.';return;}
    if(!model.value){feedback.textContent='Select a free model.';return;}
    save.disabled=true;feedback.textContent='Saving settings…';
    try {
      await rpc('ai.save',{provider:provider.value,model:model.value,key:key.value});
      key.value='';remembered.set(provider.value,model.value);
      feedback.textContent='Saved securely. Chat and title search now use this model.';
      announce('AI settings saved');
    } catch(error){feedback.textContent=error?.message||'Could not save AI settings';}
    finally{save.disabled=false;}
  });
  if(window.Mutiny)rpc('ai.config').then(current=>{
    if(!section.isConnected)return;
    if(['openrouter','groq','gemini'].includes(current.provider))provider.value=current.provider;
    if(current.model)remembered.set(provider.value,current.model);
    loadModels(current.model||'');
    feedback.textContent=current.hasKey?'A key is already saved for the selected provider.':'No API key saved for the selected provider.';
  }).catch(()=>{feedback.textContent='Could not load saved AI settings';loadModels();});
  else{feedback.textContent='Preview mode: install the Android app to save keys.';loadModels();}
  return section;
}
