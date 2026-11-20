'use strict';
const lessons = [
  [
    ['목표와 예시 살펴보기',5,'기본형과 응용동작 예시를 비교하세요. 얼굴 표정뿐 아니라 팔·다리와 몸통이 어떻게 달라지는지 찾아보세요.','오늘의 결과물 4개를 설명할 수 있어요.'],
    ['캐릭터의 성격과 특징 정하기',8,'오른쪽 기획 노트에 이름, 성격, 유지할 특징 3가지를 적으세요. 좋아하는 물건이나 취미에서 개성을 찾아도 좋아요.','캐릭터 설정과 특징 3가지를 정했어요.'],
    ['도형으로 기본형 스케치하기',12,'새 캔버스에 스케치 레이어를 만드세요. 머리 원, 몸통 사각형, 팔다리 선으로 2~3등신 정면형을 잡고 실루엣을 다듬으세요.','정면 기본형의 비례와 실루엣을 잡았어요.'],
    ['선화와 기본색 완성하기',20,'스케치 불투명도를 낮추고 새 레이어에 선을 정리하세요. 선화 아래 채색 레이어를 만들어 3~5색으로 칠하세요. 복잡한 명암은 생략해도 좋아요.','기본형 선화와 기본색을 완성했어요.'],
    ['레이어 정리하고 원본 저장하기',5,'레이어에 스케치·선화·채색 이름을 붙이고 편집 가능한 앱 원본으로 저장하세요. 전체 화면에서 캐릭터의 특징을 다시 확인하세요.','편집 가능한 기본형 원본을 저장했어요.']
  ],
  [
    ['동작선과 무게중심 관찰하기',5,'갤러리의 구조 가이드를 켜세요. 몸을 관통하는 동작선, 어깨·골반의 기울기, 몸의 무게를 받는 발을 비교하세요.','예시에서 동작이 달라지는 이유를 찾았어요.'],
    ['서로 다른 동작 3개 스케치하기',8,'인사·달리기·점프 또는 자신이 선택한 동작 3개를 작은 크기로 그리세요. 먼저 동작선, 다음 몸통과 관절, 마지막 머리와 손발 순서로 잡으세요.','신체 자세가 다른 스케치 3개를 그렸어요.'],
    ['캐릭터 특징을 유지하며 완성하기',27,'동작마다 약 9분씩 사용하세요. 새 레이어에 선화와 기본색을 정리하고 머리 비례·헤어스타일·의상·대표색이 기본형과 같은지 비교하세요.','응용동작 3종의 선화와 채색을 완성했어요.'],
    ['한 장의 작품 시트로 정리하기',5,'기본형 1개와 응용동작 3개 이상을 4칸 구도에 배치하세요. 캐릭터 이름과 각 동작의 이름을 적고 잘리거나 겹친 부분이 없는지 확인하세요.','기본형과 응용동작을 한 장에 모았어요.'],
    ['자기점검하고 PNG로 내보내기',5,'아래 자기점검을 완료하고 작품 시트를 PNG로 내보내세요. 파일을 다시 열어 화질을 확인하고 원본도 별도로 보관하세요.','최종 PNG와 편집 원본을 보관했어요.']
  ]
];
const artworks = [
  {id:'base',title:'기본형 · 정면',tag:'01 / BASIC',description:'머리 비례와 실루엣의 기준입니다. 둥근 단발, 머리핀, 재킷의 모양을 기억하세요.'},
  {id:'wave',title:'인사하기',tag:'02 / WAVE',description:'한 팔을 들어 손을 펴고, 몸을 살짝 기울여요. 반대쪽 다리가 무게를 받습니다.'},
  {id:'run',title:'달리기',tag:'03 / RUN',description:'몸통을 앞으로 기울이고, 팔과 다리를 반대 방향으로 움직여 달리는 힘을 표현해요.'},
  {id:'jump',title:'점프하기',tag:'04 / JUMP',description:'두 팔을 벌리고 양발을 땅에서 떼어요. 무릎을 굽혀 떠오르는 순간을 표현합니다.'}
];
let state = {checks:{},notes:{}};
const storageKey='character-studio-v1';
try { const saved=JSON.parse(localStorage.getItem(storageKey)); if(saved && typeof saved.checks==='object' && saved.checks && typeof saved.notes==='object' && saved.notes) state=saved; } catch {}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));document.querySelector('#saveStatus').textContent='이 브라우저에 저장했어요. 선생님께 전송되지는 않습니다.';}catch{document.querySelector('#saveStatus').textContent='브라우저 저장을 사용할 수 없어요. 기획 노트를 별도로 기록하세요.';}}
function checkMarkup(id,label){return `<label class="check"><input type="checkbox" data-check="${id}"><span>${label}</span></label>`;}
lessons.forEach((steps,n)=>{document.querySelector(`#steps${n+1}`).innerHTML=steps.map((s,i)=>`<article class="step"><span class="step-number">${String(i+1).padStart(2,'0')}</span><div><div class="step-top"><h3>${s[0]}</h3><span class="time">${s[1]} MIN</span></div><p>${s[2]}</p>${checkMarkup(`lesson${n+1}-${i}`,s[3])}</div></article>`).join('');});
document.querySelector('#artCards').innerHTML=artworks.map(a=>`<article class="art-card"><button class="art-image" data-art="${a.id}" aria-label="${a.title} 예시 확대"><img src="assets/${a.id}.svg" alt="루미 ${a.title} 예시"><span class="zoom">확대 ↗</span></button><div class="art-body"><span class="mini-label">${a.tag}</span><h3>${a.title}</h3><p>${a.description}</p></div></article>`).join('');
const selfChecks=['모든 동작에서 캐릭터의 특징과 비례가 유지돼요.','신체 자세가 서로 다른 응용동작이 3개 이상이에요.','표정 없이도 어떤 행동인지 읽을 수 있어요.','선과 색을 정리하고 잘리거나 겹친 부분을 확인했어요.','작품 시트 PNG와 편집 가능한 원본을 저장했어요.'];
document.querySelector('#selfChecks').innerHTML=selfChecks.map((s,i)=>checkMarkup(`self-${i}`,s)).join('');
function updateProgress(){const all=[...document.querySelectorAll('[data-check]')];const count=all.filter(el=>el.checked).length;document.querySelector('#progress').max=all.length;document.querySelector('#progress').value=count;document.querySelector('#progress').textContent=`${Math.round(count/all.length*100)}%`;document.querySelector('#progressText').textContent=`${count} / ${all.length}`;}
document.querySelectorAll('[data-check]').forEach(el=>{el.checked=state.checks[el.dataset.check]===true;el.addEventListener('change',()=>{state.checks[el.dataset.check]=el.checked;persist();updateProgress();});});
['characterName','personality','features'].forEach(id=>{const el=document.getElementById(id);el.value=typeof state.notes[id]==='string'?state.notes[id]:'';el.addEventListener('input',()=>{state.notes[id]=el.value;persist();});});
updateProgress();
const guideToggle=document.querySelector('#guideToggle');
const dialog=document.querySelector('#artDialog');
function assetFor(id){return `assets/${id}${guideToggle.checked?'-guide':''}.svg`;}
guideToggle.addEventListener('change',()=>{document.querySelectorAll('[data-art]').forEach(btn=>{btn.querySelector('img').src=assetFor(btn.dataset.art);});});
document.querySelectorAll('[data-art]').forEach(btn=>btn.addEventListener('click',()=>{const a=artworks.find(a=>a.id===btn.dataset.art);document.querySelector('#dialogTitle').textContent=a.title;document.querySelector('#dialogImage').src=assetFor(a.id);document.querySelector('#dialogImage').alt=`루미 ${a.title}${guideToggle.checked?' 구조 가이드':''}`;document.querySelector('#dialogDescription').textContent=a.description;dialog.showModal();}));
document.querySelector('#closeDialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelector('#printButton').addEventListener('click',()=>window.print());
document.querySelector('#resetButton').addEventListener('click',()=>{if(!confirm('이 기기에 저장된 기획 메모와 체크리스트를 초기화할까요?'))return;state={checks:{},notes:{}};document.querySelectorAll('[data-check]').forEach(el=>el.checked=false);document.querySelectorAll('.notebook input,.notebook textarea').forEach(el=>el.value='');persist();updateProgress();});
const config=window.STUDIO_CONFIG||{};let url;try{url=new URL(config.submissionUrl);if(!['https:','mailto:'].includes(url.protocol))url=null;}catch{url=null;}
const submissionArea=document.querySelector('#submissionArea');
if(url){const link=document.createElement('a');link.href=url.href;if(url.protocol==='https:'){link.target='_blank';link.rel='noopener noreferrer';}link.className='button primary';link.textContent=config.submissionLabel||'작품 제출하기';const note=document.createElement('p');note.textContent=config.submissionNote||'외부 제출처의 안내에 따라 제출하세요.';submissionArea.append(link,note);}else{submissionArea.innerHTML='<div class="submission-wait"><strong>제출처 준비 중</strong>작품을 저장하고 선생님의 안내를 기다리세요.</div>';}
