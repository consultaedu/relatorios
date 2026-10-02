const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../dashboard-core.js');
const { apiHarness, cells, headers } = require('./api-harness.cjs');
const { base } = require('./fixtures.cjs');
const original = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('./fixtures/apps-script-api-original.js'), 'utf8'), original);
const row = (overrides = {}) => ({ ...base, status: '🟢 OK', chaveSessao: 'global-A', id: 'academic-A', ...overrides });

test('API original: vazio/inválido vira zero e resumo usa média simples', () => {
  assert.equal(original.apiNumero_(''), 0);
  assert.equal(original.apiNumero_('invalid'), 0);
  const result = original.apiCalcularResumo_([
    row({ minutosGravados: 30, duracaoPrevista: 60, cobertura: 50 }),
    row({ chaveSessao: 'B', minutosGravados: 120, duracaoPrevista: 120, cobertura: 100 })
  ]);
  assert.equal(result.coberturaMedia, 75);
});

test('API corrigida: ausente, booleano e inválido são null; zero/decimal explícitos preservados', () => {
  const { context: api } = apiHarness([headers]);
  for (const value of ['', ' ', undefined, null, false, NaN, Infinity, 'invalid', -1]) assert.equal(api.apiNumero_(value), null);
  assert.equal(api.apiNumero_(0), 0);assert.equal(api.apiNumero_('15,5'), 15.5);
  assert.equal(api.apiNumero_(-5, true), -5);
});

test('API corrigida: mapeamento lê os três campos da base sem inventar fórmulas', () => {
  const api = apiHarness(cells([row({ minutosGravados: 90, duracaoPrevista: 60, cobertura: 40, atrasoGravacao: null })]));
  const result = api.get();
  assert.equal(result.ok, true);assert.equal(result.dados[0].minutosGravados, 90);
  assert.equal(result.dados[0].duracaoPrevista, 60);assert.equal(result.dados[0].cobertura, 40);
  assert.equal(result.dados[0].atrasoGravacao, null);
  assert.equal(result.resumo.tempoGravado.percentual, 150);
  assert.equal(result.resumo.tempoGravado.contratoConfirmado, false);
  assert.equal(result.resumo.gravacoesNoPrazoPercentual, null);
});

test('API corrigida: durações ponderadas e disciplinas simultâneas contam uma sessão', () => {
  const api = apiHarness(cells([
    row({ aula: 'Matemática', minutosGravados: 30, duracaoPrevista: 60, cobertura: 50 }),
    row({ id: 'academic-A2', aula: 'Física', minutosGravados: 30, duracaoPrevista: 60, cobertura: 50 }),
    row({ id: 'academic-B', chaveSessao: 'global-B', minutosGravados: 120, duracaoPrevista: 120, cobertura: 100 })
  ]));
  const result = api.get();const time = result.resumo.tempoGravado;
  assert.equal(result.resumo.aulas, 2);assert.equal(result.resumo.disciplinas, 3);
  assert.equal(time.minutosGravados, 150);assert.equal(time.minutosPrevistos, 180);assert.equal(time.percentual, 83.3);
  assert.equal(result.resumo.coberturaMedia, 75); // Legacy field is explicitly documented as a simple mean.
  const frontend = Core.recordingTotals(Core.prepare(result.dados), null);
  assert.equal(frontend.recorded, time.minutosGravados);assert.equal(frontend.planned, time.minutosPrevistos);
});

test('API corrigida: incompletos excluem ambos os tempos e não viram ausência confirmada', () => {
  const api = apiHarness(cells([
    row({ minutosGravados: null, duracaoPrevista: 60, participantes: null, pico: null }),
    row({ chaveSessao: 'B', minutosGravados: 30, duracaoPrevista: null, participantes: null, pico: null }),
    row({ chaveSessao: 'C', minutosGravados: 0, duracaoPrevista: 60, gravacao: 'NÃO', participantes: 0, pico: 0 })
  ]));
  const result = api.get().resumo;
  assert.equal(result.tempoGravado.minutosGravados, 0);assert.equal(result.tempoGravado.minutosPrevistos, 60);
  assert.equal(result.tempoGravado.sessoesExcluidas, 2);assert.equal(result.sessoesComParticipantes, 1);
  assert.equal(result.mediaParticipantes, 0);assert.equal(result.maiorPico, 0);
});

