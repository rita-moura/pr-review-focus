/* GitHub DOM adapters. No network calls; unknown structures remain untouched. */
(function (root) {
  "use strict";
  const SELECTORS = Object.freeze({
    files: [
      ".file.js-file", ".js-file[data-path]",
      "[data-testid='diff-file']", "[data-testid='diff-file-container']",
      "[class*='Diff-module__diffTargetable']"
    ].join(", "),
    // A hash target is only accepted if it contains an actual file header.
    targets: "div[id^='diff-']",
    header: ".file-header, [class*='DiffFileHeader-module__diff-file-header'], [class*='Diff-module__diffHeaderWrapper']",
    roots: "#files, [data-testid='diff-viewer'], [data-testid='files-changed']",
    name: "[class*='DiffFileHeader-module__file-name'] code, [class*='DiffFileHeader-module__file-name']",
    path: "[data-path], [data-file-path]",
    legacyName: ".file-info a[title], [data-testid='file-name']",
    headerLink: "[class*='file-path-section'] a",
    treeRows: "ul[aria-label='File Tree'] li, [class*='file-tree-row'], [data-testid='file-tree-row']"
  });
  function clean(value) {
    return (value || "").replace(/[\u200e\u200f]/g, "").trim();
  }
  function pathAttribute(node) {
    return clean(node.getAttribute("data-path") || node.getAttribute("data-file-path"));
  }
  function filename(file) {
    const ownPath = pathAttribute(file);
    if (ownPath) return ownPath;
    const header = file.querySelector(SELECTORS.header);
    const scope = header || file;
    const attributeNode = scope.querySelector(SELECTORS.path);
    if (attributeNode && pathAttribute(attributeNode)) return pathAttribute(attributeNode);

    // Modern React headers use CSS-module classes and may contain nested spans.
    const name = scope.querySelector(SELECTORS.name) || scope.querySelector("a[class*='file-name'], [class*='file-path'], [class*='filePath']");
    if (name) {
      // The accessible rename label contains the destination path.
      const rename = clean(name.querySelector(".sr-only")?.textContent);
      const separator = " renamed to ";
      if (rename.includes(separator)) return clean(rename.slice(rename.lastIndexOf(separator) + separator.length));
      const copy = name.cloneNode(true);
      for (const helper of copy.querySelectorAll(".sr-only")) helper.remove();
      const value = clean(copy.textContent);
      if (value) return value;
    }
    const legacy = scope.querySelector(SELECTORS.legacyName);
    if (legacy) return clean(legacy.getAttribute("title") || legacy.textContent);
    const link = scope.querySelector(SELECTORS.headerLink);
    if (link) return clean(link.getAttribute("title") || link.textContent);
    // Last-resort adapter for GitHub's virtualized React headers.
    const text = clean(scope.textContent);
    const match = text.match(/(?:^|\s)([^\s]+\.(?:md|markdown|txt|rst|adoc|pdf|png|jpe?g|gif|svg|webp|json|ya?ml|toml|rb|py|js|jsx|ts|tsx|css|scss|html|sql|go|rs|java|kt))(?:\s|$)/i);
    return match ? clean(match[1]) : "";
  }
  function findFiles(document) {
    const candidates = new Set(document.querySelectorAll(SELECTORS.files));
    // React/GitHub can render a file header without the targetable wrapper class.
    // Start from every known header and climb to the nearest complete file card.
    for (const header of document.querySelectorAll(SELECTORS.header)) {
      const card = header.closest("div[id^='diff-'], [class*='Diff-module__diffTargetable'], [data-testid='diff-file'], [data-testid='diff-file-container'], .file.js-file");
      if (card) candidates.add(card);
    }
    for (const node of document.querySelectorAll(SELECTORS.targets)) {
      if (node.querySelector(SELECTORS.header)) candidates.add(node);
    }
    // The left file tree is not the diff card, but filtering it prevents
    // non-code files from remaining visible while the diff is virtualized.
    for (const row of document.querySelectorAll(SELECTORS.treeRows)) candidates.add(row);
    const nodes = [...candidates];
    // The wrapper and its nested card can both match: count/hide each file once.
    return nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
  }
  function findRoot(document, files) {
    if (!files.length) return null;
    const explicit = [...document.querySelectorAll(SELECTORS.roots)]
      .find(node => node !== document.body && node !== document.documentElement &&
        files.every(file => node.contains(file)));
    if (explicit) return explicit;
    // Keep the list container even for a single file, so lazy siblings can load.
    let common = files[0].parentElement;
    while (common && !files.every(file => common.contains(file))) common = common.parentElement;
    if (common && common !== document.body && common !== document.documentElement) return common;
    return files.length === 1 ? files[0] : null;
  }
  const api = Object.freeze({ SELECTORS, filename, findFiles, findRoot });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PRCodeOnlyDOM = api;
})(globalThis);
