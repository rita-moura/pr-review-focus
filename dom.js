(() => {
  "use strict";
  const HEADER = ".file-header, [class*='DiffFileHeader-module__diff-file-header'], [class*='Diff-module__diffHeaderWrapper']";
  const TREE_LINK = "a[href^='#diff-'], a[href*='#diff-'], a[href*='%23diff-']";
  const CARD = "div[id^='diff-'], [class*='Diff-module__diffTargetable'], [data-testid='diff-file'], [data-testid='diff-file-container'], .file.js-file";
  const clean = value => (value || "").replace(/[\u200e\u200f]/g, "").trim();
  const pathFromText = value => {
    const text = clean(value);
    const match = text.match(/([^\s"'<>]+)\.(?:md|markdown|txt|rst|adoc|pdf|png|jpe?g|gif|svg|webp|avif|json|ya?ml|toml|rb|py|js|jsx|ts|tsx|css|scss|html|sql|go|rs|java|kt|lock)(?=\s|$|[),])/i);
    return match ? clean(match[0].replace(/[),]$/, "")) : text;
  };
  function treePath(link) {
    return pathFromText(link.getAttribute("data-path") || link.getAttribute("title") ||
      link.getAttribute("aria-label") || link.textContent);
  }
  function cardPath(card) {
    const header = card.querySelector(HEADER) || card;
    const attr = header.querySelector("[data-path], [data-file-path]");
    if (attr) return clean(attr.getAttribute("data-path") || attr.getAttribute("data-file-path"));
    const named = header.querySelector("[class*='file-name'], [class*='file-path'], [class*='filePath']");
    if (named) {
      const copy = named.cloneNode(true);
      copy.querySelectorAll(".sr-only").forEach(node => node.remove());
      const value = pathFromText(copy.textContent);
      if (value) return value;
    }
    const links = [...header.querySelectorAll("a")];
    for (const link of links) {
      const value = pathFromText(link.getAttribute("title") || link.getAttribute("aria-label") || link.textContent);
      if (value) return value;
    }
    return pathFromText(header.textContent);
  }
  function collectFiles(document) {
    const byPath = new Map();
    const treeByDiffId = new Map();
    const unknown = [];
    const add = (element, path, source) => {
      const normalized = clean(path);
      if (!normalized) { unknown.push({element, path:"", source}); return; }
      const key = normalized.toLowerCase();
      const existing = byPath.get(key);
      if (existing) {
        if (source === "diff") existing.diffElement = element;
        else existing.treeElement = element;
        return;
      }
      byPath.set(key, {path: normalized, source, treeElement: source === "tree" ? element : null,
        diffElement: source === "diff" ? element : null});
    };
    for (const link of document.querySelectorAll(TREE_LINK)) {
      const row = link.closest("li, [role='treeitem'], [class*='file-tree-row'], [data-testid='file-tree-row']") || link;
      const path = treePath(link);
      add(row, path, "tree");
      const href = link.getAttribute("href") || "";
      const match = href.match(/#(?:%23)?(diff-[^/?#]+)/i);
      if (match && path) treeByDiffId.set(match[1].toLowerCase(), path);
    }
    // Current React tree variants may render file names without an anchor/hash.
    // Match only leaf-like elements whose complete text is a filename.
    const extension = /\.(?:md|markdown|txt|rst|adoc|pdf|png|jpe?g|gif|svg|webp|avif|json|ya?ml|toml|rb|py|js|jsx|ts|tsx|css|scss|html|sql|go|rs|java|kt|lock)$/i;
    for (const node of document.querySelectorAll("[role='treeitem'], [data-testid*='file'], a, button, span")) {
      const text = clean(node.textContent);
      if (!text || text.length > 180 || !extension.test(text)) continue;
      const row = node.closest("li, [role='treeitem'], [class*='file-tree-row'], [data-testid='file-tree-row']") || node;
      add(row, text, "tree");
    }
    const seen = new Set();
    for (const header of document.querySelectorAll(HEADER)) {
      const card = header.closest(CARD);
      if (card && !seen.has(card)) {
        seen.add(card);
        const mapped = card.id && treeByDiffId.get(card.id.toLowerCase());
        add(card, mapped || cardPath(card), "diff");
      }
    }
    for (const card of document.querySelectorAll(".file.js-file[data-path], [data-testid='diff-file'], [data-testid='diff-file-container']")) {
      if (!seen.has(card)) {
        seen.add(card);
        const mapped = card.id && treeByDiffId.get(card.id.toLowerCase());
        add(card, mapped || cardPath(card), "diff");
      }
    }
    return [...byPath.values()].concat(unknown);
  }
  const api = Object.freeze({collectFiles, treePath, cardPath});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.PRCodeOnlyDOM = api;
})();
