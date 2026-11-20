/** Models documented for a free/free-tier API. Provider limits and availability can change. */
export const fallbackFreeModels = Object.freeze({
  openrouter: [{id:'openrouter/free',label:'Automatic free model (OpenRouter)'}],
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
  // A failed or empty live search must not silently switch to a paid model.
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
