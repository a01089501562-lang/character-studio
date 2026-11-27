import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";

test("lesson1 stages share drawing, undo and PNG across next/back and reopen", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/config.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return res.end("window.STUDIO_CONFIG = {};");
    }
    const file = path.resolve(root, "." + (url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(root)) return res.writeHead(404).end();
    try {
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml" })[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const snapshot = () => page.locator("#drawingCanvas").evaluate(c => c.toDataURL());
    async function draw() {
      const box = await page.locator("#drawingCanvas").boundingBox();
      await page.mouse.move(box.x + 80, box.y + 60);
      await page.mouse.down();
      await page.mouse.move(box.x + 180, box.y + 110, { steps: 10 });
      await page.mouse.up();
    }
    await page.getByRole("button", { name: "스케치 캔버스 열기", exact: true }).click();
    const blank = await snapshot();
    await draw();
    const sketch = await snapshot();
    assert.notEqual(sketch, blank);
    await page.getByRole("button", { name: "4번에서 이어서 작업" }).click();
    assert.equal(await snapshot(), sketch);
    await page.locator("#drawingColor").fill("#ff0000");
    await draw();
    const colored = await snapshot();
    assert.notEqual(colored, sketch);
    await page.getByRole("button", { name: "5번에서 완성 확인" }).click();
    assert.equal(await snapshot(), colored);
    assert.equal(await page.locator("#drawingNext").isVisible(), false);
    await page.locator("#drawingUndo").click();
    assert.equal(await snapshot(), sketch);
    await page.locator("#drawingPrevious").click();
    assert.equal(await snapshot(), sketch);
    await page.locator("#drawingClose").click();
    await page.getByRole("button", { name: "완성 확인·저장 캔버스 열기" }).click();
    assert.equal(await snapshot(), sketch);
    const download = page.waitForEvent("download");
    await page.locator("#drawingSave").click();
    assert.equal(await (await download).failure(), null);
    const output = await mkdtemp(path.join(os.tmpdir(), "drawing-stages-"));
    await page.screenshot({ path: path.join(output, "desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#drawingPrevious").click();
    assert.equal(await snapshot(), sketch);
    assert.ok(await page.locator('.drawing-dialog[aria-labelledby="drawingTitle"]').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.screenshot({ path: path.join(output, "mobile.png") });
    assert.deepEqual(errors, []);
    console.log("Drawing evidence:", output);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
