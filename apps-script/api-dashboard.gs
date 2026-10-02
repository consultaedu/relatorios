/* ConsultaEDU · API do Dashboard — versão local para revisão, não publicada.
 * Base: anexo API 1.1.0 recebido em 01/10/2026.
 * Apenas lê BASE_DASHBOARD; não importa contas nem altera planilhas.
 */
const API_DASHBOARD_CONFIG = {
  ABA_BASE: "BASE_DASHBOARD",
  TIME_ZONE: "America/Sao_Paulo",
  VERSAO: "1.2.0-local"
};

function doGet(e) {
  try {
    const parametros = e && e.parameter ? e.parameter : {};
    const consultadoEm = apiFormatarDataHora_(new Date());
    if (String(parametros.ping || "") === "1") {
      return responderJson_({ ok: true, sistema: "Monitor Meet Dashboard",
        versao: API_DASHBOARD_CONFIG.VERSAO, status: "online", agora: consultadoEm });
    }
    const dados = apiCarregarBase_();
    const filtrados = apiAplicarFiltros_(dados, parametros);
    return responderJson_({
      ok: true,
      sistema: "Monitor Meet Dashboard",
      versao: API_DASHBOARD_CONFIG.VERSAO,
      // Não há evidência da última importação no código recebido.
      // Integrar aqui a data real somente após sucesso da consolidação semanal.
      atualizadoEm: null,
      consultadoEm: consultadoEm,
      totalRegistros: filtrados.length,
      resumo: apiCalcularResumo_(filtrados),
      filtros: apiGerarOpcoesFiltros_(dados),
      dados: filtrados
    });
  } catch (erro) {
    console.error("Falha na API do dashboard", erro);
    return responderJson_({ ok: false, erro: "Não foi possível consultar a base do dashboard." });
  }
}

function apiCarregarBase_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(API_DASHBOARD_CONFIG.ABA_BASE);
  if (!aba) throw new Error("Aba BASE_DASHBOARD não encontrada.");
  if (aba.getLastRow() < 1) throw new Error("Base sem cabeçalhos.");
  const valores = aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getValues();
  const cabecalhos = valores[0].map(apiNormalizarCabecalho_);
  const preenchidos = cabecalhos.filter(Boolean);
  if (!cabecalhos.includes("AULA")) throw new Error("Cabeçalho AULA ausente.");
  if (new Set(preenchidos).size !== preenchidos.length) throw new Error("Cabeçalhos duplicados após normalização.");
  const registros = [];
  for (let i = 1; i < valores.length; i++) {
    const bruto = Object.create(null);
    cabecalhos.forEach(function (nome, coluna) { if (nome) bruto[nome] = valores[i][coluna]; });
    const aula = apiTexto_(bruto.AULA);
    if (!aula) continue;
    registros.push({
      id: apiTexto_(bruto.CHAVE_GLOBAL),
      chaveSessao: apiTexto_(bruto.CHAVE_SESSAO_GLOBAL || bruto.CHAVE_GLOBAL),
      idSessao: apiTexto_(bruto.ID_SESSAO || bruto.CHAVE_GLOBAL),
      disciplinasSessao: apiTexto_(bruto.DISCIPLINAS_DA_SESSAO) || aula,
      conta: apiTexto_(bruto.CONTA), instituicao: apiTexto_(bruto.INSTITUICAO),
      turma: apiTexto_(bruto.TURMA), semana: apiTexto_(bruto.SEMANA),
      data: apiSerializarData_(bruto.DATA), aula: aula,
      inicio: apiSerializarData_(bruto.INICIO_PREVISTO), fim: apiSerializarData_(bruto.FIM_PREVISTO),
      participantes: apiNumero_(bruto.PARTICIPANTES), pico: apiNumero_(bruto.PICO_SIMULTANEO),
      atrasoGravacao: apiNumero_(bruto.ATRASO_GRAVACAO_MIN, true),
      minutosGravados: apiNumero_(bruto.MINUTOS_GRAVADOS),
      duracaoPrevista: apiNumero_(bruto.DURACAO_PREVISTA_MIN),
      cobertura: apiNumero_(bruto.COBERTURA),
      gravacao: apiTexto_(bruto.GRAVACAO),
      inicioGravacao: apiSerializarData_(bruto.INICIO_GRAVACAO),
      fimGravacao: apiSerializarData_(bruto.FIM_GRAVACAO),
      codigoMeet: apiTexto_(bruto.CODIGO_MEET), status: apiTexto_(bruto.STATUS_FINAL),
      statusTipo: apiClassificarStatus_(bruto.STATUS_FINAL)
    });
  }
  // Resolver antes dos filtros evita ocultar uma divergência ao selecionar
  // apenas uma das disciplinas que compartilham a mesma sessão.
  return apiResolverConflitosSessao_(registros);
}

