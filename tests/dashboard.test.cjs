const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../dashboard-core.js');
const { payload } = require('./fixtures.cjs');

function harness() {
  const elements = new Map();
  const windowEvents = {};
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      const node = {
        value: '', textContent: '', hidden: false, disabled: false, style: {}, dataset: {}, attrs: {},
        classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle: (x, value) => value ? classes.add(x) : classes.delete(x) },
        setAttribute(key,value) { this.attrs[key] = value; },
        addEventListener() {}, querySelectorAll() { return []; }, focus() {},
        set innerHTML(value) { this.html = value; if (id.startsWith('filter')) this.value = ''; },
        get innerHTML() { return this.html || ''; }
      };
      elements.set(id, node);
    }
    return elements.get(id);
  }
  const win = { DASHBOARD_CONFIG:{ apiUrl:'/api/',requestTimeoutMs:100 }, DashboardCore:Core,
    location:{href:'http://127.0.0.1:4188/'}, addEventListener(key,fn){ windowEvents[key]=fn; }, print(){} };
  const context = vm.createContext({ window:win, document:{getElementById:element, querySelector:() => element('shell'),querySelectorAll:() => [],addEventListener(){}, body:element('body')},
    Chart:class {constructor(canvas,config){Object.assign(this,config);} destroy(){} resize(){}},
    Intl, URL, AbortController, console, setTimeout, clearTimeout, fetch:async()=>new Response(JSON.stringify(payload)) });
  vm.runInContext(fs.readFileSync(require.resolve('../script.js'),'utf8'), context);
  vm.runInContext('cacheElements(); bindEvents();', context);
  return { elements, element, context, run: code => vm.runInContext(code,context), windowEvents };
}

