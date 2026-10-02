const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Only the three pure functions in the fixture are evaluated. No Apps Script
// services, production code, network calls, triggers or real data are loaded.
const context = vm.createContext({ CONFIG_MONITOR: { JANELA_ANTES_GRAVACAO_MINUTOS: 10 } });
vm.runInContext(fs.readFileSync(require.resolve('./fixtures/apps-script-account1.js'), 'utf8'), context);
const reportSelect = context.rel_encontrarGravacaoDaAula_;
const monitorSelect = context.encontrarGravacaoDaAula_;
const minutes = context.rel_calcularMinutosGravados_;
const at = time => new Date(`2026-09-28T${time}-03:00`);
const recording = (start, end) => ({ startTime: at(start).toISOString(), ...(end ? { endTime: at(end).toISOString() } : {}) });
const first = { inicio: at('19:00:00'), fim: at('20:00:00'), indice: 0, quantidadeBlocos: 2 };
const second = { inicio: at('20:00:00'), fim: at('21:00:00'), indice: 1, quantidadeBlocos: 2 };
const after = at('22:00:00');

// These characterize the supplied behavior and document its limitations.
// Passing them does not mean the source defects were fixed or the API audited.
test('origem: gravação única é recortada ao bloco, excluindo tempo antes/depois', () => {
  const item = recording('18:50:00', '20:10:00');
  assert.equal(reportSelect([item], first), item);
  assert.equal(minutes(item, first, after), 60);
});

test('origem: gravação aberta usa agora e nunca ultrapassa o fim previsto', () => {
  const item = recording('19:10:00');
  assert.equal(minutes(item, first, at('19:40:00')), 30);
  assert.equal(minutes(item, first, after), 50);
});

test('origem: reinício não é somado; 55 minutos em dois trechos viram 20', () => {
  const items = [recording('19:00:00', '19:20:00'), recording('19:25:00', '20:00:00')];
  assert.equal(reportSelect(items, first), items[0]);
  assert.equal(minutes(reportSelect(items, first), first, after), 20);
  assert.equal(minutes(items[0], first, after) + minutes(items[1], first, after), 55);
});

test('origem: sobreposições não são unidas; 60 minutos de união viram 35', () => {
  const items = [recording('19:00:00', '19:35:00'), recording('19:25:00', '20:00:00')];
  assert.equal(minutes(reportSelect(items, first), first, after), 35);
  // The two intervals cover [19:00,20:00]; summing files would wrongly give 70.
  assert.equal(minutes(items[0], first, after) + minutes(items[1], first, after), 70);
});

test('origem: monitor reconhece início às 19:40 e relatório rejeita no primeiro bloco', () => {
  const item = recording('19:40:00', '20:00:00');
  assert.equal(monitorSelect([item], first), item);
  assert.equal(reportSelect([item], first), null);
  assert.equal(minutes(reportSelect([item], first), first, after), 0);
  assert.equal(minutes(item, first, after), 20);
});

test('origem: gravação contínua de 19h a 21h não é associada ao segundo bloco', () => {
  const item = recording('19:00:00', '21:00:00');
  assert.equal(minutes(reportSelect([item], first), first, after), 60);
  assert.equal(reportSelect([item], second), null);
  assert.equal(monitorSelect([item], second), null);
  assert.equal(minutes(item, second, after), 60);
});

test('origem: minuto arredondado não prova ausência nem cobertura integral', () => {
  assert.equal(minutes(recording('19:00:00', '19:00:20'), first, after), 0);
  assert.equal(minutes(recording('19:00:20', '20:00:00'), first, after), 60);
});

test('origem: zero também resulta de seleção ausente ou gravação sem interseção', () => {
  assert.equal(minutes(null, first, after), 0);
  const item = recording('20:10:00', '20:20:00');
  // The last-block report window accepts starts until 30 min after the end.
  const only = { ...first, quantidadeBlocos: 1 };
  assert.equal(reportSelect([item], only), item);
  assert.equal(minutes(item, only, after), 0);
});

test('origem: metadado inválido propaga NaN; frontend mantém resultado indisponível', () => {
  const Core = require('../dashboard-core.js');
  const result = minutes({ startTime: 'invalid', endTime: after.toISOString() }, first, after);
  assert.ok(Number.isNaN(result));
  assert.equal(Core.number(result), null);
});
