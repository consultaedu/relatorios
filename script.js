const CONFIG = window.DASHBOARD_CONFIG || {};
const API_URL = CONFIG.apiUrl || "/api/";
const Core = window.DashboardCore;

const state = {
  rawData: [],
  filteredData: [],
  tableData: [],
  apiUpdatedAt: "",
  apiConsultedAt: "",
  view: "executive",
  sort: {
    key: "inicio",
    direction: "desc"
  },
  page: 1,
  pageSize: 20,
  search: "",
  loaded: false,
  loading: false,
  printing: false,
  charts: {
    participants: null,
    status: null,
    coverage: null,
    weekly: null
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  setView("executive");
  await loadData();
});

function cacheElements() {
  const ids = [
    "loadingScreen", "toast", "dataNotice", "printSummary", "chartsNotice", "recordingNote", "attentionHint",
    "apiStatusDot", "apiStatusText", "apiUpdatedAt", "footerUpdatedAt",
    "filterWeek", "filterInstitution", "filterAccount", "filterClass", "filterDiscipline", "filterStatus",
    "clearFiltersButton", "selectionBadge",
    "kpiClasses", "kpiClassesHint", "kpiAverage", "kpiAverageHint",
    "kpiPeak", "kpiPeakHint", "kpiOnTime", "kpiOnTimeHint",
    "kpiCoverage", "kpiCoverageHint", "kpiIssues", "kpiIssuesHint",
    "participantsChart", "statusChart", "coverageChart", "weeklyChart",
    "statusLegend", "attentionCount", "attentionList",
    "tableSearch", "pageSize", "tableBody", "tableInfo",
    "prevPage", "nextPage", "pageIndicator",
    "refreshButton", "printButton",
    "executiveViewBtn", "operationalViewBtn",
    "menuButton", "sidebar",
    "drawerBackdrop", "detailsDrawer", "drawerClose",
    "drawerTitle", "drawerStatus", "drawerInstitution", "drawerAccount",
    "drawerClass", "drawerWeek", "drawerStart", "drawerEnd",
    "drawerParticipants", "drawerPeak", "drawerRecordingStart",
    "drawerRecordingEnd", "drawerDelay", "drawerRecorded",
    "drawerDuration", "drawerCoverage", "drawerCoverageBar", "drawerMeetCode"
  ];

  ids.forEach(id => {
    els[id] = document.getElementById(id);
  });
  document.querySelectorAll(".kpi-info").forEach((button, index) => {
    const explanation = document.createElement("span");
    explanation.id = `kpiExplanation${index}`;
    explanation.className = "sr-only";
    explanation.textContent = button.dataset.tooltip;
    button.after(explanation);
    button.setAttribute("aria-describedby", explanation.id);
  });
  updateSidebarState();
  window.matchMedia?.("(max-width: 920px)")?.addEventListener("change", updateSidebarState);
}

function bindEvents() {
  [
    els.filterWeek,
    els.filterInstitution,
    els.filterAccount,
    els.filterClass,
    els.filterDiscipline,
    els.filterStatus
  ].forEach(el => {
    el.addEventListener("change", () => {
      state.page = 1;
      applyFilters();
    });
  });

  els.clearFiltersButton.addEventListener("click", clearFilters);

  els.tableSearch.addEventListener("input", e => {
    state.search = e.target.value.trim().toLocaleLowerCase("pt-BR");
    state.page = 1;
    renderTable();
  });

  els.pageSize.addEventListener("change", e => {
    state.pageSize = Number(e.target.value) || 20;
    state.page = 1;
    renderTable();
  });

  els.prevPage.addEventListener("click", () => {
    if (state.page > 1) {
      state.page--;
      renderTable();
    }
  });

  els.nextPage.addEventListener("click", () => {
    const totalPages = getTotalPages();
    if (state.page < totalPages) {
      state.page++;
      renderTable();
    }
  });

  els.refreshButton.addEventListener("click", async () => {
    els.refreshButton.disabled = true;
    els.refreshButton.innerHTML = "<span>↻</span> Atualizando...";
    try { await loadData({ showLoading: false }); }
    finally {
      els.refreshButton.disabled = false;
      els.refreshButton.innerHTML = "<span>↻</span> Atualizar";
    }
  });

  els.printButton.addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", () => {
    state.printing = true;
    renderTable();
    updatePrintSummary();
    Object.values(state.charts).forEach(chart => { chart?.stop?.(); chart?.resize(); chart?.update?.("none"); });
  });
  window.addEventListener("afterprint", () => {
    state.printing = false;
    renderTable();
    Object.values(state.charts).forEach(chart => chart?.resize());
  });

  els.executiveViewBtn.addEventListener("click", () => setView("executive"));
  els.operationalViewBtn.addEventListener("click", () => setView("operational"));

  els.drawerClose.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);

  els.menuButton.addEventListener("click", () => {
    const open = els.sidebar.classList.toggle("open");
    els.menuButton.setAttribute("aria-expanded", String(open));
    updateSidebarState();
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      button.classList.add("active");

      const target = document.getElementById(button.dataset.scroll);
      if (button.dataset.scroll === "detalhamento") setView("operational");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });

      els.sidebar.classList.remove("open");
      els.menuButton.setAttribute("aria-expanded", "false");
      updateSidebarState();
    });
  });

  document.querySelectorAll("th[data-sort]").forEach(th => {
    const sort = () => {
      const key = th.dataset.sort;

      if (state.sort.key === key) {
        state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.direction = "asc";
      }

      state.page = 1;
      renderTable();
    };
    th.tabIndex = 0;
    th.setAttribute("aria-sort", "none");
    th.addEventListener("click", sort);
    th.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); }
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeDrawer();
      els.sidebar.classList.remove("open");
      els.menuButton.setAttribute("aria-expanded", "false");
      updateSidebarState();
    }
    if (e.key === "Tab" && els.detailsDrawer.classList.contains("open")) {
      // O painel só contém o botão Fechar como controle interativo.
      e.preventDefault();
      els.drawerClose.focus();
    }
  });
}

