"use strict";

async function showState(tabId, enabled, warning = false) {
  await chrome.action.setBadgeText({ tabId, text: warning ? "!" : enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: warning ? "#9a6700" : "#238636" });
  await chrome.action.setTitle({ tabId, title: warning
    ? "Diff não reconhecido. Abra Changes/Files changed ou recarregue a página."
    : enabled ? "Somente código ativo — clique para desligar (ou Esc)" : "Clique para ativar somente código" });
}

chrome.action.onClicked.addListener(async tab => {
  if (tab?.id == null) return;
  try {
    // The content script validates the route; tab.url may be absent without tabs permission.
    await chrome.tabs.sendMessage(tab.id, { type: "toggleCodeOnly" });
  } catch {
    await showState(tab.id, false, true);
  }
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "codeOnlyState" && sender.tab?.id != null) {
    showState(sender.tab.id, message.enabled === true, message.warning === true).catch(() => {});
  }
});
