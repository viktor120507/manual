import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {resolve, dirname, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export function createChatServer(options={}) {
 const now=options.now || Date.now;
 const period=options.period || 2*60*60*1000;
 const maxMessages=options.maxMessages || 200;
 const staticRoot=options.staticRoot && resolve(options.staticRoot);
 const allowed=new Set(options.allowedOrigins || ['http://127.0.0.1:8780','http://localhost:8780','http://127.0.0.1:8776','http://localhost:8776']);
 const sessions=new Map(), clients=new Set(), limits=new Map();
 let messages=[],resetAt=now()+period;
 const cleanName=value=>String(value || '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/g,' ').trim().slice(0,24);
 // Keep only printable text and line breaks. Messages never become HTML.
 function text(value){return String(value || '').normalize('NFC').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,'').trim();}
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 function emit(client,event,data){
  if(client.res.destroyed)return;
  if(client.res.writableLength>65536){client.res.destroy();return;}
  client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
 }
 function broadcast(event,data){for(const client of clients)emit(client,event,data);}
 function online(){const seen=new Set();return [...clients].filter(c=>!seen.has(c.session.id)&&seen.add(c.session.id)).map(c=>({id:c.session.id,name:c.session.name}));}
 function presence(){broadcast('presence',{users:online()});}
 function resetIfDue(){if(now()>=resetAt){messages=[];resetAt=now()+period;broadcast('reset',{resetAt});}}
 function limit(ip,kind,count,window){
  const key=kind+':'+ip,time=now();let bucket=limits.get(key);
  if(!bucket || time>=bucket.until){
   if(!bucket && limits.size>=2000){for(const [k,v] of limits)if(time>=v.until)limits.delete(k);if(limits.size>=2000)return false;}
   bucket={count:0,until:time+window};limits.set(key,bucket);
  }
  return ++bucket.count<=count;
 }
 async function body(req){
  let bytes=0,parts=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw Object.assign(new Error('Сообщение слишком большое.'),{status:413});parts.push(chunk);}
  try{const data=JSON.parse(Buffer.concat(parts).toString() || '{}');if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw Object.assign(new Error('Некорректный запрос.'),{status:400});}
 }
 function session(req,url,ip){const token=req.headers.authorization?.replace(/^Bearer /,'') || url.searchParams.get('token');const s=sessions.get(token);return s?.ip===ip?s:null;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const origin=req.headers.origin;
  if(origin && !allowed.has(origin)){json(res,403,{error:'Источник запроса не разрешён.'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});res.end();return;}
  const ip=req.socket.remoteAddress || 'unknown';
  let url;try{url=new URL(req.url,'http://localhost');}catch{json(res,400,{error:'Некорректный адрес.'});return;}
  const path=url.pathname;
  resetIfDue();
  try{
   if(path==='/api/chat/health' && req.method==='GET'){json(res,200,{ok:true,online:online().length,resetAt,maxMessages});return;}
   if(path==='/api/chat/join' && req.method==='POST'){
    if(!limit(ip,'join',60,60000)){json(res,429,{error:'Слишком много подключений. Попробуйте чуть позже.'});return;}
    const data=await body(req);let s=sessions.get(data.token);
    if(!s || s.ip!==ip){
     if(sessions.size>=500){json(res,503,{error:'Чат заполнен. Попробуйте позже.'});return;}
     const token=randomUUID();s={token,id:randomUUID(),ip,name:cleanName(data.name)||'Гость '+String(Math.floor(Math.random()*9000)+1000),lastSeen:now()};sessions.set(token,s);
    }
    s.lastSeen=now();json(res,200,{token:s.token,id:s.id,name:s.name,resetAt,maxMessages});return;
   }
   if(path==='/api/chat/events' && req.method==='GET'){
    const s=session(req,url,ip);if(!s){json(res,401,{error:'Подключитесь к чату заново.'});return;}
    if(clients.size>=60 || [...clients].filter(c=>c.session.ip===ip).length>=20){json(res,503,{error:'Слишком много открытых вкладок чата.'});return;}
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
    const client={res,session:s};clients.add(client);s.lastSeen=now();
    emit(client,'snapshot',{messages,users:online(),resetAt,maxMessages});presence();
    res.on('close',()=>{clients.delete(client);s.lastSeen=now();presence();});return;
   }
   if((path==='/api/chat/message' || path==='/api/chat/profile') && req.method==='POST'){
    const s=session(req,url,ip);if(!s || ![...clients].some(c=>c.session===s)){json(res,401,{error:'Дождитесь подключения к чату.'});return;}
    if(!limit(ip,'request',120,10000)){json(res,429,{error:'Слишком много запросов. Подождите немного.'});return;}
    const data=await body(req);
    if(path.endsWith('/profile')){
     const name=cleanName(data.name);if(!name){json(res,400,{error:'Введите имя.'});return;}
     s.name=name;presence();json(res,200,{name});return;
    }
    const message=typeof data.text==='string'?text(data.text):'';
    if(!message || [...message].length>800){json(res,400,{error:'Сообщение должно содержать от 1 до 800 символов.'});return;}
    if(!limit(s.id,'sender',8,10000) || !limit(ip,'message',60,10000) || !limit('all','global',120,60000)){json(res,429,{error:'Не так быстро: подождите несколько секунд.'});return;}
    const item={id:randomUUID(),senderId:s.id,name:s.name,text:message,time:now()};messages.push(item);
    if(messages.length>maxMessages)messages.splice(0,messages.length-maxMessages);
    broadcast('message',item);json(res,201,{id:item.id});return;
   }
   if(path.startsWith('/api/')){json(res,404,{error:'Запрос не найден.'});return;}
   if(staticRoot && req.method==='GET'){
    let decoded;try{decoded=decodeURIComponent(path);}catch{json(res,400,{error:'Некорректный адрес.'});return;}
    if(!/^\/(?:$|demo-2026\/|assets\/|page-\d+\.html$|favicon\.ico$)/.test(decoded)){json(res,404,{error:'Страница не найдена.'});return;}
    let file=resolve(staticRoot,'.'+decoded);if(!file.startsWith(staticRoot+sep)&&file!==staticRoot){json(res,403,{error:'Недоступно.'});return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'}[extname(file)];
    if(!mime){json(res,404,{error:'Недоступно.'});return;}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime});res.end(data);return;
   }
   json(res,404,{error:'Страница не найдена.'});
  }catch(e){if(!res.headersSent)json(res,e.status || (e.code==='ENOENT'?404:500),{error:e.status?e.message:'Не удалось выполнить запрос.'});else res.destroy();}
 });
 const timer=setInterval(()=>{
  resetIfDue();
  const time=now();for(const [k,v] of limits)if(time>=v.until)limits.delete(k);
  const active=new Set([...clients].map(c=>c.session.token));
  for(const [token,s] of sessions)if(!active.has(token)&&time-s.lastSeen>30*60000)sessions.delete(token);
  for(const c of clients){c.session.lastSeen=time;emit(c,'heartbeat',{time,resetAt});}
 },options.tick || 15000);timer.unref();
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=30;
 return {server,resetIfDue,stats:()=>({messages:messages.length,sessions:sessions.size,connections:clients.size,rateBuckets:limits.size,resetAt}),close:async()=>{clearInterval(timer);for(const c of clients)c.res.end();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const port=Number(process.env.PORT || 8780),host=process.env.HOST || '127.0.0.1';
 const app=createChatServer({staticRoot:process.env.SERVE_SITE==='0'?null:root,allowedOrigins:process.env.ALLOWED_ORIGINS?.split(',').map(s=>s.trim())});
 app.server.listen(port,host,()=>console.log(`Chat preview: http://${host}:${port}/ — messages in memory, cleared every 2 hours.`));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
}
