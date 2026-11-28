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
      <button type="button" class="button secondary" id="turnFill" aria-pressed="false">색 붓기</button>
      <label>색상 <input id="turnDrawingColor" type="color" value="#252833"></label>
      <label>굵기 <input id="turnDrawingSize" type="range" min="1" max="48" value="6"><output id="turnDrawingSizeValue">6</output></label>
      <button type="button" class="button secondary" id="turnDrawingUndo">전 단계로 되돌리기</button>
      <button type="button" class="button secondary" id="turnDrawingClear">현재 레이어 지우기</button>
      <button type="button" class="button primary" id="turnDrawingSave">PNG 저장</button>
    </div><section class="character-palette" aria-label="캐릭터 색상표"><strong>캐릭터 색상표</strong><button type="button" class="button secondary" id="turnPaletteAdd">현재 색 추가</button><button type="button" class="button secondary" id="turnPaletteRemove">현재 색 삭제</button><div id="turnPaletteColors"></div></section><section class="turn-layer-panel" aria-label="레이어 관리"><div class="turn-layer-heading"><strong>레이어</strong><span id="turnLayerCount">1 / 6</span><button type="button" class="button secondary" id="turnLayerAdd">+ 레이어 추가</button><button type="button" class="button secondary" id="turnLayerDelete">선택 레이어 삭제</button><button type="button" class="button secondary" id="turnLayerUp">한 층 위로</button><button type="button" class="button secondary" id="turnLayerDown">한 층 아래로</button></div><div id="turnLayerList" class="turn-layer-list" role="listbox" aria-label="그림 레이어"></div></section><div class="drawing-surface turn-canvas-wrap"><canvas id="turnDrawingCanvas" width="1200" height="720" aria-label="마우스, 터치 또는 펜으로 그리는 스케치 영역">이 브라우저에서는 캔버스를 사용할 수 없습니다.</canvas><img class="turn-guides" src="assets/turnaround-guides.svg" alt=""></div>
    <p class="drawing-help" id="turnDrawingStatus" role="status">레이어를 나눠 스케치, 선화, 색칠을 할 수 있어요. 닫아도 그림은 유지되지만, 새로고침 전에 PNG로 저장하세요.</p>`;
  document.body.append(panel);
  const find = id => panel.querySelector('#' + id);
  const canvas = find('turnDrawingCanvas');
  const ctx = canvas.getContext('2d');
  const layers = [{ name: '레이어 1', visible: true, opacity: 100, canvas: document.createElement('canvas'), history: [] }];
  layers[0].canvas.width = canvas.width; layers[0].canvas.height = canvas.height;
  let selected = 0, erasing = false, active = null, last = null, dirty = false;
  const status = message => { find('turnDrawingStatus').textContent = message; };
  const activeLayer = () => layers[selected];
  function controls() {
    find('turnDrawingUndo').disabled = !undoStack.length;
    find('turnLayerAdd').disabled = layers.length >= 6;
    find('turnLayerDelete').disabled = layers.length <= 1;
    find('turnLayerUp').disabled = selected === layers.length - 1;
    find('turnLayerDown').disabled = selected === 0;
    find('turnLayerCount').textContent = `${layers.length} / 6`;
  }
  function renderLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.drawImage(layer.canvas, 0, 0);
    });
    ctx.globalAlpha = 1;
  }
  function renderList() {
    const list = find('turnLayerList'); list.replaceChildren();
    layers.forEach((layer, index) => {
      const row = document.createElement('div'); row.className = 'turn-layer-row' + (index === selected ? ' is-selected' : ''); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === selected));
      const select = document.createElement('button'); select.type = 'button'; select.className = 'turn-layer-select'; select.textContent = layer.name; select.setAttribute('aria-label', `${layer.name} 선택`); select.onclick = () => { selected = index; renderList(); controls(); };
      const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'turn-layer-visibility'; visibility.textContent = layer.visible ? '보임' : '숨김'; visibility.setAttribute('aria-pressed', String(layer.visible)); visibility.setAttribute('aria-label', `${layer.name} ${layer.visible ? '숨기기' : '보이기'}`); visibility.onclick = () => { remember(); layer.visible = !layer.visible; renderLayers(); renderList(); dirty = true; };
      const opacityLabel = document.createElement('label'); opacityLabel.className = 'turn-layer-opacity'; opacityLabel.append('투명도 ');
      const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; opacity.value = String(layer.opacity); opacity.setAttribute('aria-label', `${layer.name} 투명도`);
      const opacityValue = document.createElement('output'); opacityValue.value = `${layer.opacity}%`; opacityValue.textContent = `${layer.opacity}%`;
      let adjusting = false;
      opacity.onchange = () => { adjusting = false; };
      opacity.oninput = () => { if (!adjusting) { remember(); adjusting = true; find('turnDrawingUndo').disabled = false; } layer.opacity = Number(opacity.value); opacityValue.value = `${layer.opacity}%`; opacityValue.textContent = `${layer.opacity}%`; renderLayers(); dirty = true; };
      opacityLabel.append(opacity, opacityValue);
      row.append(select, visibility, opacityLabel); list.append(row);
    });
    controls();
  }
  find('turnLayerAdd').onclick = () => {
    if (layers.length >= 6) return;
    remember();
    const layerCanvas = document.createElement('canvas'); layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
    layers.push({ name: `레이어 ${layers.length + 1}`, visible: true, opacity: 100, canvas: layerCanvas, history: [] }); selected = layers.length - 1;
    renderLayers(); renderList(); dirty = true; status(`${activeLayer().name}을(를) 추가했어요.`);
  };
  function moveLayer(offset) {
    const next = selected + offset;
    if (active !== null || next < 0 || next >= layers.length) return;
    remember();
    const [layer] = layers.splice(selected, 1);
    layers.splice(next, 0, layer);
    selected = next;
    renderLayers();
    renderList();
    dirty = true;
    status(layer.name + ' 위치: 아래에서 ' + (next + 1) + '번째');
  }
  find('turnLayerUp').onclick = () => moveLayer(1);
  find('turnLayerDown').onclick = () => moveLayer(-1);
  find('turnLayerDelete').onclick = () => {
    if (layers.length <= 1) return;
    remember();
    const removed = activeLayer().name; layers.splice(selected, 1); selected = Math.max(0, selected - 1);
    renderLayers(); renderList(); dirty = true; status(`${removed}을(를) 삭제했어요.`);
  };
  find('turnGuidesToggle').onchange = e => {panel.querySelector('.turn-guides').hidden = !e.target.checked;};
  const undoStack = [];
  let bucket = false;
  function remember(layerPixels) {
    const state = layers.map(layer => ({layer, visible: layer.visible, opacity: layer.opacity}));
    const index = selected;
    const layer = activeLayer();
    undoStack.push(() => {
      layers.splice(0, layers.length, ...state.map(item => item.layer));
      for (const item of state) {
        item.layer.visible = item.visible;
        item.layer.opacity = item.opacity;
      }
      selected = index;
      if (layerPixels) layer.canvas.getContext('2d').putImageData(layerPixels, 0, 0);
    });
    if (undoStack.length > 12) undoStack.shift();
  }
  function checkpoint() {
    const layer = activeLayer();
    remember(layer.canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
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
    if (bucket) {
      event.preventDefault();
      if (!activeLayer().visible) { status('색을 부을 레이어를 먼저 표시하세요.'); return; }
      if (fillRegion(activeLayer().canvas, ctx, point(event), find('turnDrawingColor').value, checkpoint)) { renderLayers(); dirty = true; }
      return;
    }
    event.preventDefault(); checkpoint();active = event.pointerId;canvas.setPointerCapture(active);last = point(event);paint(last,last);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== active) return;
    event.preventDefault();const next = point(event);paint(last,next);last = next;
  });
  function finish(event) { if(event.pointerId === active) {active=null;last=null;} }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,finish));
  find('turnFill').onclick = () => {
    tool(false); bucket = true;
    find('turnFill').setAttribute('aria-pressed','true');
    find('turnDrawingPen').setAttribute('aria-pressed','false');
  };
  function tool(value) {
    bucket = false; find('turnFill').setAttribute('aria-pressed','false');
erasing=value;find('turnDrawingPen').setAttribute('aria-pressed',String(!value));find('turnDrawingEraser').setAttribute('aria-pressed',String(value));}
  find('turnDrawingPen').onclick=()=>tool(false); find('turnDrawingEraser').onclick=()=>tool(true); find('turnDrawingColor').oninput=()=>tool(false);
  const clearPalette = setupPalette(id => find('turnPalette' + id.slice(7)), find('turnDrawingColor'), () => { if (!bucket) tool(false); });
  find('turnDrawingSize').oninput=event=>{find('turnDrawingSizeValue').value=event.target.value;};
  find('turnDrawingUndo').onclick=()=>{
    if (active !== null || !undoStack.length) return;
    undoStack.pop()(); renderLayers(); renderList(); dirty = true; status('이전 작업 상태로 되돌렸어요.');
  };
  find('turnDrawingClear').onclick=()=>{
    if(!confirm(`${activeLayer().name}의 그림을 모두 지울까요? 실행 취소로 복구할 수 있어요.`))return;
    checkpoint();activeLayer().canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);renderLayers();dirty=true;status(`${activeLayer().name}을(를) 비웠어요. 실행 취소로 복구할 수 있어요.`);
  };
  find('turnDrawingSave').onclick=()=>{
    const exported=document.createElement('canvas');exported.width=canvas.width;exported.height=canvas.height;
    const output=exported.getContext('2d');output.fillStyle='#ffffff';output.fillRect(0,0,exported.width,exported.height);
    if(find('turnGuidesToggle').checked) output.drawImage(panel.querySelector('.turn-guides'),0,0,canvas.width,canvas.height);
    layers.forEach(layer=>{if(layer.visible){output.globalAlpha=layer.opacity/100;output.drawImage(layer.canvas,0,0);}});
    output.globalAlpha=1;
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
  window.addEventListener('studio-drawings-clear', clearPalette);
  renderList();
})();
