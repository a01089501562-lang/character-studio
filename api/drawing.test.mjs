import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";

test("lesson1 and lesson4 keep independent drawings through stages and PNG export", async () => {
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
    const output = await mkdtemp(path.join(os.tmpdir(), "drawing-stages-"));
    const studios = [
      { prefix: 'drawing', first: '스케치 캔버스 열기', final: '완성 확인·저장 캔버스 열기', steps: [3, 4, 5], file: '캐릭터_기본형_5단계.png' },
      { prefix: 'motion', first: '동작 스케치 시트 열기', final: '작품 시트 확인·저장하기', steps: [2, 3, 4, 5], file: '캐릭터_작품시트_5단계.png' },
    ];
    for (const studio of studios) {
      const find = suffix => page.locator('#' + studio.prefix + suffix);
      const snapshot = () => find('Canvas').evaluate(c => c.toDataURL());
      const pictures = [];
      async function draw(index) {
        await find('Color').fill(['#111111', '#ff0000', '#00aa88', '#4400ff', '#ff00ff'][index]);
        await find('Canvas').scrollIntoViewIfNeeded();
        const box = await find('Canvas').boundingBox();
        await page.mouse.move(box.x + box.width * .15, box.y + box.height * (.2 + index * .05));
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * .3, box.y + box.height * (.25 + index * .05), { steps: 6 });
        await page.mouse.up();
      }
      await page.getByRole('button', { name: studio.first, exact: true }).click();
      const blank = await snapshot();
      assert.equal(await find('ImportPrevious').isVisible(), false);
      for (let index = 0; index < studio.steps.length; index++) {
        if (index > 0) await find('Next').click();
        const inherited = await snapshot();
        assert.equal(inherited, index > 0 ? pictures[index - 1] : blank);
        assert.equal(await find('Undo').isDisabled(), true);
        await draw(index);
        assert.notEqual(await snapshot(), inherited);
        await find('Undo').click();
        assert.equal(await snapshot(), inherited);
        await draw(index);
        pictures.push(await snapshot());
      }
      assert.equal(await find('Next').isVisible(), false);
      // Every previous stage must restore its own drawing, without later additions.
      for (let index = studio.steps.length - 2; index >= 0; index--) {
        await find('Previous').click();
        assert.equal(await snapshot(), pictures[index]);
      }
      await draw(4);
      const revised = await snapshot();
      assert.notEqual(revised, pictures[0]);
      await find('Next').click();
      assert.equal(await snapshot(), pictures[1]);
      page.once('dialog', dialog => dialog.dismiss());
      await find('ImportPrevious').click();
      assert.equal(await snapshot(), pictures[1]);
      page.once('dialog', dialog => dialog.accept());
      await find('ImportPrevious').click();
      assert.equal(await snapshot(), revised);
      await find('Undo').click();
      assert.equal(await snapshot(), pictures[1]);
      page.once('dialog', dialog => dialog.accept());
      await find('ImportPrevious').click();
      for (let index = 2; index < studio.steps.length; index++) {
        await find('Next').click();
        assert.equal(await snapshot(), pictures[index]);
      }
      page.once('dialog', dialog => dialog.accept());
      await find('Clear').click();
      assert.equal(await snapshot(), blank);
      await find('Undo').click();
      assert.equal(await snapshot(), pictures.at(-1));
      await find('Close').click();
      await page.getByRole('button', { name: studio.final, exact: true }).click();
      assert.equal(await snapshot(), pictures.at(-1));
      const downloadPromise = page.waitForEvent('download');
      await find('Save').click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), studio.file);
      assert.equal(await download.failure(), null);
      await download.saveAs(path.join(output, studio.file));
      const png = await readFile(await download.path());
      const border = await page.evaluate(async data => {
        const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
        const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
        const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
        return [...ctx.getImageData(40, 200, 1, 1).data];
      }, png.toString('base64'));
      assert.equal(border[3], 255);
      if (studio.prefix === 'motion') assert.ok(border[0] < 250);
      // Saving only the final stage must not dismiss the unsaved earlier-stage warning.
      assert.equal(await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event); return event.defaultPrevented;
      }), true);
      await page.screenshot({ path: path.join(output, studio.prefix + '-desktop.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await find('Previous').click();
      assert.equal(await snapshot(), studio.steps.length === 3 ? revised : pictures.at(-2));
      assert.ok(await page.locator(`[aria-labelledby="${studio.prefix}Title"]`).evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.screenshot({ path: path.join(output, studio.prefix + '-mobile.png') });
      await find('Close').click();
      await page.setViewportSize({ width: 1365, height: 1000 });
    }
    // Signing out clears all cached stages and undo histories, not just the visible canvas.
    await page.evaluate(() => window.dispatchEvent(new Event('studio-drawings-clear')));
    for (const studio of studios) {
      await page.getByRole('button', { name: studio.final, exact: true }).click();
      const empty = await page.locator('#' + studio.prefix + 'Canvas').evaluate(c =>
        !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(Boolean));
      assert.equal(empty, true);
      assert.equal(await page.locator('#' + studio.prefix + 'Undo').isDisabled(), true);
      await page.locator('#' + studio.prefix + 'Close').click();
    }
    assert.equal(await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
    }), false);
    // Opening the final step first must not initialize all earlier steps with blank copies.
    const direct = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
    await direct.goto(`http://127.0.0.1:${server.address().port}`);
    await direct.getByRole('button', { name: '완성 확인·저장 캔버스 열기', exact: true }).click();
    await direct.locator('#drawingClose').click();
    await direct.getByRole('button', { name: '스케치 캔버스 열기', exact: true }).click();
    await direct.locator('#drawingCanvas').scrollIntoViewIfNeeded();
    const bounds = await direct.locator('#drawingCanvas').boundingBox();
    await direct.mouse.click(bounds.x + 90, bounds.y + 90);
    const first = await direct.locator('#drawingCanvas').evaluate(c => c.toDataURL());
    await direct.locator('#drawingNext').click();
    assert.equal(await direct.locator('#drawingCanvas').evaluate(c => c.toDataURL()), first);
    await direct.close();
    assert.deepEqual(errors, []);
    console.log('Drawing evidence:', output);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
