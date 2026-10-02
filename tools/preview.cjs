const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { payload } = require('../tests/fixtures.cjs');
const { apiHarness, cells } = require('../tests/api-harness.cjs');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(body); };
  if (req.method !== 'GET') return send(405, 'application/json', '{}');
  if (url.pathname === '/api/') {
    const scenario = url.searchParams.get('scenario');
    if (scenario === 'api') {
      const statuses = { OK:'🟢 OK', ATRASO:'🟠 GRAVAÇÃO ATRASADA', SEM_GRAVACAO:'🔴 SEM GRAVAÇÃO', SEM_PARTICIPANTES:'🟠 SEM PARTICIPANTES', AULA_NAO_INICIADA:'AULA NÃO INICIADA' };
      const synthetic = payload.dados.map(row => ({ ...row, chaveSessao:row.idSessao || row.id, status:statuses[row.statusTipo] || 'PENDENTE' }));
      const result = apiHarness(cells(synthetic)).get(Object.fromEntries(url.searchParams));
      if (result.consultadoEm) result.consultadoEm += ' (API simulada, dados sintéticos)';
      return send(200, 'application/json', JSON.stringify(result));
    }
    if (scenario === 'error' || (scenario === 'stale' && url.searchParams.has('refresh'))) return send(503, 'application/json', '{"ok":false}');
    if (scenario === 'invalid') return send(200, 'application/json', '{"ok":true,"dados":{}}');
    if (scenario === 'html') return send(200, 'text/html', '<h1>Login required</h1>');
    if (scenario === 'empty') return send(200, 'application/json', '{"ok":true,"dados":[]}');
    if (scenario === 'timeout') return setTimeout(() => send(200, 'application/json', JSON.stringify(payload)), 500);
    return send(200, 'application/json', JSON.stringify(payload));
  }
  let name = decodeURIComponent(url.pathname).replace(/^\/scenario\/[^/]+\//, '/');
  if (name === '/') name = '/index.html';
  if (name === '/config.js') {
    const scenario = url.pathname.match(/\/scenario\/(api|error|invalid|html|empty|stale|timeout|print)\//)?.[1] || '';
    const printHook = scenario === 'print' ? `window.addEventListener('load',()=>window.dispatchEvent(new Event('beforeprint')));` : '';
    return send(200, 'text/javascript', `window.DASHBOARD_CONFIG = Object.freeze({apiUrl:'/api/?scenario=${scenario}',requestTimeoutMs:${scenario === 'timeout' ? 100 : 25000},recordingContract:null});${printHook}`);
  }
  // Não expor .git, Worker, relatórios, testes ou arquivos arbitrários.
  if (!['/index.html', '/style.css', '/script.js', '/dashboard-core.js'].includes(name) && !/^\/assets\/[a-zA-Z0-9_./-]+$/.test(name)) return send(404, 'text/plain', 'Not found');
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep)) return send(403, 'text/plain', 'Forbidden');
  fs.readFile(file, (err, bytes) => {
    if (err) return send(404, 'text/plain', 'Not found');
    // Simulação visual das regras de impressão; exclusiva do servidor de teste.
    if (name === '/style.css' && url.pathname.startsWith('/scenario/print/')) bytes = bytes.toString().replaceAll('@media print', '@media screen');
    send(200, types[path.extname(file)] || 'text/plain', bytes);
  });
}).listen(port, '127.0.0.1', () => console.log(`Preview local (somente dados sintéticos): http://127.0.0.1:${port}`));
