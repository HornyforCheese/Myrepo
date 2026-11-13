/** Display-only identity: keep theme selectors, URLs, storage keys and attribution intact. */
export function brandDisplayText(value: string): string {
  if (/\b(?:copyright|spdx-license-identifier|pearl harbor|based on harbor|derived from harbor|fork of harbor|original harbor|harbor contributors|harbor developers)\b/i.test(value)) return value;
  return value.replace(/(?<![\w./@-])harbor\b(?![./@-][\w/]|:(?:\/\/|[\w-]))/gi, "Mutiny Media");
}
function stringEnd(source: string, start: number): number {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === "\\") { i++; continue; }
    if (source[i] === quote) return i + 1;
  }
  return source.length;
}
function commentEnd(source: string, start: number): number {
  const end = source.indexOf("*/", start + 2);
  return end < 0 ? source.length : end + 2;
}
function displayStrings(value: string): string {
  let out = "";
  for (let i = 0; i < value.length;) {
    if (value.startsWith("/*", i)) { const end = commentEnd(value, i); out += value.slice(i, end); i = end; continue; }
    if (value[i] !== '"' && value[i] !== "'") { out += value[i++]; continue; }
    const end = stringEnd(value, i), raw = value.slice(i, end), quote = value[i];
    // content:url(...) carries an asset address, not a visible label.
    if (/url\(\s*$/i.test(value.slice(0, i)) || raw.at(-1) !== quote) { out += raw; i = end; continue; }
    const decoded = raw.slice(1, -1).replace(/\\(?:([0-9a-f]{1,6})[ \t\r\n\f]?|(\r\n|[\n\r\f])|([\s\S]))/gi, (_match, hex: string | undefined, newline: string | undefined, char: string) => {
      if (hex) { const code = parseInt(hex, 16); return String.fromCodePoint(code > 0 && code <= 0x10ffff ? code : 0xfffd); }
      return newline ? "" : char;
    });
    const next = brandDisplayText(decoded);
    out += next === decoded ? raw : quote + next.replace(/\\/g, "\\\\").split(quote).join("\\" + quote).replace(/\n/g, "\\a ").replace(/\r/g, "\\d ") + quote;
    i = end;
  }
  return out;
}
type Declaration = { property: string; start: number; end: number; value: string };
/** Rewrite only CSS display declarations; never run a global replacement over executable theme code. */
export function brandThemeCss(css: string): string {
  const declarations: Declaration[] = [];
  let boundary = 0, depth = 0, parens = 0;
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (css.startsWith("/*", i)) { i = commentEnd(css, i) - 1; continue; }
    if (char === '"' || char === "'") { i = stringEnd(css, i) - 1; continue; }
    if (char === "(") { parens++; continue; }
    if (char === ")") { parens = Math.max(0, parens - 1); continue; }
    if (parens) continue;
    if (char === "{") { depth++; boundary = i + 1; continue; }
    if (char === "}") { depth--; boundary = i + 1; continue; }
    if (char === ";") { boundary = i + 1; continue; }
    if (char !== ":" || depth < 1) continue;
    const property = css.slice(boundary, i).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!/^(?:content|--[\w-]+)$/i.test(property)) continue;
    const start = i + 1;
    let end = start, nested = 0;
    for (; end < css.length; end++) {
      if (css.startsWith("/*", end)) { end = commentEnd(css, end) - 1; continue; }
      if (css[end] === '"' || css[end] === "'") { end = stringEnd(css, end) - 1; continue; }
      if (css[end] === "(") nested++;
      else if (css[end] === ")") nested--;
      else if (!nested && (css[end] === ";" || css[end] === "}")) break;
    }
    declarations.push({ property, start, end, value: css.slice(start, end) });
    i = end - 1;
  }
  const displayVars = new Set<string>();
  const collect = (value: string) => { for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) displayVars.add(match[1]); };
  for (const item of declarations) if (item.property.toLowerCase() === "content") collect(item.value);
  let previous = -1;
  while (previous !== displayVars.size) {
    previous = displayVars.size;
    for (const item of declarations) if (displayVars.has(item.property)) collect(item.value);
  }
  let out = css;
  for (const item of declarations.reverse()) {
    if (item.property.toLowerCase() !== "content" && !displayVars.has(item.property)) continue;
    const next = displayStrings(item.value);
    if (next !== item.value) out = out.slice(0, item.start) + next + out.slice(item.end);
  }
  return out;
}
