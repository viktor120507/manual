/* The game is entirely local: chips and college souvenirs have no monetary value. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PGKCasino=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const wheel=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
 const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
 const symbols=['🎓','📓','💾','🧃','✏️','7'];
 const prizes=[
  {id:'pen',icon:'🖊️',name:'Ручка, которая пишет',note:'Не синяя. Не чёрная. Работает — уже хорошо.',rarity:'common',weight:26},
  {id:'chalk',icon:'🧱',name:'Кусочек мела',note:'Половина осталась на доске.',rarity:'common',weight:24},
  {id:'notebook',icon:'📓',name:'Тетрадь на 12 листов',note:'Хватит на одну очень короткую лекцию.',rarity:'common',weight:22},
  {id:'cable',icon:'🔌',name:'Патч-корд из лаборантской',note:'Обжат с двух сторон. Уже легенда.',rarity:'rare',weight:12},
  {id:'usb',icon:'💾',name:'Флешка с лабами',note:'lab_final_final_ТОЧНО_2.zip',rarity:'rare',weight:10},
  {id:'pass',icon:'🪪',name:'Пропуск без фото',note:'Охрана узнает по выражению лица.',rarity:'rare',weight:4},
  {id:'credit',icon:'🏆',name:'Золотой зачёт',note:'Сам себе поставил. Сам собой гордишься.',rarity:'legendary',weight:2}
 ];
 const bets=['red','black','even','odd','low','high','seven'];
 const limit=999999;
 function integer(n,max=limit){return Number.isSafeInteger(n)&&n>=0&&n<=max;}
 function fresh(){return {version:1,balance:1000,spins:0,collection:{},history:[]};}
 function restore(raw){
  try{const x=typeof raw==='string'?JSON.parse(raw):raw;if(!x||x.version!==1||!integer(x.balance)||!integer(x.spins))return fresh();
   const state=fresh();state.balance=x.balance;state.spins=x.spins;
   for(const p of prizes)if(integer(x.collection?.[p.id],9999)&&x.collection[p.id])state.collection[p.id]=x.collection[p.id];
   state.history=Array.isArray(x.history)?x.history.filter(h=>h&&['roulette','slots'].includes(h.game)&&integer(h.stake,100)&&integer(h.payout,3600)&&typeof h.label==='string'&&h.label.length<80&&Number.isFinite(h.time)&&h.time>=0&&h.time<=8640000000000000).slice(0,12):[];return state;
  }catch{return fresh();}
 }
 function randomInt(size){if(!Number.isSafeInteger(size)||size<1||size>4294967296)throw Error('Invalid range');const c=globalThis.crypto;if(c?.getRandomValues){const cutoff=4294967296-(4294967296%size);const a=new Uint32Array(1);do{c.getRandomValues(a);}while(a[0]>=cutoff);return a[0]%size;}return Math.floor(Math.random()*size);}
 function color(n){return n===0?'green':reds.has(n)?'red':'black';}
 function validBet(bet){return bets.includes(bet)||(typeof bet==='string'&&/^number:(?:[0-9]|[12][0-9]|3[0-6])$/.test(bet));}
 function rouletteMultiplier(n,bet){if(!integer(n,36)||!validBet(bet))throw Error('Invalid roulette choice');if(bet.startsWith('number:'))return n===Number(bet.slice(7))?36:0;if(bet==='seven')return n===7?36:0;if(n===0)return 0;return ((bet==='red'&&reds.has(n))||(bet==='black'&&!reds.has(n))||(bet==='even'&&n%2===0)||(bet==='odd'&&n%2===1)||(bet==='low'&&n<=18)||(bet==='high'&&n>=19))?2:0;}
 function slotsMultiplier(reels){if(reels.length!==3||reels.some(n=>!integer(n,symbols.length-1)))throw Error('Invalid reels');return reels.every(n=>n===reels[0])?(reels[0]===5?25:10):new Set(reels).size===2?2:0;}
 function drawPrize(rng){let roll=rng(100);for(const p of prizes){roll-=p.weight;if(roll<0)return p;}return prizes[0];}
 function play(current,{game,stake,bet='red'},rng=randomInt,now=Date.now()){
  const state=restore(current);if(!['roulette','slots'].includes(game)||![10,25,50,100].includes(stake)||state.balance<stake||!validBet(bet))throw Error('Недостаточно фишек или неверная ставка');
  const number=game==='roulette'?wheel[rng(wheel.length)]:null;
  const reels=game==='slots'?[rng(symbols.length),rng(symbols.length),rng(symbols.length)]:null;
  const multiplier=game==='roulette'?rouletteMultiplier(number,bet):slotsMultiplier(reels),payout=stake*multiplier;
  const prize=payout?drawPrize(rng):null;
  state.balance=Math.min(limit,state.balance-stake+payout);state.spins=Math.min(limit,state.spins+1);
  if(prize)state.collection[prize.id]=Math.min(9999,(state.collection[prize.id]||0)+1);
  const label=game==='roulette'?String(number):reels.map(n=>symbols[n]).join(' · ');
  state.history.unshift({game,stake,payout,label,time:now});state.history=state.history.slice(0,12);
  return {state,result:{game,number,reels,multiplier,payout,prize,stake}};
 }
 return Object.freeze({wheel,symbols,prizes,bets,fresh,restore,randomInt,color,rouletteMultiplier,slotsMultiplier,play});
});
