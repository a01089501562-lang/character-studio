import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { hash } from "./worker.js";
import { database } from "./test-support/sqlite.js";

test("submission receipts require membership and upstream success, remain class-scoped, and clear with records", async () => {
  const DB = database(), original = globalThis.fetch;
  const student = "a".repeat(64), teacher = "b".repeat(64), other = "c".repeat(64), key = "d".repeat(64);
  const env = { DB, TEACHER_EMAILS: "teacher@example.com", SUBMISSION_URL: "https://script.google.com/macros/s/test/exec" };
  let success = false, sent = 0;
  globalThis.fetch = async () => { sent++; return Response.json({ ok: success, files: [{}, {}] }); };
  async function call(path, method, body, token = student) {
    const response = await worker.fetch(new Request("https://test/api/v1/classes/one" + path, {
      method, headers: { Authorization: "Bearer " + token }, ...(body ? { body: JSON.stringify(body) } : {}),
    }), env);
    return { status: response.status, data: await response.json() };
  }
  try {
    for (const [id, email, token] of [["s", "s@example.com", student], ["t", "teacher@example.com", teacher], ["o", "o@example.com", other]]) {
      DB.db.prepare("INSERT INTO users(id,email,name,student_number) VALUES(?,?,?,?)").run(id, email, "학생", "001");
      DB.db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(await hash(token), id, 9999999999);
    }
    DB.db.exec("INSERT INTO classes VALUES('one','t','학급','code'); INSERT INTO classes VALUES('two','t','다른 학급','code2'); INSERT INTO members VALUES('one','s','pending'); INSERT INTO members VALUES('two','s','approved');");
    DB.db.prepare("INSERT INTO keys VALUES('key',?,'one','조회',9999999999,0)").run(await hash(key));
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=";
    const payload = { name: "학생", studentId: "001", character: "루미", message: "", files: [{ label: "동작시트", data: png }, { label: "3면도", data: png }] };
    assert.equal((await call("/me/submission", "POST", payload)).status, 403);
    DB.db.exec("UPDATE members SET status='approved' WHERE class_id='one'");
    for (const token of [other, teacher, key]) assert.equal((await call("/me/submission", "POST", payload, token)).status, 403);
    assert.equal((await call("/me/submission", "POST", { ...payload, studentId: "다른학생" })).status, 400);
    assert.equal((await call("/me/submission", "POST", { ...payload, files: [{ label: "동작시트", data: "not-png" }] })).status, 400);
    assert.equal(sent, 0);
    assert.equal((await call("/me/submission", "POST", payload)).status, 502);
    assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM submissions").get().n, 0);
    success = true;
    assert.equal((await call("/me/submission", "POST", payload)).data.recorded, true);
    const first = (await call("/progress", "GET", null, teacher)).data.students[0].submission;
    assert.ok(first.actionAt && first.turnaroundAt);
    globalThis.fetch = async () => Response.json({ ok: true, files: [{}] });
    assert.equal((await call("/me/submission", "POST", { ...payload, files: payload.files.slice(0, 1) })).data.recorded, true);
    assert.equal((await call("/progress", "GET", null, key)).data.students[0].submission.turnaroundAt, first.turnaroundAt);
    assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE class_id='two'").get().n, 0);
    // A storage failure after successful delivery must not encourage duplicate uploads.
    DB.db.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON submissions BEGIN SELECT RAISE(FAIL, 'test'); END;");
    const partial = await call("/me/submission", "POST", { ...payload, files: payload.files.slice(0, 1) });
    assert.equal(partial.data.ok, true);
    assert.equal(partial.data.recorded, false);
    DB.db.exec("DROP TRIGGER fail_receipt");
    assert.equal((await call("/records", "DELETE", null, other)).status, 403);
    assert.equal((await call("/records", "DELETE", null, teacher)).status, 200);
    assert.equal((await call("/progress", "GET", null, teacher)).data.students[0].submission, null);
  } finally { globalThis.fetch = original; DB.db.close(); }
});
