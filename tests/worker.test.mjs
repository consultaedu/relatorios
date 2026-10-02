import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/worker.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const good = { ok: true, dados: [{ id: 'synthetic' }] };
const request = (query = '', options = {}) => new Request(`https://relatorio.consultaedu.com.br/api/${query}`, options);
function sandbox(fn) {
  return async () => {
    const originalFetch = globalThis.fetch;
    const originalCaches = globalThis.caches;
    const entries = new Map();
    const calls = [];
    const pending = [];
    const cache = {
      async match(key) { const hit = entries.get(key.url); return hit?.clone(); },
      async put(key, value) { entries.set(key.url, value); }
    };
    globalThis.caches = { default: cache };
    globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return new Response(JSON.stringify(good)); };
    const ctx = { waitUntil(promise) { pending.push(promise); } };
    try { await fn({ calls, entries, ctx, cache, flush: () => Promise.all(pending) }); }
    finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
  };
}

test('Worker encaminha filtros codificados e estabiliza cache; t não vai à origem', sandbox(async ({ calls, ctx, flush }) => {
  const result = await worker.fetch(request('?turma=T%2B1&disciplina=F%C3%ADsica&semana=28%2F09'), {}, ctx);
  assert.equal(result.status, 200);
  const forwarded = new URL(calls[0].url);
  assert.equal(forwarded.searchParams.get('turma'), 'T+1');
  assert.equal(forwarded.searchParams.get('disciplina'), 'Física');
  await flush();
  const hit = await worker.fetch(request('?semana=28%2F09&disciplina=F%C3%ADsica&turma=T%2B1'), {}, ctx);
  assert.equal(hit.headers.get('X-Dashboard-Cache'), 'HIT');
  assert.equal(calls.length, 1);
  await worker.fetch(request('?semana=28%2F09&disciplina=F%C3%ADsica&turma=T%2B1&t=123'), {}, ctx);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1].url).searchParams.has('t'), false);
}));
test('Atualização manual ignora cache e não fragmenta chave', sandbox(async ({ ctx, calls, entries, flush }) => {
  await worker.fetch(request(), {}, ctx); await flush();
  const result = await worker.fetch(request('?refresh=1'), {}, ctx); await flush();
  assert.equal(calls.length, 2);
  assert.equal(entries.size, 1);
  assert.equal(result.headers.get('X-Dashboard-Cache'), 'BYPASS');
  assert.equal(new URL(calls[1].url).searchParams.has('refresh'), false);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
}));
test('ping da API tem schema próprio, é encaminhado e nunca usa cache', sandbox(async ({ctx,entries,flush})=>{
  let checks=0;
  const health={ok:true,sistema:'Monitor Meet Dashboard',versao:'1.2.0-local',status:'online',agora:'01/10/2026 15:00:00'};
  globalThis.fetch=async(url)=>{checks++;assert.equal(new URL(url).searchParams.get('ping'),'1');return new Response(JSON.stringify(health));};
  for(let i=0;i<2;i++){
    const response=await worker.fetch(request('?ping=1'),{},ctx);
    assert.equal(response.status,200);assert.deepEqual(await response.json(),health);
    assert.equal(response.headers.get('X-Dashboard-Cache'),'BYPASS');await flush();
  }
  assert.equal(checks,2);assert.equal(entries.size,0);
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}));
  assert.equal((await worker.fetch(request('?ping=1'),{},ctx)).status,502);
}));
test('contrato API corrigida → Worker → cálculo do frontend com filtros e dados ausentes', sandbox(async({ctx})=>{
  const {apiHarness,cells}=require('./api-harness.cjs');
  const {base}=require('./fixtures.cjs');
  const Core=require('../dashboard-core.js');
  const api=apiHarness(cells([
    {...base,id:'A',chaveSessao:'A',aula:'Física',minutosGravados:30,status:'🟢 OK'},
    {...base,id:'B',chaveSessao:'B',aula:'História',minutosGravados:120,duracaoPrevista:120,status:'🟢 OK'},
    {...base,id:'C',chaveSessao:'C',aula:'Dados incompletos',minutosGravados:null,status:'PENDENTE'}
  ]));
  globalThis.fetch=async(url)=>new Response(JSON.stringify(api.get(Object.fromEntries(new URL(url).searchParams))));
  const response=await worker.fetch(request(),{},ctx);assert.equal(response.status,200);
  const body=await response.json();const total=Core.recordingTotals(Core.validatePayload(body),null);
  assert.equal(total.recorded,150);assert.equal(total.planned,180);assert.equal(total.missing,1);
  assert.equal(body.atualizadoEm,null);assert.equal(typeof body.consultadoEm,'string');
  assert.equal(body.resumo.tempoGravado.percentual,83.3);
  const filtered=await worker.fetch(request('?disciplina=F%C3%ADsica'),{},ctx);
  const selection=await filtered.json();assert.equal(selection.dados.length,1);
  assert.equal(selection.resumo.tempoGravado.percentual,50);
}));
test('Erros HTTP, HTML e ok:false não são cacheados nem expõem a origem', sandbox(async ({ ctx, entries }) => {
  for (const response of [new Response('sensitive upstream message', {status:500}),new Response('<h1>Login</h1>'),new Response('{"ok":false,"erro":"secret"}'),new Response('{"ok":true,"dados":[null]}')]) {
    globalThis.fetch = async () => response;
    const result = await worker.fetch(request(), {}, ctx);
    assert.equal(result.status, 502);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    const text = await result.text();
    assert.ok(!text.includes('secret') && !text.includes('sensitive'));
  }
  assert.equal(entries.size, 0);
}));
test('Timeout e exceções retornam erro controlado', sandbox(async ({ ctx }) => {
  globalThis.fetch = (url, {signal}) => new Promise((resolve,reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), {once:true}));
  assert.equal((await worker.fetch(request(), {UPSTREAM_TIMEOUT_MS:10}, ctx)).status, 504);
  globalThis.fetch = async () => { throw new Error('private details'); };
  assert.equal((await worker.fetch(request(), {}, ctx)).status, 502);
}));
test('Timeout cobre também a leitura do corpo', sandbox(async ({ ctx }) => {
  globalThis.fetch = async (url, {signal}) => new Response(new ReadableStream({
    start(controller) { signal.addEventListener('abort', () => controller.error(new DOMException('Aborted','AbortError')), {once:true}); }
  }));
  assert.equal((await worker.fetch(request(), {UPSTREAM_TIMEOUT_MS:10}, ctx)).status, 504);
}));
test('Falhas de cache não invalidam resposta boa', sandbox(async ({ ctx, cache, flush }) => {
  cache.match = async () => { throw new Error('cache down'); };
  cache.put = async () => { throw new Error('cache down'); };
  assert.equal((await worker.fetch(request(), {}, ctx)).status, 200);
  await flush();
}));
test('CORS permitido com Vary, preflight, origem não permitida e métodos', sandbox(async ({ calls }) => {
  const allowed = 'https://relatorio.consultaedu.com.br';
  const response = await worker.fetch(request('', {headers:{Origin:allowed}}));
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowed);
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal((await worker.fetch(request('',{method:'OPTIONS',headers:{Origin:allowed}}))).status, 204);
  assert.equal((await worker.fetch(request('',{headers:{Origin:'https://evil.example'}}))).status, 403);
  const post = await worker.fetch(request('',{method:'POST'}));
  assert.equal(post.status, 405); assert.equal(post.headers.get('Allow'), 'GET, OPTIONS');
  assert.equal(calls.length, 1);
}));
test('Parâmetros repetidos, enormes e rotas estranhas são rejeitados', sandbox(async ({calls}) => {
  for (const query of ['?turma=A&turma=B', '?long='+'x'.repeat(5000)]) assert.equal((await worker.fetch(request(query))).status, 400);
  assert.equal((await worker.fetch(new Request('https://relatorio.consultaedu.com.br/other'))).status, 404);
  assert.equal(calls.length, 0);
}));
test('Requisições com credenciais não entram em cache compartilhado', sandbox(async ({entries,ctx,flush,calls}) => {
  await worker.fetch(request('',{headers:{Authorization:'Bearer synthetic'}}), {}, ctx); await flush();
  await worker.fetch(request('',{headers:{Cookie:'session=synthetic'}}), {}, ctx); await flush();
  assert.equal(calls.length,2); assert.equal(entries.size,0);
}));
test('Origem configurada não pode apontar para host arbitrário', sandbox(async ({calls}) => {
  assert.equal((await worker.fetch(request(),{APPS_SCRIPT_URL:'https://evil.example/'})).status, 500);
  assert.equal(calls.length,0);
}));
test('Resposta excedente é rejeitada mesmo sem Content-Length', sandbox(async ({ctx}) => {
  globalThis.fetch = async () => new Response(new Uint8Array(10*1024*1024+1));
  assert.equal((await worker.fetch(request(),{},ctx)).status, 502);
}));
