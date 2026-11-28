'use strict';
(() => {
  createStudio({ hostId: 'steps2', prefix: 'motion', filename: '캐릭터_작품시트.png', sheet: true,
    stageNames: ['2번 · 동작 스케치', '3번 · 선화·채색', '4번 · 작품 시트 정리', '5번 · 확인·저장'],
    nextNames: ['3번에서 이어서 작업', '4번에서 시트 정리', '5번에서 완성 확인'],
    stages: [
      {step:2, label:'동작 스케치 시트 열기', title:'응용동작 스케치 시트', help:'기본형 칸과 응용동작 3칸에 캐릭터를 그려 보세요. 동작선부터 시작하고 서로 다른 자세를 표현하세요.'},
      {step:3, label:'동작 선화·채색 시트 열기', title:'응용동작 선화·채색 시트', help:'2번에서 그린 스케치 위에 선과 색을 더하세요. 단일 레이어 시트이므로 레이어 작업은 드로잉 앱을 사용하세요.'},
      {step:4, label:'작품 시트 정리하기', title:'기본형·응용동작 작품 시트', help:'3번까지 작업한 그림을 이어서 정리하세요. 기본형 1개와 서로 다른 응용동작 3개를 확인하고 각 칸에 동작 이름을 적어 보세요.'},
      {step:5, label:'작품 시트 확인·저장하기', title:'작품 시트 확인·PNG 저장', help:'4번에서 정리한 시트를 확인하고 PNG로 저장하세요. 저장한 PNG는 작품 제출에서 동작 시트 파일로 선택할 수 있어요.'}
    ] });
  function createStudio(config) {
  const stages = config.stages;
  let opener = null, currentStage = -1;
  const stageStates = stages.map(() => ({ image: null, history: [], revision: 0, savedRevision: 0 }));
  let undoSequence = 0;
  const stageButtons = [];
  const panel = document.createElement('dialog');
  panel.className = 'drawing-dialog';
  panel.setAttribute('aria-labelledby', config.prefix + 'Title');
  panel.innerHTML = `<div class="drawing-heading"><div><h2 id="drawingTitle">기본형 스케치 캔버스</h2><p id="drawingInstructions">원과 선으로 나만의 캐릭터를 그려 보세요.</p></div><button type="button" class="button secondary" id="drawingClose">닫기</button></div>
    <nav class="drawing-stages" aria-label="기본형 실습 단계"><button type="button" class="button secondary" id="drawingPrevious">3번으로 돌아가기</button><strong id="drawingStage" aria-live="polite">3번 · 스케치</strong><button type="button" class="button primary" id="drawingNext">4번에서 이어서 작업</button></nav>
    <div class="drawing-tools" role="toolbar" aria-label="그리기 도구">
      <button type="button" class="button secondary" id="drawingPen" aria-pressed="true">펜</button>
      <button type="button" class="button secondary" id="drawingEraser" aria-pressed="false">지우개</button>
      <label>색상 <input id="drawingColor" type="color" value="#252833"></label>
      <label>굵기 <input id="drawingSize" type="range" min="1" max="48" value="6"><output id="drawingSizeValue">6</output></label>
      <button type="button" class="button secondary" id="drawingUndo">실행 취소</button>
      <button type="button" class="button secondary" id="drawingClear">모두 지우기</button>
      <button type="button" class="button secondary" id="drawingImportPrevious">이전 단계 수정본 가져오기</button>
      <button type="button" class="button primary" id="drawingSave">PNG 저장</button>
    </div><div class="drawing-surface"><canvas id="drawingCanvas" width="1200" height="900" aria-label="마우스, 터치 또는 펜으로 그리는 스케치 영역">이 브라우저에서는 캔버스를 사용할 수 없습니다.</canvas></div>
    <p class="drawing-help" id="drawingStatus" role="status">마우스·터치·태블릿 펜으로 그릴 수 있어요. 닫아도 그림은 유지되지만, 새로고침 전에 PNG로 저장하세요.</p>`;
  panel.innerHTML = panel.innerHTML.replaceAll('id="drawing', 'id="' + config.prefix);
  panel.querySelector('.drawing-stages').setAttribute('aria-label', config.sheet ? '응용동작 실습 단계' : '기본형 실습 단계');
  document.body.append(panel);
  const find = id => panel.querySelector('#' + id.replace(/^drawing/, config.prefix));
  const canvas = find('drawingCanvas');
  const ctx = canvas.getContext('2d');
  // The worksheet guide is separate from the drawing, so erasing and undo never remove it.
  const guide = document.createElement('canvas');
  guide.width = canvas.width; guide.height = canvas.height;
  const paper = guide.getContext('2d');
  paper.fillStyle = '#ffffff'; paper.fillRect(0, 0, guide.width, guide.height);
  if (config.sheet) {
    paper.fillStyle = '#34314d'; paper.font = 'bold 28px sans-serif';
    paper.fillText('MY CHARACTER SHEET', 40, 48);
    paper.font = '18px sans-serif';
    paper.fillText('캐릭터 이름: ____________________', 40, 82);
    ['기본형', '응용동작 1:', '응용동작 2:', '응용동작 3:'].forEach((label, index) => {
      const x = 40 + (index % 2) * 580, y = 110 + Math.floor(index / 2) * 390;
      paper.strokeStyle = '#d6d0e5'; paper.lineWidth = 2;
      paper.strokeRect(x, y, 540, 360);
      paper.fillText(label, x + 18, y + 30);
    });
    const surface = panel.querySelector('.drawing-surface');
    surface.style.backgroundImage = `url("${guide.toDataURL()}")`;
    surface.style.backgroundSize = '100% 100%';
    canvas.setAttribute('aria-label', '기본형과 응용동작 3개를 그리는 4칸 작품 시트');
  }
  let erasing = false, active = null, last = null;
  const current = () => stageStates[currentStage];
  const changed = () => { current().revision++; };
  const status = message => { find('drawingStatus').textContent = message; };
  function controls() { find('drawingUndo').disabled = !current()?.history.length; }
  function checkpoint() {
    current().history.push({ image: ctx.getImageData(0, 0, canvas.width, canvas.height), order: undoSequence++ });
    // Share the existing memory budget across stages, keeping each stage's undo independent.
    if (stageStates.reduce((sum, state) => sum + state.history.length, 0) > 12) {
      const oldest = stageStates.filter(state => state.history.length)
        .sort((a, b) => a.history[0].order - b.history[0].order)[0];
      oldest.history.shift();
    }
    controls();
  }
  function rememberStage() {
    if (currentStage >= 0) current().image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  function initializeStage(index) {
    const state = stageStates[index];
    if (state.image) return;
    const previous = stageStates.slice(0, index).reverse().find(item => item.image);
    if (previous) {
      state.image = new ImageData(new Uint8ClampedArray(previous.image.data), canvas.width, canvas.height);
      state.revision = previous.revision > 0 ? 1 : 0;
    } else state.image = ctx.createImageData(canvas.width, canvas.height);
  }
  function point(event) {
    const r = canvas.getBoundingClientRect();
    return {x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height};
  }
  function paint(from, to) {
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = find('drawingColor').value;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Number(find('drawingSize').value);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      ctx.arc(to.x,to.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();
    } else {ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
    changed();
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
    erasing=value;find('drawingPen').setAttribute('aria-pressed',String(!value));
    find('drawingEraser').setAttribute('aria-pressed',String(value));
  }
  find('drawingPen').onclick=()=>tool(false);
  find('drawingEraser').onclick=()=>tool(true);
  find('drawingColor').oninput=()=>tool(false);
  find('drawingSize').oninput=event=>{find('drawingSizeValue').value=event.target.value;};
  find('drawingUndo').onclick=()=>{
    if(!current()?.history.length)return;
    ctx.putImageData(current().history.pop().image,0,0);changed();controls();status('이 단계의 마지막 작업을 취소했어요.');
  };
  find('drawingClear').onclick=()=>{
    if(!confirm('캔버스의 그림을 모두 지울까요? 실행 취소로 복구할 수 있어요.'))return;
    checkpoint();ctx.clearRect(0,0,canvas.width,canvas.height);changed();status('이 단계의 캔버스를 비웠어요. 실행 취소로 복구할 수 있어요.');
  };
  find('drawingImportPrevious').onclick = () => {
    if (currentStage <= 0) return;
    if (!confirm(`${stages[currentStage - 1].step}번의 최신 그림으로 현재 ${stages[currentStage].step}번 그림을 바꿀까요? 현재 단계에서 추가한 그림은 대체되며 실행 취소로 복구할 수 있어요. 다른 단계는 바뀌지 않아요.`)) return;
    initializeStage(currentStage - 1);
    checkpoint();
    ctx.putImageData(stageStates[currentStage - 1].image, 0, 0);
    changed();
    status('이전 단계의 수정본을 가져왔어요. 다른 단계의 그림은 그대로예요.');
  };
  find('drawingSave').onclick=()=>{
    const exportedState = current(), exportedRevision = exportedState.revision;
    const exportedStep = stages[currentStage].step;
    const exported=document.createElement('canvas');exported.width=canvas.width;exported.height=canvas.height;
    const output=exported.getContext('2d');output.drawImage(guide,0,0);output.drawImage(canvas,0,0);
    exported.toBlob(blob=>{
      if(!blob){status('이미지 저장에 실패했어요. 다시 시도해 주세요.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=config.filename.replace('.png', `_${exportedStep}단계.png`);link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      exportedState.savedRevision=exportedRevision;status(`${exportedStep}번 그림의 PNG 다운로드를 요청했어요. 다운로드 폴더를 확인하세요.`);
    },'image/png');
  };
  function showStage(index) {
    rememberStage();
    active = null; last = null;
    initializeStage(index);
    currentStage = index;
    ctx.putImageData(current().image, 0, 0);
    controls();
    const stage = stages[index];
    opener = stageButtons[index];
    find('drawingTitle').textContent = stage.title;
    find('drawingInstructions').textContent = stage.help;
    find('drawingStage').textContent = config.stageNames[index];
    find('drawingPrevious').hidden = index === 0;
    find('drawingPrevious').textContent = `${stage.step - 1}번으로 돌아가기`;
    find('drawingNext').hidden = index === stages.length - 1;
    find('drawingNext').textContent = config.nextNames[index] || '';
    find('drawingImportPrevious').hidden = index === 0;
    status('그림은 단계별로 따로 보관돼요. 처음 여는 단계는 이전 그림을 복사하고, 다시 열면 이 단계의 작업을 보여 줘요. 이전 단계 수정은 ‘이전 단계 수정본 가져오기’로 반영하세요. 새로고침 전에는 필요한 단계를 각각 PNG로 저장하세요.');
    if (!panel.open) panel.showModal();
    document.body.classList.add('drawing-active');
  }
  find('drawingPrevious').onclick = () => {
    if (currentStage > 0) { showStage(currentStage - 1); find('drawingNext').focus(); }
  };
  find('drawingNext').onclick = () => {
    if (currentStage < stages.length - 1) {
      showStage(currentStage + 1);
      (currentStage === stages.length - 1 ? find('drawingSave') : find('drawingNext')).focus();
    }
  };
  stages.forEach((stage, index) => {
    const host = document.querySelector(`#${config.hostId} .step:nth-child(${stage.step}) > div`);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button primary canvas-open';
    button.textContent = stage.label;
    button.setAttribute('aria-haspopup', 'dialog');
    button.onclick = () => showStage(index);
    stageButtons.push(button);
    host.append(button);
  });
  find('drawingClose').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{rememberStage();active=null;document.body.classList.remove('drawing-active');opener?.focus();});
  window.addEventListener('beforeunload',event=>{if(stageStates.some(state => state.revision !== state.savedRevision)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('studio-drawings-clear', () => {
    stageStates.forEach((state, index) => { stageStates[index] = { image: null, history: [], revision: 0, savedRevision: 0 }; });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    active = null; last = null;
    if (currentStage >= 0) initializeStage(currentStage);
    controls();
  });
  controls();
  }
})();
