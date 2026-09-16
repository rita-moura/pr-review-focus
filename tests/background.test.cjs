const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function setup(fail = false) {
  let click, message;
  const sent = [], badges = [], titles = [];
  vm.runInNewContext(fs.readFileSync(require.resolve("../background.js"), "utf8"), { chrome: {
    action: { onClicked: {addListener(fn) {click = fn;}}, async setBadgeText(value) {badges.push(value);}, async setBadgeBackgroundColor() {}, async setTitle(value) {titles.push(value);} },
    tabs: {async sendMessage(id, value) {if (fail) throw Error("No receiver"); sent.push({id, type:value.type});}},
    runtime: {onMessage: {addListener(fn) {message = fn;}}}
  }});
  return {sent, badges, titles, click: (...args) => click(...args), message: (...args) => message(...args)};
}
test("click works without access to tab.url", async () => {
  const app = setup(); await app.click({id:1});
  assert.deepEqual(app.sent, [{id:1, type:"toggleCodeOnly"}]);
});
test("missing content script gives a visible warning", async () => {
  const app = setup(true); await app.click({id:1});
  assert.equal(app.badges.at(-1).text, "!");
});
test("content state updates badges independently for each tab", () => {
  const app = setup();
  app.message({type:"codeOnlyState", enabled:true}, {tab:{id:1}});
  app.message({type:"codeOnlyState", enabled:false}, {tab:{id:2}});
  assert.equal(app.badges[0].tabId, 1); assert.equal(app.badges[0].text, "ON");
  assert.equal(app.badges[1].tabId, 2); assert.equal(app.badges[1].text, "");
});

test("badge tooltip names the selected mode", async () => {
  const app = setup();
  app.message({type:"codeOnlyState", enabled:true, mode:"files"}, {tab:{id:1}});
  await new Promise(resolve => setImmediate(resolve));
  assert.match(app.titles.at(-1).title, /Arquivos de código ativos/);
});
