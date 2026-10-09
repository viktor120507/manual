import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { ChatRoom } from './worker.mjs';

async function makeRoom(storage) {
  storage ||= { alarm: null, async getAlarm() { return this.alarm; }, async setAlarm(value) { this.alarm = value; } };
  const ctx = { storage, blockConcurrencyWhile(fn) { this.ready = fn(); } };
  const room = new ChatRoom(ctx, {}); await ctx.ready;
  return { room, ctx };
}
const request = (path, data, session, ip = 'test-ip') => new Request(`https://chat.test/api/chat/${path}`, {
  method: data === undefined ? 'GET' : 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Chat-Client-IP': ip, ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
  ...(data === undefined ? {} : { body: JSON.stringify(data) })
});
async function post(room, path, data, session, ip) {
  const res = await room.fetch(request(path, data, session, ip));
  return { status: res.status, ...await res.json() };
}
async function listen(room, session, ip) {
  const response = await room.fetch(request(`events?token=${session.token}`, undefined, undefined, ip));
  assert.equal(response.status, 200);
  const reader = response.body.getReader(), events = [], decoder = new TextDecoder(); let buffer = '';
  const pumping = (async () => {
    while (true) {
      const { done, value } = await reader.read(); if (done) return;
      buffer += decoder.decode(value, { stream: true }); let index;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        events.push({ event: /event: (.+)/.exec(block)[1], data: JSON.parse(/data: (.+)/.exec(block)[1]) });
      }
    }
  })();
  return {
    reader, events, pumping,
    async until(predicate) {
      const start = Date.now();
      while (!events.some(predicate)) {
        if (Date.now() - start > 2000) throw Error('SSE event timeout');
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      return events.find(predicate).data;
    }
  };
}

test('Cloudflare room: anonymous delivery, shared presence, two-hour alarm and bounded history', async () => {
  const { room, ctx } = await makeRoom(); let clock = Date.now(); room.now = () => clock;
  const a = await post(room, 'join', { name: 'Виктор' });
  const b = await post(room, 'join', { name: 'Одногруппник' });
  assert.notEqual(a.token, b.token); assert.equal(a.status, 200);
  const first = await listen(room, a), second = await listen(room, b);
  try {
    await first.until(e => e.event === 'presence' && e.data.users.length === 2);
    const payload = '<img src=x onerror=alert(1)>';
    const sent = await post(room, 'message', { text: payload }, a);
    assert.equal(sent.status, 201);
    assert.equal((await second.until(e => e.event === 'message' && e.data.id === sent.id)).text, payload);
    assert.equal((await post(room, 'profile', { name: 'Новое имя' }, a)).status, 200);
    await second.until(e => e.event === 'presence' && e.data.users.some(u => u.name === 'Новое имя'));
    for (let i = 0; i < 205; i++) {
      clock += 2000;
      if(i % 10 === 0) assert.equal((await post(room, 'ping', {}, b)).status, 200);
      assert.equal((await post(room, 'message', { text: `Сообщение ${i}` }, a)).status, 201);
    }
    assert.equal(room.messages.length, 200); assert.equal(room.messages.at(-1).text, 'Сообщение 204');
    assert.equal((await post(room, 'message', { text: 'x'.repeat(801) }, a)).status, 400);
    assert.equal((await post(room, 'message', { text: ' ' }, a)).status, 400);
    assert.equal((await post(room, 'message', { text: 'test' }, a, 'other-ip')).status, 401);
    assert.equal((await post(room, 'message', { text: 'test' }, { token: 'fake' })).status, 401);
    let rateLimited = false;
    for (let i = 0; i < 10; i++) if ((await post(room, 'message', { text: 'быстро' }, a)).status === 429) rateLimited = true;
    assert.ok(rateLimited);
    clock = room.resetAt + 1; await room.alarm();
    for(const session of room.sessions.values()) session.lastSeen=clock;
    await first.until(e => e.event === 'reset');
    assert.equal(room.messages.length, 0); assert.equal(ctx.storage.alarm, clock + 7200000);
    const reopened = await listen(room, a);
    assert.deepEqual((await reopened.until(e => e.event === 'snapshot')).messages, []);
    await reopened.reader.cancel(); await reopened.pumping;
    const before = first.events.length;
    await second.reader.cancel(); await second.pumping;
    await first.until((e, index) => index >= before && e.event === 'presence' && e.data.users.length === 1);
    clock += 31 * 60000; room.cleanup();
    assert.equal(room.sessions.has(b.token), false);
    assert.ok(room.limits.size <= 2000);
  } finally {
    await first.reader.cancel(); await second.reader.cancel();
    await Promise.all([first.pumping, second.pumping]);
    assert.equal(room.clients.size, 0); assert.equal(room.timer, null);
  }
});

