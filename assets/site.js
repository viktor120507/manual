'use strict';
const menu=document.querySelector('.menu-button');
const sidebar=document.querySelector('.sidebar');
const backdrop=document.querySelector('.menu-backdrop');
const mobile=matchMedia('(max-width:1023px)');
function setMenu(open){sidebar.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));if(backdrop)backdrop.hidden=!open;document.body.classList.toggle('menu-open',open&&mobile.matches);sidebar.inert=mobile.matches&&!open;}
menu.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
if(backdrop)backdrop.addEventListener('click',()=>setMenu(false));
mobile.addEventListener('change',()=>setMenu(false));
setMenu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('open')){setMenu(false);menu.focus();}});
let toastTimer;
function announce(message){const toast=document.querySelector('.toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2200);}
async function copy(text){if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return;}const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('copy failed');}
const copyIcon='<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="6" y="6" width="9" height="9" rx="2"/><path d="M11 3H5a2 2 0 0 0-2 2v6"/></svg>';
document.querySelectorAll('.code-toolbar').forEach(box=>{const button=box.querySelector('.toolbar button');const code=box.querySelector('pre code');const toolbar=box.querySelector('.toolbar');if(!button||!code||!toolbar)return;const label=document.createElement('span');label.className='code-label';label.textContent='>_  Код';toolbar.prepend(label);button.innerHTML=copyIcon+'<span>Копировать</span>';button.type='button';button.setAttribute('aria-label','Копировать команду');button.addEventListener('click',async()=>{try{await copy(code.textContent);button.querySelector('span').textContent='Скопировано';announce('Команда скопирована');setTimeout(()=>button.querySelector('span').textContent='Копировать',1800);}catch{announce('Не удалось скопировать. Выделите команду вручную.');}});});
const tocLinks=[...document.querySelectorAll('.toc nav a')];
const headings=[...document.querySelectorAll('.contents h1[id],.contents h2[id],.contents h3[id]')];
let scheduled=false;
function updateReading(){scheduled=false;const range=document.documentElement.scrollHeight-innerHeight;const progress=document.querySelector('.reading-progress span');if(progress)progress.style.width=(range>0?Math.min(100,scrollY/range*100):0)+'%';let active=headings[0];for(const h of headings){if(h.getBoundingClientRect().top<=150)active=h;else break;}tocLinks.forEach(a=>{const match=active&&decodeURIComponent(a.hash.slice(1))===active.id;a.classList.toggle('active',!!match);if(match)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateReading);}},{passive:true});addEventListener('resize',updateReading);addEventListener('load',updateReading);updateReading();
const imageDialog=document.querySelector('.image-dialog');
if(imageDialog){const preview=imageDialog.querySelector('img');const close=imageDialog.querySelector('.image-close');document.querySelectorAll('.contents img').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Увеличить изображение: '+(img.alt||'Иллюстрация'));function show(){preview.src=img.src;preview.alt=img.alt;imageDialog.showModal();}img.addEventListener('click',show);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});});close.addEventListener('click',()=>imageDialog.close());imageDialog.addEventListener('click',e=>{if(e.target===imageDialog){const r=imageDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)imageDialog.close();}});}

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
if(completion)completion.addEventListener('change',()=>{state=Object.assign(readState(),state);const done=new Set(completed());if(completion.checked)done.add(pageId);else done.delete(pageId);state.completed=[...done];writeState();refreshProgress();announce(completion.checked?'Задание отмечено выполненным':'Отметка выполнения снята');});
refreshProgress();
const themeButton=document.querySelector('.theme-toggle');
function renderTheme(){const dark=document.documentElement.dataset.theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Включить светлую тему':'Включить тёмную тему');
 themeButton.title=themeButton.getAttribute('aria-label');themeButton.querySelector('.theme-label').textContent=dark?'Светлая тема':'Тёмная тема';}
if(themeButton){renderTheme();themeButton.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('pgk-theme',theme);}catch{}renderTheme();});}

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
 for(const item of matches.slice(0,30)){const link=document.createElement('a');link.className='search-result';link.href=new URL(item.url,siteRoot).href;const title=document.createElement('strong');title.append(marked(item.title,tokens));const section=document.createElement('small');section.append(marked(item.section||'Обзор',tokens));const snippet=document.createElement('p');const hits=tokens.map(t=>item.body.indexOf(t)).filter(i=>i>=0);const offset=Math.max(0,(hits.length?Math.min(...hits):0)-70);snippet.append(marked((offset?'…':'')+item.text.slice(offset,offset+230)+(item.text.length>offset+230?'…':''),tokens));link.append(title,section,snippet);results.append(link);}
 }catch{if(stamp===revision)status.textContent='Не удалось загрузить поиск. Проверьте соединение и повторите ввод.';}}
 function openSearch(){setMenu(false);searchDialog.showModal();input.focus();runSearch();}
 document.querySelectorAll('.search-open').forEach(b=>b.addEventListener('click',openSearch));searchDialog.querySelector('.search-close').addEventListener('click',()=>searchDialog.close());input.addEventListener('input',()=>{revision++;clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,120);});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('a')?.focus();}if(e.key==='Enter'){const first=results.querySelector('a');if(first){e.preventDefault();first.click();}}});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!searchDialog.open)openSearch();}});
 searchDialog.addEventListener('click',e=>{if(e.target===searchDialog){const r=searchDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)searchDialog.close();}});
}
