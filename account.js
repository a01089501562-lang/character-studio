import "./app.js";
const api = window.STUDIO_CONFIG?.apiUrl;
if (api) start();
function start() {
  const panel = document.createElement("section");
  panel.className = "account-panel";
  panel.innerHTML =
    '<h2>내 학습 기록</h2><p id="account-status" role="status"></p><div id="account-body"></div>';
  document.querySelector("main").prepend(panel);
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "account.css";
  document.head.append(style);
  const body = panel.querySelector("#account-body"),
    status = panel.querySelector("#account-status");
  let legacy = window.STUDIO_STATE?.get();
  let auth,
    me,
    selected,
    version = 0,
    timer,
    expiryTimer,
    saving = false,
    dirty = false,
    conflict = false,
    ready = false,
    loadGeneration = 0;
  try {
    auth = JSON.parse(sessionStorage.getItem("studio-session"));
  } catch {}
  const say = (s) => {
    status.textContent = s;
    if (window.STUDIO_ONLINE_ACTIVE) {
      const note = document.querySelector("#saveStatus");
      if (note) note.textContent = s;
    }
  };
  const el = (tag, text) => {
    const e = document.createElement(tag);
    e.textContent = text;
    return e;
  };
  function button(label, fn, parent = body) {
    const b = el("button", label);
    b.type = "button";
    b.onclick = async () => {
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        say(e.message);
      } finally {
        b.disabled = false;
      }
    };
    parent.append(b);
    return b;
  }
  function form(fields, label, fn) {
    const f = document.createElement("form");
    const inputs = {};
    for (const [name, title, type = "text"] of fields) {
      const l = el("label", title),
        i = document.createElement("input");
      i.name = name;
      i.type = type;
      i.required = true;
      i.maxLength = type === "email" ? 254 : 100;
      l.append(i);
      f.append(l);
      inputs[name] = i;
    }
    const b = el("button", label);
    f.append(b);
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      b.disabled = true;
      try {
        await fn(
          Object.fromEntries(
            Object.entries(inputs).map(([k, v]) => [k, v.value]),
          ),
        );
      } catch (e) {
        say(e.message);
      } finally {
        b.disabled = false;
      }
    };
    body.append(f);
    return f;
  }
  async function call(path, method = "GET", data) {
    const r = await fetch(api.replace(/\/$/, "") + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: "Bearer " + auth.token } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await r.json();
    if (!r.ok) {
      if (r.status === 401 && auth) {
        clear();
        location.reload();
      }
      const error = new Error(result.error?.message || "요청에 실패했습니다.");
      error.status = r.status;
      throw error;
    }
    return result;
  }
  function storageRemove(store, key) {
    try {
      store.removeItem(key);
    } catch {}
  }
  function editable(enabled) {
    document
      .querySelectorAll(
        "[data-check],.notebook input,.notebook textarea,#resetButton",
      )
      .forEach((el) => (el.disabled = !enabled));
  }
  function clear() {
    ready = false;
    loadGeneration++;
    editable(true);
    clearTimeout(timer);
    clearTimeout(expiryTimer);
    auth = null;
    me = null;
    selected = null;
    dirty = false;
    conflict = false;
    try {
      storageRemove(sessionStorage, "studio-session");
    } catch {}
    try {
      storageRemove(localStorage, "character-studio-v1");
    } catch {}
    window.STUDIO_STATE?.set({ notes: {}, checks: {} });
    window.STUDIO_ONLINE_ACTIVE = false;
    document
      .querySelectorAll("canvas")
      .forEach((c) => c.getContext("2d")?.clearRect(0, 0, c.width, c.height));
    document
      .querySelectorAll(".cs-submit input,.cs-submit textarea")
      .forEach((i) => (i.value = ""));
  }
  function login() {
    body.replaceChildren();
    say("이메일에서 인증번호를 확인해 입력하세요. 로그인은 3시간 유지됩니다.");
    form([["email", "이메일", "email"]], "인증번호 받기", async ({ email }) => {
      const challenge = await call("/auth/request-code", "POST", { email });
      body.replaceChildren();
      say("인증번호를 보냈습니다. 5분 안에 입력하세요.");
      form([["code", "6자리 인증번호"]], "로그인", async ({ code }) => {
        legacy = window.STUDIO_STATE?.get();
        auth = await call("/auth/verify-code", "POST", {
          challengeId: challenge.challengeId,
          code,
        });
        try {
          sessionStorage.setItem("studio-session", JSON.stringify(auth));
        } catch {
          say(
            "브라우저 저장이 차단되어 이 화면을 열어 둔 동안만 로그인됩니다.",
          );
        }
        await home();
      });
      button("이메일 다시 입력", login);
    });
  }
  async function home() {
    if (saving) throw new Error("저장이 끝난 뒤 새로고침하세요.");
    if (dirty && !confirm("저장되지 않은 변경을 버리고 새로고침할까요?"))
      return;
    selected = null;
    ready = false;
    clearTimeout(timer);
    if (!auth) {
      login();
      return;
    }
    if (auth.expiresAt * 1000 <= Date.now()) {
      clear();
      login();
      return;
    }
    me = await call("/me");
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(
      () => {
        clear();
        location.reload();
      },
      Math.max(0, auth.expiresAt * 1000 - Date.now()),
    );
    body.replaceChildren();
    say(me.email + " · " + (me.role === "teacher" ? "교사" : "학생"));
    button("로그아웃", async () => {
      try {
        await call("/auth/logout", "POST", {});
      } finally {
        clear();
        location.reload();
      }
    });
    if (me.role === "teacher") {
      await teachers();
      return;
    }
    window.STUDIO_ONLINE_ACTIVE = true;
    editable(false);
    window.STUDIO_STATE.set({ notes: {}, checks: {} });
    try {
      storageRemove(localStorage, "character-studio-v1");
    } catch {}
    const approved = me.memberships.filter((m) => m.status === "approved");
    if (approved.length) {
      const select = document.createElement("select");
      select.setAttribute("aria-label", "학급");
      approved.forEach((c) => {
        const o = el("option", c.name);
        o.value = c.id;
        select.append(o);
      });
      body.append(select);
      selected = approved.find((m) => m.id === selected)?.id || approved[0].id;
      select.value = selected;
      select.onchange = async () => {
        if (saving) {
          select.value = selected;
          say("저장이 끝난 뒤 학급을 바꾸세요.");
          return;
        }
        if (dirty && !confirm("저장되지 않은 변경을 버리고 학급을 바꿀까요?")) {
          select.value = selected;
          return;
        }
        selected = select.value;
        try {
          await load();
        } catch (e) {
          say(e.message);
        }
      };
      button("최신 기록 불러오기", async () => {
        if (dirty && !confirm("저장되지 않은 변경을 버리고 불러올까요?"))
          return;
        await load();
      });
      button("저장 재시도", save);
      if (
        legacy &&
        (Object.keys(legacy.checks).length ||
          Object.values(legacy.notes).some(Boolean))
      )
        button("이 기기의 이전 기록 가져오기", async () => {
          if (
            !confirm(
              "공용 기기의 기록은 다른 학생의 것일 수 있습니다. 본인 기록이 맞고 현재 온라인 기록을 덮어써도 되나요?",
            )
          )
            return;
          window.STUDIO_STATE.set(legacy);
          legacy = null;
          dirty = true;
          await save();
        });
      await load();
    }
    me.memberships
      .filter((m) => m.status !== "approved")
      .forEach((m) =>
        body.append(
          el(
            "p",
            m.name +
              " · " +
              ({
                pending: "승인 대기",
                rejected: "참여 거절",
                removed: "참여 해제",
              }[m.status] || m.status),
          ),
        ),
      );
    button("승인 상태 새로고침", home);
    form(
      [
        ["name", "이름"],
        ["studentNumber", "학번"],
        ["code", "학급 참여 코드"],
      ],
      "학급 참여 신청",
      async (data) => {
        await call("/classes/join", "POST", data);
        await home();
      },
    );
  }
  async function load() {
    if (saving) throw new Error("저장이 끝난 뒤 불러오세요.");
    clearTimeout(timer);
    ready = false;
    editable(false);
    const generation = ++loadGeneration;
    const classId = selected;
    window.STUDIO_STATE.set({ notes: {}, checks: {} });
    const r = await call("/classes/" + classId + "/me/progress");
    if (generation !== loadGeneration || classId !== selected || !auth) return;
    version = r.version;
    window.STUDIO_STATE.set({ notes: r.notes, checks: r.checks });
    dirty = false;
    conflict = false;
    ready = true;
    editable(true);
    say("온라인 기록을 불러왔습니다. 변경하면 자동 저장됩니다.");
  }
  async function save() {
    if (!selected || !auth || saving || conflict || !ready) return;
    saving = true;
    dirty = false;
    const classId = selected;
    let succeeded = false;
    try {
      say("저장 중…");
      const r = await call("/classes/" + classId + "/me/progress", "PUT", {
        ...window.STUDIO_STATE.get(),
        version,
      });
      version = r.version;
      succeeded = true;
      say("서버에 저장했습니다.");
    } catch (e) {
      dirty = true;
      if (e.status === 409) conflict = true;
      say(e.message + " 저장 재시도 또는 최신 기록 불러오기를 사용하세요.");
    } finally {
      saving = false;
      if (dirty && !conflict && classId === selected) {
        if (succeeded) timer = setTimeout(save, 1000);
      }
    }
  }
  window.addEventListener("studio-change", () => {
    if (!selected || !ready) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, 1000);
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty || saving) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  async function teachers() {
    form([["name", "새 학급 이름"]], "학급 만들기", async (data) => {
      await call("/classes", "POST", data);
      await home();
    });
    const list = await call("/classes");
    for (const cls of list.classes) {
      const box = document.createElement("article");
      box.className = "account-class";
      body.append(box);
      box.append(el("h3", cls.name), el("p", "참여 코드: " + cls.code));
      const base = "/classes/" + cls.id;
      button(
        "참여 코드 재발급",
        async () => {
          await call(base + "/code", "POST", {});
          await home();
        },
        box,
      );
      const members = await call(base + "/members");
      for (const m of members.members) {
        const row = el(
          "p",
          m.student_number +
            " " +
            m.name +
            " · " +
            ({
              approved: "승인됨",
              pending: "승인 대기",
              rejected: "참여 거절",
              removed: "참여 해제",
            }[m.status] || m.status),
        );
        box.append(row);
        for (const [s, label] of [
          ["approved", "승인"],
          ["rejected", "거절"],
          ["removed", "참여 해제"],
        ])
          button(
            label,
            async () => {
              await call(base + "/members/" + m.id, "PUT", { status: s });
              await home();
            },
            row,
          );
      }
      button(
        "학습 기록 조회",
        async () => {
          const data = await call(base + "/progress");
          let out = box.querySelector(".account-records");
          if (!out) {
            out = document.createElement("div");
            out.className = "account-records";
            box.append(out);
          }
          out.replaceChildren();
          for (const student of data.students) {
            const card = document.createElement("article");
            card.append(
              el("h4", student.studentNumber + " " + student.name),
              el(
                "p",
                "진행: " +
                  Object.values(student.checks).filter(Boolean).length +
                  " / 18 · 저장: " +
                  (student.updatedAt
                    ? new Date(student.updatedAt * 1000).toLocaleString()
                    : "기록 없음"),
              ),
              el("p", "캐릭터: " + (student.notes.characterName || "")),
              el("p", "성격: " + (student.notes.personality || "")),
              el("p", "특징: " + (student.notes.features || "")),
            );
            out.append(card);
          }
        },
        box,
      );
      button(
        "학습기록 엑셀로 저장",
        async () => {
          const data = await call(base + "/progress");
          const { createProgressWorkbook } = await import("./progress-export.js");
          const link = document.createElement("a"),
            url = URL.createObjectURL(createProgressWorkbook(data.students));
          link.href = url;
          link.download = (cls.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_") || "학급") + "_학습기록.xlsx";
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          say("학습기록 엑셀 파일의 다운로드를 시작했습니다.");
        },
        box,
      );
      button(
        "학급 기록 삭제",
        async () => {
          if (confirm("이 학급의 기획 노트와 체크리스트를 모두 삭제할까요?")) {
            await call(base + "/records", "DELETE");
            say("기록을 삭제했습니다.");
          }
        },
        box,
      );
      button(
        "개발자 조회 키 발급",
        async () => {
          const label = prompt("연동 앱 이름");
          if (!label) return;
          const key = await call(base + "/keys", "POST", { label });
          const out = el(
            "pre",
            "한 번만 표시되는 키입니다. 공개 코드에 넣지 마세요.\n" + key.key,
          );
          box.append(out);
        },
        box,
      );
      const keys = await call(base + "/keys");
      for (const key of keys.keys) {
        if (key.revoked) continue;
        const row = el(
          "p",
          "연동: " +
            key.label +
            " · 만료 " +
            new Date(key.expires * 1000).toLocaleDateString(),
        );
        box.append(row);
        button(
          "키 폐기",
          async () => {
            await call(base + "/keys/" + key.id, "DELETE");
            await home();
          },
          row,
        );
      }
      box.append(
        el(
          "p",
          "기록은 마지막 저장 후 1년간 보관됩니다. 필요하면 미리 내려받으세요.",
        ),
      );
    }
  }
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (auth && auth.expiresAt * 1000 <= Date.now()) {
      clear();
      location.reload();
    }
  });
  home().catch((e) => {
    say(e.message);
    if (!auth) login();
  });
}
