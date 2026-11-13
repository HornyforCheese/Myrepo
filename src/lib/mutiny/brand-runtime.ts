import { brandDisplayText, brandThemeCss } from "./theme-branding";

/** Covers installed themes on apply/reapply, their CSS and labels added later by scripts. */
export function startMutinyBranding(): () => void {
  if (typeof document === "undefined") return () => {};
  const skip = (node: Node) => !!node.parentElement?.closest("script,style,code,pre,textarea,[contenteditable],input");
  const normalize = (node: Node, descend = true): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.localName === "style") { normalize(node.parentElement); return; }
      if (!skip(node)) {
        const value = node.nodeValue ?? "", next = brandDisplayText(value);
        if (next !== value) node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.localName === "style") {
        const value = el.textContent ?? "", next = brandThemeCss(value);
        if (value !== next) el.textContent = next;
        return;
      }
      if (el.closest("script,code,pre,[contenteditable]")) return;
      for (const key of ["aria-label", "title", "placeholder", "alt"]) {
        const value = el.getAttribute(key);
        if (value && brandDisplayText(value) !== value) el.setAttribute(key, brandDisplayText(value));
      }
      const inline = el.getAttribute("style");
      if (inline) {
        const next = brandThemeCss(`x{${inline}}`).slice(2, -1);
        if (next !== inline) el.setAttribute("style", next);
      }
      if (descend && el.localName === "template") normalize((el as HTMLTemplateElement).content);
    }
    if (!descend) return;
    for (const child of node.childNodes) normalize(child);
  };
  // Theme styles live in <head>; watching only <body> misses generated wordmarks.
  normalize(document.documentElement);
  const observer = new MutationObserver(entries => {
    for (const entry of entries) {
      if (entry.type === "attributes") normalize(entry.target, false);
      else if (entry.type === "characterData") normalize(entry.target);
      else entry.addedNodes.forEach(node => normalize(node));
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder", "alt", "style"] });
  return () => observer.disconnect();
}
