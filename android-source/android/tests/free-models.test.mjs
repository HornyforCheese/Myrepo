import test from 'node:test';
import assert from 'node:assert/strict';
import {fallbackFreeModels, freeModelOptions, setModelOptions} from '../app/src/main/assets/free-models.js';

test('each AI provider has named free/free-tier selections',()=>{
  for (const name of ['openrouter','groq','gemini']) {
    const choices=freeModelOptions(name);
    assert.ok(choices.length,'missing choices for '+name);
    assert.ok(choices.every(item=>item.id&&item.label));
  }
  assert.ok(fallbackFreeModels.openrouter.some(item=>item.id==='openrouter/free'));
});
test('live catalogue options reject malformed IDs, duplicates and wrong provider',()=>{
  const input={provider:'openrouter',models:[
    {id:'openrouter/free',label:'Free Router'},
    {id:'google/gemma:free',label:'Gemma Free'},
    {id:'google/gemma:free',label:'Duplicate'},
    {id:'bad\nmodel',label:'Unsafe'},
    {id:'',label:'Missing ID'}
  ]};
  assert.deepEqual(freeModelOptions('openrouter',input).map(x=>x.id),['openrouter/free','google/gemma:free']);
  assert.deepEqual(freeModelOptions('groq',input),fallbackFreeModels.groq);
});
test('empty live catalogue uses curated free-only fallbacks',()=>{
  assert.deepEqual(freeModelOptions('gemini',{provider:'gemini',models:[]}),fallbackFreeModels.gemini);
  assert.deepEqual(freeModelOptions('openrouter',{provider:'openrouter',models:[{id:'',label:'Paid?'}]}),fallbackFreeModels.openrouter);
});
test('dropdown selections retain an available saved model',()=>{
  const node={value:'',options:[],ownerDocument:{createElement:()=>({value:'',textContent:''})},replaceChildren(){this.options=[];},append(option){this.options.push(option);}};
  assert.equal(setModelOptions(node, fallbackFreeModels.groq,'openai/gpt-oss-20b'),'openai/gpt-oss-20b');
  assert.equal(setModelOptions(node, fallbackFreeModels.groq,'unavailable-model'),'openai/gpt-oss-120b');
});
