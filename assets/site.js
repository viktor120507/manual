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
