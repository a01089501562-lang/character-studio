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
      <button type="button" class="button secondary" id="turnDrawingClear">현재 레이어 지우기</button>
      <button type="button" class="button primary" id="turnDrawingSave">PNG 저장</button>
    </div><section class="turn-layer-panel" aria-label="레이어 관리"><div class="turn-layer-heading"><strong>레이어</strong><span id="turnLayerCount">1 / 6</span><button type="button" class="button secondary" id="turnLayerAdd">+ 레이어 추가</button><button type="button" class="button secondary" id="turnLayerDelete">선택 레이어 삭제</button></div><div id="turnLayerList" class="turn-layer-list" role="listbox" aria-label="그림 레이어"></div></section><div class="drawing-surface turn-canvas-wrap"><canvas id="turnDrawingCanvas" width="1200" height="720" aria-label="마우스, 터치 또는 펜으로 그리는 스케치 영역">이 브라우저에서는 캔버스를 사용할 수 없습니다.</canvas><img class="turn-guides" src="assets/turnaround-guides.svg" alt=""></div>
    <p class="drawing-help" id="turnDrawingStatus" role="status">레이어를 나눠 스케치, 선화, 색칠을 할 수 있어요. 닫아도 그림은 유지되지만, 새로고침 전에 PNG로 저장하세요.</p>`;
  document.body.append(panel);
  const find = id => panel.querySelector('#' + id);
  const canvas = find('turnDrawingCanvas');
  const ctx = canvas.getContext('2d');
  const layers = [{ name: '레이어 1', visible: true, canvas: document.createElement('canvas'), history: [] }];
  layers[0].canvas.width = canvas.width; layers[0].canvas.height = canvas.height;
  let selected = 0, erasing = false, active = null, last = null, dirty = false;
  const status = message => { find('turnDrawingStatus').textContent = message; };
  const activeLayer = () => layers[selected];
  function controls() {
    find('turnDrawingUndo').disabled = activeLayer().history.length === 0;
    find('turnLayerAdd').disabled = layers.length >= 6;
    find('turnLayerDelete').disabled = layers.length <= 1;
    find('turnLayerCount').textContent = `${layers.length} / 6`;
  }
  function renderLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    layers.forEach(layer => { if (layer.visible) ctx.drawImage(layer.canvas, 0, 0); });
  }
  function renderList() {
    const list = find('turnLayerList'); list.replaceChildren();
    layers.forEach((layer, index) => {
      const row = document.createElement('div'); row.className = 'turn-layer-row' + (index === selected ? ' is-selected' : ''); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === selected));
      const select = document.createElement('button'); select.type = 'button'; select.className = 'turn-layer-select'; select.textContent = layer.name; select.setAttribute('aria-label', `${layer.name} 선택`); select.onclick = () => { selected = index; renderList(); controls(); };
      const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'turn-layer-visibility'; visibility.textContent = layer.visible ? '보임' : '숨김'; visibility.setAttribute('aria-pressed', String(layer.visible)); visibility.setAttribute('aria-label', `${layer.name} ${layer.visible ? '숨기기' : '보이기'}`); visibility.onclick = () => { layer.visible = !layer.visible; renderLayers(); renderList(); dirty = true; };
      row.append(select, visibility); list.append(row);
    });
    controls();
  }
  find('turnLayerAdd').onclick = () => {
    if (layers.length >= 6) return;
    const layerCanvas = document.createElement('canvas'); layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
    layers.push({ name: `레이어 ${layers.length + 1}`, visible: true, canvas: layerCanvas, history: [] }); selected = layers.length - 1;
    renderLayers(); renderList(); dirty = true; status(`${activeLayer().name}을(를) 추가했어요.`);
  };
  find('turnLayerDelete').onclick = () => {
    if (layers.length <= 1) return;
    const removed = activeLayer().name; layers.splice(selected, 1); selected = Math.max(0, selected - 1);
    renderLayers(); renderList(); dirty = true; status(`${removed}을(를) 삭제했어요.`);
  };
  find('turnGuidesToggle').onchange = e => {panel.querySelector('.turn-guides').hidden = !e.target.checked;};
  function checkpoint() {
    const layer = activeLayer();
    layer.history.push(layer.canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
    if (layer.history.length > 12) layer.history.shift();
    controls();
  }
  function point(event) {
    const r = canvas.getBoundingClientRect();
    return {x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height};
  }
  function paint(from, to) {
    const layerCtx = activeLayer().canvas.getContext('2d');
    layerCtx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    layerCtx.strokeStyle = find('turnDrawingColor').value; layerCtx.fillStyle = layerCtx.strokeStyle;
    layerCtx.lineWidth = Number(find('turnDrawingSize').value); layerCtx.lineCap = layerCtx.lineJoin = 'round'; layerCtx.beginPath();
    if (from.x === to.x && from.y === to.y) {layerCtx.arc(to.x,to.y,layerCtx.lineWidth/2,0,Math.PI*2);layerCtx.fill();}
    else {layerCtx.moveTo(from.x,from.y);layerCtx.lineTo(to.x,to.y);layerCtx.stroke();}
    renderLayers(); dirty = true;
  }
  canvas.addEventListener('pointerdown', event => {
    if (active !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();checkpoint();active = event.pointerId;canvas.setPointerCapture(active);last = point(event);paint(last,last);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== active) return;
    event.preventDefault();const next = point(event);paint(last,next);last = next;
  });
  function finish(event) { if(event.pointerId === active) {active=null;last=null;} }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,finish));
  function tool(value) {erasing=value;find('turnDrawingPen').setAttribute('aria-pressed',String(!value));find('turnDrawingEraser').setAttribute('aria-pressed',String(value));}
  find('turnDrawingPen').onclick=()=>tool(false); find('turnDrawingEraser').onclick=()=>tool(true); find('turnDrawingColor').oninput=()=>tool(false);
  find('turnDrawingSize').oninput=event=>{find('turnDrawingSizeValue').value=event.target.value;};
  find('turnDrawingUndo').onclick=()=>{
    const layer = activeLayer(); if(!layer.history.length)return;
    layer.canvas.getContext('2d').putImageData(layer.history.pop(),0,0);renderLayers();dirty=true;controls();status(`${layer.name}의 마지막 작업을 취소했어요.`);
  };
  find('turnDrawingClear').onclick=()=>{
    if(!confirm(`${activeLayer().name}의 그림을 모두 지울까요? 실행 취소로 복구할 수 있어요.`))return;
    checkpoint();activeLayer().canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);renderLayers();dirty=true;status(`${activeLayer().name}을(를) 비웠어요. 실행 취소로 복구할 수 있어요.`);
  };
  find('turnDrawingSave').onclick=()=>{
    const exported=document.createElement('canvas');exported.width=canvas.width;exported.height=canvas.height;
    const output=exported.getContext('2d');output.fillStyle='#ffffff';output.fillRect(0,0,exported.width,exported.height);
    if(find('turnGuidesToggle').checked) output.drawImage(panel.querySelector('.turn-guides'),0,0,canvas.width,canvas.height);
    layers.forEach(layer=>{if(layer.visible)output.drawImage(layer.canvas,0,0);});
    exported.toBlob(blob=>{
      if(!blob){status('이미지 저장에 실패했어요. 다시 시도해 주세요.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='캐릭터_정면_측면_후면.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      dirty=false;status('보이는 레이어를 합쳐 PNG로 저장했어요.');
    },'image/png');
  };
  open.onclick=()=>{panel.showModal();document.body.classList.add('drawing-active');};
  find('turnDrawingClose').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{active=null;document.body.classList.remove('drawing-active');open.focus();});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  renderList();
})();
