(() => {
 'use strict';
 const script=document.currentScript;
 const local=['localhost','127.0.0.1'].includes(location.hostname);
 const config=window.PGK_CHAT_CONFIG || {};
 const endpoint=script?.dataset.chatEndpoint || config.endpoint || (local?`http://${location.hostname}:${config.localPort || 8780}/api/chat`:'');
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg>';
 const root=document.createElement('div');root.className='community-chat';
 root.innerHTML=`<div class="chat-backdrop" aria-hidden="true"></div><button class="chat-launcher motion-surface" type="button" aria-expanded="false" aria-controls="community-chat-panel" aria-label="Открыть чат сайта">${icon}<span>Чат</span><span class="chat-unread" hidden>0</span><span class="chat-launcher-dot" aria-hidden="true"></span></button>
 <section class="chat-panel" id="community-chat-panel" role="dialog" aria-labelledby="community-chat-title" hidden>
 <div class="chat-head"><div class="chat-heading-icon">${icon}</div><div><h2 id="community-chat-title">Чат практикума</h2><p class="chat-connection">Подключаемся…</p></div><button class="chat-close tool-button motion-surface" type="button" aria-label="Закрыть чат"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
 <div class="chat-info"><span class="chat-online-label"><span aria-hidden="true"></span><b class="chat-online-count">0 онлайн</b></span><span class="chat-expiry" title="История автоматически очищается каждые два часа">Очистка через 2:00:00</span></div>
 <div class="chat-people" aria-label="Кто сейчас онлайн">Можно общаться без регистрации</div>
 <div class="chat-history" tabindex="0" aria-label="Сообщения чата"><div class="chat-empty"><span>${icon}</span><strong>Здесь можно обсудить задания</strong><p>Поздоровайся или задай вопрос.<br>Сообщения исчезнут при следующей очистке.</p></div><ol class="chat-messages" aria-label="История сообщений"></ol></div>
 <button class="chat-jump" type="button" hidden>Новые сообщения ↓</button>
 <div class="chat-error" role="status" hidden></div>
 <form class="chat-profile"><label for="chat-nickname">Твоё имя</label><input id="chat-nickname" type="text" maxlength="24" placeholder="Гость" autocomplete="nickname" aria-label="Имя в чате" aria-describedby="chat-name-hint"><button class="chat-name-save" type="submit" disabled>Сохранить имя</button></form>
 <p class="chat-name-hint" id="chat-name-hint" role="status" hidden></p>
 <form class="chat-composer"><label class="chat-sr-only" for="chat-message">Сообщение</label><textarea id="chat-message" rows="2" maxlength="800" placeholder="Напиши сообщение…" aria-describedby="chat-composer-hint" disabled></textarea><button class="chat-send motion-surface" type="submit" aria-label="Отправить сообщение" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 3 18 9-18 9 4-9-4-9Z"/><path d="M7 12h14"/></svg></button></form>
 <div class="chat-foot"><span id="chat-composer-hint">Enter — отправить · Shift + Enter — новая строка</span><span class="chat-length">0 / 800</span></div><p class="chat-storage-note">Без регистрации · История только на 2 часа</p>
 </section>`;
 document.body.append(root);
 const $=selector=>root.querySelector(selector);
 const launcher=$('.chat-launcher'),panel=$('.chat-panel'),history=$('.chat-history'),list=$('.chat-messages');
 const field=$('#chat-message'),nameField=$('#chat-nickname'),send=$('.chat-send'),error=$('.chat-error');
 let stream,session,connected=false,sending=false,savingName=false,unread=0,retryTimer,retryDelay=1500,resetAt=Date.now()+7200000,maxMessages=200,connecting=false,stopped=false,lastAck=0;
 const ids=new Set();
 try{session=JSON.parse(sessionStorage.getItem('pgk-chat-session') || 'null');nameField.value=session?.name || localStorage.getItem('pgk-chat-name') || '';}catch{}
 function saveSession(){try{sessionStorage.setItem('pgk-chat-session',JSON.stringify(session));}catch{}}
 function showError(message){error.textContent=message;error.hidden=!message;}
 function namePending(){return Boolean(session?.name&&nameField.value!==session.name);}
 function updateControls(){
  const pending=namePending(),blocked=pending||savingName,hint=$('.chat-name-hint'),save=$('.chat-name-save');
  root.classList.toggle('chat-name-pending',blocked);nameField.disabled=savingName;
  field.disabled=!connected||blocked;send.disabled=!connected||blocked||sending||!field.value.trim();
  save.disabled=!connected||savingName||!pending||!nameField.value.trim();save.textContent=savingName?'Сохраняем…':'Сохранить имя';
  hint.hidden=!blocked;hint.textContent=savingName?'Сохраняем новое имя…':nameField.value.trim()?'Сохрани имя, чтобы продолжить писать.':'Введи имя и нажми «Сохранить имя».';
 }
 function availability(value,message){connected=value;root.classList.toggle('chat-connected',value);updateControls();$('.chat-connection').textContent=message;}
 function clock(){const seconds=Math.max(0,Math.ceil((resetAt-Date.now())/1000));$('.chat-expiry').textContent=`Очистка через ${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
 function badge(){const chip=$('.chat-unread');chip.textContent=unread>99?'99+':String(unread);chip.hidden=!unread;launcher.setAttribute('aria-label',unread?`Открыть чат сайта, новых сообщений: ${unread}`:'Открыть чат сайта');}
 function jump(){history.scrollTop=history.scrollHeight;$('.chat-jump').hidden=true;unread=0;badge();}
 function setOpen(open){
  panel.hidden=!open;root.classList.toggle('chat-open',open);launcher.setAttribute('aria-expanded',String(open));launcher.hidden=open;
  if(open){clock();jump();(connected?(namePending()?nameField:field):$('.chat-close')).focus();}else launcher.focus();
 }
 launcher.addEventListener('click',()=>setOpen(true));$('.chat-close').addEventListener('click',()=>setOpen(false));$('.chat-backdrop').addEventListener('click',()=>setOpen(false));$('.chat-jump').addEventListener('click',jump);
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}
  if(event.key==='Tab'){
   const controls=[...panel.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);
   if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
   else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
  }
 });
 history.addEventListener('scroll',()=>{if(history.scrollHeight-history.scrollTop-history.clientHeight<45){$('.chat-jump').hidden=true;unread=0;badge();}},{passive:true});
 function people(users){
  $('.chat-online-count').textContent=`${users.length} онлайн`;
  $('.chat-people').textContent=users.length?users.slice(0,5).map(u=>u.name+(u.id===session?.id?' (ты)':'')).join(' · ')+(users.length>5?` · ещё ${users.length-5}`:''):'Можно общаться без регистрации';
 }
 function addMessage(item,notify=true){
  if(ids.has(item.id))return;ids.add(item.id);
  const nearBottom=history.scrollHeight-history.scrollTop-history.clientHeight<55;
  const li=document.createElement('li');li.className='chat-message'+(item.senderId===session?.id?' chat-own':'');li.dataset.messageId=item.id;
  const meta=document.createElement('div');meta.className='chat-message-meta';
  const name=document.createElement('strong');name.textContent=item.senderId===session?.id?'Ты':item.name;
  const time=document.createElement('time');time.dateTime=new Date(item.time).toISOString();time.textContent=new Date(item.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  const content=document.createElement('p');content.textContent=item.text;meta.append(name,time);li.append(meta,content);list.append(li);
  while(list.children.length>maxMessages){ids.delete(list.firstElementChild.dataset.messageId);list.firstElementChild.remove();}
  $('.chat-empty').hidden=true;
  if(!panel.hidden&&(nearBottom||item.senderId===session?.id))jump();
  else if(notify){unread++;badge();if(!panel.hidden)$('.chat-jump').hidden=false;}
 }
 function clearHistory(){list.replaceChildren();ids.clear();$('.chat-empty').hidden=false;unread=0;badge();$('.chat-jump').hidden=true;}
 async function request(path,data){
  const res=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',...(session?.token?{'Authorization':'Bearer '+session.token}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  const reply=await res.json();if(!res.ok)throw Object.assign(new Error(reply.error || 'Не удалось отправить запрос.'),{status:res.status});return reply;
 }
 function schedule(){if(stopped||retryTimer)return;retryTimer=setTimeout(()=>{retryTimer=null;connect();},retryDelay);retryDelay=Math.min(retryDelay*1.7,30000);}
 async function connect(){
  if(connecting||stopped||!endpoint)return;connecting=true;stream?.close();availability(false,'Подключаемся…');
  try{
   const draft=nameField.value,pending=namePending();
   session=await request('/join',{token:session?.token,name:pending?session.name:draft});
   if(!pending&&nameField.value===draft)nameField.value=session.name;
   resetAt=session.resetAt;maxMessages=session.maxMessages;saveSession();updateControls();
   stream=new EventSource(endpoint+'/events?token='+encodeURIComponent(session.token));
   stream.addEventListener('snapshot',event=>{
    const data=JSON.parse(event.data);clearHistory();resetAt=data.resetAt;maxMessages=data.maxMessages;
    for(const item of data.messages)addMessage(item,false);people(data.users);clock();availability(true,'Все, кто сейчас на сайте');showError('');retryDelay=1500;connecting=false;
   });
   stream.addEventListener('message',event=>addMessage(JSON.parse(event.data)));
   stream.addEventListener('presence',event=>people(JSON.parse(event.data).users));
   stream.addEventListener('reset',event=>{resetAt=JSON.parse(event.data).resetAt;clearHistory();clock();showError('История очищена. Можно начинать новый разговор.');});
   stream.addEventListener('heartbeat',event=>{
    resetAt=JSON.parse(event.data).resetAt;clock();
    if(session.presenceLease&&Date.now()-lastAck>25000){lastAck=Date.now();request('/ping',{}).catch(()=>{});}
   });
   stream.onerror=()=>{stream?.close();connecting=false;availability(false,'Связь прервалась · переподключаемся');schedule();};
  }catch{connecting=false;availability(false,'Чат временно недоступен');showError('Соединение восстановится автоматически.');schedule();}
 }
 nameField.addEventListener('input',updateControls);
 field.addEventListener('input',()=>{$('.chat-length').textContent=`${field.value.length} / 800`;updateControls();});
 field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!send.disabled)$('.chat-composer').requestSubmit();}});
 $('.chat-composer').addEventListener('submit',async event=>{
  event.preventDefault();if(namePending()||savingName){updateControls();if(!savingName)nameField.focus();return;}
  const text=field.value.trim();if(!text||!connected||sending)return;
  sending=true;updateControls();showError('');
  try{await request('/message',{text});field.value='';$('.chat-length').textContent='0 / 800';}
  catch(e){showError(e.message);if(e.status===401){availability(false,'Восстанавливаем подключение…');connect();}}
  finally{sending=false;updateControls();if(!panel.hidden)(namePending()?nameField:field).focus();}
 });
 $('.chat-profile').addEventListener('submit',async event=>{
  event.preventDefault();if(!connected||savingName||!namePending())return;
  if(!nameField.value.trim()){updateControls();nameField.focus();return;}
  savingName=true;updateControls();showError('');
  try{const data=await request('/profile',{name:nameField.value});session.name=data.name;nameField.value=data.name;saveSession();try{localStorage.setItem('pgk-chat-name',data.name);}catch{}showError('Имя сохранено.');}
  catch(e){showError(e.message);if(e.status===401){availability(false,'Восстанавливаем подключение…');connect();}}
  finally{savingName=false;updateControls();if(!panel.hidden)(namePending()?nameField:field).focus();}
 });
 let ticker=setInterval(()=>{if(!panel.hidden)clock();},1000);
 addEventListener('pagehide',()=>{
  stopped=true;
  if(session?.presenceLease&&connected)fetch(endpoint+'/leave',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:'{}',keepalive:true}).catch(()=>{});
  stream?.close();clearTimeout(retryTimer);clearInterval(ticker);
 });
 addEventListener('pageshow',event=>{if(event.persisted){stopped=false;retryTimer=null;ticker=setInterval(()=>{if(!panel.hidden)clock();},1000);connect();}});
 addEventListener('online',()=>{if(!connected&&!connecting){clearTimeout(retryTimer);retryTimer=null;connect();}});
 if(endpoint)connect();else{availability(false,'Сервер чата ещё не подключён');showError('Чат подготовлен для предпросмотра. Для работы на сайте нужен отдельный сервер.');}
})();
