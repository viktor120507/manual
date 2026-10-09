// Exercises the local Cloudflare runtime, or CHAT_TEST_ENDPOINT after deployment.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Real Cloudflare runtime: anonymous peers, live delivery and CORS', { timeout: 30000 }, async () => {
  const endpoint = process.env.CHAT_TEST_ENDPOINT || 'http://127.0.0.1:8781/api/chat', origin = 'http://127.0.0.1:8780';
  async function post(path, data, session) {
    const response = await fetch(endpoint + path, { method: 'POST', headers: {
      Origin: origin, 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {})
    }, body: JSON.stringify(data), signal: AbortSignal.timeout(5000) });
    assert.ok(response.ok, `${path}: ${response.status}`); return response.json();
  }
  const a = await post('/join', { name: 'Тест Cloudflare 1' }), b = await post('/join', { name: 'Тест Cloudflare 2' });
  const controllers = [new AbortController(), new AbortController()];
  try {
    const responses = await Promise.all([a, b].map((session, index) => fetch(endpoint + '/events?token=' + session.token, {
      headers: { Origin: origin }, signal: controllers[index].signal
    })));
    assert.ok(responses.every(r => r.ok));
    assert.ok(responses.every(r => r.headers.get('Access-Control-Allow-Origin') === origin));
    const reader = responses[1].body.getReader(); let buffer = '';
    const message = 'Cloudflare: сообщение получено второй сессией ' + crypto.randomUUID();
    await post('/message', { text: message }, a);
    for (let i = 0; i < 10 && !buffer.includes(message); i++) buffer += new TextDecoder().decode((await reader.read()).value);
    assert.ok(buffer.includes(message));
    const health = await (await fetch(endpoint + '/health')).json();
    assert.equal(health.provider, 'cloudflare'); assert.ok(health.online >= 2); assert.equal(health.maxMessages, 200);
    const denied = await fetch(endpoint + '/join', { method: 'POST', headers: {
      Origin: 'https://unapproved.test', 'Content-Type': 'application/json'
    }, body: '{}' });
    assert.equal(denied.status, 403);
  } finally {
    for (const session of [a, b]) await post('/leave', {}, session);
    for (const controller of controllers) controller.abort();
  }
});