function apiChaveSessao_(item, indice) {
  const chave = apiTexto_(item.chaveSessao || item.idSessao || item.id);
  return chave ? "id:" + chave : "linha:" + indice;
}

function apiResolverConflitosSessao_(dados) {
  const registros = dados.map(function (item) { return Object.assign({}, item); });
  const grupos = new Map();
  registros.forEach(function (item, indice) {
    const chave = apiChaveSessao_(item, indice);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  });
  const campos = ["participantes", "pico", "atrasoGravacao", "minutosGravados", "duracaoPrevista", "cobertura", "gravacao", "statusTipo"];
  grupos.forEach(function (grupo) {
    campos.forEach(function (campo) {
      const valores = grupo.map(function (item) {
        return campo === "gravacao" ? apiNormalizarTexto_(item[campo]) : item[campo];
      });
      if (new Set(valores).size > 1) {
        grupo.forEach(function (item) {
          item[campo] = campo === "statusTipo" ? "OUTRO" : campo === "gravacao" ? "" : null;
          item.sessionConflict = true;
        });
      }
    });
  });
  return registros;
}

function apiDeduplicarPorSessao_(dados) {
  const mapa = new Map();
  apiResolverConflitosSessao_(dados).forEach(function (item, indice) {
    const chave = apiChaveSessao_(item, indice);
    if (!mapa.has(chave)) mapa.set(chave, item);
  });
  return Array.from(mapa.values());
}

function apiAplicarFiltros_(dados, parametros) {
  const campos = { semana: "semana", instituicao: "instituicao", conta: "conta",
    turma: "turma", disciplina: "aula", status: "statusTipo" };
  return dados.filter(function (item) {
    return Object.keys(campos).every(function (nome) {
      const valor = apiParametro_(parametros[nome]);
      return !valor || apiComparar_(item[campos[nome]], valor);
    });
  });
}

function apiCalcularResumo_(dados) {
  const sessoes = apiDeduplicarPorSessao_(dados);
  const participantes = sessoes.map(function (x) { return x.participantes; }).filter(apiNumeroValido_);
  const picos = sessoes.map(function (x) { return x.pico; }).filter(apiNumeroValido_);
  const pares = sessoes.filter(function (x) { return apiNumeroValido_(x.minutosGravados) && apiNumeroValido_(x.duracaoPrevista) && x.duracaoPrevista > 0; });
  const gravado = apiSomar_(pares.map(function (x) { return x.minutosGravados; }));
  const previsto = apiSomar_(pares.map(function (x) { return x.duracaoPrevista; }));
  const percentual = gravado !== null && previsto !== null && previsto > 0 ? apiArredondar_(gravado / previsto * 100, 1) : null;
  const coberturas = sessoes.filter(function (x) { return x.duracaoPrevista > 0 && apiNumeroValido_(x.cobertura); }).map(function (x) { return x.cobertura; });
  const prazo = sessoes.map(apiNoPrazo_);
  const noPrazo = prazo.filter(function (x) { return x === true; }).length;
  const desconhecidas = prazo.filter(function (x) { return x === null; }).length;
  const somaParticipantes = apiSomar_(participantes);
  const somaCoberturas = apiSomar_(coberturas);
  const contarStatus = function (tipos) { return sessoes.filter(function (x) { return tipos.includes(x.statusTipo); }).length; };
  return {
    aulas: sessoes.length, disciplinas: dados.length,
    participacoes: somaParticipantes,
    mediaParticipantes: somaParticipantes === null ? null : apiArredondar_(somaParticipantes / participantes.length, 1),
    sessoesComParticipantes: participantes.length,
    maiorPico: picos.length ? picos.reduce(function (max, x) { return Math.max(max, x); }, 0) : null,
    // Campo legado preservado: média simples, não usar como Tempo gravado.
    coberturaMedia: somaCoberturas === null ? null : apiArredondar_(somaCoberturas / coberturas.length, 1),
    tempoGravado: {
      minutosGravados: gravado, minutosPrevistos: previsto, percentual: percentual,
      sessoesComparaveis: pares.length, sessoesTotais: sessoes.length,
      sessoesExcluidas: sessoes.length - pares.length,
      excedente: pares.some(function (x) { return x.minutosGravados > x.duracaoPrevista; }),
      contratoConfirmado: false
    },
    gravacoesNoPrazo: noPrazo, gravacoesSemInformacao: desconhecidas,
    gravacoesNoPrazoPercentual: sessoes.length && !desconhecidas ? apiArredondar_(noPrazo / sessoes.length * 100, 1) : null,
    ok: contarStatus(["OK"]), atencao: contarStatus(["ATRASO", "SEM_PARTICIPANTES"]),
    problemas: sessoes.length - contarStatus(["OK", "ATRASO", "SEM_PARTICIPANTES"]),
    sessoesComConflito: sessoes.filter(function (x) { return x.sessionConflict === true; }).length
  };
}

