(() => {
  "use strict";
  if (globalThis.__prCodeOnlyLoaded) return;
  globalThis.__prCodeOnlyLoaded = true;

  const { classifyFile, isPullRequestFiles } = globalThis.PRCodeOnlyRules;
  const { collectFiles } = globalThis.PRCodeOnlyDOM;
  const KEY = "prCodeOnlyOptions";
  const options = { enabled: false, filterFiles: true };
  let host, toggle, filter, status, stats, timer = null;
  let marked = new Set(), previousURL = location.href, nativeSummary = null;

  const remember = (node, cls) => { if (node) { node.classList.add(cls); marked.add(node); } };
  function restore() {
    document.body.classList.remove("prco-active");
    for (const node of marked) node.classList.remove("prco-hidden-file");
    marked.clear();
    if (nativeSummary?.isConnected && nativeSummary.dataset.prcoOriginal !== undefined) {
      nativeSummary.textContent = nativeSummary.dataset.prcoOriginal;
      delete nativeSummary.dataset.prcoOriginal;
    }
    nativeSummary = null;
  }
  function setStatus(message) { if (status) status.textContent = message; }

  function createToolbar() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "prco-toolbar";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{font:13px/1.4 system-ui,sans-serif;color-scheme:light dark}section{background:#161b22;color:#f0f6fc;border:1px solid #57606a;border-radius:10px;padding:12px;box-shadow:0 4px 20px #0005;max-width:390px}button{background:#238636;color:white;border:1px solid #3fb950;border-radius:6px;padding:7px 10px;cursor:pointer;font:inherit}button:focus-visible,input:focus-visible{outline:3px solid #58a6ff;outline-offset:3px}label{display:block;margin-top:8px;cursor:pointer}input{margin-right:7px}p{margin:8px 0 0;font-size:12px;max-width:380px}";
    const panel = document.createElement("section");
    panel.setAttribute("aria-label", "GitHub PR Code Only");
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.addEventListener("click", () => { options.enabled = !options.enabled; persist(); schedule(); });
    panel.append(toggle);
    const label = document.createElement("label");
    filter = document.createElement("input");
    filter.type = "checkbox";
    filter.addEventListener("change", () => { options.filterFiles = filter.checked; persist(); schedule(); });
    label.append(filter, document.createTextNode("Ocultar arquivos que não são código"));
    panel.append(label);
    stats = document.createElement("p");
    stats.setAttribute("role", "status");
    stats.setAttribute("aria-live", "polite");
    panel.append(stats);
    status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.append(status);
    shadow.append(style, panel);
    document.body.append(host);
  }

  function persist() { chrome.storage.local.set({ [KEY]: options }).catch(() => {}); }

  function countLoadedCodeChanges(entries) {
    const additions = [".blob-code-addition", ".js-blob-code-addition", "[data-code-marker='＋']", "[data-code-marker='+']"];
    const deletions = [".blob-code-deletion", ".js-blob-code-deletion", "[data-code-marker='−']", "[data-code-marker='-']"];
    const seen = new Set();
    let added = 0, deleted = 0, files = 0;
    for (const entry of entries) {
      if (!entry.diffElement || seen.has(entry.diffElement) || classifyFile(entry.path) !== "code") continue;
      seen.add(entry.diffElement);
      files++;
      for (const selector of additions) added += entry.diffElement.querySelectorAll(selector).length;
      for (const selector of deletions) deleted += entry.diffElement.querySelectorAll(selector).length;
    }
    return { added, deleted, files };
  }

  function findNativeSummary() {
    const candidates = document.querySelectorAll("span,div,dd");
    for (const node of candidates) {
      const text = node.textContent.trim();
      if (!/^\+\d+\s*-\s*\d+$/.test(text)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.top > 0 && rect.top < 330 &&
          !node.closest("[id^='diff-'], .file-header, [class*='DiffFile'], [class*='diff-file']")) return node;
    }
    return null;
  }

  function updateStats(entries) {
    const totals = countLoadedCodeChanges(entries);
    const value = "Código carregado: +" + totals.added + " -" + totals.deleted +
      " · " + totals.files + " arquivos";
    if (stats) stats.textContent = value;
    const summary = findNativeSummary();
    if (summary && summary.dataset.prcoOriginal === undefined) {
      summary.dataset.prcoOriginal = summary.textContent;
      summary.textContent = "+ " + totals.added + " -" + totals.deleted + " (código)";
      nativeSummary = summary;
    } else if (nativeSummary?.isConnected) {
      nativeSummary.textContent = "+ " + totals.added + " -" + totals.deleted + " (código)";
    }
  }

  function apply() {
    timer = null;
    try {
      restore();
      if (!isPullRequestFiles(location.pathname)) { host?.remove(); return; }
      createToolbar();
      toggle.textContent = options.enabled ? "Restaurar página normal" : "Ativar somente código";
      filter.checked = options.filterFiles;
      if (!options.enabled) { setStatus("Modo normal. Ative para focar nos arquivos de código."); return; }
      const entries = collectFiles(document);
      let hidden = 0, unknown = 0;
      for (const entry of entries) {
        const kind = classifyFile(entry.path);
        if (kind === "unknown") unknown++;
        if (options.filterFiles && kind === "non-code") {
          remember(entry.treeElement, "prco-hidden-file");
          remember(entry.diffElement, "prco-hidden-file");
          hidden++;
        }
      }
      document.body.classList.add("prco-active");
      setStatus(hidden + " arquivos não código ocultados · " + unknown + " caminhos não identificados mantidos visíveis.");
      updateStats(entries);
    } catch (error) {
      restore();
      options.enabled = false;
      setStatus("Falha no filtro; página restaurada.");
      console.warn("[PR Code Only]", error);
    }
  }

  function schedule() { if (timer === null) timer = setTimeout(apply, 150); }
  const observer = new MutationObserver(() => {
    if (isPullRequestFiles(location.pathname) || marked.size || host?.isConnected) schedule();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && options.enabled) { options.enabled = false; persist(); schedule(); }
  });
  document.addEventListener("turbo:load", schedule);
  document.addEventListener("pjax:end", schedule);
  window.addEventListener("popstate", schedule);
  setInterval(() => { if (location.href !== previousURL) { previousURL = location.href; schedule(); } }, 1000);
  function read(value) {
    if (value && typeof value === "object")
      for (const key of Object.keys(options)) if (typeof value[key] === "boolean") options[key] = value[key];
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) { read(changes[KEY].newValue); schedule(); }
  });
  chrome.storage.local.get(KEY).then(result => read(result[KEY])).catch(() => {}).finally(() => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-path", "data-file-path", "title", "id"] });
    schedule();
  });
})();