function updateSidebarState() {
  const mobile = window.matchMedia?.("(max-width: 920px)")?.matches || false;
  const hidden = mobile && !els.sidebar.classList.contains("open");
  els.sidebar.inert = hidden;
  els.sidebar.setAttribute("aria-hidden", String(hidden));
}

async function loadData({ showLoading = true } = {}) {
  if (state.loading) return;
  state.loading = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs || 25000);
  if (showLoading) els.loadingScreen.classList.remove("hidden");

  setApiState("loading");

  try {
    const url = new URL(API_URL, window.location.href);
    if (!showLoading) url.searchParams.set("refresh", "1");
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`API retornou HTTP ${response.status}`);
    }

    let payload;
    try { payload = await response.json(); }
    catch { throw new Error("A API não retornou JSON válido."); }

    if (!payload || payload.ok !== true) {
      throw new Error("A API respondeu com erro.");
    }

    const rows = Core.validatePayload(payload);
    closeDrawer();
    state.rawData = rows;

    state.apiUpdatedAt = typeof payload.atualizadoEm === "string" ? payload.atualizadoEm : "";
    state.apiConsultedAt = typeof payload.consultadoEm === "string" ? payload.consultadoEm : "";
    updateApiTimestamps();

    populateInitialFilters();
    applyFilters();
    state.loaded = true;
    els.dataNotice.textContent = rows.length ? "" : "A API retornou uma lista vazia. Não há aulas disponíveis.";
    els.dataNotice.hidden = !!rows.length;

    setApiState("online");

    showToast(`Consulta concluída: ${formatNumber(state.rawData.length)} vínculos acadêmicos carregados.`);

  } catch (error) {
    setApiState("error");
    if (error.name === "AbortError") error = new Error("A API excedeu o tempo limite. Tente atualizar novamente.");
    renderApiError(error);
    showToast(`Erro ao carregar dados: ${error.message}`, true);
  } finally {
    clearTimeout(timeout);
    state.loading = false;
    setTimeout(() => els.loadingScreen.classList.add("hidden"), 180);
  }
}

function populateInitialFilters() {
  refillSelectPreserving(els.filterWeek, uniqueSorted(state.rawData.map(x => x.semana), weekSort), "Todas as semanas");

  // Por padrão, abre na semana mais recente disponível.
  const weeks = uniqueSorted(state.rawData.map(x => x.semana), weekSort);
  if (weeks.length && !state.loaded) {
    els.filterWeek.value = weeks[0];
  }
}

function applyFilters() {
  refreshDependentFilters();
  const filters = getFilters();

  state.filteredData = state.rawData.filter(item => {
    if (filters.week && item.semana !== filters.week) return false;
    if (filters.institution && item.instituicao !== filters.institution) return false;
    if (filters.account && item.conta !== filters.account) return false;
    if (filters.className && item.turma !== filters.className) return false;
    if (filters.discipline && item.aula !== filters.discipline) return false;
    if (filters.status && item.statusTipo !== filters.status) return false;
    return true;
  });

  updateSelectionBadge();
  renderAll();
}

function refreshDependentFilters() {
  const current = getFilters();

  const baseForInstitution = state.rawData.filter(item =>
    (!current.week || item.semana === current.week)
  );

  refillSelectPreserving(
    els.filterInstitution,
    uniqueSorted(baseForInstitution.map(x => x.instituicao)),
    "Todas as instituições"
  );

  const baseForAccount = state.rawData.filter(item =>
    (!els.filterWeek.value || item.semana === els.filterWeek.value) &&
    (!els.filterInstitution.value || item.instituicao === els.filterInstitution.value)
  );

  refillSelectPreserving(
    els.filterAccount,
    uniqueSorted(baseForAccount.map(x => x.conta)),
    "Todas as contas"
  );

  const baseForClass = state.rawData.filter(item =>
    (!els.filterWeek.value || item.semana === els.filterWeek.value) &&
    (!els.filterInstitution.value || item.instituicao === els.filterInstitution.value) &&
    (!els.filterAccount.value || item.conta === els.filterAccount.value)
  );

  refillSelectPreserving(
    els.filterClass,
    uniqueSorted(baseForClass.map(x => x.turma)),
    "Todas as turmas"
  );

  const baseForDiscipline = state.rawData.filter(item =>
    (!els.filterWeek.value || item.semana === els.filterWeek.value) &&
    (!els.filterInstitution.value || item.instituicao === els.filterInstitution.value) &&
    (!els.filterAccount.value || item.conta === els.filterAccount.value) &&
    (!els.filterClass.value || item.turma === els.filterClass.value)
  );

  refillSelectPreserving(
    els.filterDiscipline,
    uniqueSorted(baseForDiscipline.map(x => x.aula)),
    "Todas as disciplinas"
  );
}

