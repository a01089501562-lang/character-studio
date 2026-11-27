'use strict';
(() => {
  const basicStages = [
    {step:3, label:'스케치 캔버스 열기', title:'기본형 스케치 캔버스', help:'원과 선으로 나만의 캐릭터를 그려 보세요.'},
    {step:4, label:'선화·채색 캔버스 열기', title:'기본형 선화·채색 캔버스', help:'3번에서 그린 그림을 이어서 다듬고 색을 더해 보세요. 이 캔버스는 단일 레이어이므로, 레이어를 나누려면 드로잉 앱을 사용하세요.'},
    {step:5, label:'완성 확인·저장 캔버스 열기', title:'기본형 완성 확인·저장 캔버스', help:'완성한 기본형을 확인하고 PNG로 저장하세요. 레이어가 있는 편집 원본은 사용 중인 드로잉 앱에서 별도로 저장하세요.'}
  ];
  createStudio({ stages: basicStages, hostId: 'steps1', prefix: 'drawing', filename: '캐릭터_기본형.png',
    stageNames: ['3번 · 스케치', '4번 · 선화·채색', '5번 · 완성 확인·저장'],
    nextNames: ['4번에서 이어서 작업', '5번에서 완성 확인'] });
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
  let opener = null, currentStage = 0;
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
  const history = [];
  let erasing = false, active = null, last = null, dirty = false;
  const status = message => { find('drawingStatus').textContent = message; };
  function controls() { find('drawingUndo').disabled = history.length === 0; }
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
    ctx.strokeStyle = find('drawingColor').value;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Number(find('drawingSize').value);
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
    erasing=value;find('drawingPen').setAttribute('aria-pressed',String(!value));
    find('drawingEraser').setAttribute('aria-pressed',String(value));
  }
  find('drawingPen').onclick=()=>tool(false);
  find('drawingEraser').onclick=()=>tool(true);
  find('drawingColor').oninput=()=>tool(false);
  find('drawingSize').oninput=event=>{find('drawingSizeValue').value=event.target.value;};
  find('drawingUndo').onclick=()=>{
    if(!history.length)return;
    ctx.putImageData(history.pop(),0,0);dirty=true;controls();status('마지막 작업을 취소했어요.');
  };
  find('drawingClear').onclick=()=>{
    if(!confirm('캔버스의 그림을 모두 지울까요? 실행 취소로 복구할 수 있어요.'))return;
    checkpoint();ctx.clearRect(0,0,canvas.width,canvas.height);dirty=true;status('캔버스를 비웠어요. 실행 취소로 복구할 수 있어요.');
  };
  find('drawingSave').onclick=()=>{
    const exported=document.createElement('canvas');exported.width=canvas.width;exported.height=canvas.height;
    const output=exported.getContext('2d');output.drawImage(guide,0,0);output.drawImage(canvas,0,0);
    exported.toBlob(blob=>{
      if(!blob){status('이미지 저장에 실패했어요. 다시 시도해 주세요.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=config.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      dirty=false;status('PNG 다운로드를 요청했어요. 다운로드 폴더를 확인하세요.');
    },'image/png');
  };
  function showStage(index) {
    currentStage = index;
    const stage = stages[index];
    opener = stageButtons[index];
    find('drawingTitle').textContent = stage.title;
    find('drawingInstructions').textContent = stage.help;
    find('drawingStage').textContent = config.stageNames[index];
    find('drawingPrevious').hidden = index === 0;
    find('drawingPrevious').textContent = `${stage.step - 1}번으로 돌아가기`;
    find('drawingNext').hidden = index === stages.length - 1;
    find('drawingNext').textContent = config.nextNames[index] || '';
    status(stages.map(item => item.step).join('·') + '번은 같은 그림을 이어서 사용해요. 단계 이동과 창 닫기로 그림은 지워지지 않아요. 새로고침 전에는 PNG로 저장하세요.');
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
  panel.addEventListener('close',()=>{active=null;document.body.classList.remove('drawing-active');opener?.focus();});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  controls();
  }
})();
