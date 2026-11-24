import { lessons, artworks, selfChecks, checklist } from "../lesson-data.js";
const allowedChecks = new Set(checklist.map(c=>c.id));
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
export async function hash(s) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function sign(secret, s) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(s))),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
class Failure extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const need = (v, status = 400, message = "요청을 확인하세요.") => {
  if (!v) throw new Failure(status, message);
};
const text = (s, max) =>
  typeof s === "string" && s.trim().length > 0 && s.length <= max;
const query = (e, sql, ...args) => e.DB.prepare(sql).bind(...args);
async function limit(e, key, max, seconds) {
  const t = now();
  const bucket = key + ":" + Math.floor(t / seconds);
  const r = await query(
    e,
    "INSERT INTO limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count",
    bucket,
    t + seconds,
  ).first();
  need(r.count <= max, 429, "요청이 많습니다. 잠시 후 다시 시도하세요.");
}
export function validateProgress(b) {
  need(b && Number.isInteger(b.version) && b.version >= 0);
  need(b.notes && typeof b.notes === "object" && !Array.isArray(b.notes));
  need(b.checks && typeof b.checks === "object" && !Array.isArray(b.checks));
  const notes = {};
  for (const key of ["characterName", "personality", "features"]) {
    need(
      typeof (b.notes[key] ?? "") === "string" &&
        (b.notes[key] ?? "").length <= 2000,
    );
    notes[key] = b.notes[key] ?? "";
  }
  const checks = {};
  for (const [key, value] of Object.entries(b.checks)) {
    need(
      allowedChecks.has(key) &&
        typeof value === "boolean",
    );
    checks[key] = value;
  }
  return { notes, checks };
}
export default {
  async fetch(req, e) {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (req.headers.get("Origin") === e.ALLOWED_ORIGIN) {
      headers["Access-Control-Allow-Origin"] = e.ALLOWED_ORIGIN;
      headers.Vary = "Origin";
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
      headers["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, DELETE, OPTIONS";
    }
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    try {
      return new Response(JSON.stringify(await route(req, e)), { headers });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: {
            code: err.status || 500,
            message: err.status
              ? err.message
              : "처리하지 못했습니다. 잠시 후 다시 시도하세요.",
          },
        }),
        { status: err.status || 500, headers },
      );
    }
  },
  async scheduled(event, e) {
    const t = now();
    await e.DB.batch([
      query(e, "DELETE FROM challenges WHERE expires < ?", t - 86400),
      query(e, "DELETE FROM sessions WHERE expires < ?", t),
      query(e, "DELETE FROM limits WHERE expires < ?", t),
      query(e, "DELETE FROM audit WHERE created < ?", t - 30 * 86400),
      query(e, "DELETE FROM progress WHERE updated < ?", t - 365 * 86400),
    ]);
  },
};
async function route(req, e) {
  const url = new URL(req.url),
    p = url.pathname.replace(/^\/api\/v1/, "");
  need(url.pathname.startsWith("/api/v1/"), 404, "경로를 찾을 수 없습니다.");
  const method = req.method,
    t = now();
  let b = {};
  if (["POST", "PUT"].includes(method)) {
    const raw = await req.text();
    need(raw.length <= 20000, 413, "요청이 너무 큽니다.");
    try {
      b = JSON.parse(raw);
      need(b && typeof b === "object" && !Array.isArray(b));
    } catch {
      throw new Failure(400, "JSON 형식을 확인하세요.");
    }
  }
  if (method === "GET" && p === "/health") return { ok: true };
  if (method === "GET" && p === "/lessons") return { lessons, selfChecks, checklist };
  if (method === "GET" && p === "/examples")
    return {
      examples: artworks.map((a) => ({
        ...a,
        imageUrl: `https://a01089501562-lang.github.io/character-studio/assets/${a.id}.svg`,
      })),
    };
  if (method === "POST" && p === "/auth/request-code") {
    need(
      e.MAIL_URL && e.MAIL_SECRET && e.OTP_SECRET,
      503,
      "인증메일 설정이 준비되지 않았습니다.",
    );
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    need(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    await limit(
      e,
      "mail-ip:" + (await hash(req.headers.get("CF-Connecting-IP") || "local")),
      120,
      3600,
    );
    const cooldown = await query(
      e,
      "INSERT INTO limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=1,expires=excluded.expires WHERE limits.expires<=? RETURNING bucket",
      "cooldown:" + (await hash(email)),
      t + 60,
      t,
    ).first();
    need(cooldown, 429, "인증번호 재발송은 60초 후 가능합니다.");
    await limit(e, "mail-hour:" + (await hash(email)), 5, 3600);
    await limit(e, "mail-global", 80, 86400);
    const id = token(),
      code = String(
        crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
      ).padStart(6, "0");
    await e.DB.batch([
      query(e, "UPDATE challenges SET used=1 WHERE email=?", email),
      query(
        e,
        "INSERT INTO challenges(id,email,digest,expires) VALUES(?,?,?,?)",
        id,
        email,
        await sign(e.OTP_SECRET, id + ":" + code),
        t + 300,
      ),
    ]);
    const payload = JSON.stringify({ id, email, code, timestamp: t });
    let result;
    try {
      const response = await fetch(e.MAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          payload,
          signature: await sign(e.MAIL_SECRET, payload),
        }),
        signal: AbortSignal.timeout(20000),
      });
      result = await response.json();
    } catch {}
    if (!result?.ok) {
      await query(e, "UPDATE challenges SET used=1 WHERE id=?", id).run();
      throw new Failure(
        503,
        "메일 발송을 확인하지 못했습니다. 잠시 후 다시 요청하세요.",
      );
    }
    return { challengeId: id, expiresIn: 300 };
  }
  if (method === "POST" && p === "/auth/verify-code") {
    need(text(b.challengeId, 64) && /^\d{6}$/.test(b.code));
    const c = await query(
      e,
      "UPDATE challenges SET attempts=attempts+1 WHERE id=? AND used=0 AND expires>? AND attempts<5 RETURNING *",
      b.challengeId,
      t,
    ).first();
    need(c, 401, "인증번호가 만료되었거나 사용할 수 없습니다.");
    need(
      c.digest === (await sign(e.OTP_SECRET, c.id + ":" + b.code)),
      401,
      "인증번호를 확인하세요.",
    );
    const used = await query(
      e,
      "UPDATE challenges SET used=1 WHERE id=? AND used=0 RETURNING id",
      c.id,
    ).first();
    need(used, 401, "이미 사용한 인증번호입니다.");
    await query(
      e,
      "INSERT INTO users(id,email) VALUES(?,?) ON CONFLICT(email) DO NOTHING",
      token(),
      c.email,
    ).run();
    const u = await query(
      e,
      "SELECT * FROM users WHERE email=?",
      c.email,
    ).first();
    const raw = token();
    await query(
      e,
      "INSERT INTO sessions(digest,user_id,expires) VALUES(?,?,?)",
      await hash(raw),
      u.id,
      t + 10800,
    ).run();
    return { token: raw, expiresAt: t + 10800 };
  }
  const bearer = req.headers
    .get("Authorization")
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  need(bearer, 401, "로그인이 필요합니다.");
  const digest = await hash(bearer);
  const session = await query(
    e,
    "SELECT users.*,sessions.expires FROM sessions JOIN users ON users.id=sessions.user_id WHERE digest=? AND expires>?",
    digest,
    t,
  ).first();
  const apiKey = session
    ? null
    : await query(
        e,
        "SELECT * FROM keys WHERE digest=? AND expires>? AND revoked=0",
        digest,
        t,
      ).first();
  need(session || apiKey, 401, "인증이 만료되었습니다. 다시 로그인하세요.");
  if (apiKey) {
    await limit(e, "key:" + apiKey.id, 60, 60);
    need(
      method === "GET" && /^\/classes\/[^/]+\/progress$/.test(p),
      403,
      "조회 권한만 제공됩니다.",
    );
  }
  const teacher =
    !!session &&
    (e.TEACHER_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((v) => v.trim())
      .includes(session.email);
  if (p === "/auth/logout" && method === "POST") {
    await query(e, "DELETE FROM sessions WHERE digest=?", digest).run();
    return { ok: true };
  }
  if (p === "/me" && method === "GET")
    return {
      id: session.id,
      email: session.email,
      name: session.name,
      studentNumber: session.student_number,
      role: teacher ? "teacher" : "student",
      expiresAt: session.expires,
      memberships: (
        await query(
          e,
          "SELECT classes.id,classes.name,members.status FROM members JOIN classes ON classes.id=members.class_id WHERE user_id=?",
          session.id,
        ).all()
      ).results,
    };
  if (p === "/classes" && method === "POST") {
    need(teacher, 403);
    need(text(b.name, 100));
    const id = token();
    const code = token().slice(0, 12);
    await query(
      e,
      "INSERT INTO classes(id,teacher_id,name,code) VALUES(?,?,?,?)",
      id,
      session.id,
      b.name.trim(),
      code,
    ).run();
    return { id, code };
  }
  if (p === "/classes" && method === "GET") {
    need(teacher, 403);
    return {
      classes: (
        await query(
          e,
          "SELECT * FROM classes WHERE teacher_id=?",
          session.id,
        ).all()
      ).results,
    };
  }
  if (p === "/classes/join" && method === "POST") {
    need(text(b.name, 50) && text(b.studentNumber, 30) && text(b.code, 20));
    const approved = await query(
      e,
      "SELECT user_id FROM members WHERE user_id=? AND status='approved' LIMIT 1",
      session.id,
    ).first();
    need(
      !approved ||
        (session.name === b.name.trim() &&
          session.student_number === b.studentNumber.trim()),
      409,
      "승인된 이름과 학번을 사용하세요. 변경은 담당 교사에게 문의하세요.",
    );
    const cls = await query(
      e,
      "SELECT id FROM classes WHERE code=?",
      b.code.trim(),
    ).first();
    need(cls, 404, "참여 코드를 확인하세요.");
    await e.DB.batch([
      query(
        e,
        "UPDATE users SET name=?,student_number=? WHERE id=?",
        b.name.trim(),
        b.studentNumber.trim(),
        session.id,
      ),
      query(
        e,
        "INSERT INTO members(class_id,user_id,status) VALUES(?,?,?) ON CONFLICT(class_id,user_id) DO NOTHING",
        cls.id,
        session.id,
        "pending",
      ),
    ]);
    return { ok: true };
  }
  const m = p.match(/^\/classes\/([^/]+)(.*)$/);
  need(m, 404);
  const classId = m[1],
    tail = m[2];
  const cls = await query(
    e,
    "SELECT * FROM classes WHERE id=?",
    classId,
  ).first();
  need(cls, 404);
  const owns = teacher && cls.teacher_id === session?.id;
  if (tail === "/me/progress") {
    need(session, 403);
    const membership = await query(
      e,
      "SELECT status FROM members WHERE class_id=? AND user_id=?",
      classId,
      session.id,
    ).first();
    need(membership?.status === "approved", 403, "교사의 승인이 필요합니다.");
    if (method === "GET") {
      const row = await query(
        e,
        "SELECT * FROM progress WHERE class_id=? AND user_id=?",
        classId,
        session.id,
      ).first();
      return row
        ? decode(row)
        : { notes: {}, checks: {}, version: 0, updatedAt: null };
    }
    if (method === "PUT") {
      const data = validateProgress(b);
      const row = await query(
        e,
        "INSERT INTO progress(class_id,user_id,notes,checks,version,updated) SELECT ?,?,?,?,1,? WHERE ?=0 ON CONFLICT(class_id,user_id) DO UPDATE SET notes=excluded.notes,checks=excluded.checks,version=progress.version+1,updated=excluded.updated WHERE progress.version=? RETURNING *",
        classId,
        session.id,
        JSON.stringify(data.notes),
        JSON.stringify(data.checks),
        t,
        b.version,
        b.version,
      ).first();
      // Nonzero versions update existing rows without attempting a new insert.
      if (row) return decode(row);
      if (b.version > 0) {
        const updated = await query(
          e,
          "UPDATE progress SET notes=?,checks=?,version=version+1,updated=? WHERE class_id=? AND user_id=? AND version=? RETURNING *",
          JSON.stringify(data.notes),
          JSON.stringify(data.checks),
          t,
          classId,
          session.id,
          b.version,
        ).first();
        if (updated) return decode(updated);
      }
      throw new Failure(
        409,
        "다른 기기에서 저장한 기록이 있습니다. 최신 기록을 다시 불러오세요.",
      );
    }
  }
  if (tail === "/progress" && method === "GET") {
    need(owns || apiKey?.class_id === classId, 403);
    await query(
      e,
      "INSERT INTO audit(id,actor,action,class_id,created) VALUES(?,?,?,?,?)",
      token(),
      apiKey?.id || session.id,
      "progress.read",
      classId,
      t,
    ).run();
    const rows = (
      await query(
        e,
        "SELECT users.id,users.name,users.student_number,progress.notes,progress.checks,progress.version,progress.updated FROM members JOIN users ON users.id=members.user_id LEFT JOIN progress ON progress.user_id=users.id AND progress.class_id=members.class_id WHERE members.class_id=? AND members.status='approved'",
        classId,
      ).all()
    ).results;
    return {
      students: rows.map((r) => ({
        id: r.id,
        name: r.name,
        studentNumber: r.student_number,
        ...decode(r),
      })),
    };
  }
  need(owns, 403, "담당 교사만 사용할 수 있습니다.");
  if (tail === "/members" && method === "GET")
    return {
      members: (
        await query(
          e,
          "SELECT users.id,users.name,users.student_number,members.status FROM members JOIN users ON users.id=members.user_id WHERE class_id=?",
          classId,
        ).all()
      ).results,
    };
  if (tail.startsWith("/members/") && method === "PUT") {
    need(["approved", "rejected", "removed"].includes(b.status));
    await query(
      e,
      "UPDATE members SET status=? WHERE class_id=? AND user_id=?",
      b.status,
      classId,
      tail.split("/")[2],
    ).run();
    return { ok: true };
  }
  if (tail === "/code" && method === "POST") {
    const code = token().slice(0, 12);
    await query(e, "UPDATE classes SET code=? WHERE id=?", code, classId).run();
    return { code };
  }
  if (tail === "/keys" && method === "GET")
    return {
      keys: (
        await query(
          e,
          "SELECT id,label,expires,revoked FROM keys WHERE class_id=?",
          classId,
        ).all()
      ).results,
    };
  if (tail === "/keys" && method === "POST") {
    need(text(b.label, 100));
    const key = token(),
      id = token();
    await query(
      e,
      "INSERT INTO keys(id,digest,class_id,label,expires) VALUES(?,?,?,?,?)",
      id,
      await hash(key),
      classId,
      b.label,
      t + 90 * 86400,
    ).run();
    return { id, key, expiresAt: t + 90 * 86400 };
  }
  if (tail.startsWith("/keys/") && method === "DELETE") {
    await query(
      e,
      "UPDATE keys SET revoked=1 WHERE id=? AND class_id=?",
      tail.split("/")[2],
      classId,
    ).run();
    return { ok: true };
  }
  if (tail === "/records" && method === "DELETE") {
    need(b.confirm === undefined);
    await query(e, "DELETE FROM progress WHERE class_id=?", classId).run();
    return { ok: true };
  }
  throw new Failure(404, "경로를 찾을 수 없습니다.");
}
function decode(r) {
  return {
    notes: JSON.parse(r.notes || "{}"),
    checks: JSON.parse(r.checks || "{}"),
    version: r.version || 0,
    updatedAt: r.updated || null,
  };
}
