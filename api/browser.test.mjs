import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";
import worker from "./worker.js";
import { database } from "./test-support/sqlite.js";

test(
  "real browser: email login, teacher approval, save, conflict, isolation and mobile layout",
  { timeout: 120000 },
  async () => {
    const executablePath =
      process.env.CHROME_PATH ||
      [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
      ].find(existsSync);
    assert.ok(
      executablePath,
      "Set CHROME_PATH to an installed Chromium browser.",
    );
    const root = fileURLToPath(new URL("../", import.meta.url));
    const DB = database(),
      mail = new Map(),
      originalFetch = globalThis.fetch;
    const env = {
      DB,
      MAIL_URL: "https://test-mail.invalid",
      MAIL_SECRET: "test-only",
      OTP_SECRET: "test-only",
      TEACHER_EMAILS: "teacher@example.com",
    };
    globalThis.fetch = async (url, opts) => {
      if (url !== env.MAIL_URL) return originalFetch(url, opts);
      const sent = JSON.parse(JSON.parse(opts.body).payload);
      mail.set(sent.email, sent.code);
      return Response.json({ ok: true });
    };
    let failLoad = false,
      apiEnabled = true;
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://127.0.0.1");
        if (url.pathname.startsWith("/api/v1/")) {
          if (
            failLoad &&
            req.method === "GET" &&
            url.pathname.endsWith("/me/progress")
          ) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: { message: "테스트: 불러오기 실패" } }),
            );
            return;
          }
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const response = await worker.fetch(
            new Request(origin + req.url, {
              method: req.method,
              headers: req.headers,
              ...(["GET", "HEAD"].includes(req.method)
                ? {}
                : { body: Buffer.concat(chunks) }),
            }),
            env,
          );
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
        const filename = path.resolve(
          root,
          "." + (url.pathname === "/" ? "/index.html" : url.pathname),
        );
        if (!filename.startsWith(root) || url.pathname.startsWith("/api/")) {
          res.writeHead(404).end();
          return;
        }
        let content = await readFile(filename);
        if (url.pathname === "/config.js")
          content = Buffer.from(
            content.toString() +
              `\nwindow.STUDIO_CONFIG.apiUrl=${JSON.stringify(apiEnabled ? origin + "/api/v1" : "")};`,
          );
        res.writeHead(200, {
          "Content-Type":
            {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".svg": "image/svg+xml",
            }[path.extname(filename)] || "application/octet-stream",
        });
        res.end(content);
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    env.ALLOWED_ORIGIN = origin;
    const browser = await chromium.launch({ headless: true, executablePath });
    const output = await mkdtemp(
      path.join(os.tmpdir(), "character-studio-browser-"),
    );
    const errors = [];
    async function page(context) {
      const p = await context.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(origin);
      await p.locator('#account-body input[name="email"]').waitFor();
      return p;
    }
    async function login(p, email) {
      await p.locator('#account-body input[name="email"]').fill(email);
      await p
        .getByRole("button", { name: "인증번호 받기", exact: true })
        .click();
      await p.locator('#account-body input[name="code"]').waitFor();
      assert.ok(mail.has(email));
      await p.locator('#account-body input[name="code"]').fill(mail.get(email));
      await p.getByRole("button", { name: "로그인", exact: true }).click();
      await p.getByRole("button", { name: "로그아웃", exact: true }).waitFor();
    }
    async function saved(p) {
      await p.waitForFunction(
        () =>
          document.querySelector("#account-status")?.textContent ===
          "서버에 저장했습니다.",
      );
    }
    try {
      const teacher = await page(
        await browser.newContext({ viewport: { width: 1365, height: 900 } }),
      );
      await login(teacher, "teacher@example.com");
      await teacher
        .locator('#account-body input[name="name"]')
        .fill("2학년 캐릭터 수업");
      await teacher
        .getByRole("button", { name: "학급 만들기", exact: true })
        .click();
      await teacher.locator(".account-class").waitFor();
      const cls = DB.db.prepare("SELECT * FROM classes").get();
      assert.ok(cls);
      const studentContext = await browser.newContext({
        viewport: { width: 1365, height: 900 },
      });
      const student = await page(studentContext);
      await login(student, "student@example.com");
      await student
        .locator('#account-body input[name="name"]')
        .fill("테스트 학생");
      await student
        .locator('#account-body input[name="studentNumber"]')
        .fill("20101");
      await student.locator('#account-body input[name="code"]').fill(cls.code);
      await student
        .getByRole("button", { name: "학급 참여 신청", exact: true })
        .click();
      await student
        .getByText("2학년 캐릭터 수업 · 승인 대기", { exact: true })
        .waitFor();
      assert.equal(await student.locator("#characterName").isDisabled(), true);
      await teacher.reload();
      await teacher.getByRole("button", { name: "승인", exact: true }).click();
      await teacher.getByText(/20101 테스트 학생 · 승인됨/).waitFor();
      await student
        .getByRole("button", { name: "승인 상태 새로고침", exact: true })
        .click();
      await student.waitForFunction(
        () => !document.querySelector("#characterName").disabled,
      );
      await student.locator("#characterName").fill("브라우저 테스트 루미");
      await student.locator('[data-check="turn-0"]').check();
      await saved(student);
      assert.equal(
        JSON.parse(DB.db.prepare("SELECT notes FROM progress").get().notes)
          .characterName,
        "브라우저 테스트 루미",
      );
      await student.reload();
      await student.waitForFunction(
        () =>
          document.querySelector("#characterName")?.value ===
          "브라우저 테스트 루미",
      );
      await teacher
        .getByRole("button", { name: "학습 기록 조회", exact: true })
        .click();
      await teacher
        .getByText("캐릭터: 브라우저 테스트 루미", { exact: true })
        .waitFor();
      await teacher.screenshot({
        path: path.join(output, "teacher-desktop.png"),
        fullPage: false,
      });
      await student.evaluate(() => window.scrollTo(0, 0));
      await student.screenshot({
        path: path.join(output, "student-desktop.png"),
        fullPage: false,
      });
      await student.setViewportSize({ width: 390, height: 844 });
      await student.evaluate(() => window.scrollTo(0, 0));
      assert.equal(
        await student.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await student.screenshot({
        path: path.join(output, "student-mobile.png"),
        fullPage: false,
      });
      DB.db.prepare("UPDATE progress SET version=version+1").run();
      await student.locator("#characterName").fill("충돌 변경");
      await student.waitForFunction(() =>
        document
          .querySelector("#account-status")
          .textContent.includes("다른 기기"),
      );
      student.once("dialog", (dialog) => dialog.accept());
      await student
        .getByRole("button", { name: "최신 기록 불러오기", exact: true })
        .click();
      await student.waitForFunction(
        () =>
          document.querySelector("#characterName").value ===
          "브라우저 테스트 루미",
      );
      failLoad = true;
      await student
        .getByRole("button", { name: "최신 기록 불러오기", exact: true })
        .click();
      await student
        .getByText("테스트: 불러오기 실패", { exact: true })
        .first()
        .waitFor();
      assert.equal(await student.locator("#characterName").isDisabled(), true);
      failLoad = false;
      await student
        .getByRole("button", { name: "최신 기록 불러오기", exact: true })
        .click();
      await student.waitForFunction(
        () => !document.querySelector("#characterName").disabled,
      );
      await student
        .getByRole("button", { name: "로그아웃", exact: true })
        .click();
      await student.locator('#account-body input[name="email"]').waitFor();
      assert.equal(
        await student.evaluate(() => sessionStorage.getItem("studio-session")),
        null,
      );
      assert.equal(await student.locator("#characterName").inputValue(), "");
      await login(student, "second@example.com");
      assert.equal(await student.locator("#characterName").inputValue(), "");
      apiEnabled = false;
      const guest = await browser.newPage();
      guest.on("pageerror", (e) => errors.push(e.message));
      await guest.goto(origin);
      assert.equal(await guest.locator("[data-check]").count(), 18);
      assert.equal(await guest.locator(".account-panel").count(), 0);
      await guest.locator("#characterName").fill("로컬 기록");
      await guest.reload();
      assert.equal(
        await guest.locator("#characterName").inputValue(),
        "로컬 기록",
      );
      assert.deepEqual(errors, []);
      await writeFile(
        path.join(output, "result.json"),
        JSON.stringify({ passed: true, errors }, null, 2),
      );
      console.log("Browser evidence:", output);
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
      globalThis.fetch = originalFetch;
      DB.db.close();
    }
  },
);
