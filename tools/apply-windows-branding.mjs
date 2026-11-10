import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const [sourcePath, action = "--check"] = process.argv.slice(2);
if (!sourcePath || !["--check", "--apply"].includes(action)) {
  console.error('Usage: node apply-windows-branding.mjs "C:\\path\\to\\HarborSource" [--check|--apply]');
  process.exit(2);
}

const root = fs.realpathSync(sourcePath);
const packageFile = path.join(root, "package.json");
const manifestFile = path.join(root, "src-tauri", "tauri.conf.json");
const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
if (!["1.0.1", "1.0.1.0"].includes(manifest.version)
    || !["Mutiny Media", "Harbor"].includes(manifest.productName)
    || !["mutiny-media", "harbor"].includes(packageJson.name)) {
  throw new Error("Expected an editable Mutiny Media 1.0.1 checkout.");
}
const require = createRequire(packageFile);
let ts;
try {
  ts = require("typescript");
} catch {
  throw new Error("Install the checkout dependencies with pnpm install --frozen-lockfile and retry.");
}

const displayFields = new Set([
  "alt", "aria-label", "aria-description", "caption", "desc", "description", "heading", "sub",
  "label", "placeholder", "subtitle", "text", "title", "tooltip",
]);
const ignoredFolders = new Set([
  ".git", "assets", "build", "dist", "node_modules", "resources", "target", "vendor",
]);
const legacyName = /(?<![\w./@-])harbor(s)?\b(?![./@-][\w/]|:(?:\/\/|[\w-]))/gi;
const protectedText = /\b(?:copyright|spdx-license-identifier|pearl harbor|based on harbor|derived from harbor|fork of harbor|original harbor|harbor contributors|harbor developers)\b/i;

function brand(value) {
  if (protectedText.test(value)) return value;
  return value
    .replace(/\b(?:donating to|support) Harbor\b/gi, "Support the upstream project")
    .replace(/\bhelp translate Harbor\b/gi, "Help translate the upstream project")
    .replace(/\buse Harbor['’]s public relay\b/gi, "Use the public relay")
    .replace(/\bHarbor Relay\b/gi, "Public relay")
    .replace(legacyName, (_, plural) => plural ? "Mutiny Media apps" : "Mutiny Media");
}

function* walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory() && !ignoredFolders.has(item.name)) yield* walk(file);
    if (item.isFile()) yield file;
  }
}

function rewriteUi(file, original) {
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length > 0) return original;
  const edits = [];
  const change = (start, end, value) => {
    if (original.slice(start, end) !== value) edits.push({ start, end, value });
  };
  const literal = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const fieldName = (name) => name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : "";
  const beforeAfter = (node, value) => {
    const start = node.getStart(source);
    const raw = original.slice(start, node.end);
    change(start, node.end, raw.length >= 2 ? raw[0] + value + raw.at(-1) : raw);
  };

  function rewriteExpression(node) {
    if (literal(node)) {
      const start = node.getStart(source);
      beforeAfter(node, brand(original.slice(start + 1, node.end - 1)));
    } else if (ts.isConditionalExpression(node)) {
      rewriteExpression(node.whenTrue);
      rewriteExpression(node.whenFalse);
    } else {
      visit(node);
    }
  }

  function visit(node) {
    if (ts.isJsxElement(node)
        && /^(?:code|pre|script|style|textarea)$/i.test(node.openingElement.tagName.getText(source))) return;
    if (ts.isJsxText(node)) {
      change(node.pos, node.end, brand(original.slice(node.pos, node.end)));
      return;
    }
    if (ts.isJsxAttribute(node) && displayFields.has(node.name.getText(source))) {
      const value = node.initializer;
      if (value && literal(value)) {
        const start = value.getStart(source);
        const raw = original.slice(start, value.end);
        beforeAfter(value, brand(raw.slice(1, -1)));
        return;
      }
      if (value && ts.isJsxExpression(value) && value.expression) {
        rewriteExpression(value.expression);
        return;
      }
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      rewriteExpression(node.expression);
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && node.left.getText(source) === "document.title") {
      rewriteExpression(node.right);
      return;
    }
    if (ts.isPropertyAssignment(node) && displayFields.has(fieldName(node.name))
        && literal(node.initializer) && node.initializer.text !== "harbor") {
      const start = node.initializer.getStart(source);
      beforeAfter(node.initializer, brand(original.slice(start + 1, node.initializer.end - 1)));
      return;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["t", "translate"].includes(node.expression.text)
        && node.arguments[0] && literal(node.arguments[0])
        && brand(node.arguments[0].text) !== node.arguments[0].text
        && !original.slice(node.end, node.end + 42).startsWith(").replace(/* mutiny display */")) {
      // Keep the upstream lookup key so existing translations still resolve.
      const start = node.getStart(source);
      const key = node.arguments[0].text;
      const display = brand(key);
      const escapeRegExp = /[.*+?^${}()|[\]\\]/g;
      const exact = new RegExp(key.replace(escapeRegExp, "\\$&"), "gi");
      const normalize = '(match) => match.toLowerCase().endsWith("s") ? "Mutiny Media apps" : "Mutiny Media"';
      change(start, node.end,
        `(${original.slice(start, node.end)}).replace(/* mutiny display */ ${exact}, ${JSON.stringify(display)}).replace(${legacyName}, ${normalize})`);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  let updated = original;
  for (const { start, end, value } of edits.sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, start) + value + updated.slice(end);
  }
  const reparsed = ts.createSourceFile(file, updated, ts.ScriptTarget.Latest, true);
  if (reparsed.parseDiagnostics.length > 0) throw new Error(`Branding edit failed syntax check for ${file}`);
  return updated;
}

