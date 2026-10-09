// Bounded functional load test: at most 20 peers, 55 messages, about 90 seconds.
// Only use against a chat deployment you own. Tokens are never logged or saved.
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import http2 from 'node:http2';
import { Readable } from 'node:stream';

const endpoint = process.env.CHAT_TEST_ENDPOINT;
assert.ok(endpoint, 'Set CHAT_TEST_ENDPOINT to your chat /api/chat URL.');
const origin = 'http://127.0.0.1:8780';
const targetPeers = Number(process.env.CHAT_TEST_PEERS || 20);
assert.ok([19, 20].includes(targetPeers), 'CHAT_TEST_PEERS must be 19 or 20.');
const peers = [], sent = new Map(), deliveries = [], posts = [], issues = [];
const networkErrors = [];
const runId = Date.now().toString(36), start = performance.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let pingTimer, pingTask = Promise.resolve(), maxOnline = 0;
let expectedPeers = 0, exitOnline = null;
let baselineOnline = 0;
const phases = [];
const connection = http2.connect(new URL(endpoint).origin);
connection.on('error', () => {}); // Each outstanding request reports its own error.
// Browser-like HTTP/2 transport: 20 independent sessions and SSE streams,
// without opening a fresh TLS connection for every simultaneous POST.
async function fetch(address, options = {}) {
  const url = new URL(address);
  return new Promise((resolve, reject) => {
    const stream = connection.request({ ':path': url.pathname + url.search,
      ':method': options.method || 'GET', ...options.headers });
    const abort = () => stream.destroy(new DOMException('Request aborted', 'AbortError'));
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    stream.once('error', reject);
    stream.once('close', () => options.signal?.removeEventListener('abort', abort));
    stream.once('response', headers => {
      const publicHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) => !key.startsWith(':')));
      resolve(new Response(Readable.toWeb(stream), { status: headers[':status'], headers: publicHeaders }));
    });
    stream.end(options.body);
  });
}

