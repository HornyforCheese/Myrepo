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
    page.on('pageerror', error => failures.push(error.message));
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
    await page.getByRole('button', { name: 'My library', exact: false }).click();
    assert.equal(await page.getByRole('button', { name: /The Matrix/ }).count(), 1); checks++;
    await page.reload();
    await page.getByRole('button', { name: 'My library', exact: false }).click();
    assert.equal(await page.getByRole('button', { name: /The Matrix/ }).count(), 1); checks++;
    await page.getByRole('button', { name: 'Search', exact: false }).first().click();
    await page.getByRole('searchbox').fill('Matrix');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
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
    await page.locator('nav [data-page=settings]').click();
    await page.getByRole('button', { name: /Manage installed and community/ }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    assert.equal(await page.getByText('Test add-on', { exact: true }).count(), 0); checks++;
    await page.getByRole('button', { name: 'Discover', exact: false }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await page.screenshot({ path: `app/build/preview/ui-${width}.png`, fullPage: true });
    await context.close();
  }
  assert.deepEqual(failures, []);
  console.log(`Mobile interface: ${checks} assertions passed at 360, 412, and 800px. API responses mocked; no live playback tested.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
