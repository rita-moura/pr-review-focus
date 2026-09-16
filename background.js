"use strict";

const updates = new Map();
const recoveringTabs = new Set();
const PR_FILES = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)\/?$/;
function isPullRequestFilesURL(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://github.com" && PR_FILES.test(url.pathname);
  } catch { return false; }
}
async function isEligibleTab(tab) {
  if (isPullRequestFilesURL(tab.url)) return true;
  const current = await chrome.tabs.get(tab.id);
  return isPullRequestFilesURL(current.url);
}
function waitForReload(tabId) {
  let finish;
  const done = new Promise(resolve => {
    let started = false;
    let settled = false;
    const listener = (updatedId, change) => {
      if (updatedId !== tabId) return;
      if (change.status === "loading") started = true;
      if (started && change.status === "complete") finish(true);
    };
    const timeout = setTimeout(() => finish(false), 20000);
    finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(result);
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  return { done, cancel: () => finish(false) };
}
async function activateAfterReload(tabId) {
  const reload = waitForReload(tabId);
  try {
    await chrome.tabs.reload(tabId);
    if (!await reload.done) return false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (!await isEligibleTab({ id: tabId })) return false;
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: "activateCodeOnly" });
        if (response?.ready === true && response.enabled === true) return true;
        if (response?.ready === true && response.enabled === false) return false;
      } catch { /* Content script may not be ready immediately after load. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
  } finally { reload.cancel(); }
}
async function showState(tabId, enabled, warning = false, mode = "code") {
  const previous = updates.get(tabId) || Promise.resolve();
  const update = previous.catch(() => {}).then(async () => {
    await chrome.action.setBadgeText({ tabId, text: warning ? "!" : enabled ? "ON" : "" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: warning ? "#9a6700" : "#238636" });
    await chrome.action.setTitle({ tabId, title: warning
      ? "Diff não reconhecido. Abra Changes/Files changed ou recarregue a página."
      : enabled ? (mode === "files" ? "Arquivos de código ativos" : "Código sem comentários ativo") +
        " — clique para desligar (ou Esc)" : "Clique para ativar o filtro" });
  });
  updates.set(tabId, update);
  try { await update; }
  finally { if (updates.get(tabId) === update) updates.delete(tabId); }
}

chrome.action.onClicked.addListener(async tab => {
  if (tab?.id == null || recoveringTabs.has(tab.id)) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "toggleCodeOnly" });
    if (response?.ready === true && typeof response.enabled === "boolean") return;
  } catch { /* An outdated or absent content script requires a page reload. */ }
  recoveringTabs.add(tab.id);
  try {
    if (!await isEligibleTab(tab) || !await activateAfterReload(tab.id))
      await showState(tab.id, false, true);
  } catch {
    await showState(tab.id, false, true);
  } finally {
    recoveringTabs.delete(tab.id);
  }
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "codeOnlyState" && sender.tab?.id != null) {
    showState(sender.tab.id, message.enabled === true, message.warning === true, message.mode).catch(() => {});
  }
});
