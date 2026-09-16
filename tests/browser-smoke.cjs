const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");

const html = `<!doctype html><html><head><style>
  nav { display: flex; gap: 12px; align-items: center; }
  .summary { display: flex; gap: 8px; margin-left: auto; }
</style></head><body>
  <nav><a href="/owner/repo/pull/1/changes">Files changed</a>
    <div class="summary"><span id="added">+3</span><span id="deleted">-1</span></div></nav>
  <ul><li id="docs-tree" role="treeitem" data-path="docs/README.md"><a href="#diff-a1b2c3d4">README.md</a></li>
    <li role="treeitem" data-path="app.rb"><a href="#diff-b2c3d4e5">app.rb</a></li></ul>
  <main id="files">
    <div id="diff-a1b2c3d4" class="file js-file" data-path="docs/README.md">
      <div class="file-header">docs/README.md +1</div><table><tr><td class="blob-code blob-code-addition">documentation</td></tr></table></div>
    <div id="diff-b2c3d4e5" class="file js-file" data-path="app.rb">
      <div class="file-header">app.rb +2 -1</div>
      <table><tr><td class="blob-code blob-code-addition">run()</td></tr>
        <tr id="comment"><td class="blob-code blob-code-addition"><span class="pl-c"># explanation</span></td></tr>
        <tr><td class="blob-code blob-code-deletion">old()</td></tr></table></div>
  </main>
</body></html>`;

async function main() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/owner/repo/pull/1/changes`);
    await page.evaluate(() => {
      window.chrome = { runtime: { id: "browser-smoke", onMessage: {
        addListener(listener) { window.toggleFilter = () => listener({ type: "toggleCodeOnly" }, {}, () => {}); },
        removeListener() {}
      }, sendMessage() { return Promise.resolve(); } } };
    });
    await page.addStyleTag({ path: path.resolve(__dirname, "../styles.css") });
    for (const script of ["rules.js", "dom.js", "diff.js", "content.js"]) {
      await page.addScriptTag({ path: path.resolve(__dirname, "..", script) });
    }
    await page.evaluate(() => window.toggleFilter());
    assert.equal(await page.locator("#diff-a1b2c3d4").evaluate(node => getComputedStyle(node).display), "none");
    assert.equal(await page.locator("#docs-tree").evaluate(node => getComputedStyle(node).display), "none");
    assert.equal(await page.locator("#comment").evaluate(node => getComputedStyle(node).display), "none");
    assert.equal(await page.locator("#added").textContent(), "+1");
    assert.equal(await page.locator("#deleted").textContent(), "−1");

    await page.locator("#prco-mode-picker button").nth(1).click();
    assert.notEqual(await page.locator("#comment").evaluate(node => getComputedStyle(node).display), "none");
    assert.equal(await page.locator("#added").textContent(), "+2");
    assert.equal(await page.locator("#diff-a1b2c3d4").evaluate(node => getComputedStyle(node).display), "none");

    await page.evaluate(() => window.toggleFilter());
    assert.notEqual(await page.locator("#diff-a1b2c3d4").evaluate(node => getComputedStyle(node).display), "none");
    assert.equal(await page.locator("#added").textContent(), "+3");
    assert.equal(await page.locator("#deleted").textContent(), "-1");
    console.log("Browser smoke: dois modos, arquivos, comentários, contador e restauração OK.");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
