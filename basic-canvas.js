'use strict';
(() => {
  const open = document.getElementById('basicDrawingOpen');
  const panel = document.createElement('dialog');
  panel.className = 'drawing-dialog basic-dialog';
  panel.setAttribute('aria-labelledby', 'basicDrawingTitle');
  panel.innerHTML = `<div class="drawing-heading"><div><h2 id="basicDrawingTitle">기본형 그리기</h2><p>정면 캐릭터를 그리고, 스케치·선화·채색을 레이어로 나눠 수정해 보세요.</p></div><button type="button" class="button secondary" id="basicDrawingClose">닫기</button></div>
    <div class="drawing-tools" role="toolbar" aria-label="기본형 그리기 도구">
      <button type="button" class="button secondary" id="basicDrawingPen" aria-pressed="true">펜</button>
      <button type="button" class="button secondary" id="basicDrawingEraser" aria-pressed="false">지우개</button>
      <button type="button" class="button secondary" id="basicFill" aria-pressed="false">색 붓기</button>
      <label>색상 <input id="basicDrawingColor" type="color" value="#252833"></label>
      <label>굵기 <input id="basicDrawingSize" type="range" min="1" max="48" value="6"><output id="basicDrawingSizeValue">6</output></label>
      <button type="button" class="button secondary" id="basicDrawingUndo">전 단계로 되돌리기</button>
      <button type="button" class="button secondary" id="basicDrawingClear">현재 레이어 지우기</button>
      <button type="button" class="button primary" id="basicDrawingSave">PNG 저장</button>
    </div><section class="character-palette" aria-label="캐릭터 색상표"><strong>캐릭터 색상표</strong><button type="button" class="button secondary" id="basicPaletteAdd">현재 색 추가</button><button type="button" class="button secondary" id="basicPaletteRemove">현재 색 삭제</button><div id="basicPaletteColors"></div></section><section class="turn-layer-panel" aria-label="레이어 관리"><div class="turn-layer-heading"><strong>레이어</strong><span id="basicLayerCount">1 / 6</span><button type="button" class="button secondary" id="basicLayerAdd">+ 레이어 추가</button><button type="button" class="button secondary" id="basicLayerDelete">선택 레이어 삭제</button><button type="button" class="button secondary" id="basicLayerUp">한 층 위로</button><button type="button" class="button secondary" id="basicLayerDown">한 층 아래로</button></div><div id="basicLayerList" class="turn-layer-list" role="listbox" aria-label="기본형 그림 레이어"></div></section>
    <div class="drawing-surface basic-canvas-wrap"><canvas id="basicDrawingCanvas" width="1200" height="900" aria-label="마우스, 터치 또는 펜으로 기본형 캐릭터를 그리는 영역">이 브라우저에서는 캔버스를 사용할 수 없습니다.</canvas></div>
    <p class="drawing-help" id="basicDrawingStatus" role="status">레이어를 선택하고 마우스·터치·태블릿 펜으로 그리세요. 보이는 레이어가 합쳐져 PNG로 저장됩니다. 새로고침 전에 PNG로 저장하세요.</p>`;
  document.body.append(panel);
  const find = id => panel.querySelector('#' + id);
  const canvas = find('basicDrawingCanvas');
  const ctx = canvas.getContext('2d');
  const makeLayer = (name = `레이어 ${layers.length + 1}`) => {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
    return {name, visible: true, opacity: 100, canvas: layerCanvas, history: []};
  };
  const layers = [];
  layers.push(makeLayer('레이어 1'));
  let selected = 0, erasing = false, active = null, last = null, dirty = false;
  const activeLayer = () => layers[selected];
  const status = message => {find('basicDrawingStatus').textContent = message;};
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
    const list = find('basicLayerList'); list.replaceChildren();
    layers.forEach((layer, index) => {
      const row = document.createElement('div');
      row.className = 'turn-layer-row' + (index === selected ? ' is-selected' : '');
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === selected));
      const select = document.createElement('button'); select.type = 'button'; select.className = 'turn-layer-select';
      select.textContent = layer.name; select.setAttribute('aria-label', `${layer.name} 선택`);
      select.onclick = () => {selected = index; renderList();};
      const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'turn-layer-visibility';
      visibility.textContent = layer.visible ? '보임' : '숨김'; visibility.setAttribute('aria-pressed', String(layer.visible));
      visibility.setAttribute('aria-label', `${layer.name} ${layer.visible ? '숨기기' : '보이기'}`);
      visibility.onclick = () => {remember(); layer.visible = !layer.visible; renderLayers(); renderList(); dirty = true;};
      const opacityLabel = document.createElement('label'); opacityLabel.className = 'turn-layer-opacity'; opacityLabel.append('투명도 ');
      const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = '0'; opacity.max = '100'; opacity.step = '1';
      opacity.value = String(layer.opacity); opacity.setAttribute('aria-label', `${layer.name} 투명도`);
      const value = document.createElement('output'); value.value = `${layer.opacity}%`; value.textContent = `${layer.opacity}%`;
      let adjusting = false;
      opacity.onchange = () => { adjusting = false; };
      opacity.oninput = () => {if (!adjusting) { remember(); adjusting = true; find('basicDrawingUndo').disabled = false; } layer.opacity = Number(opacity.value); value.value = `${layer.opacity}%`; value.textContent = `${layer.opacity}%`; renderLayers(); dirty = true;};
      opacityLabel.append(opacity, value); row.append(select, visibility, opacityLabel); list.append(row);
    });
    find('basicDrawingUndo').disabled = !undoStack.length;
    find('basicLayerAdd').disabled = layers.length >= 6;
    find('basicLayerDelete').disabled = layers.length <= 1;
    find('basicLayerUp').disabled = selected === layers.length - 1;
    find('basicLayerDown').disabled = selected === 0;
    find('basicLayerCount').textContent = `${layers.length} / 6`;
  }
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
    renderList();
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
  }
  function paint(from, to) {
    const layerCtx = activeLayer().canvas.getContext('2d');
    layerCtx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    layerCtx.strokeStyle = find('basicDrawingColor').value; layerCtx.fillStyle = layerCtx.strokeStyle;
    layerCtx.lineWidth = Number(find('basicDrawingSize').value); layerCtx.lineCap = layerCtx.lineJoin = 'round'; layerCtx.beginPath();
    if (from.x === to.x && from.y === to.y) {layerCtx.arc(to.x,to.y,layerCtx.lineWidth/2,0,Math.PI*2);layerCtx.fill();}
    else {layerCtx.moveTo(from.x,from.y);layerCtx.lineTo(to.x,to.y);layerCtx.stroke();}
    renderLayers(); dirty = true;
  }
  canvas.addEventListener('pointerdown', event => {
    if (active !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (bucket) {
      event.preventDefault();
      if (!activeLayer().visible) { status('색을 부을 레이어를 먼저 표시하세요.'); return; }
      if (fillRegion(activeLayer().canvas, ctx, point(event), find('basicDrawingColor').value, checkpoint)) { renderLayers(); dirty = true; }
      return;
    }
    event.preventDefault(); checkpoint(); active = event.pointerId; canvas.setPointerCapture(active); last = point(event); paint(last, last);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== active) return;
    event.preventDefault(); const next = point(event); paint(last, next); last = next;
  });
  function finish(event) {if(event.pointerId === active) {active = null; last = null;}}
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type, finish));
  find('basicFill').onclick = () => {
    tool(false); bucket = true;
    find('basicFill').setAttribute('aria-pressed','true');
    find('basicDrawingPen').setAttribute('aria-pressed','false');
  };
  function tool(value) {
    bucket = false; find('basicFill').setAttribute('aria-pressed','false');

    erasing = value; find('basicDrawingPen').setAttribute('aria-pressed', String(!value));
    find('basicDrawingEraser').setAttribute('aria-pressed', String(value));
  }
  find('basicDrawingPen').onclick = () => tool(false);
  find('basicDrawingEraser').onclick = () => tool(true);
  const clearPalette = setupPalette(id => find('basicPalette' + id.slice(7)), find('basicDrawingColor'), () => { if (!bucket) tool(false); });
  find('basicDrawingSize').oninput = event => {find('basicDrawingSizeValue').value = event.target.value;};
  find('basicLayerAdd').onclick = () => {
    if (layers.length >= 6) return;
    remember();
    layers.push(makeLayer()); selected = layers.length - 1; renderLayers(); renderList(); dirty = true; status(`${activeLayer().name}을(를) 추가했어요.`);
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
  find('basicLayerUp').onclick = () => moveLayer(1);
  find('basicLayerDown').onclick = () => moveLayer(-1);
  find('basicLayerDelete').onclick = () => {
    if (layers.length <= 1) return;
    remember();
    const removed = activeLayer().name; layers.splice(selected, 1); selected = Math.max(0, selected - 1);
    renderLayers(); renderList(); dirty = true; status(`${removed}을(를) 삭제했어요.`);
  };
  find('basicDrawingUndo').onclick = () => {
    if (active !== null || !undoStack.length) return;
    undoStack.pop()(); renderLayers(); renderList(); dirty = true; status('이전 작업 상태로 되돌렸어요.');
  };
  find('basicDrawingClear').onclick = () => {
    if (!confirm(`${activeLayer().name}의 그림을 모두 지울까요? 실행 취소로 복구할 수 있어요.`)) return;
    checkpoint(); activeLayer().canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    renderLayers(); dirty = true; status(`${activeLayer().name}을(를) 비웠어요. 실행 취소로 복구할 수 있어요.`);
  };
  find('basicDrawingSave').onclick = () => {
    const exported = document.createElement('canvas'); exported.width = canvas.width; exported.height = canvas.height;
    const output = exported.getContext('2d'); output.fillStyle = '#ffffff'; output.fillRect(0, 0, canvas.width, canvas.height);
    layers.forEach(layer => {if(layer.visible) {output.globalAlpha = layer.opacity / 100; output.drawImage(layer.canvas, 0, 0);}});
    output.globalAlpha = 1;
    exported.toBlob(blob => {
      if (!blob) {status('이미지 저장에 실패했어요. 다시 시도해 주세요.'); return;}
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = '캐릭터_기본형.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      dirty = false; status('보이는 레이어를 합쳐 PNG로 저장했어요.');
    }, 'image/png');
  };
  open.onclick = () => {panel.showModal(); document.body.classList.add('drawing-active');};
  find('basicDrawingClose').onclick = () => panel.close();
  panel.addEventListener('close', () => {active = null; document.body.classList.remove('drawing-active'); open.focus();});
  window.addEventListener('beforeunload', event => {if(dirty) {event.preventDefault(); event.returnValue = '';}});
  window.addEventListener('studio-drawings-clear', () => {
    undoStack.length = 0;
    clearPalette();
    layers.splice(0, layers.length, makeLayer('레이어 1')); selected = 0; active = null; last = null; dirty = false;
    renderLayers(); renderList();
  });
  renderList();
})();
