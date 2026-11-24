import {lessons,artworks,selfChecks} from './lesson-data.js';
'use strict';
let state = {checks:{},notes:{}};
const storageKey='character-studio-v1';
try { const saved=JSON.parse(localStorage.getItem(storageKey)); if(saved && typeof saved.checks==='object' && saved.checks && typeof saved.notes==='object' && saved.notes) state=saved; } catch {}
function persist(){if(window.STUDIO_ONLINE_ACTIVE){window.dispatchEvent(new Event("studio-change"));return;}try{localStorage.setItem(storageKey,JSON.stringify(state));document.querySelector('#saveStatus').textContent='이 브라우저에 저장했어요. 선생님께 전송되지는 않습니다.';}catch{document.querySelector('#saveStatus').textContent='브라우저 저장을 사용할 수 없어요. 기획 노트를 별도로 기록하세요.';}}
function checkMarkup(id,label){return `<label class="check"><input type="checkbox" data-check="${id}"><span>${label}</span></label>`;}
lessons.forEach((steps,n)=>{document.querySelector(`#steps${n+1}`).innerHTML=steps.map((s,i)=>`<article class="step"><span class="step-number">${String(i+1).padStart(2,'0')}</span><div><div class="step-top"><h3>${s[0]}</h3><span class="time">${s[1]} MIN</span></div><p>${s[2]}</p>${checkMarkup(`lesson${n+1}-${i}`,s[3])}</div></article>`).join('');});
document.querySelector('#artCards').innerHTML=artworks.map(a=>`<article class="art-card"><button class="art-image" data-art="${a.id}" aria-label="${a.title} 예시 확대"><img src="assets/${a.id}.svg" alt="루미 ${a.title} 예시"><span class="zoom">확대 ↗</span></button><div class="art-body"><span class="mini-label">${a.tag}</span><h3>${a.title}</h3><p>${a.description}</p></div></article>`).join('');

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

window.STUDIO_STATE={get:()=>JSON.parse(JSON.stringify(state)),set:(value)=>{state=value;document.querySelectorAll("[data-check]").forEach(el=>el.checked=state.checks[el.dataset.check]===true);["characterName","personality","features"].forEach(id=>document.getElementById(id).value=state.notes[id]||"");updateProgress();}};
