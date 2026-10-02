const fs = require('node:fs');
const vm = require('node:vm');

// No real SpreadsheetApp/ContentService/Utilities objects exist in this context.
// The only spreadsheet API implemented is a read of synthetic in-memory cells.
function apiHarness(values, { missingSheet = false } = {}) {
  const errors = [];
  const dates = [];
  const sheet = {
    getLastRow: () => values.length,
    getLastColumn: () => values[0]?.length || 0,
    getRange: () => ({ getValues: () => values })
  };
  const context = vm.createContext({ Date, console: { error: (...args) => errors.push(args) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => missingSheet ? null : sheet }) },
    Utilities: { formatDate(date, zone, pattern) {
      dates.push({ zone, pattern });
      const local = new Date(date.getTime() - 3 * 3600000).toISOString().slice(0, 19);
      return pattern.includes('XXX') ? local + '-03:00' : local;
    } },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(text) {
      return { text, setMimeType(type) { this.type = type; return this; } };
    } }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../apps-script/api-dashboard.gs'), 'utf8'), context);
  return { context, errors, dates, get: params => JSON.parse(context.doGet({ parameter: params || {} }).text) };
}

const headers = ['CHAVE_GLOBAL', 'CHAVE_SESSAO_GLOBAL', 'ID_SESSAO', 'AULA', 'CONTA', 'INSTITUICAO', 'TURMA', 'SEMANA',
  'INICIO_PREVISTO', 'FIM_PREVISTO', 'PARTICIPANTES', 'PICO_SIMULTANEO', 'ATRASO_GRAVACAO_MIN', 'MINUTOS_GRAVADOS',
  'DURACAO_PREVISTA_MIN', 'COBERTURA', 'GRAVACAO', 'STATUS_FINAL', 'INICIO_GRAVACAO', 'FIM_GRAVACAO', 'DISCIPLINAS_DA_SESSAO'];
const fields = ['id', 'chaveSessao', 'idSessao', 'aula', 'conta', 'instituicao', 'turma', 'semana', 'inicio', 'fim',
  'participantes', 'pico', 'atrasoGravacao', 'minutosGravados', 'duracaoPrevista', 'cobertura', 'gravacao', 'status', 'inicioGravacao', 'fimGravacao', 'disciplinasSessao'];
function cells(rows) {
  return [headers, ...rows.map(row => fields.map(field => {
    const value = row[field];
    if (['inicio', 'fim', 'inicioGravacao', 'fimGravacao'].includes(field)) return value ? new Date(value) : '';
    return value === null || value === undefined ? '' : value;
  }))];
}
module.exports = { apiHarness, cells, headers };