function rewriteMarkup(original) {
  // Keep code, styles, and verbatim license or command blocks out of markup edits.
  return original
    .split(/(<(?:script|style|pre|code)\b[^>]*>[\s\S]*?<\/(?:script|style|pre|code)>)/gi)
    .map((part, index) => index % 2 ? part : part
      .replace(/>([^<>]+)</g, (_, body) => `>${brand(body)}<`)
      .replace(/\b(title|alt|aria-label|placeholder|content)=(["'])(.*?)\2/gi,
        (_, field, quote, value) => `${field}=${quote}${brand(value)}${quote}`))
    .join("");
}

function rewriteManifest(original) {
  return original.replace(/("(?:productName|title|shortDescription|longDescription)"\s*:\s*)"((?:[^"\\]|\\.)*)"/g,
    (whole, key, raw) => {
      const value = JSON.parse(`"${raw}"`);
      const updated = brand(value);
      return updated === value ? whole : key + JSON.stringify(updated);
    });
}

function rewriteNative(original) {
  return original
    .replace(/(<title>)([^<]+)(<\/title>)/g, (_, left, value, right) => left + brand(value) + right)
    .replace(/(\.(?:title|tooltip)\(\s*")([^"\r\n]*)(")/g, (_, left, value, right) => left + brand(value) + right);
}

// Apply targeted fixes only when the recovered implementation still matches.
const fixes = new Map([
  ["src/lib/mutiny/brand-runtime.ts", [
    [/\/\*\* Last-mile display-brand cleanup\.[\s\S]*?return \(\) => obs\.disconnect\(\);\r?\n}/, `/** Update the app's window label without rewriting rendered provider titles. */
export function startMutinyBranding(): () => void {
  if (typeof document === "undefined") return () => {};
  const refresh = () => {
    const label = document.title.trim();
    if (/^Harbor(?: Desktop)?$/i.test(label)) document.title = "Mutiny Media";
  };
  refresh();
  const observer = new MutationObserver(refresh);
  if (document.head) observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}`],
  ]],
  ["src/lib/mutiny/use-free-openrouter-models.ts", [
    [`    current = fetchFreeOpenRouterModels(fetch, false).catch((e: unknown) => {
      current = null; // Allow a later retry after an outage.
      throw e;
    });`, `    const pending = fetchFreeOpenRouterModels(fetch, false).catch((e: unknown) => {
      if (current === pending) current = null;
      throw e;
    });
    current = pending;`],
  ]],
  ["src/lib/mutiny/anime-stream-language.ts", [
    [`  const langs = s.audioLanguages.map(x => x.toLowerCase());`,
      `  const langs = (s.audioLanguages ?? []).map(x => x.trim().toLowerCase());`],
    [/\^\(en\|eng\|english\)\$/g, "^(en(?:[-_][a-z]{2,8})?|eng|english)$"],
    [/\^\(ja\|jpn\|japanese\)\$/g, "^(ja(?:[-_][a-z]{2,8})?|jpn|japanese)$"],
    [/\|dual\\s\*audio(?=\))/g, ""],
  ]],
  ["src/lib/mutiny/low-bandwidth.ts", [
    [`    const heights: Record<string, number> = { "4K": 2160, "1080p": 1080, "720p": 720, "480p": 480 };
    const height = heights[resolution];
    // SD is not reliable enough to distinguish 240p from 360p; leave unknowns.`,
      `    const label = resolution.trim();
    const declared = /^(\\d{3,4})p$/i.exec(label);
    const height = /^(?:4k|uhd)$/i.test(label) ? 2160 : Number(declared?.[1]);
    // Generic SD labels cannot distinguish 240p from 360p.`],
  ]],
  ["src/components/player/transport/bitrate-meter.tsx", [
    [`    void sample();
    const timer = window.setInterval(() => void sample(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };`,
      `    let timer: number | undefined;
    const poll = async () => {
      await sample();
      if (!cancelled) timer = window.setTimeout(() => void poll(), 1500);
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };`],
  ]],
]);

