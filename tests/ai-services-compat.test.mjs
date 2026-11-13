import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_LIB || 'typescript');
function load(file, mocks = {}) {
  const source = fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',js)(name=>{if(name in mocks)return mocks[name];throw Error('Unexpected import '+name);},m,m.exports);
  return m.exports;
}
const errors = load('src/lib/mutiny/openrouter-error.ts');
const services = load('src/lib/mutiny/ai-services.ts', {'./openrouter-error':errors});
const models = load('src/lib/ai-models.ts', {'./mutiny/ai-services':services});
const credentials = {aiSearchKey:'or-fixture',aiGroqKey:'groq-fixture',aiGeminiKey:'gemini-fixture'};
const reply = content => Response.json({choices:[{message:{content}}]});

test('every AI route uses only its own key and exact HTTPS endpoint',async()=>{
  for (const provider of ['openrouter','groq','gemini']) {
    const settings = {...credentials,aiSearchProvider:provider};
    const key = models.aiKey(settings);
    assert.equal(key,credentials[services.AI_SERVICES[provider].field]);
    const model = services.defaultServiceModel(provider, 'fixture/model:free');
    let calls=0;
    const content = await services.aiCompletion(provider,key,model,{messages:[{role:'user',content:'films'}]},undefined,async(url,init)=>{
      calls++;assert.equal(url,services.AI_SERVICES[provider].endpoint);
      assert.equal(init.headers.Authorization,'Bearer '+key);
      assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
      const body=JSON.parse(init.body);assert.equal(body.model,model);
      for (const other of Object.values(credentials)) assert.ok(!init.body.includes(other));
      assert.ok(init.signal);return reply('fixture reply');
    });
    assert.equal(content,'fixture reply');assert.equal(calls,1);
  }
});
test('missing provider keys never fall back to a different saved key',async()=>{
  const settings={...credentials,aiSearchProvider:'gemini',aiGeminiKey:''};
  assert.equal(models.aiKey(settings),'');
  await assert.rejects(services.aiCompletion('gemini','','gemini-3.5-flash-lite',{},undefined,()=>assert.fail('must not fetch')),/Gemini API key/);
});
test('direct providers reject model ownership mismatches before requesting',async()=>{
  for (const [provider,model] of [['groq','gemini-3.5-flash-lite'],['gemini','openai/gpt-oss-20b']]) {
    await assert.rejects(services.aiCompletion(provider,'fixture',model,{},undefined,()=>assert.fail('must not fetch')),/supported .* free-tier model/);
  }
  assert.throws(()=>services.aiService('toString'),/Unknown AI provider/);
});
test('provider failures redact credentials, identify quota errors and never retry another service',async()=>{
  let calls=0;const key='AIza-fixture-secret';
  await assert.rejects(services.aiCompletion('gemini',key,'gemini-3.5-flash-lite',{},undefined,async()=>{
    calls++;return new Response(JSON.stringify({error:{message:'Quota exceeded '+key}}),{status:429});
  }),error=>{assert.match(error.message,/Gemini HTTP 429/);assert.match(error.message,/quota/i);assert.ok(!error.message.includes(key));return true;});
  assert.equal(calls,1);
});
test('malformed and empty responses produce actionable errors without leaking response text',async()=>{
  for (const response of [reply(''),Response.json(null),new Response('AIza-fixture-secret',{status:200})]) {
    await assert.rejects(services.aiCompletion('groq','fixture','openai/gpt-oss-20b',{},undefined,async()=>response),error=>{
      assert.match(error.message,/empty reply|unreadable reply/);assert.ok(!error.message.includes('AIza-fixture-secret'));return true;
    });
  }
});
test('cancellation propagates and legacy boolean routes remain compatible',async()=>{
  assert.equal(services.aiService(true),'groq');assert.equal(services.aiService(false),'openrouter');
  const controller=new AbortController();const reason=new Error('cancelled');controller.abort(reason);
  await assert.rejects(services.aiCompletion('gemini','fixture','gemini-3.5-flash-lite',{},controller.signal,async(_url,init)=>{init.signal.throwIfAborted();}),error=>error===reason);
});
test('actual discovery parser accepts Gemini completion and retains requested episode metadata',async()=>{
  const saved=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,services.AI_SERVICES.gemini.endpoint);
    const body=JSON.parse(init.body);assert.equal(body.model,'gemini-3.5-flash-lite');assert.equal(body.messages[1].content,'find an episode');
    return reply(JSON.stringify([{title:'Example series',type:'series',year:2020,season:2,episode:3}]));
  };
  try {
    const search=load('src/lib/ai-search.ts',{'./mutiny/ai-services':services,'./mutiny/openrouter-error':errors,'./ai-models':models,'./search':{},'./cinemeta':{},'@/lib/release-info':{}});
    const results=await search.aiSuggest('fixture','gemini-3.5-flash-lite','gemini','find an episode');
    assert.equal(results[0].title,'Example series');assert.equal(results[0].season,2);assert.equal(results[0].episode,3);
  } finally {globalThis.fetch=saved;}
});
