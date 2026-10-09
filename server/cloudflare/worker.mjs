// One Durable Object coordinates the whole site. Message bodies never enter storage.
const PERIOD = 2 * 60 * 60 * 1000;
const MAX_MESSAGES = 200;
const encoder = new TextEncoder();
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
const fail = (message, status) => Object.assign(new Error(message), { status });
const cleanName = value => typeof value === 'string' ? value.normalize('NFKC')
  .replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24) : '';
const cleanText = value => typeof value === 'string' ? value.normalize('NFC')
  .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim() : '';

async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw fail('Ожидается JSON.', 415);
  if (Number(request.headers.get('Content-Length')) > 4096) throw fail('Запрос слишком большой.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw fail('Пустой запрос.', 400);
  let bytes = 0, parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); throw fail('Запрос слишком большой.', 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const combined = new Uint8Array(bytes); let offset = 0;
    for (const part of parts) { combined.set(part, offset); offset += part.byteLength; }
    const data = JSON.parse(new TextDecoder().decode(combined));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data;
  } catch { throw fail('Некорректный запрос.', 400); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    const allowed = new Set((env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
    // The Worker URL isn't a website: mutations and streams must come from an allowed site.
    if (origin && !allowed.has(origin)) return json({ error: 'Источник запроса не разрешён.' }, 403);
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    function wrap(response) {
      const result = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) result.set(key, value);
      return new Response(response.body, { status: response.status, headers: result });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600'
    }});
    if (!/^\/api\/chat\/(health|join|events|message|profile|ping|leave)$/.test(url.pathname))
      return wrap(json({ error: 'Запрос не найден.' }, 404));
    if (!origin && url.pathname !== '/api/chat/health')
      return wrap(json({ error: 'Откройте чат на сайте практикума.' }, 403));
    try {
      const trusted = new Headers(request.headers);
      // Replace, never trust an IP supplied in a client-created header.
      trusted.set('X-Chat-Client-IP', request.headers.get('CF-Connecting-IP') || 'local');
      const forwarded = new Request(request, { headers: trusted });
      const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('pgk-praktikum-mdk-v1'));
      return wrap(await room.fetch(forwarded));
    } catch { return wrap(json({ error: 'Чат временно недоступен. Попробуйте позже.' }, 503)); }
  }
};

