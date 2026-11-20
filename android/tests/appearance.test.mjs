import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/src/main/assets/app.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');

test('light and system appearance settings have actual CSS palettes', () => {
  assert.match(css, /:root\[data-theme="light"\]\{[^}]*--bg:/);
  assert.match(css, /@media\(prefers-color-scheme:light\)\{:root\[data-theme="system"\]\{[^}]*--bg:/);
  assert.match(css, /body\{[^}]*color:var\(--ink\)/);
  assert.match(css, /nav\{[^}]*background:var\(--nav\)/);
  assert.match(css, /\.settings-card\s*\{[^}]*background:var\(--settings-panel\)/);
  assert.match(app, /document\.documentElement\.dataset\.theme = preferences\.theme \|\| 'dark'/);
});
