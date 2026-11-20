/** Models documented for a free/free-tier API. Provider limits and availability can change. */
export const fallbackFreeModels = Object.freeze({
  // Confirmed in OpenRouter's free-model collection / 20 Nov 2026 API snapshot.
  // Backups are shown only when live catalogue retrieval fails. Availability can change.
  openrouter: [
    {id:'openrouter/free',label:'Automatic free model (OpenRouter)'},
    {id:'baidu/ernie-5.5-flash-preview:free',label:'ERNIE 5.5 Flash Preview (free)'},
    {id:'nvidia/nemotron-3-ultra-550b-a55b:free',label:'NVIDIA Nemotron 3 Ultra (free)'},
    {id:'nvidia/nemotron-3.5-super-vl:free',label:'NVIDIA Nemotron 3.5 Super VL (free)'},
    {id:'nvidia/nemotron-3.5-lightning:free',label:'NVIDIA Nemotron 3.5 Lightning (free)'},
    {id:'google/gemma-4-31b-it:free',label:'Google Gemma 4 31B (free)'},
    {id:'google/gemma-4-26b-a4b-it:free',label:'Google Gemma 4 26B A4B (free)'},
    {id:'dots-studio/dots-3-note-preview:free',label:'Dots 3 Note Preview (free)'},
    {id:'recursive/flint-v1.0:free',label:'Recursive Flint (free)'},
    {id:'inclusionai/ling-3.2-flash:free',label:'Ling 3.2 Flash (free)'},
    {id:'liquid/lfm-3-1.7b:free',label:'LiquidAI LFM3 1.7B (free)'},
    {id:'particle-ai/particle-1:free',label:'Particle AI Particle-1 (free)'},
    {id:'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',label:'Nemotron 3 Nano Omni (free)'}
  ],
  groq: [
    {id:'openai/gpt-oss-120b',label:'GPT-OSS 120B · Groq free tier'},
    {id:'openai/gpt-oss-20b',label:'GPT-OSS 20B · Groq free tier'}
  ],
  gemini: [
    {id:'gemini-3.5-flash-lite',label:'Gemini 3.5 Flash-Lite · free tier'},
    {id:'gemini-3.1-flash-lite',label:'Gemini 3.1 Flash-Lite · free tier'}
  ]
});
const safeId = value => typeof value==='string' && value.length>0 && value.length<=160 && /^[a-zA-Z0-9._:\/-]+$/.test(value);
export function freeModelOptions(provider, response) {
  const defaults = fallbackFreeModels[provider] || [];
  if(response?.provider!==provider || !Array.isArray(response?.models)) return defaults;
  const items=[], ids=new Set();
  for(const model of response.models.slice(0,200)) {
    const id=String(model?.id??'');
    if(!safeId(id)||ids.has(id))continue;
    ids.add(id);
    items.push({id,label:String(model?.label||id).slice(0,125)});
  }
  // A failed/empty live search should expose the last verified free models, marked as
  // cached by the caller. Older native builds returned just the automatic router on errors.
  if(provider==='openrouter' && response.catalogueStatus!=='live' &&
     items.length===1 && items[0].id==='openrouter/free') return defaults;
  return items.length?items.slice(0,100):defaults;
}
export function setModelOptions(select, options, preferred='') {
  select.replaceChildren();
  for(const item of options){
    const option=select.ownerDocument.createElement('option');
    option.value=item.id;option.textContent=item.label;
    select.append(option);
  }
  select.value=options.some(x=>x.id===preferred)?preferred:options[0]?.id||'';
  return select.value;
}