test('semana mais recente na abertura, seleção preservada e todas as semanas após atualizar', async () => {
  const h = harness(); await h.run('loadData()');
  assert.equal(h.element('filterWeek').value, payload.dados[0].semana);
  h.element('filterInstitution').value='Instituição Alfa';
  h.element('filterAccount').value='Conta A';
  h.element('filterClass').value='Turma 1';
  h.element('filterDiscipline').value='Física';
  h.element('filterStatus').value='OK';
  h.run('applyFilters()'); await h.run('loadData({showLoading:false})');
  assert.equal(h.element('filterDiscipline').value,'Física');
  assert.equal(h.element('kpiClasses').textContent,'1');
  assert.equal(h.element('kpiCoverage').textContent,'30 min de 1h00 previstas');
  h.run('clearFilters()'); await h.run('loadData({showLoading:false})');
  assert.equal(h.element('filterWeek').value,'');
  assert.equal(h.element('kpiClasses').textContent,'29');
});
test('filtros dependentes são reconciliados antes do cálculo; evolução semanal usa a seleção', async () => {
  const h=harness(); await h.run('loadData()');
  h.element('filterInstitution').value='Instituição Alfa';h.element('filterDiscipline').value='Física';
  h.run('applyFilters()');
  h.element('filterWeek').value='21/09/2026 – 27/09/2026';h.run('applyFilters()');
  assert.equal(h.element('filterInstitution').value,'');assert.equal(h.element('filterDiscipline').value,'');
  assert.equal(h.element('kpiClasses').textContent,'1');
  assert.match(h.element('weeklyChart').attrs['aria-label'],/40,0/);
  assert.doesNotMatch(h.element('weeklyChart').attrs['aria-label'],/28\/09/);
});
test('falha de refresh mantém última seleção e dados; falha inicial mantém indicadores indisponíveis', async () => {
  const h=harness(); await h.run('loadData()');
  h.element('filterDiscipline').value='Física';h.run('applyFilters()');
  h.context.fetch=async()=>new Response('{}',{status:503});await h.run('loadData({showLoading:false})');
  assert.equal(h.element('kpiClasses').textContent,'1');assert.equal(h.element('filterDiscipline').value,'Física');
  assert.match(h.element('dataNotice').textContent,/últimos dados/);
  const initial=harness();initial.context.fetch=async()=>new Response('{"ok":true,"dados":{}}');await initial.run('loadData()');
  assert.equal(initial.element('kpiClasses').textContent,'—');assert.match(initial.element('dataNotice').textContent,/Formato inesperado/);
});
test('impressão inclui todos os vínculos filtrados e restaura a página; pesquisa só afeta tabela', async () => {
  const h=harness();await h.run('loadData()');h.run('clearFilters(); state.page=2; renderTable();');
  assert.equal((h.element('tableBody').innerHTML.match(/<tr>/g)||[]).length,10);
  h.windowEvents.beforeprint();
  assert.equal((h.element('tableBody').innerHTML.match(/<tr>/g)||[]).length,30);
  assert.match(h.element('printSummary').textContent,/30 vínculos/);
  h.windowEvents.afterprint();
  assert.equal((h.element('tableBody').innerHTML.match(/<tr>/g)||[]).length,10);
  assert.equal(h.run('state.page'),2);
  h.run('state.search="história"; state.page=1; renderTable();');
  assert.equal((h.element('tableBody').innerHTML.match(/<tr>/g)||[]).length,1);
  assert.equal(h.element('kpiClasses').textContent,'29');
});
test('ordenacao envia ausentes ao final em ambas direções e detalhes usam chave da linha', async () => {
  const h=harness();await h.run('loadData()');
  for(const direction of ['asc','desc']){
    const sorted=h.run(`state.rawData.slice().sort(compareBy('minutosGravados','${direction}'))`);
    assert.equal(sorted.at(-1).minutosGravados,null);
  }
  const row=h.run('state.rawData.find(x=>x.aula==="Gravação excedente")');h.context.testRow=row;h.run('openDrawer(testRow)');
  assert.equal(h.element('drawerCoverage').textContent,'150,0%');
  assert.match(h.element('drawerRecordingNote').textContent,/100,0%/);
});
test('biblioteca de gráficos ausente não bloqueia cards e tabela', async()=>{
  const h=harness();h.context.Chart=undefined;await h.run('loadData()');
  assert.equal(h.element('kpiClasses').textContent,'28');assert.equal(h.element('chartsNotice').hidden,false);
  assert.match(h.element('chartsNotice').textContent,/gráficos/);
  assert.equal(h.element('apiStatusText').textContent,'API online');
});
test('tempo informado não promete união de reinícios nem cobertura integral', async()=>{
  const h=harness();await h.run('loadData()');
  assert.match(h.element('recordingNote').textContent,/reinícios podem estar fora do total/i);
  assert.match(h.element('recordingNote').textContent,/Cobertura do horário não confirmada/);
  const row=h.run('state.rawData.find(x=>x.aula==="Gravação excedente")');
  h.context.testRow=row;h.run('openDrawer(testRow)');
  assert.match(h.element('drawerRecordingNote').textContent,/Reinícios podem estar fora/);
  assert.match(h.element('drawerRecordingNote').textContent,/não comprova cobertura/);
});
test('nome de semana herdado de Object não quebra o agrupamento', async()=>{
  const h=harness();
  h.context.fetch=async()=>new Response(JSON.stringify({ok:true,dados:[{...payload.dados[0],semana:'__proto__'}]}));
  await h.run('loadData()');
  assert.equal(h.element('apiStatusText').textContent,'API online');
  assert.match(h.element('weeklyChart').attrs['aria-label'],/__proto__/);
});
test('hora da consulta não é apresentada como hora da consolidação semanal', async()=>{
  const h=harness();
  h.context.fetch=async()=>new Response(JSON.stringify({...payload,atualizadoEm:null,consultadoEm:'01/10/2026 15:00:00'}));
  await h.run('loadData()');
  assert.equal(h.element('apiUpdatedAt').textContent,'Consulta: 01/10/2026 15:00:00');
  assert.match(h.element('footerUpdatedAt').textContent,/Consolidação da base: data não informada/);
  assert.doesNotMatch(h.element('footerUpdatedAt').textContent,/Consolidação da base: 01\/10/);
  const legacy=harness();await legacy.run('loadData()');
  assert.match(legacy.element('footerUpdatedAt').textContent,/Data de consolidação da base não confirmada/);
});
test('conflito sinalizado pela API permanece visível mesmo após filtro de disciplina', async()=>{
  const h=harness();
  h.context.fetch=async()=>new Response(JSON.stringify({ok:true,dados:[{...payload.dados[0],minutosGravados:null,sessionConflict:true}]}));
  await h.run('loadData()');
  assert.match(h.element('recordingNote').textContent,/1 sessões com dados divergentes/);
});
