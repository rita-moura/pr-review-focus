"use strict";

function isPullRequestDiff(url) {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)(?:[/?#]|$)/i.test(url || "");
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id || !isPullRequestDiff(tab.url)) return;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "toggleCodeOnly" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: result?.enabled ? "ON" : "" });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: result?.enabled ? "#238636" : "#6e7781" });
  } catch (error) {
    // A content script pode ainda não existir em uma aba aberta antes da instalação.
    console.warn("[PR Code Only] Recarregue a aba do PR para ativar a extensão.", error);
  }
});
