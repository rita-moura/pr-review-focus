(() => {
  "use strict";
  if (globalThis.__prCodeOnlyLoaded) return;
  globalThis.__prCodeOnlyLoaded = true;
  const { classifyFile, isPullRequestFiles } = globalThis.PRCodeOnlyRules;
  const { collectFiles, nonCodeTargets } = globalThis.PRCodeOnlyDOM;
  let enabled = false, mode = "code", timer = null, previousURL = location.href;
  let modePicker = null, modeButtons = null;
  let stopped = false, navigationTimer = null;
  const marked = new Set();
  const counters = [];
  const summaryEdits = [];
  const { filterDiff, updateCounters, showOverallCounter, readFileChangeTotals } = globalThis.PRCodeOnlyDiff;
  const observer = new MutationObserver(schedule);
  function observe() {
    if (stopped || !enabled) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["data-path", "data-file-path", "title", "id", "aria-label", "href"] });
  }
  function hide(node) {
    if (node) { node.classList.add("prco-hidden"); marked.add(node); }
  }
  function restore() {
    document.body.classList.remove("prco-active");
    for (const node of marked) node.classList.remove("prco-hidden");
    marked.clear();
    for (const counter of counters) counter.remove();
    counters.length = 0;
    for (const edit of summaryEdits) {
      if (edit.node?.isConnected && edit.node.nodeValue === edit.replacement) edit.node.nodeValue = edit.original;
      if (edit.element?.isConnected && edit.element.textContent === edit.replacement) edit.element.textContent = edit.originalText;
    }
    summaryEdits.length = 0;
  }
  function removeModePicker() {
    modePicker?.remove();
    modePicker = null;
    modeButtons = null;
  }
  function showModePicker() {
    if (!modePicker?.parentElement) {
      modePicker = document.createElement("div");
      modePicker.setAttribute("id", "prco-mode-picker");
      modePicker.setAttribute("role", "group");
      modePicker.setAttribute("aria-label", "Modo de revisão");
      modeButtons = {};
      modePicker.title = "Os contadores consideram apenas os diffs carregados.";
      for (const [value, label] of [["code", "Código sem comentários"], ["files", "Arquivos de código"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (mode !== value) { mode = value; apply(); }
        });
        modeButtons[value] = button;
        modePicker.append(button);
      }
      document.body.append(modePicker);
    }
    for (const [value, button] of Object.entries(modeButtons))
      button.setAttribute("aria-pressed", String(mode === value));
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    enabled = false;
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
    if (navigationTimer !== null) clearInterval(navigationTimer);
    timer = null;
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("turbo:load", schedule);
    document.removeEventListener("pjax:end", schedule);
    window.removeEventListener("popstate", schedule);
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch {}
    restore();
    removeModePicker();
  }
  function hasExtensionContext() {
    try { return Boolean(chrome.runtime.id); }
    catch { return false; }
  }
  function connectionFailed(error) {
    if (!hasExtensionContext() || /context invalidated/i.test(String(error?.message || error))) stop();
  }
  function report(warning = false) {
    if (stopped) return;
    try {
      if (!hasExtensionContext()) { stop(); return; }
      Promise.resolve(chrome.runtime.sendMessage({ type: "codeOnlyState", enabled, mode, warning }))
        .catch(connectionFailed);
    } catch (error) { connectionFailed(error); }
  }
  function apply() {
    if (stopped) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    observer.disconnect();
    try {
      restore();
      if (!isPullRequestFiles(location.pathname)) enabled = false;
      if (!enabled) { removeModePicker(); report(); return; }
      const entries = collectFiles(document);
      const cards = entries.map(entry => entry.diffElement).filter(Boolean);
      if (!cards.length) { removeModePicker(); report(true); return; }
      for (const target of nonCodeTargets(document, classifyFile, entries)) hide(target);
      showModePicker();
      const totals = { added: 0, deleted: 0 };
      for (const entry of entries) {
        if (!entry.diffElement || classifyFile(entry.path) !== "code") continue;
        const visible = filterDiff(entry.diffElement, hide, entry.path, mode === "code");
        const counts = mode === "files" ? readFileChangeTotals(entry.diffElement) || visible : visible;
        totals.added += counts.added;
        totals.deleted += counts.deleted;
        updateCounters(entry.diffElement, counts, hide, counters, document, [], mode === "code");
      }
      showOverallCounter(document, totals, hide, counters, cards, summaryEdits);
      document.body.classList.add("prco-active");
      report();
    } catch (error) {
      restore();
      enabled = false;
      removeModePicker();
      report(true);
      console.warn("[PR Review Focus] Página restaurada após falha no filtro.", error);
    } finally { observe(); }
  }
  function schedule() {
    if (!stopped && enabled && timer === null) timer = setTimeout(apply, 100);
  }
  function onMessage(message, sender, reply) {
    if (stopped) return;
    if (message?.type !== "toggleCodeOnly" && message?.type !== "activateCodeOnly") return;
    if (!isPullRequestFiles(location.pathname)) { reply({ enabled: false, ready: true }); return; }
    enabled = message.type === "activateCodeOnly" ? true : !enabled;
    apply();
    reply({ enabled, mode, ready: !stopped });
  }
  chrome.runtime.onMessage.addListener(onMessage);
  function onKeydown(event) {
    if (event.key === "Escape" && enabled) { enabled = false; apply(); }
  }
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("turbo:load", schedule);
  document.addEventListener("pjax:end", schedule);
  window.addEventListener("popstate", schedule);
  navigationTimer = setInterval(() => {
    if (stopped) return;
    if (!hasExtensionContext()) { stop(); return; }
    if (location.href !== previousURL) { previousURL = location.href; apply(); }
  }, 1000);
  observe();
  report();
})();
