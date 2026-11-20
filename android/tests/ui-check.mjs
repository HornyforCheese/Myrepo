import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const assets = path.resolve('app/src/main/assets');
await fs.mkdir('app/build/preview', { recursive: true });
const server = http.createServer(async (request, response) => {
  const name = request.url === '/' ? 'index.html' : request.url.slice(1);
  if (!/^[a-z0-9._-]+$/i.test(name)) { response.writeHead(404).end(); return; }
  try {
    const body = await fs.readFile(path.join(assets, name));
    response.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'application/javascript' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
const movie = { id: 'tt0133093', type: 'movie', name: 'The Matrix', moviedb_id: 603, releaseInfo: '1999', imdbRating: '8.7', description: 'A computer hacker discovers a world beyond the one he knows.', poster: 'https://posters.example/matrix.svg' };
const series = { id: 'tt0944947', type: 'series', name: 'Game of Thrones', moviedb_id: 1399, releaseInfo: '2011–2019', poster: 'https://posters.example/thrones.svg', videos: [{ id: 'tt0944947:1:1', season: 1, episode: 1, title: 'Winter Is Coming' }, { id: 'tt0944947:2:4', season: 2, episode: 4, title: 'Garden of Bones' }] };
const failures = [];
let checks = 0;
try {
  for (const width of [360, 412, 800]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 700, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => { failures.push(error.message); console.error(error.message); });
    const commands = [];
    const cdp = await context.newCDPSession(page); await cdp.send('Page.enable');
    cdp.on('Page.frameRequestedNavigation', event => { if (event.url.startsWith('mutiny://')) commands.push(event.url); });
    await page.route('https://posters.example/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#274c43"/><stop offset="1" stop-color="#111922"/></linearGradient></defs><path fill="url(#g)" d="M0 0h300v450H0z"/><text x="150" y="210" text-anchor="middle" fill="#b4d3b8" font-family="sans-serif" font-size="24">MUTINY</text><text x="150" y="245" text-anchor="middle" fill="#e9ae58" font-family="sans-serif" font-size="15">TEST CATALOG</text></svg>' }));
    await page.route('https://v3-cinemeta.strem.io/**', route => {
      const url = route.request().url();
      const meta = url.includes('tt0944947') ? series : movie;
      route.fulfill({ json: url.includes('/meta/') ? { meta } : { metas: url.includes('/series/') ? [series] : [movie] } });
    });
    await page.route('https://addon.example/**', route => route.fulfill({ json: route.request().url().endsWith('/manifest.json') ? { id: 'test.addon', name: 'Test add-on', types: ['movie', 'series'], resources: ['stream'] } : { streams: [{ name: 'HTTPS sample', url: 'https://video.example/sample.mp4' }, { name: 'Torrent only', infoHash: 'abc123' }] } }));
    await page.goto(`http://127.0.0.1:${port}/`);
    assert.equal(await page.locator('.home-shortcuts button').count(), 5); checks++;
    await page.locator('nav [data-page=settings]').click();
    await page.getByRole('button', { name: /General Settings/ }).click();
    await page.getByRole('button', { name: 'Load cloud library' }).waitFor(); checks++;
    await page.evaluate(() => window.mutinyBack());
    await page.getByRole('button', { name: /Streaming Server/ }).click();
    await page.getByRole('button', { name: 'Refresh torrent' }).waitFor(); checks++;
    await page.locator('nav [data-page=home]').click();
    await page.getByRole('button', { name: /The Matrix/ }).click();
    await page.getByRole('button', { name: /Save to library/ }).click();
    await page.getByRole('button', { name: 'Play source', exact: false }).click();
    await page.waitForTimeout(100);
    assert.ok(commands.some(url => decodeURIComponent(url).includes('/tt0133093')), 'native play command must contain exact movie ID'); checks++;
    await page.getByRole('button', { name: 'Try next source' }).click();
    assert.notEqual(await page.locator('#provider').inputValue(), '0'); checks++;
    await page.getByRole('button', { name: 'Close title' }).click();
    await page.locator('#detail').waitFor({state:'hidden'});
    await page.getByRole('button', { name: 'My library', exact: false }).click();
    assert.equal(await page.getByRole('button', { name: /The Matrix/ }).count(), 1); checks++;
    await page.reload();
    await page.getByRole('button', { name: 'My library', exact: false }).click();
    assert.equal(await page.getByRole('button', { name: /The Matrix/ }).count(), 1); checks++;
    await page.locator('nav [data-page=search]').click();
    await page.getByLabel('Search titles', {exact:true}).fill('Matrix');
    await page.locator('main form').getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('button', { name: /The Matrix/ }).waitFor(); checks++;
    await page.getByRole('button', { name: 'Discover', exact: false }).click();
    await page.getByRole('button', { name: 'Series', exact: true }).click();
    await page.getByRole('button', { name: /Game of Thrones/ }).click();
    await page.getByText('Select an episode above to see its sources.').waitFor();
    assert.equal(await page.locator('#provider').count(), 0); checks++;
    await page.locator('#season').selectOption('2');
    await page.getByRole('button', { name: /Garden of Bones/ }).click();
    await page.getByText('Season 2 · Episode 4', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Play source', exact: false }).click();
    await page.waitForTimeout(100);
    assert.ok(commands.some(url => decodeURIComponent(url).includes('/tt0944947/2/4'))); checks++;
    await page.getByRole('button', { name: 'Close title' }).click();
    await page.locator('#detail').waitFor({state:'hidden'});
    await page.locator('nav [data-page=settings]').click();
    await page.getByRole('button', { name: /Manage installed and community/ }).click();
    await page.getByRole('textbox', { name: 'Add-on manifest URL' }).fill('https://addon.example/manifest.json');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByText('Test add-on', { exact: true }).waitFor(); checks++;
    await page.getByRole('button', { name: 'My library', exact: false }).click();
    await page.getByRole('button', { name: /The Matrix/ }).click();
    await page.getByRole('button', { name: 'Add-on providers', exact: true }).click();
    await page.getByText('HTTPS sample', { exact: true }).waitFor();
    await page.getByText(/1 stream\(s\) require torrent support/).waitFor(); checks++;
    await page.getByRole('button', { name: 'Play video', exact: false }).click();
    await page.waitForTimeout(100);
    assert.ok(commands.some(url => decodeURIComponent(url).includes('mutiny://video?url=https://video.example/sample.mp4'))); checks++;
    await page.getByRole('button', { name: 'Close title' }).click();
    await page.locator('#detail').waitFor({state:'hidden'});
    await page.locator('nav [data-page=settings]').click();
    await page.getByRole('button', { name: /Manage installed and community/ }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    assert.equal(await page.getByText('Test add-on', { exact: true }).count(), 0); checks++;
    await page.getByRole('button', { name: 'Discover', exact: false }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await page.screenshot({ path: `app/build/preview/ui-${width}.png`, fullPage: true });
    await context.close();
  }
  // Exercise the origin bridge contract with account fixtures. All provider traffic is intercepted.
  const account = await browser.newContext();
  await account.addInitScript(() => {
    localStorage.setItem('mutiny.android.preferences.v1',JSON.stringify({audioLanguage:'ja',subtitles:true}));
    let signedIn = true, chosenModel = 'fixture:free';
    window.fixtureCalls = [];
    window.Mutiny = {postMessage(raw) {
      const {id,method,args} = JSON.parse(raw);
      window.fixtureCalls.push({method,args});
      if (method === 'account.logout') signedIn = false;
      if (method === 'ai.save') chosenModel = args.model;
      const result = method === 'ai.config' ? {provider:'openrouter',model:chosenModel,hasKey:true}
        : method === 'ai.models' ? {models:[{id:'fixture:free',free:true},{id:'other:free',free:true}]}
        : method === 'ai.save' ? {hasKey:true}
        : method === 'ai.suggest' ? JSON.stringify([{title:'Fixture title',reason:'A fixture recommendation.'}])
        : method === 'account.addons' && signedIn
        ? {stremio:{signedIn:true,user:'fixture',profile:1,addons:[{transportUrl:'https://cloud.example/config/manifest.json'}]}}
        : {};
      queueMicrotask(() => this.onmessage({data:JSON.stringify({id,result})}));
    }};
  });
  const page = await account.newPage();
  page.on('pageerror', e => failures.push(e.message));
  const meta = {id:'fixture:item',type:'movie',name:'Account movie'};
  await page.route('https://v3-cinemeta.strem.io/**',route => route.fulfill({json:{metas:[]}}));
  await page.route('https://cloud.example/**',route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('manifest.json')
      ? {id:'fixture',name:'Account add-on',resources:['meta','stream','catalog'],types:['movie'],catalogs:[{id:'catalog',type:'movie',extra:[{name:'search'}]}]}
      : path.includes('/catalog/') ? {metas:[meta]} : path.includes('/meta/') ? {meta}
      : {streams:[{name:'Fixture video',url:'https://video.example/fixture.mp4'}]};
    return route.fulfill({json});
  });
  const manifest = page.waitForResponse(r => r.url().endsWith('/config/manifest.json'));
  await page.goto(`http://127.0.0.1:${port}/`); await manifest;
  await page.locator('nav [data-page=search]').click();
  await page.getByLabel('Search titles',{exact:true}).fill('Account movie');
  await page.locator('main form button[type=submit]').click();
  await page.getByRole('button',{name:/Account movie.*Account add-on/}).click();
  await page.getByRole('button',{name:/Save to library/}).click();
  const saved = await page.evaluate(() => localStorage.getItem('mutiny.android.library.v1'));
  assert.ok(saved.includes('addon:') && !saved.includes('/config')); checks++;
  await page.getByRole('button',{name:'Add-on providers',exact:true}).click();
  await page.getByRole('button',{name:/Play video/}).click();
  assert.ok(await page.evaluate(()=>window.fixtureCalls.some(c=>c.method==='video.play' && c.args.meta.id==='fixture:item' && c.args.audio==='ja' && c.args.subtitles===true))); checks++;
  await page.getByRole('button',{name:'Close title'}).click();
  await page.locator('nav [data-page=settings]').click();
  await page.getByRole('button',{name:/General Settings/}).click();
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.getByText('Signed out',{exact:true}).waitFor();
  await page.locator('nav [data-page=search]').click();
  await page.getByLabel('Search titles',{exact:true}).fill('Account movie');
  await page.locator('main form button[type=submit]').click();
  await page.getByText('No matching titles found.').waitFor(); checks++;
  await page.getByRole('button',{name:'Search with AI',exact:true}).click();
  await page.getByText('Provider and model',{exact:true}).click();
  await page.getByLabel('Available AI models').selectOption('other:free');
  assert.equal(await page.getByLabel('AI model ID').inputValue(),'other:free'); checks++;
  await page.getByRole('button',{name:'Save AI credentials'}).click();
  await page.getByText('AI model and credentials saved securely.').waitFor();
  const message = page.getByLabel('Search with AI message');
  await message.fill('Suggest a film'); await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByRole('button',{name:/Find Fixture title/}).waitFor();
  await message.fill('Another like that'); await page.getByRole('button',{name:'Send',exact:true}).click();
  assert.ok(await page.evaluate(()=>window.fixtureCalls.some(c=>c.method==='ai.suggest' && c.args.history.some(h=>h.role==='assistant' && h.content.includes('Fixture title'))))); checks++;
  await account.close();
  assert.deepEqual(failures, []);
  console.log(`Mobile interface: ${checks} assertions passed at 360, 412, and 800px. API responses mocked; no live playback tested.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
