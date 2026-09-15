"use strict";

chrome.action.onClicked.addListener(async tab => {
  const url = tab?.url || "";
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/changes(?:[/?#]|$)/i.test(url)) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggleCodeOnly" });
  } catch (error) {
    console.warn("[PR Code Only] Abra/recarregue a página do PR antes de clicar no ícone.", error);
  }
});
