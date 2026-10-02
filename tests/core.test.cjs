const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../dashboard-core.js');
const { base, rows } = require('./fixtures.cjs');

test('ausência, vazio, booleano e inválidos não viram zero; zero explícito é preservado', () => {
  for (const value of [null, undefined, '', ' ', false, [], {}, 'NaN', 'Infinity', -1, '1e4']) assert.equal(Core.number(value), null);
  assert.equal(Core.number('0'), 0);
  assert.equal(Core.number('7,5'), 7.5);
  assert.equal(Core.number(-5, true), -5);
});
test('payload inválido não é confundido com lista vazia', () => {
  for (const payload of [null, {ok:false}, {ok:true}, {ok:true,dados:{}}, {ok:true,dados:[null]}]) assert.throws(() => Core.validatePayload(payload));
  assert.deepEqual(Core.validatePayload({ok:true,dados:[]}), []);
});
test('duracões diferentes têm pesos diferentes e sessão compartilhada conta uma vez', () => {
  const data = Core.prepare(rows.slice(0, 3));
  const totals = Core.recordingTotals(data, null);
  assert.equal(totals.recorded, 150);
  assert.equal(totals.planned, 180);
  assert.equal(totals.percent, 150 / 180 * 100);
  assert.notEqual(totals.percent, 75);
  assert.equal(totals.confirmed, false);
  assert.equal(Core.recordingTotals(data, 'union-within-schedule-v1').confirmed, true);
});
test('dados incompletos excluem o par inteiro; excesso mantém valor informado sem capar a 100%', () => {
  const data = Core.prepare(rows.slice(3, 6));
  const total = Core.recordingTotals(data, null);
  assert.equal(total.recorded, 90);
  assert.equal(total.planned, 120);
  assert.equal(total.missing, 1);
  assert.equal(total.exceeds, true);
  assert.equal(Core.recordingTotals(Core.prepare([rows[5]]), null).percent, 150);
  assert.equal(Core.recordingTotals(Core.prepare([rows[5]]), 'union-within-schedule-v1').confirmed, false);
  assert.equal(Core.recordingTotals(Core.prepare([rows[4]]), null).percent, null);
});
test('conflitos de sessão não escolhem silenciosamente a primeira linha', () => {
  const data = Core.prepare([{...base,idSessao:'x',minutosGravados:30}, {...base,idSessao:'x',minutosGravados:50}]);
  assert.ok(data.every(x => x.sessionConflict && x.minutosGravados === null));
  assert.deepEqual(Core.prepare([...rows.slice(0, 3)].reverse()).map(x => x.minutosGravados), [120,30,30]);
});
test('sem identificadores, linhas não são fundidas; ID acadêmico não substitui chave explícita', () => {
  const data = Core.prepare([{...base,id:'a',idSessao:'x'},{...base,id:'b',idSessao:'x'},{...base},{...base}]);
  assert.equal(Core.deduplicate(data).length, 3);
});
test('filtros combinados e status desconhecido', () => {
  const data = Core.prepare(rows);
  const filters = {week:base.semana,institution:base.instituicao,account:base.conta,className:base.turma,discipline:'Física',status:'OK'};
  assert.equal(data.filter(x => Core.matches(x,filters)).length, 1);
  assert.equal(data[4].statusTipo, 'OUTRO');
  assert.equal(data.filter(x => Core.matches(x,{institution:'inexistente'})).length, 0);
});
test('gravação sem atraso informado não é classificada no prazo e média exclui ausentes', () => {
  const data = Core.prepare([{...base,participantes:null,atrasoGravacao:null}, {...base,participantes:0,gravacao:'NÃO'}]);
  assert.equal(Core.mean(data,'participantes'), 0);
  assert.equal(Core.onTime(data[0]), null);
  assert.equal(Core.onTime(data[1]), false);
});
test('horas e minutos são formatados sem esconder valores ausentes', () => {
  assert.equal(Core.duration(450), '7h30');
  assert.equal(Core.duration(600), '10h00');
  assert.equal(Core.duration(0), '0 min');
  assert.equal(Core.duration(null), '—');
  assert.equal(Core.duration(0.1), '<1 min');
});
test('somas que excedem a faixa numérica não geram porcentagem infinita', () => {
  const result = Core.recordingTotals(Core.prepare([{...base,id:'huge-a',minutosGravados:1e308}, {...base,id:'huge-b',minutosGravados:1e308}]), null);
  assert.equal(result.recorded,null);
  assert.equal(result.percent,null);
});
