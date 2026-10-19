(()=>{
 'use strict';
 const E=window.PGKCasino,key='pgk-secret-break-v1',$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],reduce=matchMedia('(prefers-reduced-motion: reduce)'),page=document.body.dataset.page;
 let state=load(),busy=false,bet='red',wheelStake=25,slotStake=25,rotation=0,announcementTimer,collectionFilter='all';
 const animations=new Set(),ns='http://www.w3.org/2000/svg',wheel=$('#roulette-wheel');
 const sounds=new window.PGKCasinoSound((enabled,unavailable)=>{updateSoundButton();if(unavailable)announce('Звук недоступен в этом браузере.');});
 function updateSoundButton(){$('.sound-toggle').setAttribute('aria-pressed',String(sounds.enabled));$('.sound-toggle').setAttribute('aria-label',sounds.enabled?'Выключить звук':'Включить звук');}
 updateSoundButton();
 const numberFormat=new Intl.NumberFormat('ru-RU'),format=n=>numberFormat.format(n),rarities={common:'Обычный',rare:'Редкий',legendary:'Легендарный'},betNames={red:'Красное',black:'Чёрное',even:'Чётное',odd:'Нечётное',low:'1–18',high:'19–36',seven:'Число 7'};
 function load(){try{return E.restore(localStorage.getItem(key));}catch{return E.fresh();}}
 function save(){try{localStorage.setItem(key,JSON.stringify(state));if($('.storage-note'))$('.storage-note').hidden=true;}catch{if($('.storage-note'))$('.storage-note').hidden=false;}}
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
 function svg(tag,attrs,text){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;}
 try{const url=new URL(sessionStorage.getItem('pgk-casino-return')||'/',location.href);if(url.origin===location.origin&&!url.pathname.startsWith('/peremena/'))for(const link of $$('#back-link,.footer-manual'))link.href=url.href;}catch{}
 function render(){
  $('#balance').textContent=format(state.balance);
  const owned=E.prizes.filter(p=>state.collection[p.id]).length,total=Object.values(state.collection).reduce((a,b)=>a+b,0);
  for(const node of $$('[data-collection-count]'))node.textContent=String(total);
  for(const node of $$('[data-owned-count]'))node.textContent=String(owned);
  for(const node of $$('[data-total-prizes]'))node.textContent=String(E.prizes.length);
  if($('#spin-count'))$('#spin-count').textContent=`Всего игр: ${format(state.spins)}`;
  if($('#prize-grid'))renderCollection();if($('#game-history'))renderHistory();
  if($('#last-numbers')){const last=$('#last-numbers');last.replaceChildren();const rounds=state.history.filter(h=>h.game==='roulette').slice(0,7);if(!rounds.length)last.append(el('small','','Тут появятся твои числа'));for(const h of rounds){const n=Number(h.label);last.append(el('span','number-pill '+E.color(n),String(n)));}}
  controls();
 }
 function renderCollection(){
  const grid=$('#prize-grid');grid.replaceChildren();let shown=0;
  for(const p of E.prizes){const count=state.collection[p.id]||0;if(collectionFilter==='owned'&&!count)continue;shown++;
   const card=el('article','prize-card'+(count?'':' locked'));card.dataset.rarity=p.rarity;
   card.append(el('span','rarity',rarities[p.rarity]),el('span',count?'prize-owned':'prize-lock',count?'×'+count:'Не найден'));
   const art=el('span','prize-art',p.icon);art.setAttribute('aria-hidden','true');card.append(art,el('h3','',p.name),el('p','',p.note));grid.append(card);
  }
  $('.collection-empty').hidden=shown>0;
 }
 function renderHistory(){
  const history=$('#game-history');history.replaceChildren();
  if(!state.history.length)history.append(el('li','history-empty','Пока ни одного раунда. Выбери игру в лобби — и история начнётся.'));
  for(const h of state.history){const row=el('li','history-row'),time=el('time','',new Date(h.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));time.dateTime=new Date(h.time).toISOString();
   const info=el('span');info.append(el('strong','',h.game==='roulette'?'Рулетка':'Три зачёта'),document.createTextNode(' · '+h.label));const net=h.payout-h.stake;
   row.append(time,info,el('span','','Ставка '+h.stake),el('span',net>0?'history-win':'history-loss',(net>0?'+':'')+format(net)+' ◉'));history.append(row);
  }
 }
 function betLabel(){return bet.startsWith('number:')?'Число '+bet.slice(7):betNames[bet];}
 function controls(){
  for(const button of $$('.bet-button,.stakes button,.number-choice'))button.disabled=busy;
  const which=page==='roulette'?'#spin-wheel':page==='slots'?'#spin-slots':null,stake=page==='roulette'?wheelStake:slotStake;
  if(which){const button=$(which);button.disabled=busy||state.balance<stake;button.setAttribute('aria-busy',String(busy));button.querySelector('.play-cost').firstChild.textContent=format(stake)+' ';button.querySelector('span:first-child').textContent=busy?(page==='roulette'?'Колесо вращается…':'Барабаны вращаются…'):(page==='roulette'?'Крутить рулетку':'Крутить барабаны');
   $('.action-hint').textContent=!busy&&state.balance<stake?'Не хватает фишек. Нажми «＋» возле баланса сверху.':'';
  }
  $('.refill-button').disabled=busy;
  if($('.selected-bet')){const label=betLabel()+' · ×'+(bet.startsWith('number:')?36:2);$('.selected-bet').textContent=label;const summary=$('.game-actionbar .table-heading>span');if(summary)summary.textContent=label;}
 }
 function announce(text){const node=$('.casino-announcement');node.textContent=text;node.classList.add('visible');clearTimeout(announcementTimer);announcementTimer=setTimeout(()=>node.classList.remove('visible'),3000);}
 async function motion(node,frames,options){if(!node?.animate)return;const animation=node.animate(frames,options);animations.add(animation);try{await animation.finished;}catch{}finally{animations.delete(animation);animation.cancel();}}
 function openDialog(dialog){if(dialog.open)return;dialog.showModal();}
 for(const dialog of $$('.casino-dialog')){
  for(const button of dialog.querySelectorAll('[data-close]'))button.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
 }
 function showPrize(result){
  const dialog=$('#prize-dialog'),prize=result.prize;dialog.dataset.rarity=prize.rarity;
  $('#win-icon').textContent=prize.icon;$('#win-rarity').textContent=rarities[prize.rarity]+' предмет';$('#prize-title').textContent=prize.name;
  $('#prize-description').textContent=prize.note+(state.collection[prize.id]>1?' В коллекции уже '+state.collection[prize.id]+'.':'');
  $('#win-payout').textContent='+'+format(result.payout)+' ◉';$('#win-net').textContent='Ставка '+result.stake+' учтена · чистый выигрыш +'+format(result.payout-result.stake);
  openDialog(dialog);$('.claim-prize').focus();
 }
 function showRules(){
  const roulette=page==='roulette';$('#rules-title').textContent=roulette?'Как играть в рулетку':'Как играть в «Три зачёта»';
  $('#rules-content').innerHTML=roulette?'<ol><li>Выбери цвет, чётность, диапазон или конкретное число.</li><li>Выбери ставку: 10, 25, 50 или 100 фишек.</li><li>Нажми «Крутить рулетку» и дождись остановки.</li></ol><div class="rules-payout"><div><span>Цвет, чётность или диапазон</span><b>×2</b></div><div><span>Точное число, включая 0</span><b>×36</b></div></div><p>Выплата включает ставку. На нуле ставки ×2 проигрывают. Колесо содержит 37 равновероятных чисел: шанс точного числа — 1 из 37, цвета — 18 из 37.</p>':'<ol><li>Выбери размер ставки.</li><li>Нажми «Крутить барабаны».</li><li>Два или три одинаковых символа приносят выигрыш.</li></ol><div class="rules-payout"><div><span>Два одинаковых</span><b>×2</b></div><div><span>Три одинаковых</span><b>×10</b></div><div><span>7 · 7 · 7</span><b>×25</b></div></div><p>Выплата включает ставку. На каждом барабане 6 равновероятных символов. Результаты барабанов независимы.</p>';
  $('#rules-content').append(el('p','','При любом выигрыше появится окно с виртуальным предметом. Он сразу сохраняется в коллекции. Бесплатные фишки можно взять кнопкой «＋» в шапке.'));
  openDialog($('#rules-dialog'));
 }
 for(const button of $$('.rules-button'))button.addEventListener('click',showRules);
 for(const button of $$('[data-filter]'))button.addEventListener('click',()=>{collectionFilter=button.dataset.filter;for(const other of $$('[data-filter]'))other.setAttribute('aria-pressed',String(other===button));renderCollection();});
 function makeWheel(){
  wheel.append(svg('circle',{cx:200,cy:200,r:194,fill:'#0c1e1a',stroke:'#ba9756','stroke-width':2}));
  E.wheel.forEach((n,i)=>{const a=(i*360/37-90-180/37)*Math.PI/180,b=(i*360/37-90+180/37)*Math.PI/180,pt=(r,t)=>[200+r*Math.cos(t),200+r*Math.sin(t)];const p=pt(189,a),q=pt(189,b),r=pt(142,b),s=pt(142,a);const d=`M${p}A189 189 0 0 1 ${q}L${r}A142 142 0 0 0 ${s}Z`;
   wheel.append(svg('path',{d,fill:n===0?'#267854':E.color(n)==='red'?'#9a3547':'#17131c',stroke:'#b0935a','stroke-width':.7}));
   const angle=i*360/37,mid=(angle-90)*Math.PI/180,x=200+166*Math.cos(mid),y=200+166*Math.sin(mid);
   wheel.append(svg('text',{x,y,fill:'#fff0d7','font-size':12,'font-family':'Georgia,serif','text-anchor':'middle','dominant-baseline':'central',transform:`rotate(${angle} ${x} ${y})`},n));
  });
  wheel.append(svg('circle',{cx:200,cy:200,r:136,fill:'#153c2f',stroke:'#b39659','stroke-width':2}));
  for(let i=0;i<37;i++){const a=(i*360/37-90-180/37)*Math.PI/180;wheel.append(svg('line',{x1:200+111*Math.cos(a),y1:200+111*Math.sin(a),x2:200+136*Math.cos(a),y2:200+136*Math.sin(a),stroke:'#b3965950','stroke-width':1}));}
 }
 async function spinWheel(result){
  const index=E.wheel.indexOf(result.number),target=(360-index*360/37)%360,delta=(target-rotation%360+360)%360,next=rotation+360*5+delta;
  $('#wheel-caption').textContent='Ставки сделаны. Колесо решает.';
  if(reduce.matches){rotation=target;wheel.style.transform=`rotate(${rotation}deg)`;await motion(wheel,[{opacity:.7},{opacity:1}],{duration:160});return;}
  const duration=4200;sounds.roulette(duration);const spin=motion(wheel,[{transform:`rotate(${rotation}deg)`},{transform:`rotate(${next}deg)`}],{duration,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
  const ball=motion($('.ball-orbit'),[{transform:'rotate(0deg)'},{transform:'rotate(-1800deg)'}],{duration,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
  await Promise.all([spin,ball]);sounds.stopSpin();sounds.play('ball-stop');rotation=target;wheel.style.transform=`rotate(${rotation}deg)`;
 }
 async function spinSlots(result){
  const strips=[...document.querySelectorAll('.reel-strip')];
  if(!reduce.matches)sounds.slots(2400);
  await Promise.all(strips.map(async(strip,i)=>{
   const symbol=E.symbols[result.reels[i]];
   if(reduce.matches){strip.replaceChildren(el('span','',symbol));await motion(strip,[{opacity:.6},{opacity:1}],{duration:160});return;}
   const initial=strip.querySelector('span')?.textContent||'🎓',n=22+i*4,fragment=document.createDocumentFragment();
   fragment.append(el('span','',initial));for(let j=1;j<n;j++)fragment.append(el('span','',E.symbols[E.randomInt(E.symbols.length)]));fragment.append(el('span','',symbol));strip.replaceChildren(fragment);
   const height=strip.parentElement.getBoundingClientRect().height;
   await motion(strip,[{transform:'translateY(0px)'},{transform:`translateY(${-n*height}px)`}],{duration:1700+i*350,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
   strip.replaceChildren(el('span','',symbol));strip.style.transform='translateY(0px)';sounds.play('reel-stop',i);
  }));
 }
 function resultBox(game,result){
  const box=$(game==='roulette'?'#roulette-result':'#slots-result'),win=result.payout>0;
  const title=game==='roulette'?`Выпало ${result.number}${result.number===0?' · зеро':E.color(result.number)==='red'?' · красное':' · чёрное'}`:result.reels.map(n=>E.symbols[n]).join(' · ');
  box.dataset.win=String(win);box.querySelector('.result-icon').textContent=result.prize?.icon||(game==='roulette'?'♠':'♣');
  box.querySelector('strong').textContent=win?`${title}. Выигрыш ${format(result.payout)} фишек`:`${title}. Ставка не сыграла`;
  box.querySelector('p').textContent=win?'Приз сохранён в коллекции.':`Потрачено ${result.stake} фишек. Бесплатное пополнение — кнопка «＋» сверху.`;
  if(game==='roulette')$('#wheel-caption').textContent=`Шарик на ${result.number}. ${win?'Есть выигрыш!':'Раунд завершён.'}`;
 }
 async function play(game){
  if(busy||$('.casino-dialog[open]'))return;
  state=load();const stake=game==='roulette'?wheelStake:slotStake;
  if(state.balance<stake){render();announce('Возьми бесплатные фишки кнопкой «＋» сверху.');return;}
  sounds.unlock();sounds.play('start');busy=true;controls();let round;
  try{
   round=E.play(state,{game,stake,bet});state=round.state;save();$('#balance').textContent=format(Math.max(0,state.balance-round.result.payout));
   const box=$(game==='roulette'?'#roulette-result':'#slots-result');box.dataset.win='false';box.querySelector('strong').textContent=game==='roulette'?'Ставки приняты. Колесо вращается…':'Ставка принята. Барабаны вращаются…';box.querySelector('p').textContent='Твоя ставка: '+stake+' виртуальных фишек.';
   if(game==='roulette')await spinWheel(round.result);else await spinSlots(round.result);
  }catch(error){announce('Не получилось запустить игру. Попробуй ещё раз.');console.error(error);}
  finally{sounds.stopSpin();busy=false;render();if(round){resultBox(game,round.result);sounds.play(round.result.payout>0?'win':'loss',round.result.prize?.rarity);if(round.result.prize)showPrize(round.result);}}
 }
 function selectBet(next){if(busy)return;sounds.unlock();if(bet!==next)sounds.play('select');bet=next;for(const button of $$('[data-bet]'))button.setAttribute('aria-pressed',String(button.dataset.bet===bet));const exact=bet.startsWith('number:');if($('#choose-number')){$('#choose-number').setAttribute('aria-pressed',String(exact));$('#choose-number span').textContent=exact?'Число '+bet.slice(7):'На конкретное число';}for(const button of $$('.number-choice'))button.setAttribute('aria-pressed',String('number:'+button.dataset.number===bet));controls();}
 for(const button of $$('[data-bet]'))button.addEventListener('click',()=>selectBet(button.dataset.bet));
 for(const group of $$('.stakes'))group.addEventListener('click',event=>{const button=event.target.closest('[data-stake]');if(!button||busy)return;sounds.unlock();sounds.play('select');const stake=Number(button.dataset.stake);if(page==='slots')slotStake=stake;else wheelStake=stake;for(const other of group.querySelectorAll('button'))other.setAttribute('aria-pressed',String(other===button));controls();});
 if(wheel){makeWheel();for(let n=0;n<=36;n++){const button=el('button','number-choice '+E.color(n),String(n));button.type='button';button.dataset.number=String(n);button.setAttribute('aria-label','Число '+n);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{selectBet('number:'+n);$('#number-dialog').close();});$('#number-picker').append(button);}$('#choose-number').addEventListener('click',()=>{if(!busy)openDialog($('#number-dialog'));});$('#spin-wheel').addEventListener('click',()=>play('roulette'));}
 if($('#spin-slots'))$('#spin-slots').addEventListener('click',()=>play('slots'));
 $('.refill-button').addEventListener('click',()=>{if(busy)return;state=load();const previous=state.balance;state.balance=Math.min(999999,state.balance+500);save();render();if(state.balance>previous){sounds.unlock();sounds.play('refill');}announce(state.balance===previous?'Банк уже полон.':`+${format(state.balance-previous)} бесплатных фишек в твоём банке.`);});
 $('.sound-toggle').addEventListener('click',()=>{sounds.setEnabled(!sounds.enabled);if(sounds.enabled)sounds.play('enable');});
 function finishAnimations(){for(const animation of animations)try{animation.finish();}catch{animation.cancel();}}
 reduce.addEventListener('change',()=>{if(reduce.matches){sounds.stopSpin();finishAnimations();}});document.addEventListener('visibilitychange',()=>{if(document.hidden){sounds.stop();finishAnimations();}});
 addEventListener('pagehide',()=>{finishAnimations();clearTimeout(announcementTimer);sounds.close();});
 addEventListener('storage',event=>{if(event.key===key&&!busy){state=load();render();}});
 addEventListener('pageshow',event=>{if(event.persisted){state=load();render();updateSoundButton();}});
 render();
 const latest=state.history.find(h=>h.game==='roulette');if(wheel&&latest){const n=Number(latest.label);if(E.wheel.includes(n)){rotation=(360-E.wheel.indexOf(n)*360/37)%360;wheel.style.transform=`rotate(${rotation}deg)`;$('#wheel-caption').textContent='Последнее число: '+n;}}
})();