function apiNoPrazo_(item) {
  const gravacao = apiNormalizarTexto_(item.gravacao);
  if (gravacao === "NAO") return false;
  if (gravacao !== "SIM" || !apiNumeroValido_(item.atrasoGravacao)) return null;
  return item.atrasoGravacao <= 10;
}

function apiGerarOpcoesFiltros_(dados) {
  return { semanas: apiUnicos_(dados.map(function (x) { return x.semana; })),
    instituicoes: apiUnicos_(dados.map(function (x) { return x.instituicao; })),
    contas: apiUnicos_(dados.map(function (x) { return x.conta; })),
    turmas: apiUnicos_(dados.map(function (x) { return x.turma; })),
    disciplinas: apiUnicos_(dados.map(function (x) { return x.aula; })),
    status: ["OK", "ATRASO", "SEM_GRAVACAO", "AULA_NAO_INICIADA", "SEM_PARTICIPANTES", "OUTRO"] };
}

function apiClassificarStatus_(status) {
  const texto = apiNormalizarTexto_(status).replace(/[^A-Z0-9]+/g, " ").trim();
  if (texto === "AULA NAO INICIADA") return "AULA_NAO_INICIADA";
  if (texto === "SEM GRAVACAO") return "SEM_GRAVACAO";
  if (texto === "GRAVACAO ATRASADA" || texto === "ATRASO") return "ATRASO";
  if (texto === "SEM PARTICIPANTES") return "SEM_PARTICIPANTES";
  return texto === "OK" ? "OK" : "OUTRO";
}

function apiTexto_(valor) { return valor === null || valor === undefined ? "" : String(valor).trim(); }
function apiNormalizarTexto_(valor) { return apiTexto_(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }
function apiNormalizarCabecalho_(valor) { return apiNormalizarTexto_(valor).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function apiParametro_(valor) { return apiTexto_(valor); }
function apiComparar_(a, b) { return apiNormalizarTexto_(a) === apiNormalizarTexto_(b); }
function apiNumeroValido_(valor) { return typeof valor === "number" && Number.isFinite(valor); }
function apiNumero_(valor, permiteNegativo) {
  if (typeof valor !== "number" && typeof valor !== "string") return null;
  if (typeof valor === "string") {
    valor = valor.trim();
    if (!/^-?\d+(?:[.,]\d+)?$/.test(valor)) return null;
    valor = valor.replace(",", ".");
  }
  const numero = Number(valor);
  return Number.isFinite(numero) && (permiteNegativo || numero >= 0) ? numero : null;
}
function apiSomar_(valores) {
  if (!valores.length) return null;
  const soma = valores.reduce(function (total, valor) { return total + valor; }, 0);
  return Number.isFinite(soma) ? soma : null;
}
function apiArredondar_(numero, casas) {
  if (!apiNumeroValido_(numero)) return null;
  const fator = Math.pow(10, casas);
  const arredondado = Math.round(numero * fator) / fator;
  // Não perder um número finito apenas por overflow na multiplicação.
  return Number.isFinite(arredondado) ? arredondado : numero;
}
function apiUnicos_(valores) { return Array.from(new Set(valores.map(apiTexto_).filter(Boolean))).sort(); }
function apiSerializarData_(valor) {
  if (!(valor instanceof Date) || isNaN(valor.getTime())) return "";
  return Utilities.formatDate(valor, API_DASHBOARD_CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function apiFormatarDataHora_(data) { return Utilities.formatDate(data, API_DASHBOARD_CONFIG.TIME_ZONE, "dd/MM/yyyy HH:mm:ss"); }
function responderJson_(objeto) { return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON); }