test('Request boundary: oversized streaming body, malformed JSON and non-object bodies', async () => {
  const { room } = await makeRoom();
  for (const data of [null, [], 'string']) assert.equal((await post(room, 'join', data)).status, 400);
  const large = await room.fetch(request('join', { name: 'x'.repeat(5000) }));
  assert.equal(large.status, 413);
  const malformed = new Request('https://chat.test/api/chat/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal((await room.fetch(malformed)).status, 400);
  const wrongType = new Request('https://chat.test/api/chat/join', { method: 'POST', body: '{}' });
  assert.equal((await room.fetch(wrongType)).status, 415);
});

test('Gateway: exact CORS origins, trusted IP replacement, one shared room and private token handling', async () => {
  let forwarded, roomName;
  const env = { ALLOWED_ORIGINS: 'https://pgk-mdk.ru', CHAT_ROOM: {
    idFromName(name) { roomName = name; return 'fixed-room'; },
    get() { return { async fetch(req) { forwarded = req; return Response.json({ ok: true }); } }; }
  }};
  const allowed = new Request('https://chat.test/api/chat/join', { method: 'POST', headers: {
    Origin: 'https://pgk-mdk.ru', 'CF-Connecting-IP': 'trusted', 'X-Chat-Client-IP': 'spoofed',
    'Content-Type': 'application/json'
  }, body: '{}' });
  const reply = await worker.fetch(allowed, env);
  assert.equal(reply.status, 200); assert.equal(reply.headers.get('Access-Control-Allow-Origin'), 'https://pgk-mdk.ru');
  assert.equal(forwarded.headers.get('X-Chat-Client-IP'), 'trusted'); assert.equal(roomName, 'pgk-praktikum-mdk-v1');
  assert.equal((await worker.fetch(new Request('https://chat.test/api/chat/join', { method: 'POST', body: '{}' }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://chat.test/api/chat/health', { headers: { Origin: 'https://evil.test' } }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://chat.test/api/chat/health'), env)).status, 200);
  assert.equal((await worker.fetch(new Request('https://chat.test/other'), env)).status, 404);
  const preflight = await worker.fetch(new Request('https://chat.test/api/chat/message', { method: 'OPTIONS', headers: { Origin: 'https://pgk-mdk.ru' } }), env);
  assert.equal(preflight.status, 204); assert.ok(preflight.headers.get('Access-Control-Allow-Headers').includes('Authorization'));
});

test('Object recreation never restores message bodies; only the cleanup deadline persists', async () => {
  const alarm = Date.now() + 600000;
  const storage = { async getAlarm() { return alarm; }, async setAlarm() { throw Error('Existing future alarm should be reused'); } };
  const { room } = await makeRoom(storage);
  assert.equal(room.resetAt, alarm); assert.deepEqual(room.messages, []); assert.equal(room.sessions.size, 0);
});

test('Presence lease removes a vanished visitor even when the SSE proxy fails to cancel', async () => {
  const { room } = await makeRoom(); let clock = Date.now(); room.now = () => clock;
  const a = await post(room, 'join', { name: 'Активный' }), b = await post(room, 'join', { name: 'Ушёл' });
  const first = await listen(room, a), second = await listen(room, b);
  try {
    clock += 40000; assert.equal((await post(room, 'ping', {}, a)).status, 200);
    clock += 50001; assert.equal((await post(room, 'ping', {}, a)).status, 200);
    assert.deepEqual(room.online().map(user => user.name), ['Активный']);
    assert.equal((await post(room, 'message', { text: 'expired connection' }, b)).status, 401);
    assert.equal((await post(room, 'leave', {}, a)).status, 200);
    assert.equal(room.clients.size, 0); assert.equal(room.timer, null);
  } finally { await first.reader.cancel(); await second.reader.cancel(); await Promise.all([first.pumping, second.pumping]); }
});
