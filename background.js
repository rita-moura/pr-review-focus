"use strict";

function isPullRequestDiff(url) {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)(?:[/?#]|$)/i.test(url || "");
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id || !isPullRequestDiff(tab.url)) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggleCodeOnly" });
  } catch (error) {
    // A content script pode ainda não existir em uma aba aberta antes da instalação.
    console.warn("[PR Code Only] Recarregue a aba do PR para ativar a extensão.", error);
  }
});
