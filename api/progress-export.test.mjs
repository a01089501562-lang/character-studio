import { test } from "node:test";
import assert from "node:assert/strict";
import { createProgressWorkbook } from "../progress-export.js";
import { checklist } from "../lesson-data.js";
import { chromium } from "playwright-core";

test("Excel export preserves text, checks, dates and empty classes in valid XML parts", async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage();
    for (const students of [[], [{ studentNumber: "001", name: "=1+1", notes: {
      characterName: "루미 & <친구>", personality: "첫 줄\n둘째 줄", features: "특징\u0000",
    }, checks: { [checklist[0].id]: true, unknown: true }, updatedAt: 1704067200,
      submission: { actionAt: 1704067200, turnaroundAt: null, characterName: "제출 루미" } }, {
      studentNumber: "002", name: "김학생", notes: {}, checks: {}, updatedAt: null,
    }]]) {
      const blob = createProgressWorkbook(students);
      assert.match(blob.type, /spreadsheetml/);
      const bytes = Buffer.from(await blob.arrayBuffer()), parts = {};
      let offset = 0;
      while (bytes.readUInt32LE(offset) === 0x04034b50) {
        const size = bytes.readUInt32LE(offset + 18), nameSize = bytes.readUInt16LE(offset + 26);
        const start = offset + 30 + nameSize;
        parts[bytes.subarray(offset + 30, start).toString()] = bytes.subarray(start, start + size).toString();
        offset = start + size;
      }
      assert.equal(Object.keys(parts).length, 6);
      assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
      assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
      const result = await page.evaluate((parts) => {
        const parsed = Object.values(parts).map((xml) => new DOMParser().parseFromString(xml, "application/xml"));
        const workbook = new DOMParser().parseFromString(parts["xl/workbook.xml"], "application/xml");
        const sheet = new DOMParser().parseFromString(parts["xl/worksheets/sheet1.xml"], "application/xml");
        return { errors: parsed.some((doc) => doc.querySelector("parsererror")), rows: sheet.querySelectorAll("row").length,
          sheetNames: [...workbook.querySelectorAll("sheet")].map(s => s.getAttribute("name")),
          formulas: sheet.querySelectorAll("f").length,
          lastCells: [...sheet.querySelectorAll("row")].map((row) => row.lastElementChild.textContent),
          cells: Object.fromEntries([...sheet.querySelectorAll("c")].map((cell) => [cell.getAttribute("r"), cell.textContent])) };
      }, parts);
      assert.equal(result.errors, false);
      assert.equal(result.rows, students.length + 1);
      assert.equal(result.formulas, 0);
      assert.deepEqual(result.sheetNames, ["학습기록"]);
      assert.equal(parts["xl/worksheets/sheet2.xml"], undefined);
      assert.equal(result.lastCells[0], "작품 제출 현황");
      if (students.length) {
        assert.equal(result.cells.A2, "001");
        assert.equal(result.cells.B2, "=1+1");
        assert.equal(result.cells.C2, "1");
        assert.equal(result.cells.D2, String(checklist.length));
        assert.equal(Number(result.cells.E2), 1 / checklist.length);
        assert.equal(result.cells.F2, "루미 & <친구>");
        assert.equal(result.cells.G2, "첫 줄\n둘째 줄");
        assert.equal(result.cells.H2, "특징");
        assert.equal(result.cells.I2, "2024-01-01 09:00:00");
        assert.equal(result.cells.J2, "완료");
        assert.equal(result.cells.K2, "미완료");
        assert.equal(result.cells.I3, "기록 없음");
        assert.deepEqual(result.lastCells.slice(1), ["제출 완료", "제출 기록 없음"]);
      }
    }
  } finally { await browser.close(); }
});