export class ChatRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.messages = [];
    this.sessions = new Map();
    this.clients = new Set();
    this.limits = new Map();
    this.timer = null;
    this.presenceQueued = false;
    this.now = () => Date.now();
    this.resetAt = this.now() + PERIOD;
    // Only the cleanup deadline is persistent. No messages, names, IPs or tokens are written.
    ctx.blockConcurrencyWhile(async () => {
      const alarm = await ctx.storage.getAlarm();
      if (alarm > this.now()) this.resetAt = alarm;
      else await ctx.storage.setAlarm(this.resetAt);
    });
  }
  online() {
    const seen = new Set();
    return [...this.clients].filter(c => !seen.has(c.session.id) && seen.add(c.session.id))
      .map(c => ({ id: c.session.id, name: c.session.name }));
  }
  drop(client) {
    if (!this.clients.delete(client)) return;
    client.session.lastSeen = this.now();
    try { client.controller.close(); } catch {}
    if (!this.clients.size) { clearInterval(this.timer); this.timer = null; }
    if (!this.presenceQueued) {
      this.presenceQueued = true;
      queueMicrotask(() => { this.presenceQueued = false; this.broadcast('presence', { users: this.online() }); });
    }
  }
  emit(client, event, data) {
    if (!this.clients.has(client)) return;
    try {
      if (client.controller.desiredSize <= 0) { this.drop(client); return; }
      client.controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch { this.drop(client); }
  }
  broadcast(event, data) { for (const client of this.clients) this.emit(client, event, data); }
  async resetIfDue() {
    if (this.now() < this.resetAt) return;
    this.messages = [];
    this.resetAt = this.now() + PERIOD;
    this.broadcast('reset', { resetAt: this.resetAt });
    await this.ctx.storage.setAlarm(this.resetAt);
  }
  async alarm() { await this.resetIfDue(); }
  cleanup() {
    const time = this.now();
    // Streaming proxies don't always propagate a closed browser connection promptly.
    // Browser acknowledgements keep presence bounded even if stream cancellation is lost.
    for (const client of this.clients) if (time - client.session.lastSeen > 90000) this.drop(client);
    for (const [key, bucket] of this.limits) if (time >= bucket.until) this.limits.delete(key);
    const active = new Set([...this.clients].map(c => c.session.token));
    for (const [token, session] of this.sessions)
      if (!active.has(token) && time - session.lastSeen > 30 * 60000) this.sessions.delete(token);
  }
  limited(id, kind, count, window) {
    const key = `${kind}:${id}`, time = this.now(); let bucket = this.limits.get(key);
    if (!bucket || time >= bucket.until) {
      if (!bucket && this.limits.size >= 2000) { this.cleanup(); if (this.limits.size >= 2000) return true; }
      bucket = { count: 0, until: time + window }; this.limits.set(key, bucket);
    }
    return ++bucket.count > count;
  }
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    const ip = request.headers.get('X-Chat-Client-IP') || 'local';
    try {
      await this.resetIfDue(); this.cleanup();
      if (path.endsWith('/health') && request.method === 'GET')
        return json({ ok: true, provider: 'cloudflare', online: this.online().length, resetAt: this.resetAt, maxMessages: MAX_MESSAGES });
      if (path.endsWith('/join') && request.method === 'POST') {
        if (this.limited(ip, 'join', 60, 60000)) throw fail('Слишком много подключений. Подождите немного.', 429);
        const data = await readBody(request); let session = this.sessions.get(data.token);
        if (!session || session.ip !== ip) {
          if (this.sessions.size >= 500) throw fail('Чат заполнен. Попробуйте позже.', 503);
          session = { token: crypto.randomUUID(), id: crypto.randomUUID(), ip,
            name: cleanName(data.name) || `Гость ${Math.floor(Math.random() * 9000) + 1000}`, lastSeen: this.now() };
          this.sessions.set(session.token, session);
        }
        session.lastSeen = this.now();
        return json({ token: session.token, id: session.id, name: session.name, resetAt: this.resetAt, maxMessages: MAX_MESSAGES, presenceLease: true });
      }
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || url.searchParams.get('token');
      const session = this.sessions.get(token);
      if (!session || session.ip !== ip) throw fail('Дождитесь подключения к чату.', 401);
      if (path.endsWith('/events') && request.method === 'GET') {
        if (this.clients.size >= 60 || [...this.clients].filter(c => c.session.ip === ip).length >= 20)
          throw fail('Слишком много открытых вкладок чата.', 503);
        let client;
        const body = new ReadableStream({
          start: controller => {
            client = { controller, session }; this.clients.add(client); session.lastSeen = this.now();
            this.emit(client, 'snapshot', { messages: this.messages, users: this.online(), resetAt: this.resetAt, maxMessages: MAX_MESSAGES });
            this.broadcast('presence', { users: this.online() });
          },
          cancel: () => this.drop(client)
        }, { highWaterMark: 65536, size: chunk => chunk.byteLength });
        if (!this.timer) this.timer = setInterval(async () => {
          try { await this.resetIfDue(); } catch { /* next request/alarm retries cleanup */ }
          this.cleanup();
          for (const c of this.clients) {
            this.emit(c, 'heartbeat', { time: this.now(), resetAt: this.resetAt });
          }
        }, 15000);
        return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      if (!['/api/chat/profile', '/api/chat/message', '/api/chat/ping', '/api/chat/leave'].includes(path) || request.method !== 'POST')
        throw fail('Запрос не найден.', 404);
      if (![...this.clients].some(c => c.session === session)) throw fail('Дождитесь подключения к чату.', 401);
      if (this.limited(ip, 'request', 120, 10000)) throw fail('Слишком много запросов. Подождите немного.', 429);
      const data = await readBody(request);
      if (path.endsWith('/leave')) {
        for (const client of this.clients) if (client.session === session) this.drop(client);
        return json({ ok: true });
      }
      session.lastSeen = this.now();
      if (path.endsWith('/ping')) return json({ ok: true });
      if (path.endsWith('/profile')) {
        const name = cleanName(data.name); if (!name) throw fail('Введите имя.', 400);
        session.name = name; this.broadcast('presence', { users: this.online() }); return json({ name });
      }
      const text = cleanText(data.text);
      if (!text || [...text].length > 800) throw fail('Сообщение должно содержать от 1 до 800 символов.', 400);
      if (this.limited(session.id, 'sender', 8, 10000) || this.limited(ip, 'message', 60, 10000) || this.limited('all', 'global', 120, 60000))
        throw fail('Не так быстро: подождите несколько секунд.', 429);
      const message = { id: crypto.randomUUID(), senderId: session.id, name: session.name, text, time: this.now() };
      this.messages.push(message);
      if (this.messages.length > MAX_MESSAGES) this.messages.splice(0, this.messages.length - MAX_MESSAGES);
      this.broadcast('message', message); return json({ id: message.id }, 201);
    } catch (error) { return json({ error: error.status ? error.message : 'Не удалось выполнить запрос.' }, error.status || 500); }
  }
}
