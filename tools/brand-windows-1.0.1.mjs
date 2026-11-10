import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";

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
    || !["mutiny-media", "harbor"].includes(packageJson.name)
    || (packageJson.version && packageJson.version !== "1.0.1")) {
  throw new Error("Expected an editable Mutiny Media 1.0.1 checkout.");
}
const require = createRequire(packageFile);
const hash = value => createHash("sha256").update(value).digest("hex");
let ts;
try {
  ts = require("typescript");
} catch {
  try {
    ts = require(process.env.MUTINY_TYPESCRIPT_PATH || "typescript");
  } catch {
    throw new Error("TypeScript not found. Run pnpm install --frozen-lockfile inside the Windows source checkout, then retry.");
  }
}

const displayFields = new Set([
  "alt", "aria-label", "aria-description", "anchorTitle", "blurb", "caption", "desc", "description", "displayName", "heading", "helpText", "name", "sub",
  "label", "message", "placeholder", "subtitle", "text", "title", "tooltip", "windowTitle",
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
    .replace(/Classic\. Was Harbor[’']s original pair\./gi, "Classic. Based on the original interface.")
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
  const migrated = original.replace(/("mainBinaryName"\s*:\s*)"harbor"/gi,'$1"MutinyMedia"');
  return migrated.replace(/("(?:productName|title|shortDescription|longDescription)"\s*:\s*)"((?:[^"\\]|\\.)*)"/g,
    (whole, key, raw) => {
      const value = JSON.parse(`"${raw}"`);
      const updated = brand(value);
      return updated === value ? whole : key + JSON.stringify(updated);
    });
}

function rewriteExtensionManifest(original) {
  const data = JSON.parse(original);
  let changed = false;
  for (const field of ["name", "short_name", "description"]) {
    if (typeof data[field] !== "string") continue;
    const next = brand(data[field]);
    if (next !== data[field]) { data[field] = next; changed = true; }
  }
  return changed ? JSON.stringify(data, null, 2) + "\n" : original;
}

function rewriteInstallerPayload(original) {
  // The 1.0.1 Tauri mainBinaryName is MutinyMedia. The legacy custom installer
  // still expects harbor.exe INSIDE its payload. Keep that ABI until its native
  // installer is migrated, but read the correctly named build executable.
  const binary = manifest.mainBinaryName || "MutinyMedia";
  if (!/^[a-z0-9_-]+$/i.test(binary)) throw new Error("Unsafe Tauri main binary name");
  return original.replace(
    /join\(APP, "target", "release", "harbor\.exe"\)/g,
    `join(APP, "target", "release", "${binary}.exe")`,
  );
}

function rewriteNative(original) {
  return original
    .replace(/(<title>)([^<]+)(<\/title>)/g, (_, left, value, right) => left + brand(value) + right)
    .replace(/(\.(?:title|tooltip)\(\s*")([^"\r\n]*)(")/g, (_, left, value, right) => left + brand(value) + right);
}

// Branding-only run: do not patch unrelated AI, video, or bandwidth behavior.
function applyKnownFixes(_file, original) { return original; }

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

// A legacy CSS selector refers to the old accessible home button name.
// Support both while old builds remain installed and newer UI labels are branded.
plan(path.join(root, "src", "index.css"), original => original.replace(
  /button\[aria-label="Harbor home"\]/g,
  'button:is([aria-label="Mutiny Media home"], [aria-label="Harbor home"])',
));

// Display name only: the browser extension remains at its legacy resource
// path so WebView2 registration and extension discovery keep working.
plan(path.join(root, "src-tauri", "resources", "harbor-stream-blocker", "manifest.json"), rewriteExtensionManifest);
// Fix the Windows core binary name mismatch without changing Shipyard's legacy
// payload ABI. The Tauri/NSIS build uses mainBinaryName directly.
plan(path.join(root, "installer", "scripts", "make-payload.mjs"), rewriteInstallerPayload);
// These Rust labels are known display strings, not protocol or storage names.
for (const rel of [
  "installer/src-tauri/src/main.rs", "installer/src-tauri/src/uninstall_main.rs",
  "installer/src-tauri/src/install.rs", "installer/src-tauri/src/update.rs",
  "installer/src-tauri/src/clean_install.rs",
]) {
  const file = path.join(root, rel);
  plan(file, original => original
    .replace(/(const APP_NAME: &str = ")Harbor(";)/g, "$1Mutiny Media$2")
    .replace(/failed to start Harbor Shipyard/g, "failed to start Mutiny Media setup")
    .replace(/failed to start Harbor Uninstall/g, "failed to start Mutiny Media uninstaller")
    .replace(/Closing Harbor for a clean install/g, "Closing Mutiny Media for a clean install")
    .replace(/Removing old Harbor settings and data/g, "Removing old Mutiny Media settings and data")
    .replace(/Close Harbor and any playback/g, "Close Mutiny Media and any playback")
    .replace(/No Harbor install found/g, "No Mutiny Media install found")
    .replace(/Harbor exited before confirming startup/g, "Mutiny Media exited before confirming startup")
    .replace(/Harbor did not confirm startup/g, "Mutiny Media did not confirm startup")
    .replace(/Harbor is still running/g, "Mutiny Media is still running")
    .replace(/Harbor exited/g, "Mutiny Media exited")
    .replace(/relaunched harbor/g, "relaunched Mutiny Media")
    .replace(/Closing Harbor/g, "Closing Mutiny Media")
    .replace(/Run Shipyard from outside the Harbor installation folder/g, "Run setup from outside the Mutiny Media installation folder")
    .replace(/Choose an absolute Harbor installation folder/g, "Choose an absolute Mutiny Media installation folder")
    .replace(/Choose a Harbor installation folder/g, "Choose a Mutiny Media installation folder")
    .replace(/is not a Harbor installation/g, "is not a Mutiny Media installation")
    .replace(/existing Harbor folder/g, "existing Mutiny Media folder")
    .replace(/Close Harbor and try again/g, "Close Mutiny Media and try again")
    .replace(/cannot clear Harbor data/g, "cannot clear Mutiny Media data")
    .replace(/No Harbor/g, "No Mutiny Media")
    .replace(/Close Harbor/g, "Close Mutiny Media")
  );
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
const manifestRows = [...targets].map(([file, {original,updated}]) => ({
  path: path.relative(root,file).split(path.sep).join("/"),
  beforeSha256: hash(original), afterSha256: hash(updated)
}));
fs.writeFileSync(path.join(backup,"branding-backup-manifest.json"), JSON.stringify({
  version: "1.0.1", target: root, changed: manifestRows, timestamp: new Date().toISOString()
},null,2)+"\n");
console.log(`Backups saved to ${backup}`);
