const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function setup({ missingScript = false, url = "https://github.com/owner/repo/pull/1/changes", emptyResponse = false, oldResponse = false } = {}) {
  let click, message;
  const sent = [], badges = [], titles = [], reloads = [], updated = new Set();
  let reloaded = false;
  vm.runInNewContext(fs.readFileSync(require.resolve("../background.js"), "utf8"), { URL, setTimeout, clearTimeout, chrome: {
    action: { onClicked: {addListener(fn) {click = fn;}}, async setBadgeText(value) {badges.push(value);}, async setBadgeBackgroundColor() {}, async setTitle(value) {titles.push(value);} },
    tabs: {
      onUpdated: {addListener(fn) {updated.add(fn);}, removeListener(fn) {updated.delete(fn);}},
      async get(id) {return {id, url};},
      async reload(id) {
        reloads.push(id); reloaded = true;
        for (const listener of updated) listener(id, {status:"loading"});
        for (const listener of updated) listener(id, {status:"complete"});
      },
      async sendMessage(id, value) {
        sent.push({id, type:value.type});
        if (missingScript && !reloaded) throw Error("No receiver");
        if (emptyResponse && !reloaded) return undefined;
        if (oldResponse && !reloaded) return {enabled:false};
        return {enabled:true, ready:true};
      }
    },
    runtime: {onMessage: {addListener(fn) {message = fn;}}}
  }});
  return {sent, badges, titles, reloads, click: (...args) => click(...args), message: (...args) => message(...args)};
}
test("click works without access to tab.url", async () => {
  const app = setup(); await app.click({id:1});
  assert.deepEqual(app.sent, [{id:1, type:"toggleCodeOnly"}]);
  assert.deepEqual(app.reloads, []);
});
test("missing content script reloads the PR and activates the new script", async () => {
  const app = setup({missingScript:true}); await app.click({id:1});
  assert.deepEqual(app.reloads, [1]);
  assert.deepEqual(app.sent, [{id:1,type:"toggleCodeOnly"}, {id:1,type:"activateCodeOnly"}]);
  assert.notEqual(app.badges.at(-1)?.text, "!");
});
test("a stale script with no response also reloads the PR", async () => {
  const app = setup({emptyResponse:true}); await app.click({id:1});
  assert.deepEqual(app.reloads, [1]);
  assert.equal(app.sent.at(-1).type, "activateCodeOnly");
});
test("a response from the previous version also reloads the PR", async () => {
  const app = setup({oldResponse:true}); await app.click({id:1});
  assert.deepEqual(app.reloads, [1]);
  assert.equal(app.sent.at(-1).type, "activateCodeOnly");
});
test("missing script outside a PR does not reload the tab", async () => {
  const app = setup({missingScript:true, url:"https://github.com/owner/repo/issues/1"});
  await app.click({id:1});
  assert.deepEqual(app.reloads, []);
  assert.equal(app.badges.at(-1).text, "!");
});
test("content state updates badges independently for each tab", async () => {
  const app = setup();
  app.message({type:"codeOnlyState", enabled:true}, {tab:{id:1}});
  app.message({type:"codeOnlyState", enabled:false}, {tab:{id:2}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.badges[0].tabId, 1); assert.equal(app.badges[0].text, "ON");
  assert.equal(app.badges[1].tabId, 2); assert.equal(app.badges[1].text, "");
});

test("rapid state updates finish with the latest badge state", async () => {
  const app = setup();
  app.message({type:"codeOnlyState", enabled:true}, {tab:{id:1}});
  app.message({type:"codeOnlyState", enabled:false}, {tab:{id:1}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.badges.at(-1).text, "");
  assert.match(app.titles.at(-1).title, /Clique para ativar/);
});

test("badge tooltip names the selected mode", async () => {
  const app = setup();
  app.message({type:"codeOnlyState", enabled:true, mode:"files"}, {tab:{id:1}});
  await new Promise(resolve => setImmediate(resolve));
  assert.match(app.titles.at(-1).title, /Arquivos de código ativos/);
});
