'use strict';
// One motion preference is shared by reveals, dialogs and interaction feedback.
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const motionJobs=new WeakMap();
const dialogClosings=new WeakMap();
function animateElement(element,frames,options={}){
 if(!element||motionPreference.matches||!element.animate)return null;
 motionJobs.get(element)?.cancel();
 const animation=element.animate(frames,{duration:360,easing:'cubic-bezier(.22,1,.36,1)',...options});
 motionJobs.set(element,animation);
 animation.finished.catch(()=>{}).then(()=>{if(motionJobs.get(element)===animation)motionJobs.delete(element);});
 return animation;
}
function setBackdrop(open){
 if(!backdrop)return;
 motionJobs.get(backdrop)?.cancel();
 if(open){backdrop.hidden=false;animateElement(backdrop,[{opacity:0},{opacity:1}],{duration:280});}
 else if(!backdrop.hidden){const animation=animateElement(backdrop,[{opacity:1},{opacity:0}],{duration:200});
  if(animation)animation.finished.then(()=>{if(!sidebar.classList.contains('open'))backdrop.hidden=true;}).catch(()=>{});
  else backdrop.hidden=true;
 }
}
function openDialog(dialog){
 dialogClosings.get(dialog)?.cancel();dialogClosings.delete(dialog);delete dialog.dataset.closing;
 if(!dialog.open)dialog.showModal();
}
function closeDialog(dialog){
 if(!dialog.open||dialogClosings.has(dialog))return;
 if(motionPreference.matches||!dialog.animate){dialog.close();return;}
 dialog.dataset.closing='true';
 const animation=dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(10px) scale(.98)'}],{duration:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
 dialogClosings.set(dialog,animation);
 animation.finished.catch(()=>{}).then(()=>{if(dialogClosings.get(dialog)!==animation)return;dialog.close();delete dialog.dataset.closing;dialogClosings.delete(dialog);animation.cancel();});
}
const menu=document.querySelector('.menu-button');
const sidebar=document.querySelector('.sidebar');
const backdrop=document.querySelector('.menu-backdrop');
const mobile=matchMedia('(max-width:1023px)');
function setMenu(open){sidebar.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));setBackdrop(open);document.body.classList.toggle('menu-open',open&&mobile.matches);sidebar.inert=mobile.matches&&!open;}
menu.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
if(backdrop)backdrop.addEventListener('click',()=>setMenu(false));
mobile.addEventListener('change',()=>setMenu(false));
setMenu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('open')){setMenu(false);menu.focus();}});
let toastTimer;
function announce(message){const toast=document.querySelector('.toast');toast.textContent=message;toast.classList.add('visible');animateElement(toast,[{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:260});clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2200);}
async function copy(text){if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return;}const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('copy failed');}
const copyIcon='<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="6" y="6" width="9" height="9" rx="2"/><path d="M11 3H5a2 2 0 0 0-2 2v6"/></svg>';
document.querySelectorAll('.code-toolbar').forEach(box=>{const button=box.querySelector('.toolbar button');const code=box.querySelector('pre code');const toolbar=box.querySelector('.toolbar');if(!button||!code||!toolbar)return;const label=document.createElement('span');label.className='code-label';label.textContent='>_  Код';toolbar.prepend(label);button.innerHTML=copyIcon+'<span>Копировать</span>';button.type='button';button.setAttribute('aria-label','Копировать команду');button.addEventListener('click',async()=>{try{await copy(code.textContent);button.querySelector('span').textContent='Скопировано';announce('Команда скопирована');setTimeout(()=>button.querySelector('span').textContent='Копировать',1800);}catch{announce('Не удалось скопировать. Выделите команду вручную.');}});});
const tocLinks=[...document.querySelectorAll('.toc nav a')];
const headings=[...document.querySelectorAll('.contents h1[id],.contents h2[id],.contents h3[id]')];
let scheduled=false;
function updateReading(){scheduled=false;const range=document.documentElement.scrollHeight-innerHeight;const progress=document.querySelector('.reading-progress span');if(progress)progress.style.width=(range>0?Math.min(100,scrollY/range*100):0)+'%';let active=headings[0];for(const h of headings){if(h.getBoundingClientRect().top<=150)active=h;else break;}tocLinks.forEach(a=>{const match=active&&decodeURIComponent(a.hash.slice(1))===active.id;a.classList.toggle('active',!!match);if(match)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateReading);}},{passive:true});addEventListener('resize',updateReading);addEventListener('load',updateReading);updateReading();
const imageDialog=document.querySelector('.image-dialog');
if(imageDialog){const preview=imageDialog.querySelector('img');const close=imageDialog.querySelector('.image-close');document.querySelectorAll('.contents img').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Увеличить изображение: '+(img.alt||'Иллюстрация'));function show(){preview.src=img.src;preview.alt=img.alt;openDialog(imageDialog);}img.addEventListener('click',show);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});});close.addEventListener('click',()=>closeDialog(imageDialog));imageDialog.addEventListener('click',e=>{if(e.target===imageDialog){const r=imageDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(imageDialog);}});}

// The course manifest keeps navigation and progress ready for additional modules.
const siteScript=new URL(document.querySelector('script[src*="assets/site.js"]').src);
const siteRoot=new URL('../',siteScript);
const dataUrl=path=>{const url=new URL(path,siteRoot);url.search=siteScript.search;return url;};
const stateKey='pgk-reading-v1';
function readState(){try{const value=JSON.parse(localStorage.getItem(stateKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
let state=readState();
function writeState(){try{localStorage.setItem(stateKey,JSON.stringify(state));return true;}catch{announce('Браузер не разрешает сохранение. Прогресс доступен до закрытия страницы.');return false;}}
function validPosition(p){return p&&typeof p==='object'&&typeof p.id==='string'&&typeof p.path==='string'&&p.path.startsWith('demo-2026/')&&!p.path.includes('..')&&!p.path.includes('://')&&typeof p.title==='string'&&Number.isFinite(p.y);}
const pageId=document.body.dataset.pageId;
let course;
const courseReady=fetch(dataUrl('assets/course-data.json')).then(r=>{if(!r.ok)throw new Error('course');return r.json();}).then(data=>{course=data;refreshProgress();return data;}).catch(()=>null);
function completed(){return Array.isArray(state.completed)?state.completed.filter(x=>typeof x==='string'):[];}
function refreshProgress(){
 const done=completed();
 document.querySelectorAll('[data-task-id]').forEach(card=>{const yes=done.includes(card.dataset.taskId);card.classList.toggle('is-complete',yes);const label=card.querySelector('.card-status');if(label)label.textContent=yes?'✓ Выполнено':'К изучению';});
 if(course){
  const lessons=course.modules.flatMap(module=>module.lessons);
  document.querySelectorAll('.course-progress').forEach(panel=>{const module=course.modules.find(x=>x.id===panel.dataset.moduleId)||course.modules[0];const ids=module.lessons.map(x=>x.id);const count=done.filter(x=>ids.includes(x)).length;panel.querySelector('.completed-count').textContent=count+' из '+ids.length+' выполнено';const bar=panel.querySelector('.completion-progress');bar.max=ids.length;bar.value=count;});
  document.querySelectorAll('.sidebar nav a').forEach(a=>{const lesson=lessons.find(x=>new URL(x.path,siteRoot).pathname===new URL(a.href).pathname);a.classList.toggle('is-complete',!!lesson&&done.includes(lesson.id));});
 }
 const checkbox=document.querySelector('.task-complete');if(checkbox)checkbox.checked=done.includes(pageId);
}
const completion=document.querySelector('.task-complete');
if(completion)completion.addEventListener('change',()=>{state=Object.assign(readState(),state);const done=new Set(completed());if(completion.checked)done.add(pageId);else done.delete(pageId);state.completed=[...done];writeState();refreshProgress();animateElement(completion.closest('.task-state'),[{boxShadow:'0 0 0 0 #743ce635'},{boxShadow:'0 0 0 9px #743ce600'},{boxShadow:'0 0 0 0 #743ce600'}],{duration:600});announce(completion.checked?'Задание отмечено выполненным':'Отметка выполнения снята');});
refreshProgress();
const themeButton=document.querySelector('.theme-toggle');
let themeTimer;
function renderTheme(){const dark=document.documentElement.dataset.theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Включить светлую тему':'Включить тёмную тему');
 themeButton.title=themeButton.getAttribute('aria-label');themeButton.querySelector('.theme-label').textContent=dark?'Светлая тема':'Тёмная тема';}
if(themeButton){renderTheme();themeButton.addEventListener('click',()=>{document.documentElement.classList.add('theme-changing');clearTimeout(themeTimer);themeTimer=setTimeout(()=>document.documentElement.classList.remove('theme-changing'),550);const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('pgk-theme',theme);}catch{}renderTheme();animateElement(themeButton.querySelector(theme==='dark'?'.theme-sun':'.theme-moon'),[{transform:'rotate(-40deg) scale(.7)',opacity:.2},{transform:'rotate(0) scale(1)',opacity:1}],{duration:480});});}

// Link buttons use existing heading IDs, keeping old bookmarks working.
headings.forEach(h=>{const title=h.textContent.replace('¶','').trim();const button=document.createElement('button');button.type='button';button.className='section-share';button.textContent='#';button.title='Копировать ссылку на раздел';button.setAttribute('aria-label','Копировать ссылку: '+title);button.addEventListener('click',async()=>{const url=new URL(location.href);url.search='';url.hash=h.id;try{await copy(url.href);announce('Ссылка на раздел скопирована');}catch{announce('Не удалось скопировать ссылку. Используйте содержание страницы.');}});h.append(button);});

// Save only intentional reading activity: showing a resume prompt must not erase it.
const previous=validPosition(state.last)?state.last:null;
const saved=state.positions&&typeof state.positions==='object'?state.positions[pageId]:null;
const resumeSlot=document.querySelector('.resume-slot');
const resume=pageId?(validPosition(saved)?saved:null):previous;
let canSave=false,saveTimer,restoring=false;
function headingName(h){const clone=h.cloneNode(true);clone.querySelectorAll('button,.toc-anchor').forEach(x=>x.remove());return clone.textContent.trim();}
function savePosition(){if(!pageId||!canSave||restoring)return;const visible=[...headings].reverse().find(h=>h.getBoundingClientRect().top<=160)||headings[0];const y=window.scrollY;const position={id:pageId,path:location.pathname.slice(siteRoot.pathname.length),title:document.body.dataset.pageTitle,anchor:visible?visible.id:'',section:visible?headingName(visible):'',offset:visible?y-(visible.getBoundingClientRect().top+y):0,y,updated:Date.now()};if(!validPosition(position))return;state.positions=state.positions&&typeof state.positions==='object'&&!Array.isArray(state.positions)?state.positions:{};state.positions[pageId]=position;state.last=position;writeState();}
function queueSave(){if(canSave&&!restoring){clearTimeout(saveTimer);saveTimer=setTimeout(savePosition,450);}}
if(resumeSlot&&resume&&!location.hash&&resume.y>250){
 const banner=document.createElement('section');banner.className='resume-banner';banner.setAttribute('aria-label','Продолжить чтение');const text=document.createElement('div');const title=document.createElement('strong');title.textContent=pageId?'Вернуться к месту чтения':'Продолжить подготовку';const description=document.createElement('p');description.textContent=resume.title+(resume.section?' · '+resume.section:'');text.append(title,description);
 const action=document.createElement(pageId?'button':'a');action.className='tool-button';action.textContent='Продолжить чтение';
 if(pageId){action.type='button';action.addEventListener('click',async()=>{restoring=true;await Promise.all([...document.querySelectorAll('.contents img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,1500);})));banner.remove();const target=document.getElementById(resume.anchor);const y=target?target.getBoundingClientRect().top+scrollY+(Number.isFinite(resume.offset)?resume.offset:-130):resume.y;window.scrollTo({top:Math.max(0,y),behavior:'instant'});banner.remove();canSave=true;restoring=false;queueSave();});}
 else{const destination=new URL(resume.path,siteRoot);destination.searchParams.set('resume','1');action.href=destination.href;}
 banner.append(text,action);resumeSlot.append(banner);if(pageId&&new URL(location.href).searchParams.get('resume')==='1'){action.click();const clean=new URL(location.href);clean.searchParams.delete('resume');history.replaceState(null,'',clean.href);}
}
for(const type of ['wheel','touchmove','keydown'])addEventListener(type,e=>{if(searchDialog?.open||imageDialog?.open||e.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(type==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))return;canSave=true;queueSave();},{passive:true});
addEventListener('scroll',queueSave,{passive:true});
document.querySelectorAll('.toc a,.mobile-toc a').forEach(a=>a.addEventListener('click',()=>{canSave=true;queueSave();}));
addEventListener('pagehide',savePosition);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePosition();});
addEventListener('storage',e=>{if(e.key===stateKey){state=readState();refreshProgress();}if(e.key==='pgk-theme'&&['dark','light'].includes(e.newValue)){document.documentElement.dataset.theme=e.newValue;renderTheme();}});

// Search includes full instruction text and commands, indexed by existing sections.
const searchDialog=document.querySelector('.search-dialog');
if(searchDialog){
 const input=searchDialog.querySelector('input');const results=searchDialog.querySelector('.search-results');const status=searchDialog.querySelector('.search-status');let searchData,searchRequest,searchTimer,revision=0;
 const normalize=s=>s.toLocaleLowerCase('ru').replace(/ё/g,'е');
 function getIndex(){if(!searchRequest)searchRequest=fetch(dataUrl('assets/search-index.json')).then(r=>{if(!r.ok)throw new Error('index');return r.json();}).then(data=>{searchData=data.map(x=>({...x,normalized:normalize(x.title+' '+x.section+' '+x.text),body:normalize(x.text)}));return searchData;}).catch(e=>{searchRequest=null;throw e;});return searchRequest;}
 function marked(text,tokens){const fragment=document.createDocumentFragment();const lower=normalize(text);let at=0;while(at<text.length){let start=text.length,term='';for(const token of tokens){const next=lower.indexOf(token,at);if(next>=0&&next<start){start=next;term=token;}}if(!term){fragment.append(document.createTextNode(text.slice(at)));break;}fragment.append(document.createTextNode(text.slice(at,start)));const mark=document.createElement('mark');mark.textContent=text.slice(start,start+term.length);fragment.append(mark);at=start+term.length;}return fragment;}
 async function runSearch(){const stamp=++revision;const query=input.value.trim();results.replaceChildren();const tokens=[...new Set(normalize(query).split(/\s+/).filter(Boolean))];if(!tokens.length){status.textContent='Введите текст для поиска.';return;}status.textContent='Ищем в заданиях и командах…';try{const data=await getIndex();if(stamp!==revision)return;const matches=data.filter(x=>tokens.every(t=>x.normalized.includes(t))).map(x=>({...x,score:tokens.reduce((n,t)=>n+(normalize(x.title).includes(t)?8:0)+(normalize(x.section).includes(t)?4:0)+(x.body.includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score);
 status.textContent=matches.length?'Найдено разделов: '+matches.length+(matches.length>30?'. Показаны первые 30.':''):'Ничего не найдено. Попробуйте другое слово или команду.';
 let resultIndex=0;for(const item of matches.slice(0,30)){const link=document.createElement('a');link.className='search-result';link.style.setProperty('--result-delay',Math.min(resultIndex++,6)*35+'ms');link.href=new URL(item.url,siteRoot).href;const title=document.createElement('strong');title.append(marked(item.title,tokens));const section=document.createElement('small');section.append(marked(item.section||'Обзор',tokens));const snippet=document.createElement('p');const hits=tokens.map(t=>item.body.indexOf(t)).filter(i=>i>=0);const offset=Math.max(0,(hits.length?Math.min(...hits):0)-70);snippet.append(marked((offset?'…':'')+item.text.slice(offset,offset+230)+(item.text.length>offset+230?'…':''),tokens));link.append(title,section,snippet);results.append(link);}
 }catch{if(stamp===revision)status.textContent='Не удалось загрузить поиск. Проверьте соединение и повторите ввод.';}}
 function openSearch(){setMenu(false);openDialog(searchDialog);input.focus();runSearch();}
 document.querySelectorAll('.search-open').forEach(b=>b.addEventListener('click',openSearch));searchDialog.querySelector('.search-close').addEventListener('click',()=>closeDialog(searchDialog));input.addEventListener('input',()=>{revision++;clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,120);});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('a')?.focus();}if(e.key==='Enter'){const first=results.querySelector('a');if(first){e.preventDefault();first.click();}}});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!searchDialog.open)openSearch();}});
 searchDialog.addEventListener('click',e=>{if(e.target===searchDialog){const r=searchDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(searchDialog);}});
}

document.querySelectorAll('.sidebar nav a').forEach((link,index)=>link.style.setProperty('--nav-delay',Math.min(index,7)*25+'ms'));

// Keep text without paragraph/list markup in the reveal flow as well.
// Inline spans preserve the original whitespace, links and line layout.
const contentRoot=document.querySelector('.contents');
const atomicContent='.code-toolbar,pre,table,.diagram,svg';
if(contentRoot){
 for(const parent of [contentRoot,...contentRoot.querySelectorAll('div,section,ul,ol,blockquote,figure')]){
  if(parent.closest(atomicContent))continue;
  let run=[];
  function wrapRun(){
   if(run.some(node=>node.textContent.trim())){
    const span=document.createElement('span');span.className='motion-inline';parent.insertBefore(span,run[0]);span.append(...run);
   }
   run=[];
  }
  for(const node of [...parent.childNodes]){
   const inline=node.nodeType===Node.TEXT_NODE||(node.nodeType===Node.ELEMENT_NODE&&node.matches('a,strong,em,b,i,u,s,code,span,br,small,sub,sup'));
   if(inline)run.push(node);else wrapRun();
  }
  wrapRun();
 }
}
// Every text block gets its own reveal. Containers fade without moving their
// children twice, and code/table/diagram internals stay one readable unit.
const revealSelector='.breadcrumb,.page-title,.reader-tools,.task-state,.resume-banner,.module-overview,.pagination,.contact-footer,.source-row,.mobile-toc,.toc,article,.contents h1,.contents h2,.contents h3,.contents h4,.contents h5,.contents h6,.contents p,.contents li,.contents dt,.contents dd,.contents .code-toolbar,.contents pre,.contents blockquote,.contents table,.contents .diagram,.contents img,.contents hr,.contents figure,.contents figcaption,.contents details,.contents .motion-inline';
const revealTargets=[...document.querySelectorAll(revealSelector)].filter(element=>{
 if(element.parentElement?.closest(atomicContent))return false;
 // An image-only paragraph is a layout wrapper; reveal the image itself.
 return !element.matches('p')||element.textContent.trim()||!element.querySelector('img');
});
const revealTargetSet=new Set(revealTargets);
for(const element of revealTargets){
 if(revealTargets.some(child=>child!==element&&element.contains(child)))element.classList.add('motion-container');
}
let revealObserver;
function reveal(element,delay=0){element.style.setProperty('--reveal-delay',delay+'ms');element.classList.remove('motion-pending');element.classList.add('motion-revealed');}
function showReadingTarget(target){
 for(let element=target;element;element=element.parentElement){
  if(!revealTargetSet.has(element))continue;
  revealObserver?.unobserve(element);element.classList.remove('motion-pending');element.classList.add('motion-revealed','motion-instant');
 }
}
function hashTarget(){try{return document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return null;}}
function prepareMotion(){
 revealObserver?.disconnect();
 document.documentElement.classList.toggle('motion-enabled',!motionPreference.matches);
 if(motionPreference.matches){revealTargets.forEach(element=>{element.classList.remove('motion-pending','motion-revealed','motion-instant');element.style.removeProperty('--reveal-delay');});return;}
 if(!('IntersectionObserver' in window))return;
 revealObserver=new IntersectionObserver(entries=>{
  const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
  let index=0;
  for(const entry of visible){
   const delay=entry.target.classList.contains('motion-container')?0:Math.min(index++,4)*45;
   reveal(entry.target,delay);revealObserver.unobserve(entry.target);
  }
 },{threshold:0,rootMargin:'0px 0px -20px 0px'});
 if(location.hash)showReadingTarget(hashTarget());
 let initialIndex=0;
 for(const element of revealTargets){
  if(element.classList.contains('motion-revealed'))continue;
  const rect=element.getBoundingClientRect();
  if(rect.bottom<0){showReadingTarget(element);continue;}
  if(rect.top<innerHeight&&rect.bottom>0)reveal(element,element.classList.contains('motion-container')?0:Math.min(initialIndex++,5)*55);
  else{element.classList.add('motion-pending');revealObserver.observe(element);}
 }
}
for(const dialog of document.querySelectorAll('.search-dialog,.image-dialog')){
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
}
// Keyboard focus and anchor navigation expose only their target and ancestors;
// later paragraphs keep their own scroll reveal instead of being pre-revealed.
document.addEventListener('focusin',event=>showReadingTarget(event.target));
addEventListener('hashchange',()=>showReadingTarget(hashTarget()));
motionPreference.addEventListener('change',prepareMotion);
prepareMotion();