function clearFilters() {
  els.filterWeek.value = "";
  els.filterInstitution.value = "";
  els.filterAccount.value = "";
  els.filterClass.value = "";
  els.filterDiscipline.value = "";
  els.filterStatus.value = "";
  els.tableSearch.value = "";
  state.search = "";
  state.page = 1;
  applyFilters();
}

function getFilters() {
  return {
    week: els.filterWeek.value,
    institution: els.filterInstitution.value,
    account: els.filterAccount.value,
    className: els.filterClass.value,
    discipline: els.filterDiscipline.value,
    status: els.filterStatus.value
  };
}

function updateSelectionBadge() {
  const filters = getFilters();
  const parts = [];

  if (filters.week) parts.push(filters.week);
  if (filters.institution) parts.push(filters.institution);
  if (filters.account) parts.push(filters.account);
  if (filters.className) parts.push(filters.className);
  if (filters.discipline) parts.push(filters.discipline);
  if (filters.status) parts.push(statusLabel(filters.status));

  els.selectionBadge.textContent = parts.length ? parts.join(" · ") : "Todos os dados";
}

function renderAll() {
  renderKpis();
  renderCharts();
  renderAttention();
  renderTable();
}

/*
 * ============================================================
 * SESSÕES COMPARTILHADAS
 * ============================================================
 *
 * A API mantém uma linha acadêmica por disciplina.
 * Indicadores e gráficos contam a sessão real do Meet apenas
 * uma vez quando duas disciplinas compartilham horário/link.
 *
 * A tabela continua mostrando as disciplinas separadamente.
 */

function deduplicarPorSessao(itens) {
  return Core.deduplicate(itens);
}


function nomeExibicaoSessao(item) {
  const filtros = getFilters();

  if (filtros.discipline) {
    return item.aula || "";
  }

  return item.disciplinasSessao || item.aula || "";
}


function recordingRatio(item) {
  const value = item.minutosGravados !== null && item.duracaoPrevista > 0
    ? item.minutosGravados / item.duracaoPrevista * 100 : null;
  return Number.isFinite(value) ? value : null;
}

function renderKpis() {
  const rows = state.filteredData;
  const data = deduplicarPorSessao(rows);
  const total = data.length;
  const participants = data.filter(x => x.participantes !== null);
  const peaks = data.filter(x => x.pico !== null);
  const onTime = data.filter(x => Core.onTime(x) === true);
  const unknownOnTime = data.filter(x => Core.onTime(x) === null).length;
  const totals = Core.recordingTotals(data, CONFIG.recordingContract);
  const issues = data.filter(x => x.statusTipo !== "OK");

  setText(els.kpiClasses, state.loaded || state.loading ? formatNumber(total) : "—");
  setText(els.kpiAverage, formatDecimal(Core.mean(data, "participantes"), 1));
  setText(els.kpiPeak, formatNumber(peaks.length ? peaks.reduce((max, x) => Math.max(max, x.pico), 0) : null));
  setText(els.kpiOnTime, total ? (unknownOnTime ? `${onTime.length}/${total}` : formatPercent(onTime.length / total * 100)) : "—");
  setText(els.kpiIssues, total ? formatNumber(issues.length) : "—");
  els.kpiClassesHint.textContent = `${total} sessões · ${rows.length} vínculos de disciplina`;
  els.kpiAverageHint.textContent = `${participants.length} de ${total} sessões com participantes informados`;
  els.kpiPeakHint.textContent = `${peaks.length} de ${total} sessões com pico informado`;
  els.kpiOnTimeHint.textContent = `${onTime.length} de ${total} sessões confirmadas no prazo${unknownOnTime ? ` · ${unknownOnTime} sem informação` : ""}`;
  els.kpiIssuesHint.textContent = total ? `${issues.length} sessões fora do status OK` : "Sem aulas na seleção";

  els.kpiCoverage.textContent = totals.eligible
    ? `${Core.duration(totals.recorded)} de ${Core.duration(totals.planned)} previstas` : "—";
  els.kpiCoverageHint.textContent = totals.percent !== null
    ? `${formatPercent(totals.percent)} em relação ao previsto${totals.missing ? ` · base parcial: ${totals.eligible}/${total} sessões` : ""}`
    : "Sem pares válidos de tempo gravado e previsto";
  els.recordingNote.textContent = `${totals.confirmed ? "Intervalos dentro do horário previsto." : "Tempos da API; reinícios podem estar fora do total. Cobertura do horário não confirmada."}${totals.exceeds ? " Excesso não comprova cobertura integral." : ""}${totals.missing ? ` ${totals.missing} sessões excluídas dos dois totais por dados incompletos.` : ""}`;
  const conflicts = data.filter(x => x.sessionConflict).length;
  const withoutSession = data.filter(x => !x.chaveSessao && !x.idSessao).length;
  if (conflicts || withoutSession) els.recordingNote.textContent += ` ${conflicts ? `${conflicts} sessões com dados divergentes. ` : ""}${withoutSession ? `${withoutSession} sessões sem chave explícita; deduplicação usa ID/linha como fallback.` : ""}`;
}

