(() => {
  "use strict";
  const CELLS = ".blob-code, [data-code-marker]";
  const COMMENTS = ".pl-c, .token.comment, [data-token-type='comment']";
  const THREADS = ".js-inline-comments-container, .review-thread, [data-testid='review-thread'], [data-testid='comment-thread'], [data-testid*='review-thread'], [class*='ReviewThread-module__']";
  const STATS = ".diffstat, [data-testid='diff-stats'], [class*='DiffStats-module__diffStats']";
  function commentOnly(cell) {
    if (!cell.querySelector(COMMENTS)) return false;
    const copy = cell.cloneNode(true);
    copy.querySelectorAll(COMMENTS).forEach(node => node.remove());
    return !copy.textContent.trim();
  }
  function changeKind(cell) {
    const marker = cell.getAttribute("data-code-marker");
    const classes = (cell.getAttribute("class") || "").split(/\s+/);
    if (marker === "+" || marker === "＋" || classes.includes("blob-code-addition")) return "added";
    if (marker === "-" || marker === "−" || classes.includes("blob-code-deletion")) return "deleted";
    return null;
  }
  function plainComment(text, path) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const extension = (path || "").split(".").pop().toLowerCase();
    if (["rb", "py", "sh", "bash", "zsh", "yml", "yaml", "toml"].includes(extension))
      return trimmed.startsWith("#");
    if (["js", "jsx", "ts", "tsx", "css", "scss", "java", "go", "rs"].includes(extension))
      return /^(?:\/\/|\/\*|\*\s)/.test(trimmed);
    if (["html", "htm", "xml"].includes(extension)) return trimmed.startsWith("<!--");
    if (extension === "sql") return /^(?:--|\/\*)/.test(trimmed);
    return false;
  }
  function reactLineKind(row) {
    const type = (row.getAttribute("data-line-type") || row.getAttribute("data-diff-line-type") ||
      row.getAttribute("class") || "").toLowerCase();
    if (/(?:addition|added|insert)/.test(type)) return "added";
    if (/(?:deletion|deleted|removed)/.test(type)) return "deleted";
    const marker = row.querySelector("[data-code-marker], [class*='line-marker'], [class*='lineMarker']");
    const value = marker?.getAttribute("data-code-marker") || marker?.textContent?.trim();
    if (value === "+" || value === "＋") return "added";
    if (value === "-" || value === "−") return "deleted";
    const prefix = row.textContent.match(/^\s*(?:\d+\s*){0,2}([+−-])(?=\s|\S)/);
    if (prefix?.[1] === "+") return "added";
    if (prefix?.[1] === "-" || prefix?.[1] === "−") return "deleted";
    return null;
  }
  function reactCodeText(row) {
    const content = row.querySelector("[data-testid='diff-line-content'], [class*='codeContent'], [class*='code-content']");
    if (content) return content.textContent.trim();
    return row.textContent.replace(/^\s*(?:\d+\s+){0,2}[+−-]?\s*/, "").trim();
  }
  function filterReactRows(card, hide, totals, path, hideComments) {
    const rows = new Set();
    const selectors = "tr, [role='row'], [data-line-number], [class*='DiffLine-module__line'], [data-testid='diff-line']";
    for (const candidate of card.querySelectorAll(selectors)) {
      const row = candidate.closest("tr, [role='row'], [data-testid='diff-line'], [class*='DiffLine-module__line']") ||
        candidate.parentElement;
      if (row && row !== card) rows.add(row);
    }
    for (const row of rows) {
      const text = reactCodeText(row);
      if (text.startsWith("@@")) continue;
      const kind = reactLineKind(row);
      if (!hideComments) {
        if (kind) totals[kind]++;
        continue;
      }
      if (!text) continue;
      if (plainComment(text, path)) { hide(row); continue; }
      if (kind) totals[kind]++;
      row.querySelectorAll(COMMENTS).forEach(hide);
    }
  }
  function filterDiff(card, hide, path = "", hideComments = true) {
    const totals = { added: 0, deleted: 0 };
    if (hideComments) card.querySelectorAll(THREADS).forEach(hide);
    if (hideComments) for (const button of card.querySelectorAll("button")) {
      if (!/^(?:Resolve comment|Unresolve comment)$/i.test(button.textContent.trim())) continue;
      let panel = button.parentElement;
      for (let depth = 0; panel && panel !== card && depth < 5; panel = panel.parentElement, depth++) {
        if (/Comment on lines? /i.test(panel.textContent) &&
            !panel.querySelector(".blob-code, [class*='DiffLine-module__line']")) {
          hide(panel);
          break;
        }
      }
    }
    // Choose the innermost code cell, avoiding counting a marker wrapper twice.
    const cells = [...card.querySelectorAll(CELLS)].filter(cell => !cell.querySelector(CELLS));
    if (!cells.length) {
      filterReactRows(card, hide, totals, path, hideComments);
      return totals;
    }
    if (!hideComments) {
      for (const cell of cells) {
        const kind = changeKind(cell) || changeKind(cell.parentElement || cell);
        if (kind) totals[kind]++;
      }
      return totals;
    }
    const rows = new Map();
    for (const cell of cells) {
      const onlyComment = commentOnly(cell) || plainComment(cell.textContent, path);
      cell.querySelectorAll(COMMENTS).forEach(hide);
      const row = cell.closest("tr, [role='row']");
      if (row) {
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push({cell, onlyComment});
      }
      if (onlyComment) continue;
      const kind = changeKind(cell) || changeKind(cell.parentElement || cell);
      if (kind && cell.textContent.trim()) totals[kind]++;
    }
    for (const [row, values] of rows) {
      // A split row can contain a comment on one side and code on the other.
      if (values.every(value => value.onlyComment || !value.cell.textContent.trim())) {
        if (values.some(value => value.onlyComment)) hide(row);
      } else {
        for (const {cell, onlyComment} of values) {
          if (onlyComment) cell.querySelectorAll(COMMENTS).forEach(hide);
        }
      }
    }
    return totals;
  }
  function readFileChangeTotals(card) {
    const header = card.querySelector(".file-header, [class*='DiffFileHeader-module__diff-file-header'], [class*='Diff-module__diffHeaderWrapper']");
    if (!header) return null;
    const text = header.textContent;
    const additions = text.match(/\+(\d[\d,]*)/);
    const deletions = text.match(/[-−](\d[\d,]*)/);
    if (!additions && !deletions) return null;
    return {
      added: additions ? Number(additions[1].replace(/,/g, "")) : 0,
      deleted: deletions ? Number(deletions[1].replace(/,/g, "")) : 0
    };
  }
  function updateCounters(root, totals, hide, created, document, excludedCards = [], hideComments = true) {
    const candidates = [...root.querySelectorAll(STATS)].filter(node =>
      !excludedCards.some(card => card.contains(node)));
    for (const node of candidates) {
      if (candidates.some(other => other !== node && other.contains(node))) continue;
      const label = document.createElement("span");
      label.setAttribute("class", "prco-counter");
      label.setAttribute("title", hideComments
        ? "Linhas de código carregadas; exclui comentários, linhas vazias e arquivos não código."
        : "Alterações carregadas em arquivos de código, incluindo comentários e linhas vazias.");
      label.textContent = (hideComments ? "Código carregado: +" : "Arquivos de código: +") +
        totals.added + " −" + totals.deleted;
      node.parentElement.insertBefore(label, node);
      created.push(label);
      hide(node);
    }
    return candidates.length;
  }
  function replaceNativeNumbers(document, totals, cards, edits) {
    if (!document.createTreeWalker) return false;
    const walker = document.createTreeWalker(document.body, 4);
    const positives = [], negatives = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || cards.some(card => card.contains(parent))) continue;
      const top = parent.getBoundingClientRect?.().top;
      if (top != null && (top < 0 || top > 600)) continue;
      const value = node.nodeValue.trim();
      if (/^\+[\d, .]+[-−][\d, .]+$/.test(value)) {
        edits.push({node, original: node.nodeValue});
        node.nodeValue = node.nodeValue.replace(/\+\s*[\d,.]+\s*[-−]\s*[\d,.]+/,
          "+" + totals.added + " −" + totals.deleted);
        return true;
      }
      if (/^\+[\d, .]+$/.test(value)) positives.push(node);
      if (/^[-−][\d, .]+$/.test(value)) negatives.push(node);
    }
    for (const positive of positives) {
      const parent = positive.parentElement;
      const negative = negatives.find(other => {
        if (other.parentElement === parent || other.parentElement?.parentElement === parent?.parentElement)
          return true;
        const a = parent.getBoundingClientRect?.();
        const b = other.parentElement?.getBoundingClientRect?.();
        return a && b && Math.abs(a.top - b.top) < 30 && Math.abs(a.left - b.left) < 300;
      });
      if (!negative) continue;
      for (const [target, sign, count] of [[positive, "+", totals.added], [negative, "−", totals.deleted]]) {
        edits.push({node: target, original: target.nodeValue});
        target.nodeValue = target.nodeValue.replace(/([+−-])\s*[\d, .]+/, sign + count);
      }
      return true;
    }
    return false;
  }
  function replaceNativeElements(document, totals, cards, edits) {
    const positive = [], negative = [];
    for (const element of document.querySelectorAll("span, strong, b")) {
      if (cards.some(card => card.contains(element))) continue;
      const bounds = element.getBoundingClientRect?.();
      if (!bounds || bounds.top < 0 || bounds.top > 400) continue;
      const value = element.textContent.trim();
      if (element.children.length) continue;
      if (/^\+\s*[\d, .]+$/.test(value)) positive.push({element, bounds});
      if (/^[-−]\s*[\d, .]+$/.test(value)) negative.push({element, bounds});
    }
    for (const addition of positive) {
      const deletion = negative.find(item => Math.abs(item.bounds.top - addition.bounds.top) < 30 &&
        Math.abs(item.bounds.left - addition.bounds.left) < 300);
      if (!deletion) continue;
      for (const [item, sign, count] of [[addition, "+", totals.added], [deletion, "−", totals.deleted]]) {
        edits.push({element:item.element, originalText:item.element.textContent});
        item.element.textContent = sign + count;
      }
      return true;
    }
    return false;
  }
  function showOverallCounter(document, totals, hide, created, cards, edits = []) {
    return Boolean(updateCounters(document, totals, hide, created, document, cards)) ||
      replaceNativeNumbers(document, totals, cards, edits) ||
      replaceNativeElements(document, totals, cards, edits);
  }
  const api = Object.freeze({ filterDiff, updateCounters, showOverallCounter, replaceNativeNumbers, replaceNativeElements, readFileChangeTotals, commentOnly, plainComment });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.PRCodeOnlyDiff = api;
})();
