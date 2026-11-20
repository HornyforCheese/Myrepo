import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui = readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
test('AI homepage entry and provider settings are wired',()=>{
 assert.ok(ui.includes("button('Search with AI'"));
 for(const p of ['openrouter','groq','gemini']) assert.ok(ui.includes("['"+p+"',"),p);
 for(const action of ['ai.config','ai.models','ai.save','ai.clearKey','ai.suggest']) assert.ok(ui.includes("'"+action+"'"),action);
 assert.ok(ui.includes("key.type='password'"));
});
test('AI requests limit context and provide catalogue navigation',()=>{
 assert.ok(ui.includes('aiHistory.slice(-8)'));
 assert.ok(ui.includes('context.slice(0,6000)'));
 assert.ok(ui.includes("setPage('search')"));
 assert.ok(ui.includes('requestSubmit()'));
});
