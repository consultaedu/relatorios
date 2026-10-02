/* Regras de apresentação compartilhadas pelo navegador e pelos testes. */
(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.DashboardCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const numericFields = ["participantes", "pico", "atrasoGravacao", "minutosGravados", "duracaoPrevista", "cobertura"];
  const statuses = ["OK", "ATRASO", "SEM_GRAVACAO", "AULA_NAO_INICIADA", "SEM_PARTICIPANTES", "OUTRO"];

  function number(value, allowNegative = false) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string") {
      value = value.trim();
      if (!/^-?\d+(?:[.,]\d+)?$/.test(value)) return null;
      value = value.replace(",", ".");
    }
    const n = Number(value);
    return Number.isFinite(n) && (allowNegative || n >= 0) ? n : null;
  }

  function normalize(item, index = 0) {
    const result = { rowKey: String(index) };
    for (const key of ["id", "chaveSessao", "idSessao", "disciplinasSessao", "aula", "instituicao", "conta", "turma", "semana", "status", "inicio", "fim", "inicioGravacao", "fimGravacao", "codigoMeet", "gravacao"]) {
      result[key] = typeof item[key] === "string" || typeof item[key] === "number" ? String(item[key]).trim() : "";
    }
    for (const key of numericFields) result[key] = number(item[key], key === "atrasoGravacao");
    result.statusTipo = String(item.statusTipo || "OUTRO").trim().toUpperCase();
    if (!statuses.includes(result.statusTipo)) result.statusTipo = "OUTRO";
    result.gravacao = result.gravacao.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    result.disciplinasSessao ||= result.aula;
    // ID acadêmico é apenas fallback. Nunca inferir sessão pelo título ou link.
    result.sessionKey = result.chaveSessao || result.idSessao || result.id || `linha:${index}`;
    result.sessionConflict = item.sessionConflict === true;
    return result;
  }

  function validatePayload(payload) {
    if (!payload || payload.ok !== true) throw new Error("A API respondeu com erro.");
    if (!Array.isArray(payload.dados) || payload.dados.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
      throw new Error("Formato inesperado: a API deve retornar uma lista de aulas.");
    }
    return prepare(payload.dados);
  }

  function prepare(rows) {
    const normalized = rows.map(normalize);
    const groups = new Map();
    for (const row of normalized) {
      if (!groups.has(row.sessionKey)) groups.set(row.sessionKey, []);
      groups.get(row.sessionKey).push(row);
    }
    // Dados divergentes de uma mesma sessão não podem depender da ordem das linhas.
    for (const group of groups.values()) {
      for (const key of [...numericFields, "gravacao", "statusTipo"]) {
        const values = new Set(group.map(row => row[key]));
        if (values.size > 1) {
          for (const row of group) {
            row[key] = key === "statusTipo" ? "OUTRO" : key === "gravacao" ? "" : null;
            row.sessionConflict = true;
          }
        }
      }
    }
    return normalized;
  }

  function deduplicate(rows) {
    const groups = new Map();
    for (const row of rows) if (!groups.has(row.sessionKey)) groups.set(row.sessionKey, row);
    return [...groups.values()];
  }

  function matches(row, filters, except = "") {
    const keys = { week: "semana", institution: "instituicao", account: "conta", className: "turma", discipline: "aula", status: "statusTipo" };
    return Object.entries(keys).every(([filter, field]) => filter === except || !filters[filter] || row[field] === filters[filter]);
  }

  function mean(rows, field) {
    const values = rows.map(row => row[field]).filter(value => value !== null && Number.isFinite(value));
    const result = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return Number.isFinite(result) ? result : null;
  }

  function onTime(row) {
    if (row.gravacao === "NAO") return false;
    if (row.gravacao !== "SIM" || row.atrasoGravacao === null) return null;
    return row.atrasoGravacao <= 10;
  }

  function recordingTotals(rows, contract) {
    const sessions = deduplicate(rows);
    const eligible = sessions.filter(row => row.minutosGravados !== null && row.duracaoPrevista > 0);
    const recorded = eligible.reduce((total, row) => total + row.minutosGravados, 0);
    const planned = eligible.reduce((total, row) => total + row.duracaoPrevista, 0);
    // Ativação só após confirmar união dos intervalos dentro da janela prevista.
    const exceeds = eligible.some(row => row.minutosGravados > row.duracaoPrevista);
    const confirmed = contract === "union-within-schedule-v1" && !exceeds;
    return { recorded: Number.isFinite(recorded) ? recorded : null, planned: Number.isFinite(planned) ? planned : null,
      eligible: eligible.length, total: sessions.length, confirmed,
      missing: sessions.length - eligible.length, exceeds,
      percent: Number.isFinite(recorded) && Number.isFinite(planned) && planned > 0 && Number.isFinite(recorded / planned * 100)
        ? recorded / planned * 100 : null };
  }

  function duration(value) {
    if (value === null || !Number.isFinite(value)) return "—";
    if (value > 0 && value < 1) return "<1 min";
    const minutes = Math.round(value);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`;
  }

  return { number, normalize, prepare, validatePayload, deduplicate, matches, mean, onTime, recordingTotals, duration };
});
