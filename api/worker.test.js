import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { hash, validateProgress } from "./worker.js";
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(new URL("./migrations/0001.sql", import.meta.url), "utf8"),
  );
  return {
    db,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return db.prepare(sql).get(...args) || null;
            },
            async run() {
              return db.prepare(sql).run(...args);
            },
            async all() {
              return { results: db.prepare(sql).all(...args) };
            },
          };
        },
      };
    },
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const result = await Promise.all(stmts.map((s) => s.run()));
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
test("authentication, authorization, persistence, conflicts and revocation", async () => {
  const DB = database(),
    e = {
      DB,
      TEACHER_EMAILS: "teacher@example.com",
      OTP_SECRET: "otp-test-only",
      MAIL_SECRET: "mail-test-only",
      MAIL_URL: "https://mail.invalid",
      ALLOWED_ORIGIN: "https://example.com",
    };
  const original = globalThis.fetch;
  let mail;
  globalThis.fetch = async (url, opts) => {
    mail = JSON.parse(JSON.parse(opts.body).payload);
    return Response.json({ ok: true });
  };
  async function call(path, method = "GET", data, token) {
    const r = await worker.fetch(
      new Request("https://api.test/api/v1" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      e,
    );
    return { status: r.status, data: await r.json() };
  }
  async function login(email) {
    const request = await call("/auth/request-code", "POST", { email });
    assert.equal(request.status, 200);
    const code = mail.code;
    const result = await call("/auth/verify-code", "POST", {
      challengeId: request.data.challengeId,
      code,
    });
    assert.equal(result.status, 200);
    assert.equal(
      (
        await call("/auth/verify-code", "POST", {
          challengeId: request.data.challengeId,
          code,
        })
      ).status,
      401,
    );
    return result.data.token;
  }
  try {
    assert.equal((await call("/me")).status, 401);
    const teacher = await login("teacher@example.com"),
      student = await login("student@example.com"),
      other = await login("other@example.com");
    assert.equal(
      (await call("/classes", "POST", { name: "침입" }, student)).status,
      403,
    );
    const cls = (await call("/classes", "POST", { name: "2학년" }, teacher))
        .data,
      base = "/classes/" + cls.id;
    await call(
      "/classes/join",
      "POST",
      { name: "학생", studentNumber: "20101", code: cls.code },
      student,
    );
    assert.equal(
      (await call(base + "/me/progress", "GET", null, student)).status,
      403,
    );
    const id = (await call("/me", "GET", null, student)).data.id;
    assert.equal(
      (
        await call(
          base + "/members/" + id,
          "PUT",
          { status: "approved" },
          teacher,
        )
      ).status,
      200,
    );
    const value = {
      notes: { characterName: "루미" },
      checks: { "turn-0": true },
      version: 0,
    };
    const saved = await call(base + "/me/progress", "PUT", value, student);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.version, 1);
    assert.equal(
      (await call(base + "/me/progress", "PUT", value, student)).status,
      409,
    );
    assert.equal(
      (
        await call(
          base + "/me/progress",
          "PUT",
          { ...value, version: 1 },
          student,
        )
      ).data.version,
      2,
    );
    assert.equal(
      (await call(base + "/me/progress", "GET", null, other)).status,
      403,
    );
    const key = (await call(base + "/keys", "POST", { label: "test" }, teacher))
      .data;
    const records = await call(base + "/progress", "GET", null, key.key);
    assert.equal(records.status, 200);
    assert.equal(records.data.students.length, 1);
    assert.equal(records.data.students[0].email, undefined);
    assert.equal(
      (await call(base + "/me/progress", "PUT", value, key.key)).status,
      403,
    );
    const cls2 = (
      await call("/classes", "POST", { name: "다른 학급" }, teacher)
    ).data;
    assert.equal(
      (await call("/classes/" + cls2.id + "/progress", "GET", null, key.key))
        .status,
      403,
    );
    await call(base + "/keys/" + key.id, "DELETE", null, teacher);
    assert.equal(
      (await call(base + "/progress", "GET", null, key.key)).status,
      401,
    );
    DB.db
      .prepare("UPDATE sessions SET expires=0 WHERE digest=?")
      .run(await hash(student));
    assert.equal((await call("/me", "GET", null, student)).status, 401);
    assert.equal((await call("/auth/logout", "POST", {}, teacher)).status, 200);
    assert.equal((await call("/me", "GET", null, teacher)).status, 401);
  } finally {
    globalThis.fetch = original;
    DB.db.close();
  }
});
test("invalid records are rejected", () => {
  assert.throws(() =>
    validateProgress({ version: 0, notes: {}, checks: { admin: true } }),
  );
  assert.throws(() => validateProgress({ version: -1, notes: {}, checks: {} }));
  assert.throws(() =>
    validateProgress({
      version: 0,
      notes: { features: "x".repeat(2001) },
      checks: {},
    }),
  );
});
test("mail failure never reports successful delivery", async () => {
  const DB = database();
  const old = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: false });
  try {
    const response = await worker.fetch(
      new Request("https://x/api/v1/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      }),
      { DB, MAIL_URL: "https://x", MAIL_SECRET: "x", OTP_SECRET: "x" },
    );
    assert.equal(response.status, 503);
    assert.equal(DB.db.prepare("SELECT used FROM challenges").get().used, 1);
  } finally {
    globalThis.fetch = old;
    DB.db.close();
  }
});
test("30 students on one IP, resend cooldown, expiry and guess limits", async () => {
  const DB = database(),
    e = { DB, MAIL_URL: "https://x", MAIL_SECRET: "x", OTP_SECRET: "x" };
  const old = globalThis.fetch;
  const codes = new Map();
  globalThis.fetch = async (url, opts) => {
    const m = JSON.parse(JSON.parse(opts.body).payload);
    codes.set(m.id, m.code);
    return Response.json({ ok: true });
  };
  async function post(path, b) {
    const r = await worker.fetch(
      new Request("https://x/api/v1" + path, {
        method: "POST",
        headers: { "CF-Connecting-IP": "192.0.2.1" },
        body: JSON.stringify(b),
      }),
      e,
    );
    return { status: r.status, data: await r.json() };
  }
  try {
    const requests = [];
    for (let i = 0; i < 30; i++)
      requests.push(
        post("/auth/request-code", { email: `student${i}@example.com` }),
      );
    const results = await Promise.all(requests);
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(
      (await post("/auth/request-code", { email: "student0@example.com" }))
        .status,
      429,
    );
    const id = results[0].data.challengeId;
    DB.db.prepare("UPDATE challenges SET expires=0 WHERE id=?").run(id);
    assert.equal(
      (
        await post("/auth/verify-code", {
          challengeId: id,
          code: codes.get(id),
        })
      ).status,
      401,
    );
    const id2 = results[1].data.challengeId;
    const wrong = codes.get(id2) === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await post("/auth/verify-code", { challengeId: id2, code: wrong }))
          .status,
        401,
      );
    assert.equal(
      (
        await post("/auth/verify-code", {
          challengeId: id2,
          code: codes.get(id2),
        })
      ).status,
      401,
    );
  } finally {
    globalThis.fetch = old;
    DB.db.close();
  }
});
