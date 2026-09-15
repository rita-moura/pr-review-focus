"use strict";
const PATCH_HOSTS = new Set(["github.com", "patch-diff.githubusercontent.com"]);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "getPatch" || typeof message.url !== "string") return false;
  let target;
  try {
    target = new URL(message.url);
    if (target.protocol !== "https:" || !PATCH_HOSTS.has(target.hostname) ||
        !/^\/[^/]+\/[^/]+\/pull\/\d+\.patch$/.test(target.pathname)) {
      throw new Error("URL de patch inválida");
    }
  } catch (error) {
    sendResponse({ok:false,error:error.message});
    return false;
  }
  fetch(target.href, {credentials:"include", redirect:"follow", headers:{accept:"text/plain"}})
    .then(async response => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return {ok:true,text:await response.text()};
    })
    .catch(error => ({ok:false,error:error.message}))
    .then(sendResponse);
  return true;
});
