'use strict';
(() => {
  const open = document.getElementById("turnOpen");
  const panel = document.createElement('dialog');
  panel.className = 'drawing-dialog turn-dialog';
  panel.setAttribute('aria-labelledby', 'turnDrawingTitle');
  panel.innerHTML = `<div class="drawing-heading"><div><h2 id="turnDrawingTitle">정면 · 측면 · 후면 캔버스</h2><p>세 방향의 높이를 맞춰 그리세요. 비율이 다른 캐릭터는 안내선을 끄고 자유롭게 그려도 좋아요.</p></div><button type="button" class="button secondary" id="turnDrawingClose">닫기</button></div>
    <label class="toggle"><input type="checkbox" id="turnGuidesToggle" checked>높이 안내선 보기</label><div class="drawing-tools" role="toolbar" aria-label="그리기 도구">
      <button type="button" class="button secondary" id="turnDrawingPen" aria-pressed="true">펜</button>
      <button type="button" class="button secondary" id="turnDrawingEraser" aria-pressed="false">지우개</button>
      <label>색상 <input id="turnDrawingColor" type="color" value="#252833"></label>
      <label>굵기 <input id="turnDrawingSize" type="range" min="1" max="48" value="6"><output id="turnDrawingSizeValue">6</output></label>
      <button type="button" class="button secondary" id="turnDrawingUndo">실행 취소</button>
      <button type="button" class="button secondary" id="turnDrawingClear">모두 지우기</button>
      <button type="button" class="button primary" id="turnDrawingSave">PNG 저장</button>
    </div><div class="drawing-surface turn-canvas-wrap"><canvas id="turnDrawingCanvas" width="1200" height="720" aria-label="마우스, 터치 또는 펜으로 그리는 스케치 영역">이 브라우저에서는 캔버스를 사용할 수 없습니다.</canvas><img class="turn-guides" src="assets/turnaround-guides.svg" alt=""></div>
    <p class="drawing-help" id="turnDrawingStatus" role="status">마우스·터치·태블릿 펜으로 그릴 수 있어요. 닫아도 그림은 유지되지만, 새로고침 전에 PNG로 저장하세요.</p>`;
  document.body.append(panel);
  const find = id => panel.querySelector('#' + id);
  const canvas = find('turnDrawingCanvas');
  const ctx = canvas.getContext('2d');
  const history = [];
  find('turnGuidesToggle').onchange = e => {panel.querySelector('.turn-guides').hidden = !e.target.checked;};
  let erasing = false, active = null, last = null, dirty = false;
  const status = message => { find('turnDrawingStatus').textContent = message; };
  function controls() { find('turnDrawingUndo').disabled = history.length === 0; }
  function checkpoint() {
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.length > 12) history.shift();
    controls();
  }
  function point(event) {
    const r = canvas.getBoundingClientRect();
    return {x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height};
  }
  function paint(from, to) {
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = find('turnDrawingColor').value;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Number(find('turnDrawingSize').value);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      ctx.arc(to.x,to.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();
    } else {ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
    dirty = true;
  }
  canvas.addEventListener('pointerdown', event => {
    if (active !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();checkpoint();active = event.pointerId;
    canvas.setPointerCapture(active);last = point(event);paint(last,last);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== active) return;
    event.preventDefault();const next = point(event);paint(last,next);last = next;
  });
  function finish(event) { if(event.pointerId === active) {active=null;last=null;} }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,finish));
  function tool(value) {
    erasing=value;find('turnDrawingPen').setAttribute('aria-pressed',String(!value));
    find('turnDrawingEraser').setAttribute('aria-pressed',String(value));
  }
  find('turnDrawingPen').onclick=()=>tool(false);
  find('turnDrawingEraser').onclick=()=>tool(true);
  find('turnDrawingColor').oninput=()=>tool(false);
  find('turnDrawingSize').oninput=event=>{find('turnDrawingSizeValue').value=event.target.value;};
  find('turnDrawingUndo').onclick=()=>{
    if(!history.length)return;
    ctx.putImageData(history.pop(),0,0);dirty=true;controls();status('마지막 작업을 취소했어요.');
  };
  find('turnDrawingClear').onclick=()=>{
    if(!confirm('캔버스의 그림을 모두 지울까요? 실행 취소로 복구할 수 있어요.'))return;
    checkpoint();ctx.clearRect(0,0,canvas.width,canvas.height);dirty=true;status('캔버스를 비웠어요. 실행 취소로 복구할 수 있어요.');
  };
  find('turnDrawingSave').onclick=()=>{
    const exported=document.createElement('canvas');exported.width=canvas.width;exported.height=canvas.height;
    const output=exported.getContext('2d');output.fillStyle='#ffffff';output.fillRect(0,0,exported.width,exported.height);if(find('turnGuidesToggle').checked) output.drawImage(panel.querySelector('.turn-guides'),0,0,canvas.width,canvas.height);output.drawImage(canvas,0,0);
    exported.toBlob(blob=>{
      if(!blob){status('이미지 저장에 실패했어요. 다시 시도해 주세요.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='캐릭터_정면_측면_후면.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      dirty=false;status('PNG 다운로드를 요청했어요. 다운로드 폴더를 확인하세요.');
    },'image/png');
  };
  open.onclick=()=>{panel.showModal();document.body.classList.add('drawing-active');};
  find('turnDrawingClose').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{active=null;document.body.classList.remove('turnDrawing-active');open.focus();});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  controls();
})();