async function health() {
  const r = await fetch(endpoint + '/health', { signal: AbortSignal.timeout(10000) });
  assert.equal(r.status, 200);
  const data = await r.json(); maxOnline = Math.max(maxOnline, data.online); return data;
}
async function post(path, data, peer) {
  const before = performance.now();
  let r;
  try {
    r = await fetch(endpoint + path, { method: 'POST', headers: {
      Origin: origin, 'Content-Type': 'application/json',
      ...(peer ? { Authorization: `Bearer ${peer.session.token}` } : {})
    }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
  } catch (error) {
    networkErrors.push({ path, message: error.message, code: error.cause?.code || error.code || null });
    throw error;
  }
  const result = await r.json();
  posts.push({ path, status: r.status, ms: performance.now() - before });
  assert.ok(r.ok, `${path}: ${r.status} ${result.error || ''}`); return result;
}
async function until(predicate, label, timeout = 12000) {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > deadline) throw Error('Timeout: ' + label);
    await delay(50);
  }
}
async function connect(peer) {
  peer.abort = new AbortController();
  const r = await fetch(endpoint + '/events?token=' + encodeURIComponent(peer.session.token), {
    headers: { Origin: origin }, signal: peer.abort.signal
  });
  assert.equal(r.status, 200, 'SSE connect');
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), origin);
  peer.reader = r.body.getReader(); peer.snapshot = null; peer.closed = false;
  peer.task = (async () => {
    const decoder = new TextDecoder(); let buffer = '';
    try {
      while (true) {
        const chunk = await peer.reader.read();
        if (chunk.done) { if (!peer.intentionalClose) issues.push('Unexpected stream close: ' + peer.number); break; }
        buffer += decoder.decode(chunk.value, { stream: true });
        let separator;
        while ((separator = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, separator); buffer = buffer.slice(separator + 2);
          const event = frame.split('\n').find(s => s.startsWith('event: '))?.slice(7);
          const line = frame.split('\n').find(s => s.startsWith('data: '));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (event === 'snapshot') peer.snapshot = data;
          if (event === 'heartbeat') peer.heartbeats++;
          if (event === 'presence') peer.users = data.users;
          if (event === 'message' && sent.has(data.text)) {
            if (peer.received.has(data.id)) issues.push('Duplicate delivery: ' + peer.number);
            peer.received.add(data.id);
            deliveries.push({ peer: peer.number, text: data.text, ms: performance.now() - sent.get(data.text) });
          }
        }
      }
    } catch (error) { if (!peer.intentionalClose) issues.push('Stream error: ' + peer.number + ': ' + error.message); }
    finally { peer.closed = true; }
  })();
  await until(() => peer.snapshot, 'initial snapshot');
}
async function addPeers(count) {
  const offset = peers.length;
  const added = await Promise.allSettled(Array.from({ length: count }, async (_, index) => {
    const peer = { number: offset + index + 1, received: new Set(), heartbeats: 0, users: [] };
    peer.session = await post('/join', { name: `Нагрузочный тест ${peer.number}` });
    peers.push(peer); await connect(peer); return peer;
  }));
  const failure = added.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  return added.map(result => result.value);
}
async function wave(label) {
  expectedPeers = peers.length;
  const before = deliveries.length;
  await Promise.all(peers.map(async peer => {
    const text = `[Тест ${runId}] ${label}: участник ${peer.number}`;
    sent.set(text, performance.now()); await post('/message', { text }, peer);
  }));
  await until(() => deliveries.length - before === peers.length ** 2, label + ' all recipients');
  const state = await health(); assert.ok(state.online >= peers.length, 'online count');
  phases.push({ label, peers: peers.length, messages: peers.length, deliveries: deliveries.length - before, online: state.online });
  console.log(JSON.stringify({ phase: label, ...phases.at(-1) }));
}
function stats(values) {
  const a = [...values].sort((a, b) => a - b), rounded = x => Math.round(x * 10) / 10;
  return { count: a.length, medianMs: rounded(a[Math.floor(a.length * .5)] || 0),
    p95Ms: rounded(a[Math.min(a.length - 1, Math.floor(a.length * .95))] || 0), maxMs: rounded(a.at(-1) || 0) };
}
let failure = null;
try {
  const baseline = await health();
  baselineOnline = baseline.online;
  console.log(JSON.stringify({ phase: 'baseline', online: baselineOnline, targetPeers }));
  await addPeers(15); await wave('15 одновременно');
  pingTimer = setInterval(() => {
    pingTask = pingTask.then(() => Promise.all(peers.filter(p => !p.intentionalClose)
      .map(p => post('/ping', {}, p)))).catch(e => { issues.push('Ping: ' + e.message); });
  }, 25000);
  await delay(12000); await addPeers(targetPeers - 15); await wave(`${targetPeers} одновременно`);
  await delay(16000); await wave(`${targetPeers} повторная отправка`);
  await delay(38000);
  assert.ok(peers.every(p => !p.closed), 'all test streams remain connected');
  assert.ok(peers.every(p => p.heartbeats >= 2), 'heartbeats continue for each peer');
  const p = peers[0]; p.intentionalClose = true;
  await post('/leave', {}, p); p.abort.abort(); await p.task;
  p.intentionalClose = false; await connect(p);
  assert.ok([...sent.keys()].every(text => p.snapshot.messages.some(m => m.text === text)), 'history after reconnect');
  const reconnectedOnline = (await health()).online;
  assert.ok(reconnectedOnline >= targetPeers, 'reconnected participant counted');
  console.log(JSON.stringify({ phase: 'reconnect', restoredMessages: sent.size, online: reconnectedOnline }));
} catch (error) { failure = error.message; }
finally {
  clearInterval(pingTimer); await pingTask;
  for (const p of peers) p.intentionalClose = true;
  await Promise.all(peers.map(async p => {
    try { if (p.reader && !p.closed) await post('/leave', {}, p); }
    catch (error) { issues.push('Cleanup: ' + error.message); }
    p.abort?.abort();
  }));
  await Promise.allSettled(peers.map(p => p.task));
  try { exitOnline = (await health()).online; } catch (error) { issues.push(error.message); }
  connection.close();
}
const report = { runId, endpoint, transport: 'HTTP/2: independent sessions and SSE streams over one TLS connection', startedAt: new Date(Date.now() - (performance.now() - start)).toISOString(),
  durationSeconds: Math.round((performance.now() - start) / 1000), phases, baselineOnline, targetPeers, maxOnline,
  messages: sent.size, deliveries: deliveries.length, expectedDeliveries: 15 * 15 + targetPeers * targetPeers * 2,
  deliveryLatency: stats(deliveries.map(d => d.ms)), requestLatency: stats(posts.filter(p => p.path === '/message').map(p => p.ms)),
  heartbeats: peers.map(p => ({ peer: p.number, received: p.heartbeats })),
  httpErrors: posts.filter(p => p.status >= 400).map(({ path, status }) => ({ path, status })),
  exitOnline, networkErrors, issues, failure,
  passed: !failure && !issues.length && exitOnline <= baselineOnline && expectedPeers === targetPeers };
const reportFile = process.env.CHAT_TEST_REPORT || new URL('../../../../outputs/chat-load-20.json', import.meta.url);
await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
