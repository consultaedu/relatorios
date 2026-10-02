// Somente dados sintéticos. Nenhum aluno, conta ou aula real.
const base = {
  semana: "28/09/2026 – 04/10/2026", instituicao: "Instituição Alfa", conta: "Conta A",
  turma: "Turma 1", aula: "Matemática", disciplinasSessao: "Matemática + Física",
  inicio: "2026-09-28T19:00:00-03:00", fim: "2026-09-28T20:00:00-03:00",
  participantes: 20, pico: 15, gravacao: "SIM", atrasoGravacao: 5,
  minutosGravados: 30, duracaoPrevista: 60, cobertura: 50, statusTipo: "OK"
};
const rows = [
  { ...base, id: "a1", idSessao: "s1" },
  { ...base, id: "a2", idSessao: "s1", aula: "Física" },
  { ...base, id: "b", idSessao: "s2", aula: "História", disciplinasSessao: "História", fim: "2026-09-28T21:00:00-03:00", minutosGravados: 120, duracaoPrevista: 120, cobertura: 100 },
  { ...base, id: "c", idSessao: "s3", aula: "Sem gravação", disciplinasSessao: "Sem gravação", gravacao: "NAO", atrasoGravacao: null, minutosGravados: 0, cobertura: 0, statusTipo: "SEM_GRAVACAO" },
  { ...base, id: "d", idSessao: "s4", aula: "Dados incompletos", disciplinasSessao: "Dados incompletos", minutosGravados: null, cobertura: null, participantes: null, pico: null, atrasoGravacao: null, statusTipo: "PENDENTE" },
  { ...base, id: "e", idSessao: "s5", aula: "Gravação excedente", disciplinasSessao: "Gravação excedente", minutosGravados: 90, cobertura: 100, atrasoGravacao: 15, statusTipo: "ATRASO" },
  { ...base, id: "f", idSessao: "s6", instituicao: "Instituição Beta", conta: "Conta B", turma: "Turma 2", aula: "Biologia", disciplinasSessao: "Biologia", semana: "21/09/2026 – 27/09/2026", inicio: "2026-09-22T19:00:00-03:00", fim: "2026-09-22T20:00:00-03:00", participantes: 40 },
  { ...base, id: "g", idSessao: "s7", aula: '<img src=x onerror="alert(1)">', disciplinasSessao: '<img src=x onerror="alert(1)">', duracaoPrevista: null, statusTipo: "OUTRO" }
];
for (let i = 0; i < 22; i++) rows.push({ ...base, id: `extra-${i}`, idSessao: `extra-${i}`, aula: `Aula extra ${i + 1}`, disciplinasSessao: `Aula extra ${i + 1}`, statusTipo: i < 10 ? "ATRASO" : "OK", atrasoGravacao: i < 10 ? 15 : 0 });
module.exports = { base, rows, payload: { ok: true, atualizadoEm: "01/10/2026 12:00 (dados sintéticos)", dados: rows } };
