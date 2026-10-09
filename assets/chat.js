(() => {
 'use strict';
 const script=document.currentScript;
 const local=['localhost','127.0.0.1'].includes(location.hostname);
 const config=window.PGK_CHAT_CONFIG || {};
 const endpoint=script?.dataset.chatEndpoint || config.endpoint || (local?`http://${location.hostname}:${config.localPort || 8780}/api/chat`:'');
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg>';
 const replyIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 14-5-5 5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v2"/></svg>';
 const settingsIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9.5 3-.6 2.4-2 .9-2.2-.7-2.5 4.3 1.7 1.7v2.3l-1.7 1.7 2.5 4.3 2.2-.7 2 .9.6 2.4h5l.6-2.4 2-.9 2.2.7 2.5-4.3-1.7-1.7v-2.3l1.7-1.7-2.5-4.3-2.2.7-2-.9L14.5 3Z"/><circle cx="12" cy="12.75" r="3"/></svg>';
 const root=document.createElement('div');root.className='community-chat';
 root.innerHTML=`<div class="chat-backdrop" aria-hidden="true"></div><div class="chat-notifications" role="log" aria-label="Новые сообщения чата" aria-live="polite" aria-relevant="additions" hidden></div><button class="chat-launcher motion-surface" type="button" aria-expanded="false" aria-controls="community-chat-panel" aria-label="Открыть чат сайта">${icon}<span>Чат</span><span class="chat-unread" hidden>0</span><span class="chat-launcher-dot" aria-hidden="true"></span></button>
 <section class="chat-panel" id="community-chat-panel" role="dialog" aria-labelledby="community-chat-title" hidden>
 <div class="chat-head"><div class="chat-heading-icon">${icon}</div><div><h2 id="community-chat-title">Чат практикума</h2><p class="chat-connection">Подключаемся…</p></div><button class="chat-settings-button tool-button" type="button" aria-label="Настройки чата" aria-expanded="false" aria-controls="chat-settings">${settingsIcon}</button><button class="chat-close tool-button motion-surface" type="button" aria-label="Закрыть чат"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
 <section class="chat-settings" id="chat-settings" aria-labelledby="chat-settings-title" hidden><h3 id="chat-settings-title">Настройки чата</h3><label class="chat-setting"><span><strong>Всплывающие сообщения</strong><small>Над кнопкой чата</small></span><input type="checkbox" role="switch" class="chat-popups-toggle" aria-label="Всплывающие сообщения" checked><span class="chat-switch" aria-hidden="true"></span></label><label class="chat-setting"><span><strong>Звук сообщений</strong><small>Тихий сигнал при новом сообщении</small></span><input type="checkbox" role="switch" class="chat-sound-toggle" aria-label="Звук сообщений" checked><span class="chat-switch" aria-hidden="true"></span></label></section>
 <div class="chat-info"><span class="chat-online-label"><span aria-hidden="true"></span><b class="chat-online-count">0 онлайн</b></span><span class="chat-expiry" title="История автоматически очищается каждые два часа">Очистка через 2:00:00</span></div>
 <div class="chat-people" aria-label="Кто сейчас онлайн"></div>
 <div class="chat-history" tabindex="0" aria-label="Сообщения чата"><div class="chat-empty"><span>${icon}</span><strong>Здесь можно обсудить задания</strong><p>Поздоровайся или задай вопрос.<br>Сообщения исчезнут при следующей очистке.</p></div><ol class="chat-messages" aria-label="История сообщений"></ol></div>
 <button class="chat-jump" type="button" hidden>Новые сообщения ↓</button>
 <div class="chat-error" role="status" hidden></div>
 <form class="chat-profile"><label for="chat-nickname">Твоё имя</label><input id="chat-nickname" type="text" maxlength="24" placeholder="Гость" autocomplete="nickname" aria-label="Имя в чате" aria-describedby="chat-name-hint"><button class="chat-name-save" type="submit" disabled>Сохранить имя</button></form>
 <p class="chat-name-hint" id="chat-name-hint" role="status" hidden></p>
 <div class="chat-reply-draft" hidden><div><strong></strong><span></span></div><button type="button" aria-label="Отменить ответ">×</button></div><form class="chat-composer"><label class="chat-sr-only" for="chat-message">Сообщение</label><textarea id="chat-message" rows="2" maxlength="800" placeholder="Напиши сообщение…" disabled></textarea><button class="chat-send motion-surface" type="submit" aria-label="Отправить сообщение" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 3 18 9-18 9 4-9-4-9Z"/><path d="M7 12h14"/></svg></button></form>
 <div class="chat-foot"><span class="chat-typing" role="status"><span class="chat-typing-label"></span><span class="chat-typing-dots" hidden><i></i><i></i><i></i></span></span><span class="chat-length">0 / 800</span></div>
 </section>`;
 document.body.append(root);
 const $=selector=>root.querySelector(selector);
 const launcher=$('.chat-launcher'),panel=$('.chat-panel'),history=$('.chat-history'),list=$('.chat-messages');
 const field=$('#chat-message'),nameField=$('#chat-nickname'),send=$('.chat-send'),error=$('.chat-error');
 let stream,session,connected=false,sending=false,savingName=false,unread=0,retryTimer,retryDelay=1500,resetAt=Date.now()+7200000,maxMessages=200,connecting=false,stopped=false,lastAck=0;
 const ids=new Set(),messages=new Map(),emojis=['👍','❤️','😂','🔥'];
 let replyTo=null,firstUnread=null,typingUsers=[],typingTimer,lastTyping=0,typingActive=false,sound=true,popups=true,audioContext,lastSound=0;
 const supports=feature=>session?.features?.includes(feature);
 const picker=document.createElement('div');picker.className='chat-reaction-picker';picker.hidden=true;picker.setAttribute('role','toolbar');picker.setAttribute('aria-label','Выбрать реакцию');root.append(picker);
 let pickerMessage=null,pickerHideTimer,pickerCloseTimer;
 function closePicker(){clearTimeout(pickerHideTimer);clearTimeout(pickerCloseTimer);picker.classList.remove('is-visible');pickerMessage=null;pickerCloseTimer=setTimeout(()=>{picker.hidden=true;},180);}
 function deferPickerClose(){if(picker.contains(document.activeElement))return;clearTimeout(pickerHideTimer);pickerHideTimer=setTimeout(closePicker,140);}
 function showPicker(item,bubble){
  if(!connected||!supports('reactions'))return;clearTimeout(pickerHideTimer);clearTimeout(pickerCloseTimer);pickerMessage=item;picker.hidden=false;
  for(const button of picker.querySelectorAll('button'))button.setAttribute('aria-pressed',String((item.reactions?.[button.dataset.emoji]||[]).includes(session?.id)));
  const rect=bubble.getBoundingClientRect(),bounds=history.getBoundingClientRect(),width=picker.offsetWidth,height=picker.offsetHeight;
  const left=Math.max(bounds.left+7,Math.min(rect.right-width,bounds.right-width-7));
  const top=rect.top-height-6>=bounds.top+4?rect.top-height-6:Math.min(rect.bottom+6,bounds.bottom-height-4);
  picker.style.left=`${Math.max(8,Math.min(left,innerWidth-width-8))}px`;picker.style.top=`${Math.max(8,Math.min(top,innerHeight-height-8))}px`;
  picker.classList.add('is-visible');
 }
 for(const emoji of emojis){const button=document.createElement('button');button.type='button';button.className='chat-picker-reaction';button.dataset.emoji=emoji;button.textContent=emoji;button.setAttribute('aria-label',`Поставить реакцию ${emoji}`);button.setAttribute('aria-pressed','false');button.addEventListener('click',async event=>{const item=pickerMessage;if(!item||!connected)return;button.disabled=true;try{await request('/reaction',{id:item.id,emoji});closePicker();if(event.detail===0)[...list.children].find(el=>el.dataset.messageId===item.id)?.querySelector('.chat-bubble')?.focus();}catch(e){showError(e.message);}finally{button.disabled=false;}});picker.append(button);}
 picker.addEventListener('pointerenter',()=>clearTimeout(pickerHideTimer));picker.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'&&matchMedia('(hover: hover)').matches)deferPickerClose();});
 picker.addEventListener('focusin',()=>clearTimeout(pickerHideTimer));picker.addEventListener('focusout',event=>{if(!picker.contains(event.relatedTarget))deferPickerClose();});
 picker.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();const id=pickerMessage?.id;closePicker();[...list.children].find(el=>el.dataset.messageId===id)?.querySelector('.chat-bubble')?.focus();}if(event.key==='Escape'){event.preventDefault();const id=pickerMessage?.id;closePicker();[...list.children].find(el=>el.dataset.messageId===id)?.querySelector('.chat-bubble')?.focus();}if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();const buttons=[...picker.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length]?.focus();}});
 document.addEventListener('pointerdown',event=>{if(!picker.hidden&&!picker.contains(event.target)&&!event.target.closest('.chat-bubble'))closePicker();});
 history.addEventListener('scroll',closePicker,{passive:true});addEventListener('resize',closePicker);

 const nearBottom=()=>history.scrollHeight-history.scrollTop-history.clientHeight<55;
 try{sound=localStorage.getItem('pgk-chat-sound')!=='false';popups=localStorage.getItem('pgk-chat-popups')!=='false';}catch{}
 const settings=$('.chat-settings'),settingsButton=$('.chat-settings-button'),notices=$('.chat-notifications'),toasts=[];
 function setSettings(open,focus=false){settings.hidden=!open;settingsButton.setAttribute('aria-expanded',String(open));if(focus)(open?$('.chat-popups-toggle'):settingsButton).focus();}
 function preferences(){ $('.chat-sound-toggle').checked=sound;$('.chat-popups-toggle').checked=popups; }
 function enableAudio(){
  if(!sound)return;
  try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}
 }
 // Browsers unlock sound after a gesture; incoming messages never prompt for permissions.
 document.addEventListener('pointerdown',enableAudio,{passive:true});document.addEventListener('keydown',enableAudio);
 function playSound(){
  if(!sound||!audioContext||audioContext.state!=='running'||Date.now()-lastSound<1000)return;
  lastSound=Date.now();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
  oscillator.type='sine';oscillator.frequency.setValueAtTime(660,now);oscillator.frequency.exponentialRampToValueAtTime(880,now+.12);
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.035,now+.015);gain.gain.exponentialRampToValueAtTime(.001,now+.18);
  oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+.2);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }
 settingsButton.addEventListener('click',event=>setSettings(settings.hidden,event.detail===0));
 $('.chat-sound-toggle').addEventListener('change',event=>{sound=event.target.checked;try{localStorage.setItem('pgk-chat-sound',String(sound));}catch{}if(sound)enableAudio();else audioContext?.suspend().catch(()=>{});});
 $('.chat-popups-toggle').addEventListener('change',event=>{popups=event.target.checked;try{localStorage.setItem('pgk-chat-popups',String(popups));}catch{}if(!popups)clearToasts();});
 document.addEventListener('pointerdown',event=>{if(!settings.hidden&&!settings.contains(event.target)&&!settingsButton.contains(event.target))setSettings(false);});
 addEventListener('storage',event=>{if(event.key==='pgk-chat-sound'){sound=event.newValue!=='false';if(!sound)audioContext?.suspend().catch(()=>{});}else if(event.key==='pgk-chat-popups'){popups=event.newValue!=='false';if(!popups)clearToasts();}preferences();});preferences();

 function removeToast(toast,animate=false){
  if(!toasts.includes(toast))return;clearTimeout(toast.timer);clearTimeout(toast.exitTimer);
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){toast.element.classList.add('chat-toast-leaving');toast.exitTimer=setTimeout(()=>removeToast(toast),230);return;}
  toasts.splice(toasts.indexOf(toast),1);if(toast.element.contains(document.activeElement))launcher.focus();toast.element.remove();notices.hidden=!toasts.length;
 }
 function clearToasts(){for(const toast of [...toasts])removeToast(toast);}
 function armToast(toast){clearTimeout(toast.timer);toast.timer=setTimeout(()=>removeToast(toast,true),3000);}
 function fitToasts(){
  if(!toasts.length)return;
  const header=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;
  const viewport=window.visualViewport,top=Math.max(viewport?.offsetTop||0,header)+12;
  const available=Math.max(0,notices.getBoundingClientRect().bottom-top);
  while(toasts.length&&(toasts.length>6||notices.scrollHeight>available))removeToast(toasts.at(-1));
 }
 function showToast(item){
  if(!popups||!panel.hidden)return;
  const oldPositions=new Map(toasts.map(toast=>[toast,toast.element.getBoundingClientRect().top]));
  const card=document.createElement('div');card.className='chat-toast';card.dataset.messageId=item.id;
  const open=document.createElement('button');open.type='button';open.className='chat-toast-open';
  const meta=document.createElement('span');meta.className='chat-toast-meta';const author=document.createElement('strong'),time=document.createElement('time');author.textContent=item.name;time.dateTime=new Date(item.time).toISOString();time.textContent=new Date(item.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});meta.append(author,time);
  const text=document.createElement('span');text.className='chat-toast-text';text.textContent=[...item.text].slice(0,240).join('')+([...item.text].length>240?'…':'');open.append(meta,text);open.setAttribute('aria-label',`Открыть сообщение ${item.name}: ${text.textContent}`);
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='chat-toast-dismiss';dismiss.textContent='×';dismiss.setAttribute('aria-label',`Скрыть уведомление от ${item.name}`);card.append(open,dismiss);
  const toast={element:card,id:item.id};toasts.unshift(toast);notices.hidden=false;notices.prepend(card);
  open.addEventListener('click',()=>{setOpen(true);const original=[...list.children].find(el=>el.dataset.messageId===item.id);if(original){original.scrollIntoView({block:'center'});original.classList.add('chat-quoted-target');setTimeout(()=>original.classList.remove('chat-quoted-target'),1300);}});
  dismiss.addEventListener('click',()=>removeToast(toast,true));
  const pause=()=>clearTimeout(toast.timer),resume=()=>{if(!card.matches(':hover')&&!card.contains(document.activeElement))armToast(toast);};
  card.addEventListener('pointerenter',pause);card.addEventListener('pointerleave',resume);card.addEventListener('focusin',pause);card.addEventListener('focusout',resume);
  fitToasts();if(!toasts.includes(toast))return;armToast(toast);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const [existing,oldTop] of oldPositions){if(!toasts.includes(existing))continue;const distance=oldTop-existing.element.getBoundingClientRect().top;if(distance)existing.element.animate([{transform:`translateY(${distance}px)`},{transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.22,.8,.25,1)'});}
 }
 addEventListener('resize',fitToasts);window.visualViewport?.addEventListener('resize',fitToasts);
 function renderTyping(){
  const users=typingUsers.filter(user=>user.id!==session?.id&&user.until>Date.now());
  $('.chat-typing-label').textContent=users.length?users.length===1?`${users[0].name} печатает`:users.length===2?`${users[0].name} и ${users[1].name} печатают`:'Несколько человек печатают':'';
  $('.chat-typing-dots').hidden=!users.length;
 }
 function stopTyping(){clearTimeout(typingTimer);if(typingActive&&connected&&supports('typing'))request('/typing',{active:false}).catch(()=>{});typingActive=false;lastTyping=0;}
 function reportTyping(){
  if(!connected||!supports('typing')||panel.hidden||field.disabled||!field.value.trim()){stopTyping();return;}
  if(Date.now()-lastTyping>3000){lastTyping=Date.now();typingActive=true;request('/typing',{active:true}).catch(()=>{});}
  clearTimeout(typingTimer);typingTimer=setTimeout(stopTyping,2500);
 }
 function setReply(item){replyTo=item?.id||null;const draft=$('.chat-reply-draft');draft.hidden=!item;if(item){draft.querySelector('strong').textContent=`Ответ: ${item.name}`;draft.querySelector('span').textContent=[...item.text].slice(0,160).join('');field.focus();}}
 $('.chat-reply-draft button').addEventListener('click',()=>{setReply(null);field.focus();});
 function preserveScroll(change){const stick=nearBottom(),anchor=[...list.querySelectorAll('.chat-message')].find(el=>el.getBoundingClientRect().bottom>history.getBoundingClientRect().top),top=anchor?.getBoundingClientRect().top;change();if(stick)history.scrollTop=history.scrollHeight;else if(anchor?.isConnected)history.scrollTop+=anchor.getBoundingClientRect().top-top;}
 function updateReactions(item){
  const li=[...list.children].find(el=>el.dataset.messageId===item.id);if(!li)return;
  preserveScroll(()=>{for(const button of li.querySelectorAll('.chat-reaction')){const voters=item.reactions?.[button.dataset.emoji]||[];button.hidden=!voters.length;button.querySelector('span').textContent=String(voters.length);button.setAttribute('aria-pressed',String(voters.includes(session?.id)));button.setAttribute('aria-label',`${button.dataset.emoji}, реакций: ${voters.length}`);}const actions=li.querySelector('.chat-message-actions');if(actions)actions.hidden=![...actions.querySelectorAll('.chat-reaction')].some(button=>!button.hidden);});if(pickerMessage?.id===item.id){pickerMessage=item;for(const button of picker.querySelectorAll('button'))button.setAttribute('aria-pressed',String((item.reactions?.[button.dataset.emoji]||[]).includes(session?.id)));}
 }
 function divider(){root.querySelector('.chat-new-divider')?.remove();if(!firstUnread)return;const target=[...list.children].find(el=>el.dataset.messageId===firstUnread);if(target){const marker=document.createElement('li');marker.className='chat-new-divider';marker.textContent='Новые сообщения';target.before(marker);}}

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
 function availability(value,message){if(!value){closePicker();stopTyping();typingUsers=[];renderTyping();}connected=value;root.classList.toggle('chat-connected',value);updateControls();$('.chat-connection').textContent=message;}
 function clock(){const seconds=Math.max(0,Math.ceil((resetAt-Date.now())/1000));$('.chat-expiry').textContent=`Очистка через ${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
 function badge(){const chip=$('.chat-unread');chip.textContent=unread>99?'99+':String(unread);chip.hidden=!unread;launcher.setAttribute('aria-label',unread?`Открыть чат сайта, новых сообщений: ${unread}`:'Открыть чат сайта');}
 function jump(){firstUnread=null;history.scrollTop=history.scrollHeight;$('.chat-jump').hidden=true;unread=0;badge();}
 function setOpen(open){
  setSettings(false);if(open)clearToasts();if(!open)closePicker();panel.hidden=!open;root.classList.toggle('chat-open',open);launcher.setAttribute('aria-expanded',String(open));launcher.hidden=open;
  if(open){clock();if(firstUnread){divider();root.querySelector('.chat-new-divider')?.scrollIntoView({block:'start'});$('.chat-jump').hidden=nearBottom();}else jump();(connected?(namePending()?nameField:field):$('.chat-close')).focus();}else{stopTyping();if(!unread){firstUnread=null;divider();}launcher.focus();}
 }
 launcher.addEventListener('click',()=>{enableAudio();setOpen(true);});$('.chat-close').addEventListener('click',()=>setOpen(false));$('.chat-backdrop').addEventListener('click',()=>setOpen(false));$('.chat-jump').addEventListener('click',jump);
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!settings.hidden)setSettings(false,true);else setOpen(false);}
  if(event.key==='Tab'){
   const controls=[...panel.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);
   if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
   else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
  }
 });
 history.addEventListener('scroll',()=>{if(history.scrollHeight-history.scrollTop-history.clientHeight<45){$('.chat-jump').hidden=true;unread=0;badge();}},{passive:true});
 function people(users){
  $('.chat-online-count').textContent=`${users.length} онлайн`;
  $('.chat-people').textContent=users.length?users.slice(0,5).map(u=>u.name+(u.id===session?.id?' (ты)':'')).join(' · ')+(users.length>5?` · ещё ${users.length-5}`:''):'';
 }
 function addMessage(item,notify=true){
  if(ids.has(item.id))return;ids.add(item.id);messages.set(item.id,item);
  const stick=nearBottom(),own=item.senderId===session?.id,anchor=[...list.querySelectorAll('.chat-message')].find(el=>el.getBoundingClientRect().bottom>history.getBoundingClientRect().top),anchorTop=anchor?.getBoundingClientRect().top;
  const li=document.createElement('li');li.className='chat-message'+(own?' chat-own':'')+(notify?' chat-message-new':'');li.dataset.messageId=item.id;
  const avatar=document.createElement('span');avatar.className='chat-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=item.name.split(/\s+/).slice(0,2).map(word=>[...word][0]).join('').toUpperCase();let hash=0;for(const character of item.senderId)hash=(hash*31+character.charCodeAt(0))>>>0;avatar.style.setProperty('--avatar-hue',String(hash%360));
  const bubble=document.createElement('div');bubble.className='chat-bubble';if(supports('reactions')){bubble.tabIndex=0;bubble.setAttribute('aria-label',`Сообщение ${item.name}. Нажми, чтобы выбрать реакцию.`);bubble.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'&&matchMedia('(hover: hover)').matches)showPicker(item,bubble);});bubble.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'&&matchMedia('(hover: hover)').matches)deferPickerClose();});bubble.addEventListener('click',event=>{if(event.target.closest('button')||getSelection()?.toString())return;if(!matchMedia('(hover: hover)').matches){if(pickerMessage?.id===item.id)closePicker();else showPicker(item,bubble);}});bubble.addEventListener('keydown',event=>{if(event.target===bubble&&(event.key==='Enter'||event.key===' ')){event.preventDefault();showPicker(item,bubble);picker.querySelector('button').focus();}});}const meta=document.createElement('div');meta.className='chat-message-meta';
  const name=document.createElement('strong');name.textContent=own?'Ты':item.name;
  const time=document.createElement('time');time.dateTime=new Date(item.time).toISOString();time.textContent=new Date(item.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});meta.append(name,time);bubble.append(meta);
  if(item.reply){const quote=document.createElement('button');quote.type='button';quote.className='chat-quote';const author=document.createElement('strong'),excerpt=document.createElement('span');author.textContent=item.reply.name;excerpt.textContent=item.reply.text;quote.append(author,excerpt);quote.setAttribute('aria-label',`Цитата ${item.reply.name}: ${item.reply.text}`);quote.addEventListener('click',()=>{const original=[...list.children].find(el=>el.dataset.messageId===item.reply.id);if(original){original.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});original.classList.add('chat-quoted-target');setTimeout(()=>original.classList.remove('chat-quoted-target'),1300);}else showError('Исходное сообщение уже удалено. Цитата сохранена в ответе.');});bubble.append(quote);}
  const content=document.createElement('p');content.textContent=item.text;bubble.append(content);
  const actions=document.createElement('div');actions.className='chat-message-actions';
  if(supports('reactions'))for(const emoji of emojis){const button=document.createElement('button');button.type='button';button.className='chat-reaction';button.dataset.emoji=emoji;const glyph=document.createElement('b'),count=document.createElement('span');glyph.textContent=emoji;button.append(glyph,count);button.addEventListener('click',async()=>{if(!connected)return;button.disabled=true;try{await request('/reaction',{id:item.id,emoji});}catch(e){showError(e.message);}finally{button.disabled=false;}});actions.append(button);}
  if(supports('replies')){const button=document.createElement('button');button.type='button';button.className='chat-reply-button';button.innerHTML=replyIcon;button.setAttribute('aria-label',`Ответить на сообщение ${item.name}`);button.title='Ответить';button.addEventListener('click',()=>setReply(item));meta.append(button);}
  if(actions.children.length)bubble.append(actions);li.append(avatar,bubble);list.append(li);
  while(messages.size>maxMessages){const oldest=messages.keys().next().value;messages.delete(oldest);ids.delete(oldest);[...list.children].find(el=>el.dataset.messageId===oldest)?.remove();const toast=toasts.find(entry=>entry.id===oldest);if(toast)removeToast(toast);if(replyTo===oldest)setReply(null);if(pickerMessage?.id===oldest)closePicker();if(firstUnread===oldest)firstUnread=[...messages.keys()].find(id=>id!==item.id)||item.id;}
  $('.chat-empty').hidden=true;updateReactions(item);
  if(!panel.hidden&&(stick||own))jump();
  else if(notify&&!own){unread++;firstUnread ||= item.id;divider();badge();if(!panel.hidden)$('.chat-jump').hidden=false;}
  if(!stick&&anchor?.isConnected)history.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;
  if(notify&&!own){showToast(item);playSound();}
 }
 function clearHistory(){closePicker();clearToasts();list.replaceChildren();ids.clear();messages.clear();setReply(null);firstUnread=null;typingUsers=[];renderTyping();$('.chat-empty').hidden=false;unread=0;badge();$('.chat-jump').hidden=true;}
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
    const data=JSON.parse(event.data),savedUnread=unread,savedFirst=firstUnread,savedReply=replyTo,wasConnected=ids.size>0,savedAnchor=[...list.querySelectorAll('.chat-message')].find(el=>el.getBoundingClientRect().bottom>history.getBoundingClientRect().top),savedTop=savedAnchor?.getBoundingClientRect().top,anchorId=savedAnchor?.dataset.messageId,wasAtBottom=nearBottom();clearHistory();resetAt=data.resetAt;maxMessages=data.maxMessages;
    session.features=data.features||session.features;for(const item of data.messages)addMessage(item,false);typingUsers=data.typing||[];renderTyping();if(wasConnected&&!wasAtBottom){unread=savedUnread;firstUnread=messages.has(savedFirst)?savedFirst:null;divider();badge();const anchor=[...list.children].find(el=>el.dataset.messageId===anchorId);if(anchor&&savedTop!=null)history.scrollTop+=anchor.getBoundingClientRect().top-savedTop;}else jump();if(savedReply&&messages.has(savedReply))setReply(messages.get(savedReply));people(data.users);clock();availability(true,'Все, кто сейчас на сайте');showError('');retryDelay=1500;connecting=false;
   });
   stream.addEventListener('message',event=>addMessage(JSON.parse(event.data)));
   stream.addEventListener('reaction',event=>{const data=JSON.parse(event.data),item=messages.get(data.id);if(item){item.reactions=data.reactions;updateReactions(item);}});
   stream.addEventListener('typing',event=>{typingUsers=JSON.parse(event.data).users;renderTyping();});
   stream.addEventListener('presence',event=>people(JSON.parse(event.data).users));
   stream.addEventListener('reset',event=>{resetAt=JSON.parse(event.data).resetAt;clearHistory();clock();showError('История очищена. Можно начинать новый разговор.');});
   stream.addEventListener('heartbeat',event=>{
    resetAt=JSON.parse(event.data).resetAt;clock();
    if(session.presenceLease&&Date.now()-lastAck>25000){lastAck=Date.now();request('/ping',{}).catch(()=>{});}
   });
   stream.onerror=()=>{stream?.close();connecting=false;availability(false,'Связь прервалась · переподключаемся');schedule();};
  }catch{connecting=false;availability(false,'Чат временно недоступен');showError('Соединение восстановится автоматически.');schedule();}
 }
 nameField.addEventListener('input',()=>{stopTyping();updateControls();});
 field.addEventListener('blur',stopTyping);
 field.addEventListener('input',()=>{$('.chat-length').textContent=`${field.value.length} / 800`;updateControls();reportTyping();});
 field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!send.disabled)$('.chat-composer').requestSubmit();}});
 $('.chat-composer').addEventListener('submit',async event=>{
  event.preventDefault();if(namePending()||savingName){updateControls();if(!savingName)nameField.focus();return;}
  const text=field.value.trim();if(!text||!connected||sending)return;
  sending=true;stopTyping();updateControls();showError('');
  try{await request('/message',{text,...(replyTo?{replyTo}:{})});setReply(null);field.value='';$('.chat-length').textContent='0 / 800';}
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
 let ticker=setInterval(()=>{if(!panel.hidden)clock();renderTyping();},1000);
 addEventListener('pagehide',()=>{
  stopped=true;clearToasts();setSettings(false);audioContext?.suspend().catch(()=>{});clearTimeout(typingTimer);clearTimeout(pickerHideTimer);clearTimeout(pickerCloseTimer);
  if(session?.presenceLease&&connected)fetch(endpoint+'/leave',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:'{}',keepalive:true}).catch(()=>{});
  stream?.close();clearTimeout(retryTimer);clearInterval(ticker);
 });
 addEventListener('pageshow',event=>{if(event.persisted){stopped=false;retryTimer=null;ticker=setInterval(()=>{if(!panel.hidden)clock();renderTyping();},1000);connect();}});
 addEventListener('online',()=>{if(!connected&&!connecting){clearTimeout(retryTimer);retryTimer=null;connect();}});
 if(endpoint)connect();else{availability(false,'Сервер чата ещё не подключён');showError('Чат подготовлен для предпросмотра. Для работы на сайте нужен отдельный сервер.');}
})();