function renderCharts() {
  if (typeof Chart !== "function") {
    els.chartsNotice.hidden = false;
    els.chartsNotice.textContent = "Não foi possível carregar os gráficos. Indicadores, ocorrências e tabela continuam disponíveis.";
    return;
  }
  els.chartsNotice.hidden = true;
  renderParticipantsChart();
  renderStatusChart();
  renderCoverageChart();
  renderWeeklyChart();
  const summaries = {
    participantsChart: state.charts.participants,
    statusChart: state.charts.status,
    coverageChart: state.charts.coverage,
    weeklyChart: state.charts.weekly
  };
  for (const [id, chart] of Object.entries(summaries)) {
    const summary = chart.data.labels.map((label, index) => `${label}: ${chart.data.datasets.map(dataset => `${dataset.label || "Sessões"} ${dataset.data[index] === null ? "sem informação" : formatDecimal(dataset.data[index], 1)}`).join(", ")}`).join("; ");
    els[id].setAttribute("role", "img");
    els[id].setAttribute("aria-label", summary || "Sem dados para os filtros atuais");
  }
}

function renderParticipantsChart() {
  destroyChart("participants");

  const data = deduplicarPorSessao(state.filteredData)
    .filter(x => x.participantes !== null || x.pico !== null)
    .sort((a, b) => (b.participantes ?? -1) - (a.participantes ?? -1))
    .slice(0, 12)
    .reverse();

  state.charts.participants = new Chart(els.participantsChart, {
    type: "bar",
    data: {
      labels: data.map(x => truncate(nomeExibicaoSessao(x), 34)),
      datasets: [
        {
          label: "Participantes únicos",
          data: data.map(x => x.participantes),
          backgroundColor: "rgba(22, 163, 74, .84)",
          borderRadius: 5,
          borderSkipped: false,
          barThickness: 10
        },
        {
          label: "Pico simultâneo",
          data: data.map(x => x.pico),
          backgroundColor: "rgba(132, 204, 22, .68)",
          borderRadius: 5,
          borderSkipped: false,
          barThickness: 10
        }
      ]
    },
    options: chartOptions({
      indexAxis: "y",
      legend: true,
      tooltipTitle: ctx => nomeExibicaoSessao(data[ctx[0].dataIndex] || {})
    })
  });
}

function renderStatusChart() {
  destroyChart("status");

  const counts = {
    OK: 0,
    ATRASO: 0,
    SEM_GRAVACAO: 0,
    AULA_NAO_INICIADA: 0,
    SEM_PARTICIPANTES: 0,
    OUTRO: 0
  };

  deduplicarPorSessao(state.filteredData).forEach(item => {
    counts[item.statusTipo] = (counts[item.statusTipo] || 0) + 1;
  });

  const entries = Object.entries(counts).filter(([, value]) => value > 0);

  const labels = entries.map(([key]) => statusLabel(key));
  const values = entries.map(([, value]) => value);
  const colors = entries.map(([key]) => statusColor(key));

  state.charts.status = new Chart(els.statusChart, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      cutout: "74%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => ` ${context.label}: ${context.raw}`
          }
        }
      }
    }
  });

  els.statusLegend.innerHTML = entries.map(([key, value]) => `
    <span class="legend-item">
      <i class="legend-dot" style="background:${statusColor(key)}"></i>
      ${escapeHtml(statusLabel(key))}: <strong>${value}</strong>
    </span>
  `).join("");
}

function renderCoverageChart() {
  destroyChart("coverage");

  const data = deduplicarPorSessao(state.filteredData)
    .filter(x => recordingRatio(x) !== null)
    .sort((a, b) => recordingRatio(a) - recordingRatio(b))
    .slice(0, 12)
    .reverse();

  state.charts.coverage = new Chart(els.coverageChart, {
    type: "bar",
    data: {
      labels: data.map(x => truncate(nomeExibicaoSessao(x), 34)),
      datasets: [{
        label: "Tempo informado / previsto (%)",
        data: data.map(recordingRatio),
        backgroundColor: data.map(x => coverageColor(recordingRatio(x), .76)),
        borderRadius: 5,
        borderSkipped: false,
        barThickness: 11
      }]
    },
    options: chartOptions({
      indexAxis: "y",
      percentTicks: true,
      legend: false,
      tooltipTitle: ctx => nomeExibicaoSessao(data[ctx[0].dataIndex] || {}),
      tooltipLabel: ctx => { const item = data[ctx.dataIndex]; return ` ${Core.duration(item.minutosGravados)} / ${Core.duration(item.duracaoPrevista)} · ${formatPercent(ctx.raw)} (API)`; }
    })
  });
}

