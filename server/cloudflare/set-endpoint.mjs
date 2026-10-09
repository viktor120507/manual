import { writeFile } from 'node:fs/promises';

// Only a public Worker address belongs in the client. No API key is needed.
const arg = process.argv[2];
let endpoint = '';
if (arg !== '--reset') {
  let url;
  try { url = new URL(arg); } catch { throw Error('Укажите публичный HTTPS-адрес Worker или --reset.'); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password || url.search || url.hash || !['/', '/api/chat'].includes(url.pathname))
    throw Error('Ожидается адрес https://имя.аккаунт.workers.dev без ключей и параметров.');
  endpoint = url.origin + '/api/chat';
}
const file = new URL('../../assets/chat-config.js', import.meta.url);
await writeFile(file, '// Public configuration only. Never put account/API credentials in browser files.\n' +
  'window.PGK_CHAT_CONFIG = Object.freeze(' + JSON.stringify({ endpoint, localPort: 8781 }, null, 2) + ');\n');
console.log(endpoint ? 'Публичный адрес чата сохранён. Эта команда не публикует сайт.' : 'Публичное подключение выключено. Локальный предпросмотр сохранён.');