function applyKnownFixes(file, original) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  for (const [before, after] of fixes.get(relative) ?? []) {
    if (typeof before === "string") {
      // Match both Windows and LF checkout line endings.
      const eol = original.includes("\r\n") ? "\r\n" : "\n";
      original = original.replace(before.replaceAll("\n", eol), () => after.replaceAll("\n", eol));
    } else {
      original = original.replace(before, () => after);
    }
  }
  return original;
}

const targets = new Map();
function plan(file, transform) {
  if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) return;
  const original = fs.readFileSync(file, "utf8");
  const repaired = applyKnownFixes(file, original);
  const updated = /harbor/i.test(repaired) ? transform(repaired) : repaired;
  if (updated !== original) targets.set(file, { original, updated });
}

for (const directory of ["src", "installer/ui"]) {
  for (const file of walk(path.join(root, directory))) {
    if (/\.(?:tsx?|jsx)$/.test(file)) plan(file, original => rewriteUi(file, original));
    if (/\.html?$/i.test(file)) plan(file, rewriteMarkup);
    if (/\.css$/i.test(file)) plan(file, original => original.replace(
      /(\bcontent\s*:\s*)(["'])([^"'\r\n]*)\2/g,
      (_, left, quote, value) => left + quote + brand(value) + quote));
    if (directory === "installer/ui" && /\.[cm]?js$/i.test(file)) plan(file, original => rewriteUi(file, original));
    if (directory === "installer/ui" && /(?:terms|eula)\.(?:txt|md)$/i.test(path.basename(file))) {
      plan(file, original => original.split(/(?<=\n)/).map(brand).join(""));
    }
  }
}
plan(path.join(root, "index.html"), rewriteMarkup);
for (const directory of ["src-tauri", "installer/src-tauri"]) {
  const full = path.join(root, directory);
  if (!fs.existsSync(full)) continue;
  for (const item of fs.readdirSync(full)) {
    if (/^tauri(?:\.[\w-]+)?\.conf\.json$/.test(item)) plan(path.join(full, item), rewriteManifest);
  }
  for (const file of walk(path.join(full, "src"))) {
    if (file.endsWith(".rs")) plan(file, rewriteNative);
  }
  for (const file of walk(full)) {
    if (/\.(?:nsh|nsi)$/i.test(file)) {
      plan(file, original => original.replace(
        /^(\s*(?:Caption|LangString|MessageBox|!define\s+(?:PRODUCT_NAME|MUI_[\w_]+))\b[^"\r\n]*")([^"\r\n]*)(")/gm,
        (_, left, value, right) => left + brand(value) + right));
    }
  }
}

for (const file of targets.keys()) console.log(path.relative(root, file));
console.log(`${targets.size} file(s) ${action === "--check" ? "would be updated" : "selected for update"}.`);
if (action === "--check" || targets.size === 0) process.exit(0);

const backup = path.join(path.dirname(root), `mutiny-branding-backup-${randomUUID()}`);
for (const [file, { original }] of targets) {
  if (fs.readFileSync(file, "utf8") !== original) throw new Error(`Source changed during scan: ${file}`);
  const saved = path.join(backup, path.relative(root, file));
  fs.mkdirSync(path.dirname(saved), { recursive: true });
  fs.copyFileSync(file, saved);
}
const written = [];
try {
  for (const [file, { original, updated }] of targets) {
    if (fs.readFileSync(file, "utf8") !== original) throw new Error(`Source changed during update: ${file}`);
    const stage = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(stage, updated, { flag: "wx", mode: fs.statSync(file).mode });
      fs.renameSync(stage, file);
      written.push(file);
    } finally {
      fs.rmSync(stage, { force: true });
    }
  }
} catch (error) {
  for (const file of written) fs.copyFileSync(path.join(backup, path.relative(root, file)), file);
  throw error;
}
console.log(`Backups saved to ${backup}`);