function renderWeeklyChart() {
  destroyChart("weekly");

  const grouped = Object.create(null);

  const sessoes =
    deduplicarPorSessao(
      state.filteredData
    );

  sessoes.forEach(item => {
    const key = item.semana || "Sem semana";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  const weeks = Object.keys(grouped).sort(weekSort).reverse();

  const avgParticipants = weeks.map(week => {
    const items = grouped[week];
    return Core.mean(items, "participantes");
  });

  const onTimePercent = weeks.map(week => {
    const items = grouped[week];
    if (!items.length || items.some(x => Core.onTime(x) === null)) return null;

    const ok = items.filter(x =>
      Core.onTime(x) === true
    ).length;

    return (ok / items.length) * 100;
  });

  state.charts.weekly = new Chart(els.weeklyChart, {
    type: "line",
    data: {
      labels: weeks.map(shortWeekLabel),
      datasets: [
        {
          label: "Média de participantes",
          data: avgParticipants,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22,163,74,.09)",
          pointBackgroundColor: "#16a34a",
          pointRadius: 3,
          tension: .32,
          fill: true,
          yAxisID: "y"
        },
        {
          label: "Gravações no prazo (%)",
          data: onTimePercent,
          borderColor: "#65a30d",
          backgroundColor: "transparent",
          pointBackgroundColor: "#65a30d",
          pointRadius: 3,
          tension: .32,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      scales: {
        x: axisStyle(),
        y: {
          ...axisStyle(),
          beginAtZero: true,
          position: "left",
          title: {
            display: true,
            text: "Participantes",
            color: "#64748b",
            font: { size: 9 }
          }
        },
        y1: {
          ...axisStyle(),
          beginAtZero: true,
          max: 100,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#64748b",
            font: { size: 9 },
            callback: value => `${value}%`
          },
          title: {
            display: true,
            text: "No prazo",
            color: "#64748b",
            font: { size: 9 }
          }
        }
      },
      plugins: {
        legend: legendStyle(),
        tooltip: tooltipStyle()
      }
    }
  });
}

function chartOptions({
  indexAxis = "x",
  max = undefined,
  percentTicks = false,
  legend = false,
  tooltipTitle = undefined,
  tooltipLabel = undefined
} = {}) {
  const valueAxis = indexAxis === "y" ? "x" : "y";

  const scales = {
    x: axisStyle(),
    y: axisStyle()
  };

  scales[valueAxis].beginAtZero = true;

  if (max !== undefined) scales[valueAxis].max = max;

  if (percentTicks) {
    scales[valueAxis].ticks = {
      color: "#64748b",
      font: { size: 9 },
      callback: value => `${value}%`
    };
  }

  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    scales,
    plugins: {
      legend: legend ? legendStyle() : { display: false },
      tooltip: {
        ...tooltipStyle(),
        callbacks: {
          ...(tooltipTitle ? { title: tooltipTitle } : {}),
          ...(tooltipLabel ? { label: tooltipLabel } : {})
        }
      }
    }
  };
}

function axisStyle() {
  return {
    grid: {
      color: "rgba(226,232,240,.75)",
      drawBorder: false
    },
    ticks: {
      color: "#64748b",
      font: { size: 9 },
      maxRotation: 0
    },
    border: { display: false }
  };
}

function legendStyle() {
  return {
    display: true,
    position: "top",
    align: "end",
    labels: {
      color: "#64748b",
      boxWidth: 8,
      boxHeight: 8,
      usePointStyle: true,
      pointStyle: "circle",
      font: { size: 9 }
    }
  };
}

function tooltipStyle() {
  return {
    backgroundColor: "#0f172a",
    titleColor: "#fff",
    bodyColor: "#e2e8f0",
    borderColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    titleFont: { size: 10, weight: "600" },
    bodyFont: { size: 10 }
  };
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function renderAttention() {
  const issues = deduplicarPorSessao(state.filteredData)
    .filter(item => item.statusTipo !== "OK")
    .sort((a, b) => issuePriority(a) - issuePriority(b) || b.atrasoGravacao - a.atrasoGravacao);

  els.attentionCount.textContent = issues.length;
  els.attentionHint.textContent = issues.length > 9 ? `Exibindo 9 de ${issues.length} ocorrências. Consulte a tabela operacional para as demais.` : "";

  if (!issues.length) {
    els.attentionList.innerHTML = `
      <div class="empty-state">
        <span>✓</span>
        <strong>${state.filteredData.length ? "Nenhuma ocorrência na seleção atual" : "Sem aulas na seleção atual"}</strong>
        <p>${state.filteredData.length ? "As aulas selecionadas não apresentam alertas de status." : "Ajuste ou limpe os filtros para consultar outras aulas."}</p>
      </div>
    `;
    return;
  }

  els.attentionList.innerHTML = issues.slice(0, 9).map(item => {
    const severe = ["SEM_GRAVACAO", "AULA_NAO_INICIADA"].includes(item.statusTipo);

    return `
      <article class="attention-card ${severe ? "problem" : ""}" tabindex="0" role="button" aria-label="Ver detalhes de ${escapeAttr(nomeExibicaoSessao(item))}" data-id="${escapeAttr(item.rowKey)}">
        <div class="attention-card-top">
          <div style="min-width:0">
            <h3 title="${escapeAttr(nomeExibicaoSessao(item))}">${escapeHtml(nomeExibicaoSessao(item))}</h3>
            <div class="attention-meta">
              ${escapeHtml(item.instituicao || "—")} · ${escapeHtml(formatDateTime(item.inicio))}
            </div>
          </div>
          ${statusPill(item)}
        </div>

        <div class="attention-metrics">
          <div class="attention-metric">
            <span>Participantes</span>
            <strong>${formatNumber(item.participantes)}</strong>
          </div>
          <div class="attention-metric">
            <span>Atraso</span>
            <strong>${formatMinutes(item.atrasoGravacao)}</strong>
          </div>
          <div class="attention-metric">
            <span>Tempo / previsto (API)</span>
            <strong>${formatPercent(recordingRatio(item))}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");

  els.attentionList.querySelectorAll(".attention-card").forEach(card => {
    const open = () => {
      const item = state.rawData.find(x => x.rowKey === card.dataset.id);
      if (item) openDrawer(item);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

function renderTable() {
  const search = state.search;

  let rows = [...state.filteredData];

  if (search) {
    rows = rows.filter(item => {
      const haystack = [
        item.aula,
        item.disciplinasSessao,
        item.instituicao,
        item.turma,
        item.conta,
        item.semana,
        item.status,
        item.statusTipo
      ].join(" ").toLocaleLowerCase("pt-BR");

      return haystack.includes(search);
    });
  }

  rows.sort(compareBy(state.sort.key, state.sort.direction));
  state.tableData = rows;

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.printing ? rows : rows.slice(start, start + state.pageSize);
  document.querySelectorAll("th[data-sort]").forEach(th => th.setAttribute("aria-sort", th.dataset.sort === state.sort.key ? (state.sort.direction === "asc" ? "ascending" : "descending") : "none"));

  if (!pageRows.length) {
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="padding:38px;text-align:center;color:#94a3b8">
          Nenhuma aula encontrada para os filtros atuais.
        </td>
      </tr>
    `;
  } else {
    els.tableBody.innerHTML = pageRows.map(item => `
      <tr>
        <td>
          <div class="cell-title" title="${escapeAttr(item.aula)}">${escapeHtml(item.aula)}</div>
          <span class="cell-subtitle">${escapeHtml(item.conta || "")}</span>
        </td>
        <td>
          <strong>${escapeHtml(formatShortDate(item.inicio))}</strong>
          <span class="cell-subtitle">${escapeHtml(formatTimeRange(item.inicio, item.fim))}</span>
        </td>
        <td>${escapeHtml(item.instituicao || "—")}</td>
        <td>${escapeHtml(item.turma || "—")}</td>
        <td class="numeric">${formatNumber(item.participantes)}</td>
        <td class="numeric">${formatNumber(item.pico)}</td>
        <td class="numeric">${formatMinutes(item.atrasoGravacao)}</td>
        <td class="numeric">${Core.duration(item.minutosGravados)}<span class="cell-subtitle">de ${Core.duration(item.duracaoPrevista)} previstas</span></td>
        <td class="numeric"><strong>${formatPercent(recordingRatio(item))}</strong></td>
        <td>${statusPill(item)}</td>
        <td class="table-action no-print">
          <button class="row-button" data-id="${escapeAttr(item.rowKey)}" aria-label="Ver detalhes de ${escapeAttr(item.aula)}">›</button>
        </td>
      </tr>
    `).join("");
  }

  els.tableBody.querySelectorAll(".row-button").forEach(button => {
    button.addEventListener("click", () => {
      const item = state.rawData.find(x => x.rowKey === button.dataset.id);
      if (item) openDrawer(item);
    });
  });

  const shownFrom = total ? start + 1 : 0;
  const shownTo = Math.min(start + state.pageSize, total);

  els.tableInfo.textContent = `${formatNumber(shownFrom)}–${formatNumber(shownTo)} de ${formatNumber(total)} registros`;
  els.pageIndicator.textContent = `${state.page} / ${totalPages}`;
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= totalPages;
  if (state.printing) updatePrintSummary();
}

function updatePrintSummary() {
  els.printSummary.textContent = `Filtros: ${els.selectionBadge.textContent}. Pesquisa da tabela: ${state.search || "nenhuma"}. ${state.tableData.length} vínculos acadêmicos. ${els.footerUpdatedAt.textContent}. ${els.dataNotice.textContent}`;
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.tableData.length / state.pageSize));
}

function openDrawer(item) {
  els.drawerTitle.textContent = item.aula || "Aula";
  els.drawerStatus.innerHTML = statusPill(item);

  setText(els.drawerInstitution, item.instituicao || "—");
  setText(els.drawerAccount, item.conta || "—");
  setText(els.drawerClass, item.turma || "—");
  setText(els.drawerWeek, item.semana || "—");
  setText(els.drawerStart, formatDateTime(item.inicio));
  setText(els.drawerEnd, formatDateTime(item.fim));
  setText(els.drawerParticipants, formatNumber(item.participantes));
  setText(els.drawerPeak, formatNumber(item.pico));
  setText(els.drawerRecordingStart, formatDateTime(item.inicioGravacao));
  setText(els.drawerRecordingEnd, formatDateTime(item.fimGravacao));
  setText(els.drawerDelay, formatMinutes(item.atrasoGravacao));
  setText(els.drawerRecorded, formatMinutes(item.minutosGravados));
  setText(els.drawerDuration, formatMinutes(item.duracaoPrevista));
  setText(els.drawerCoverage, formatPercent(recordingRatio(item)));
  document.getElementById("drawerRecordingNote").textContent = `Cobertura informada pela API: ${formatPercent(item.cobertura)}. Relação de durações não comprova cobertura do horário previsto.${CONFIG.recordingContract !== "union-within-schedule-v1" ? " Reinícios podem estar fora do tempo informado pela origem." : ""}${item.sessionConflict ? " Dados divergentes entre vínculos da mesma sessão." : ""}`;
  setText(els.drawerMeetCode, item.codigoMeet || "—");

  const ratio = recordingRatio(item);
  const width = ratio === null ? 0 : Math.max(0, Math.min(100, ratio));
  els.drawerCoverageBar.style.width = `${width}%`;
  els.drawerCoverageBar.style.background = coverageGradient(ratio);

  state.drawerTrigger = document.activeElement;
  document.querySelector(".app-shell").inert = true;
  document.body.classList.add("drawer-open");
  els.detailsDrawer.inert = false;
  els.detailsDrawer.classList.add("open");
  els.drawerBackdrop.classList.add("open");
  els.detailsDrawer.setAttribute("aria-hidden", "false");
  els.drawerClose.focus();
}

function closeDrawer() {
  if (!els.detailsDrawer) return;
  const wasOpen = els.detailsDrawer.classList.contains("open");
  document.querySelector(".app-shell").inert = false;
  document.body.classList.remove("drawer-open");
  els.detailsDrawer.classList.remove("open");
  els.drawerBackdrop.classList.remove("open");
  els.detailsDrawer.setAttribute("aria-hidden", "true");
  els.detailsDrawer.inert = true;
  if (wasOpen && state.drawerTrigger?.isConnected) state.drawerTrigger.focus();
}

function setView(view) {
  state.view = view;

  const executive = view === "executive";
  document.body.classList.toggle("executive-mode", executive);

  els.executiveViewBtn?.classList.toggle("active", executive);
  els.operationalViewBtn?.classList.toggle("active", !executive);
  els.executiveViewBtn?.setAttribute("aria-pressed", String(executive));
  els.operationalViewBtn?.setAttribute("aria-pressed", String(!executive));

  if (executive) closeDrawer();
}

function setApiState(status) {
  els.apiStatusDot.className = "status-dot";

  if (status === "online") {
    els.apiStatusDot.classList.add("online");
    els.apiStatusText.textContent = "API online";
  } else if (status === "error") {
    els.apiStatusDot.classList.add("error");
    els.apiStatusText.textContent = "Falha na API";
  } else {
    els.apiStatusText.textContent = "Atualizando dados";
  }
}

function updateApiTimestamps() {
  if (state.apiConsultedAt) {
    els.apiUpdatedAt.textContent = `Consulta: ${state.apiConsultedAt}`;
    els.footerUpdatedAt.textContent = `Consulta à API: ${state.apiConsultedAt}. Consolidação da base: ${state.apiUpdatedAt || "data não informada"}.`;
  } else {
    const text = state.apiUpdatedAt || "não informado";
    els.apiUpdatedAt.textContent = `Horário da API: ${text}`;
    els.footerUpdatedAt.textContent = `Horário informado pela API: ${text}. Data de consolidação da base não confirmada.`;
  }
}

function renderApiError(error) {
  closeDrawer();
  els.dataNotice.hidden = false;
  els.dataNotice.textContent = `${state.loaded ? "Falha na atualização. Exibindo os últimos dados carregados; podem estar desatualizados." : "Não foi possível carregar dados. Indicadores indisponíveis."} ${error.message}`;
  if (!state.loaded) {
    [els.kpiClasses, els.kpiAverage, els.kpiPeak, els.kpiOnTime, els.kpiCoverage, els.kpiIssues].forEach(el => el.textContent = "—");
    els.attentionList.innerHTML = `<div class="empty-state"><strong>Dados indisponíveis</strong><p>Tente atualizar novamente.</p></div>`;
    els.tableBody.innerHTML = `<tr><td colspan="11">Dados indisponíveis. Tente atualizar novamente.</td></tr>`;
  }
}

function statusPill(item) {
  const type = item.statusTipo || "OUTRO";
  const className =
    type === "OK"
      ? "status-ok"
      : ["ATRASO", "SEM_PARTICIPANTES"].includes(type)
        ? "status-warning"
        : ["SEM_GRAVACAO", "AULA_NAO_INICIADA"].includes(type)
          ? "status-danger"
          : "status-neutral";

  return `<span class="status-pill ${className}">${escapeHtml(statusLabel(type))}</span>`;
}

function statusLabel(type) {
  const labels = {
    OK: "OK",
    ATRASO: "Gravação atrasada",
    SEM_GRAVACAO: "Sem gravação",
    AULA_NAO_INICIADA: "Aula não iniciada",
    SEM_PARTICIPANTES: "Sem participantes",
    OUTRO: "Outro"
  };

  return labels[type] || "Outro";
}

function statusColor(type) {
  const colors = {
    OK: "#22c55e",
    ATRASO: "#f59e0b",
    SEM_PARTICIPANTES: "#d97706",
    SEM_GRAVACAO: "#ef4444",
    AULA_NAO_INICIADA: "#b91c1c",
    OUTRO: "#94a3b8"
  };

  return colors[type] || colors.OUTRO;
}

function coverageColor(value, alpha = 1) {
  if (value === null || value > 100) return `rgba(100, 116, 139, ${alpha})`;
  if (value >= 90) return `rgba(34, 197, 94, ${alpha})`;
  if (value >= 75) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}

function coverageGradient(value) {
  if (value === null || value > 100) return "#64748b";
  if (value >= 90) return "linear-gradient(90deg,#15803d,#22c55e)";
  if (value >= 75) return "linear-gradient(90deg,#d97706,#f59e0b)";
  return "linear-gradient(90deg,#dc2626,#ef4444)";
}

function issuePriority(item) {
  if (item.statusTipo === "AULA_NAO_INICIADA") return 0;
  if (item.statusTipo === "SEM_GRAVACAO") return 1;
  if (item.statusTipo === "ATRASO") return 2;
  if (item.statusTipo === "SEM_PARTICIPANTES") return 3;
  return 4;
}

function compareBy(key, direction) {
  const modifier = direction === "asc" ? 1 : -1;

  return (a, b) => {
    let av = a[key];
    let bv = b[key];

    if (["inicio", "fim", "inicioGravacao", "fimGravacao"].includes(key)) {
      av = toDate(av)?.getTime() ?? null;
      bv = toDate(bv)?.getTime() ?? null;
    }

    if (key === "cobertura") { av = recordingRatio(a); bv = recordingRatio(b); }
    if (av === null || av === "") return bv === null || bv === "" ? 0 : 1;
    if (bv === null || bv === "") return -1;
    if (typeof av === "number" || typeof bv === "number") {
      return (safeNumber(av) - safeNumber(bv)) * modifier;
    }

    return String(av || "").localeCompare(String(bv || ""), "pt-BR", {
      numeric: true,
      sensitivity: "base"
    }) * modifier;
  };
}

function setSelectOptions(select, values, placeholder) {
  select.innerHTML = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...values.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`)
  ].join("");
}

function refillSelectPreserving(select, values, placeholder) {
  const current = select.value;
  setSelectOptions(select, values, placeholder);

  if (values.includes(current)) select.value = current;
}

function uniqueSorted(values, customSort) {
  const list = [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))];
  return customSort ? list.sort(customSort) : list.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function weekSort(a, b) {
  const da = parseWeekStart(a);
  const db = parseWeekStart(b);

  if (da && db) return db - da;
  return String(b).localeCompare(String(a), "pt-BR");
}

function parseWeekStart(week) {
  const match = String(week || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}

function shortWeekLabel(week) {
  const matches = String(week || "").match(/(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\/\d{2}\/\d{4})/);
  if (!matches) return week;

  return `${matches[1].slice(0, 5)} – ${matches[2].slice(0, 5)}`;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatTimeRange(start, end) {
  const a = formatTime(start);
  const b = formatTime(end);
  return a === "—" && b === "—" ? "—" : `${a} – ${b}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(safeNumber(value));
}

function formatDecimal(value, decimals = 1) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(safeNumber(value));
}

function formatPercent(value) {
  return value === null || value === undefined ? "—" : `${formatDecimal(value, 1)}%`;
}

function formatMinutes(value) {
  return value === null || value === undefined ? "—" : `${formatDecimal(value, 0)} min`;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function truncate(text, size) {
  const value = String(text || "");
  return value.length <= size ? value : `${value.slice(0, size - 1)}…`;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message, error = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", error);
  els.toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 3300);
}
