/* 작품 제출: Google Apps Script */
(function () {
  'use strict';
  function start() {
    var endpoint = (window.STUDIO_CONFIG || {}).appsScriptUrl || '';
    var area = document.getElementById('submissionArea');
    if (!area || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) return;
    area.innerHTML = '<form class="cs-submit">' +
      '<div class="cs-row"><label>학번<input name="studentId" type="text" inputmode="numeric" maxlength="20" required placeholder="20301"></label>' +
      '<label>이름<input name="name" type="text" maxlength="30" required placeholder="홍길동"></label></div>' +
      '<label>캐릭터명<input name="character" type="text" maxlength="30" required placeholder="루미"></label>' +
      '<label>동작 시트 PNG (필수)<input name="action" type="file" accept="image/png" required></label>' +
      '<label>3면도 시트 PNG (선택)<input name="turnaround" type="file" accept="image/png"></label>' +
      '<p class="small">파일당 최대 10MB. 학번·이름과 작품은 선생님의 Google 드라이브에 저장되고 이메일로 전달됩니다.</p>' +
      '<p class="small">로그인 후 승인된 학급을 선택하고 제출하면 엑셀의 작품 제출 현황에도 반영됩니다. 이메일 제출과 로그인 전 제출은 자동으로 반영되지 않습니다.</p>' +
      '<label>선생님께 남길 말 (선택)<textarea name="message" rows="2" maxlength="500"></textarea></label>' +
      '<button type="submit" class="cs-button">작품 제출하기</button>' +
      '<p class="cs-status" role="status" aria-live="polite"></p></form>';
    var form = area.querySelector('form');
    var status = form.querySelector('.cs-status');
    var button = form.querySelector('button');
    var busy = false;
    function say(text, kind) {
      status.textContent = text;
      status.className = 'cs-status' + (kind ? ' is-' + kind : '');
    }
    function readBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
        reader.onerror = reader.onabort = function () { reject(new Error('파일을 읽지 못했습니다.')); };
        reader.readAsDataURL(file);
      });
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (busy) return;
      var value = function (name) { return form.elements.namedItem(name).value.trim(); };
      var payload = { studentId: value('studentId'), name: value('name'), character: value('character'), message: value('message') };
      if (!payload.studentId || !payload.name || !payload.character) return say('학번, 이름, 캐릭터명을 모두 입력하세요.', 'error');
      var picks = [
        { label: '동작시트', file: form.elements.namedItem('action').files[0] },
        { label: '3면도', file: form.elements.namedItem('turnaround').files[0] }
      ].filter(function (pick) { return pick.file; });
      if (!picks.length || picks[0].label !== '동작시트') return say('동작 시트 PNG를 선택하세요.', 'error');
      for (var pick of picks) {
        if (pick.file.type !== 'image/png' && !/\.png$/i.test(pick.file.name)) return say('PNG 파일만 제출할 수 있어요.', 'error');
        if (!pick.file.size || pick.file.size > 10 * 1024 * 1024) return say('빈 파일은 제출할 수 없으며 파일당 10MB 이하여야 해요.', 'error');
      }
      busy = true;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      say('업로드 중이에요… 창을 닫지 마세요.');
      try {
        var send = window.STUDIO_ONLINE_ACTIVE ? window.STUDIO_SUBMISSION.prepare(payload) : null;
        payload.files = await Promise.all(picks.map(async function (pick) {
          return { label: pick.label, data: await readBase64(pick.file) };
        }));
        var result;
        if (send) result = await send(payload.files);
        else {
        var response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('서버 응답 오류');
        result = await response.json();
        }
        if (!result.ok) throw new Error(result.error || '서버가 제출 완료를 확인하지 못했습니다.');
        if (!Array.isArray(result.files)) throw new Error('응답 형식을 확인하지 못했습니다.');
        say('제출 완료! ' + result.files.length + '개 파일이 선생님께 전달되었어요.' +
          (send ? (result.recorded ? ' 학급의 작품 제출 현황에도 반영되었어요.' : ' 제출 현황 저장에는 실패했어요. 파일을 다시 제출하지 말고 선생님께 확인하세요.') :
            ' 로그인 전 제출이므로 학급의 작품 제출 현황에는 자동 반영되지 않아요.'), 'ok');
        form.elements.namedItem('action').value = '';
        form.elements.namedItem('turnaround').value = '';
      } catch (error) {
        say('제출 완료를 확인하지 못했어요: ' + error.message + ' 이미 저장되었을 수 있으니 선생님께 확인한 후 다시 시도하세요.', 'error');
      } finally {
        busy = false;
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
