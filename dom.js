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
    const row = link.closest("[role='treeitem'], [data-testid='file-tree-row'], [class*='file-tree-row'], li");
    const full = row?.querySelector("[data-filterable-item-text]")?.textContent ||
      row?.getAttribute("data-path") || row?.getAttribute("data-file-path");
    return pathFromText(full || link.getAttribute("data-path") || link.getAttribute("title") ||
      link.getAttribute("aria-label") || link.textContent);
  }
  function cardPath(card) {
    const direct = card.getAttribute("data-path") || card.getAttribute("data-file-path");
    if (direct) return clean(direct);
    const header = card.querySelector(HEADER);
    if (!header) return "";
    const headerPath = header.getAttribute("data-path") || header.getAttribute("data-file-path");
    if (headerPath) return clean(headerPath);
    for (const helper of header.querySelectorAll(".sr-only, [aria-label]")) {
      const description = helper.getAttribute("aria-label") || helper.textContent;
      const renamed = clean(description).match(/ renamed to (.+)$/i);
      if (renamed) return clean(renamed[1]);
    }
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
  function fileContainer(header) {
    const initial = header.closest(CARD);
    if (!initial) return null;
    const lines = ".blob-code, [data-code-marker], [data-line-number], [class*='DiffLine-module__']";
    if (initial.querySelector(lines)) return initial;
    let node = initial.parentElement;
    for (let depth = 0; node && depth < 5; node = node.parentElement, depth++) {
      if (node.id === "files" || node.tagName === "BODY") break;
      if (node.querySelectorAll(HEADER).length !== 1) break;
      if (node.querySelector(lines)) return node;
    }
    return initial;
  }
  function collectFiles(document) {
    const byPath = new Map();
    const treeByDiffId = new Map();
    const unknown = [];
    const add = (element, path, source) => {
      const normalized = clean(path);
      if (!normalized) { unknown.push({element, path:"", source}); return; }
      const key = normalized;
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
      const row = link.closest("li, [role='treeitem'], [class*='file-tree-row'], [data-testid='file-tree-row']");
      if (!row || link.closest(CARD)) continue;
      const path = treePath(link);
      add(row, path, "tree");
      const href = link.getAttribute("href") || "";
      const match = href.match(/(?:#|%23)(diff-[^/?#]+)/i);
      if (match && path) treeByDiffId.set(match[1].toLowerCase(), path);
    }
    // Current React tree variants may render file names without an anchor/hash.
    // Match only leaf-like elements whose complete text is a filename.
    const extension = /\.(?:md|markdown|txt|rst|adoc|pdf|png|jpe?g|gif|svg|webp|avif|json|ya?ml|toml|rb|py|js|jsx|ts|tsx|css|scss|html|sql|go|rs|java|kt|lock)$/i;
    for (const node of document.querySelectorAll("file-tree [data-tree-entry-type='file'], file-tree [data-file-type], [role='treeitem'], [data-testid='file-tree-row'], [class*='file-tree-row']")) {
      if (node.closest(CARD) || node.querySelector("[role='group'], [role='treeitem']")) continue;
      const text = clean(node.getAttribute("data-path") || node.getAttribute("data-file-path") ||
        node.querySelector("[data-filterable-item-text]")?.textContent ||
        node.querySelector("a[title]")?.getAttribute("title") || node.textContent);
      if (!text || text.length > 180 || !extension.test(text)) continue;
      const row = node.closest("li, [role='treeitem'], [class*='file-tree-row'], [data-testid='file-tree-row']") || node;
      add(row, text, "tree");
    }
    const seen = new Set();
    for (const header of document.querySelectorAll(HEADER)) {
      const card = fileContainer(header);
      if (card && !seen.has(card)) {
        seen.add(card);
        const mapped = card.id && treeByDiffId.get(card.id.toLowerCase());
        add(card, mapped || cardPath(card), "diff");
      }
    }
    for (const card of document.querySelectorAll(".file.js-file[data-path], [data-testid='diff-file'], [data-testid='diff-file-container']")) {
      if (!seen.has(card) && ![...seen].some(parent => parent.contains(card))) {
        seen.add(card);
        const mapped = card.id && treeByDiffId.get(card.id.toLowerCase());
        add(card, mapped || cardPath(card), "diff");
      }
    }
    return [...byPath.values()].concat(unknown);
  }
  function findFiles(document) {
    return collectFiles(document).map(entry => entry.diffElement).filter(Boolean);
  }
  function findRoot(document, cards) {
    if (!cards.length) return null;
    for (const root of document.querySelectorAll("#files, [data-testid='files-changed']")) {
      if (cards.every(card => root.contains(card))) return root;
    }
    let root = cards[0].parentElement;
    while (root && !cards.every(card => root.contains(card))) root = root.parentElement;
    return root && root !== document.body && root !== document.documentElement ? root : null;
  }
  const api = Object.freeze({collectFiles, treePath, cardPath, fileContainer, filename: cardPath, findFiles, findRoot});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.PRCodeOnlyDOM = api;
})();
