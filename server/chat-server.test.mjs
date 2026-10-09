import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChatServer} from './chat-server.mjs';

test('Anonymous live chat: delivery, limits, reset, reconnect and input boundaries',async()=>{
 let clock=1000000;
 const app=createChatServer({now:()=>clock,maxMessages:3,tick:30,allowedOrigins:['http://test.local']});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}/api/chat`,streams=[];
 async function post(path,data,session,origin='http://test.local'){
  const res=await fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(data)});
  return {status:res.status,...await res.json()};
 }
 async function listen(session){
  const controller=new AbortController();streams.push(controller);
  const res=await fetch(base+'/events?token='+session.token,{signal:controller.signal});assert.equal(res.status,200);
  const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';const events=[];
  const pumping=(async()=>{try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let index;
   while((index=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,index);buffer=buffer.slice(index+2);const event=/event: (.+)/.exec(block)?.[1],data=/data: (.+)/.exec(block)?.[1];if(data)events.push({event,data:JSON.parse(data)});}
  }}catch(e){if(!controller.signal.aborted)throw e;}})();
  const until=async(predicate)=>{const start=Date.now();while(!events.some(predicate)){if(Date.now()-start>2000)throw Error('Event timeout');await new Promise(resolve=>setTimeout(resolve,10));}return events.find(predicate).data;};
  return {events,until,controller,pumping};
 }
 try{
  const a=await post('/join',{name:'Виктор'}),b=await post('/join',{name:'Одногруппник'});
  assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.token,b.token);
  const first=await listen(a),second=await listen(b);
  await first.until(e=>e.event==='presence'&&e.data.users.length===2);
  const snapshot=await second.until(e=>e.event==='snapshot');assert.equal(snapshot.users.length,2);assert.deepEqual(snapshot.messages,[]);
  const payload='<img src=x onerror=alert(1)>';const sent=await post('/message',{text:payload},a);assert.equal(sent.status,201);
  const incoming=await second.until(e=>e.event==='message'&&e.data.id===sent.id);assert.equal(incoming.name,'Виктор');assert.equal(incoming.text,payload);
  assert.equal(await first.until(e=>e.event==='message'&&e.data.id===sent.id).then(x=>x.senderId),a.id);
  for(let i=0;i<4;i++)assert.equal((await post('/message',{text:'Сообщение '+i},a)).status,201);
  assert.equal(app.stats().messages,3);
  const third=await listen(b);const limited=await third.until(e=>e.event==='snapshot');assert.equal(limited.messages.length,3);assert.equal(limited.messages[2].text,'Сообщение 3');
  assert.equal((await post('/message',{text:'x'.repeat(801)},a)).status,400);
  assert.equal((await post('/message',{text:'   '},a)).status,400);
  assert.equal((await post('/message',{text:'blocked'},a,'http://unapproved.local')).status,403);
  assert.equal((await post('/message',{text:'blocked'},{token:'fake'})).status,401);
  assert.equal((await post('/profile',{name:'Новое имя'},a)).status,200);
  await second.until(e=>e.event==='presence'&&e.data.users.some(u=>u.name==='Новое имя'));
  let throttled=false;for(let i=0;i<8;i++)if((await post('/message',{text:'rapid '+i},a)).status===429)throttled=true;
  assert.ok(throttled,'burst protection applies');
  clock=app.stats().resetAt+1;app.resetIfDue();
  await first.until(e=>e.event==='reset');assert.equal(app.stats().messages,0);
  const fourth=await listen(a);const clean=await fourth.until(e=>e.event==='snapshot');assert.deepEqual(clean.messages,[]);assert.equal(clean.resetAt-clock,7200000);
  const reused=await post('/join',{token:a.token},null);assert.equal(reused.id,a.id);
  const last=first.events.length;second.controller.abort();third.controller.abort();
  await first.until((e,index)=>index>=last&&e.event==='presence'&&e.data.users.length===1);
  assert.ok(app.stats().messages<=3);assert.ok(app.stats().rateBuckets<=2000);
 }finally{for(const s of streams)s.abort();await app.close();}
});