test('API corrigida: conflito é resolvido antes do filtro e chega sinalizado ao frontend', () => {
  const api = apiHarness(cells([
    row({ aula: 'Matemática', minutosGravados: 30 }),
    row({ aula: 'Física', id: 'second', minutosGravados: 60 })
  ]));
  const result = api.get({ disciplina: 'Física' });
  assert.equal(result.dados.length, 1);assert.equal(result.dados[0].minutosGravados, null);
  assert.equal(result.dados[0].sessionConflict, true);
  assert.equal(Core.prepare(result.dados)[0].sessionConflict, true);
  assert.equal(result.resumo.tempoGravado.sessoesComparaveis, 0);
});

test('API corrigida: filtros combinados e opções continuam disponíveis da base completa', () => {
  const api = apiHarness(cells([row({ aula: 'Física' }), row({ aula: 'História', chaveSessao: 'B', conta: 'Conta B' })]));
  const result = api.get({ semana: base.semana, instituicao: base.instituicao.toLowerCase(), conta: base.conta,
    turma: base.turma, disciplina: 'fisica', status: 'ok' });
  assert.equal(result.dados.length, 1);assert.equal(result.dados[0].aula, 'Física');
  assert.equal(result.filtros.disciplinas.length, 2);
  assert.equal(api.get({ conta: 'unknown' }).dados.length, 0);
});

test('API corrigida: sem chave, linhas ficam separadas; chave real não colide com fallback', () => {
  const api = apiHarness(cells([row({ id: '', chaveSessao: '', idSessao: '' }),
    row({ id: '', chaveSessao: '', idSessao: '' }), row({ chaveSessao: 'linha:1' })]));
  assert.equal(api.get().resumo.aulas, 3);
});

test('API corrigida: resumo vazio/overflow permanece indisponível e excedente não é limitado', () => {
  const empty = apiHarness([headers]).get().resumo;
  assert.equal(empty.aulas, 0);assert.equal(empty.tempoGravado.percentual, null);
  assert.equal(empty.tempoGravado.minutosGravados, null);assert.equal(empty.mediaParticipantes, null);
  const huge = apiHarness(cells([row({ minutosGravados: 1e308 }), row({ chaveSessao: 'B', minutosGravados: 1e308 })])).get().resumo;
  assert.equal(huge.tempoGravado.minutosGravados, null);assert.equal(huge.tempoGravado.percentual, null);
  const excess = apiHarness(cells([row({ minutosGravados: 90, duracaoPrevista: 60 })])).get().resumo.tempoGravado;
  assert.equal(excess.percentual, 150);assert.equal(excess.excedente, true);
});

test('API corrigida: data da consulta é separada da consolidação, datas usam fuso explícito', () => {
  const api = apiHarness(cells([row()]));const result = api.get();
  assert.equal(result.atualizadoEm, null);assert.equal(typeof result.consultadoEm, 'string');
  assert.match(result.dados[0].inicio, /-03:00$/);
  assert.ok(api.dates.some(x => x.zone === 'America/Sao_Paulo' && x.pattern.endsWith('XXX')));
  const health = api.get({ ping: '1' });assert.equal(health.status, 'online');assert.equal(health.dados, undefined);
});

test('API corrigida: cabeçalhos ambíguos e falhas de planilha retornam erro sem detalhes internos', () => {
  for (const api of [apiHarness([['AULA', 'MINUTOS GRAVADOS', 'MINUTOS_GRAVADOS'], ['A', 20, 30]]),
    apiHarness([['WRONG'], ['A']]), apiHarness([], { missingSheet: true })]) {
    const result = api.get();assert.equal(result.ok, false);
    assert.equal(result.erro, 'Não foi possível consultar a base do dashboard.');
    assert.equal(result.dados, undefined);assert.equal(api.errors.length, 1);
  }
});

test('API corrigida: status desconhecido não vira OK por substring', () => {
  const { context: api } = apiHarness([headers]);
  assert.equal(api.apiClassificarStatus_('🟢 OK'), 'OK');
  assert.equal(api.apiClassificarStatus_('NÃO OK'), 'OUTRO');
  assert.equal(api.apiClassificarStatus_('🟠 GRAVAÇÃO ATRASADA'), 'ATRASO');
  assert.equal(api.apiClassificarStatus_('SEM_GRAVACAO'), 'SEM_GRAVACAO');
});
