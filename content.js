(() => {
  "use strict";
  if (globalThis.__prCodeOnlyLoaded) return;
  globalThis.__prCodeOnlyLoaded = true;
  const { classifyFile, isPullRequestFiles } = globalThis.PRCodeOnlyRules;
  const STORAGE_KEY = "prCodeOnlyOptions";
  const { filename, findFiles, findRoot } = globalThis.PRCodeOnlyDOM;
  const VERSION = chrome.runtime.getManifest().version;
  let options = { enabled: false, filterFiles: true, hideComments: true };
  let host, toggle, filter, comments, status;
  let timer = null;
  let previousURL = location.href;
  let marked = new Set();
  let storageWarning = false;

  function remember(node, name) {
    node.classList.add(name);
    marked.add(node);
  }
  function restore() {
    document.body.classList.remove("prco-active", "prco-hide-comments");
    for (const node of marked) {
      node.classList.remove("prco-root", "prco-ancestor", "prco-hidden-file");
    }
    marked.clear();
  }
  function setStatus(message) {
    status.textContent = "v" + VERSION + " · " + message + (storageWarning ? " Preferências não salvas; recarregue a aba." : "");
  }
  function persist() {
    chrome.storage.local.set({ [STORAGE_KEY]: options }).catch(() => {
      storageWarning = true;
      schedule();
    });
  }
  function createToolbar() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "prco-toolbar";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = [
      ":host { font: 13px/1.4 system-ui, sans-serif; color-scheme: light dark; }",
      "section { font: 13px/1.4 system-ui, sans-serif; background: #161b22; color: #f0f6fc; border: 1px solid #57606a; border-radius: 10px; padding: 12px; box-shadow: 0 4px 20px #0005; max-width: 380px; }",
      "button { background: #238636; color: white; border: 1px solid #3fb950; border-radius: 6px; padding: 7px 10px; cursor: pointer; font: inherit; }",
      "button:focus-visible, input:focus-visible { outline: 3px solid #58a6ff; outline-offset: 3px; }",
      "label { display: block; margin-top: 8px; cursor: pointer; }",
      "input { margin-right: 7px; }",
      "p { margin: 8px 0 0; font-size: 12px; max-width: 360px; }"
    ].join("\n");
    const panel = document.createElement("section");
    panel.setAttribute("aria-label", "GitHub PR Code Only");
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      options.enabled = !options.enabled;
      persist();
      schedule();
    });
    panel.append(toggle);
    function checkbox(text, key) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.addEventListener("change", () => {
        options[key] = input.checked;
        persist();
        schedule();
      });
      label.append(input, document.createTextNode(text));
      panel.append(label);
      return input;
    }
    filter = checkbox("Ocultar arquivos não código/gerados", "filterFiles");
    comments = checkbox("Ocultar comentários de revisão", "hideComments");
    status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.append(status);
    shadow.append(style, panel);
    document.body.append(host);
  }
  function observe() {
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["data-path", "data-file-path", "title", "id"]
    });
  }
  function apply() {
    timer = null;
    observer.disconnect();
    try {
      restore();
      if (!isPullRequestFiles(location.pathname)) {
        host?.remove();
        return;
      }
      createToolbar();
      toggle.textContent = options.enabled ? "Restaurar página normal" : "Ativar somente código";
      toggle.setAttribute("aria-pressed", String(options.enabled));
      filter.checked = options.filterFiles;
      comments.checked = options.hideComments;
      if (!options.enabled) {
        setStatus("Modo normal. Ative para focar nos diffs.");
        return;
      }
      const files = findFiles(document);
      const root = findRoot(document, files);
      if (!files.length || !root) {
        setStatus("Diff não identificado. A página foi mantida intacta; aguarde o carregamento ou desative o modo.");
        return;
      }
      remember(root, "prco-root");
      for (let parent = root.parentElement; parent; parent = parent.parentElement) {
        remember(parent, "prco-ancestor");
        if (parent === document.body) break;
      }
      let hidden = 0;
      let unknown = 0;
      for (const file of files) {
        const kind = classifyFile(filename(file));
        if (kind === "unknown") unknown++;
        if (options.filterFiles && kind === "non-code") {
          remember(file, "prco-hidden-file");
          hidden++;
        }
      }
      document.body.classList.add("prco-active");
      document.body.classList.toggle("prco-hide-comments", options.hideComments);
      setStatus(
        (files.length - hidden) + " arquivos visíveis · " + hidden + " ocultos (carregados)." +
        (unknown ? " " + unknown + " não identificados, mantidos visíveis." : "") +
        (hidden === files.length ? " Desmarque o filtro para mostrar os arquivos." : "")
      );
    } catch (error) {
      restore();
      options.enabled = false;
      if (status) setStatus("Não foi possível aplicar o filtro. A página foi restaurada.");
      console.warn("[PR Code Only] Falha ao aplicar modo de foco.", error);
    } finally {
      observe();
    }
  }
  function schedule() {
    // Throttle, not debounce: a busy page must not postpone filtering forever.
    if (timer === null) timer = setTimeout(apply, 150);
  }
  const observer = new MutationObserver(() => {
    if (isPullRequestFiles(location.pathname) || marked.size || host?.isConnected) schedule();
  });
  // The stylesheet alone never changes GitHub without the active body class.
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !options.enabled || !isPullRequestFiles(location.pathname)) return;
    options.enabled = false;
    restore();
    persist();
    schedule();
  });
  document.addEventListener("turbo:load", schedule);
  document.addEventListener("pjax:end", schedule);
  window.addEventListener("popstate", schedule);
  // GitHub also uses same-document navigation without the legacy events.
  setInterval(() => {
    if (location.href !== previousURL) {
      previousURL = location.href;
      schedule();
    }
  }, 1000);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    readOptions(changes[STORAGE_KEY].newValue);
    schedule();
  });
  function readOptions(value) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(options)) {
      if (typeof value[key] === "boolean") options[key] = value[key];
    }
  }
  chrome.storage.local.get(STORAGE_KEY).then(result => {
    readOptions(result[STORAGE_KEY]);
  }).catch(() => { storageWarning = true; }).finally(() => {
    observe();
    schedule();
  });
})();
