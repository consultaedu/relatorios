const API_URL = "https://monitor-meet-api.marcosdalleprane2.workers.dev/";

const state = {
  rawData: [],
  filteredData: [],
  tableData: [],
  apiUpdatedAt: "",
  view: "executive",
  sort: {
    key: "inicio",
    direction: "desc"
  },
  page: 1,
  pageSize: 20,
  search: "",
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
    "loadingScreen", "toast",
    "apiStatusDot", "apiStatusText", "apiUpdatedAt", "footerUpdatedAt",
    "filterWeek", "filterInstitution", "filterAccount", "filterClass", "filterStatus",
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
}

function bindEvents() {
  [
    els.filterWeek,
    els.filterInstitution,
    els.filterAccount,
    els.filterClass,
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
    await loadData({ showLoading: false });
    els.refreshButton.disabled = false;
    els.refreshButton.innerHTML = "<span>↻</span> Atualizar";
  });

  els.printButton.addEventListener("click", () => window.print());

  els.executiveViewBtn.addEventListener("click", () => setView("executive"));
  els.operationalViewBtn.addEventListener("click", () => setView("operational"));

  els.drawerClose.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);

  els.menuButton.addEventListener("click", () => {
    els.sidebar.classList.toggle("open");
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      button.classList.add("active");

      const target = document.getElementById(button.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });

      els.sidebar.classList.remove("open");
    });
  });

  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;

      if (state.sort.key === key) {
        state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.direction = "asc";
      }

      state.page = 1;
      renderTable();
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
  });
}

async function loadData({ showLoading = true } = {}) {
  if (showLoading) els.loadingScreen.classList.remove("hidden");

  setApiState("loading");

  try {
    const cacheBuster = `t=${Date.now()}`;
    const response = await fetch(`${API_URL}?${cacheBuster}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`API retornou HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true) {
      throw new Error(payload?.erro || "A API respondeu com erro.");
    }

    state.rawData = Array.isArray(payload.dados)
      ? payload.dados.map(normalizeItem)
      : [];

    state.apiUpdatedAt = payload.atualizadoEm || "";
    updateApiTimestamps();

    populateInitialFilters();
    applyFilters();

    setApiState("online");

    showToast(`Dados atualizados: ${formatNumber(state.rawData.length)} aulas carregadas.`);

  } catch (error) {
    console.error(error);
    setApiState("error");
    renderApiError(error);
    showToast(`Erro ao carregar dados: ${error.message}`, true);
  } finally {
    setTimeout(() => els.loadingScreen.classList.add("hidden"), 180);
  }
}

function normalizeItem(item) {
  return {
    ...item,
    participantes: safeNumber(item.participantes),
    pico: safeNumber(item.pico),
    atrasoGravacao: safeNumber(item.atrasoGravacao),
    minutosGravados: safeNumber(item.minutosGravados),
    duracaoPrevista: safeNumber(item.duracaoPrevista),
    cobertura: safeNumber(item.cobertura),
    statusTipo: String(item.statusTipo || "OUTRO").trim().toUpperCase(),
    instituicao: String(item.instituicao || "").trim(),
    turma: String(item.turma || "").trim(),
    conta: String(item.conta || "").trim(),
    semana: String(item.semana || "").trim(),
    aula: String(item.aula || "").trim(),
    gravacao: String(item.gravacao || "").trim()
  };
}

function populateInitialFilters() {
  setSelectOptions(els.filterWeek, uniqueSorted(state.rawData.map(x => x.semana), weekSort), "Todas as semanas");
  setSelectOptions(els.filterInstitution, uniqueSorted(state.rawData.map(x => x.instituicao)), "Todas as instituições");
  setSelectOptions(els.filterAccount, uniqueSorted(state.rawData.map(x => x.conta)), "Todas as contas");
  setSelectOptions(els.filterClass, uniqueSorted(state.rawData.map(x => x.turma)), "Todas as turmas");

  // Por padrão, abre na semana mais recente disponível.
  const weeks = uniqueSorted(state.rawData.map(x => x.semana), weekSort);
  if (weeks.length && !els.filterWeek.value) {
    els.filterWeek.value = weeks[0];
  }
}

function applyFilters() {
  const filters = getFilters();

  state.filteredData = state.rawData.filter(item => {
    if (filters.week && item.semana !== filters.week) return false;
    if (filters.institution && item.instituicao !== filters.institution) return false;
    if (filters.account && item.conta !== filters.account) return false;
    if (filters.className && item.turma !== filters.className) return false;
    if (filters.status && item.statusTipo !== filters.status) return false;
    return true;
  });

  refreshDependentFilters();
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
}

function clearFilters() {
  els.filterWeek.value = "";
  els.filterInstitution.value = "";
  els.filterAccount.value = "";
  els.filterClass.value = "";
  els.filterStatus.value = "";
  state.page = 1;
  applyFilters();
}

function getFilters() {
  return {
    week: els.filterWeek.value,
    institution: els.filterInstitution.value,
    account: els.filterAccount.value,
    className: els.filterClass.value,
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
  if (filters.status) parts.push(statusLabel(filters.status));

  els.selectionBadge.textContent = parts.length ? parts.join(" · ") : "Todos os dados";
}

function renderAll() {
  renderKpis();
  renderCharts();
  renderAttention();
  renderTable();
}

function renderKpis() {
  const data = state.filteredData;
  const total = data.length;

  const participationSum = sum(data, x => x.participantes);
  const average = total ? participationSum / total : 0;
  const peak = total ? Math.max(...data.map(x => x.pico)) : 0;

  const withRecording = data.filter(x => x.gravacao.toUpperCase() === "SIM");
  const onTime = data.filter(x =>
    x.gravacao.toUpperCase() === "SIM" &&
    x.atrasoGravacao <= 10
  );

  const onTimePercent = total ? (onTime.length / total) * 100 : 0;

  const coverageData = data.filter(x => x.duracaoPrevista > 0);
  const averageCoverage = coverageData.length
    ? sum(coverageData, x => x.cobertura) / coverageData.length
    : 0;

  const issues = data.filter(x => x.statusTipo !== "OK");

  setText(els.kpiClasses, formatNumber(total));
  setText(els.kpiAverage, formatDecimal(average, 1));
  setText(els.kpiPeak, formatNumber(peak));
  setText(els.kpiOnTime, formatPercent(onTimePercent));
  setText(els.kpiCoverage, formatPercent(averageCoverage));
  setText(els.kpiIssues, formatNumber(issues.length));

  els.kpiClassesHint.textContent = `${formatNumber(participationSum)} participações registradas`;
  els.kpiAverageHint.textContent = total ? `Média calculada em ${formatNumber(total)} aulas` : "Sem aulas na seleção";
  els.kpiPeakHint.textContent = peak ? "Maior valor encontrado na seleção" : "Sem pico registrado";
  els.kpiOnTimeHint.textContent = `${formatNumber(onTime.length)} de ${formatNumber(total)} aulas`;
  els.kpiCoverageHint.textContent = coverageData.length ? `${formatNumber(coverageData.length)} aulas com duração válida` : "Sem cobertura calculável";
  els.kpiIssuesHint.textContent = issues.length ? "Aulas fora do status OK" : "Nenhuma ocorrência";
}

function renderCharts() {
  renderParticipantsChart();
  renderStatusChart();
  renderCoverageChart();
  renderWeeklyChart();
}

function renderParticipantsChart() {
  destroyChart("participants");

  const data = [...state.filteredData]
    .sort((a, b) => b.participantes - a.participantes)
    .slice(0, 12)
    .reverse();

  state.charts.participants = new Chart(els.participantsChart, {
    type: "bar",
    data: {
      labels: data.map(x => truncate(x.aula, 34)),
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
      tooltipTitle: ctx => data[ctx[0].dataIndex]?.aula || ""
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

  state.filteredData.forEach(item => {
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

  const data = [...state.filteredData]
    .filter(x => x.duracaoPrevista > 0)
    .sort((a, b) => a.cobertura - b.cobertura)
    .slice(0, 12)
    .reverse();

  state.charts.coverage = new Chart(els.coverageChart, {
    type: "bar",
    data: {
      labels: data.map(x => truncate(x.aula, 34)),
      datasets: [{
        label: "Cobertura",
        data: data.map(x => x.cobertura),
        backgroundColor: data.map(x => coverageColor(x.cobertura, .76)),
        borderRadius: 5,
        borderSkipped: false,
        barThickness: 11
      }]
    },
    options: chartOptions({
      indexAxis: "y",
      max: 100,
      percentTicks: true,
      legend: false,
      tooltipTitle: ctx => data[ctx[0].dataIndex]?.aula || "",
      tooltipLabel: ctx => ` Cobertura: ${formatPercent(ctx.raw)}`
    })
  });
}

function renderWeeklyChart() {
  destroyChart("weekly");

  const grouped = {};

  state.rawData.forEach(item => {
    const key = item.semana || "Sem semana";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  const weeks = Object.keys(grouped).sort(weekSort).reverse();

  const avgParticipants = weeks.map(week => {
    const items = grouped[week];
    return items.length ? sum(items, x => x.participantes) / items.length : 0;
  });

  const onTimePercent = weeks.map(week => {
    const items = grouped[week];
    if (!items.length) return 0;

    const ok = items.filter(x =>
      x.gravacao.toUpperCase() === "SIM" &&
      x.atrasoGravacao <= 10
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
            color: "#94a3b8",
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
            color: "#94a3b8",
            font: { size: 9 },
            callback: value => `${value}%`
          },
          title: {
            display: true,
            text: "No prazo",
            color: "#94a3b8",
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
      color: "#94a3b8",
      font: { size: 9 },
      callback: value => `${value}%`
    };
  }

  return {
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
      color: "#94a3b8",
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
  const issues = [...state.filteredData]
    .filter(item => item.statusTipo !== "OK")
    .sort((a, b) => issuePriority(a) - issuePriority(b) || b.atrasoGravacao - a.atrasoGravacao);

  els.attentionCount.textContent = issues.length;

  if (!issues.length) {
    els.attentionList.innerHTML = `
      <div class="empty-state">
        <span>✓</span>
        <strong>Nenhuma ocorrência na seleção atual</strong>
        <p>As aulas selecionadas não apresentam alertas.</p>
      </div>
    `;
    return;
  }

  els.attentionList.innerHTML = issues.slice(0, 9).map(item => {
    const severe = ["SEM_GRAVACAO", "AULA_NAO_INICIADA"].includes(item.statusTipo);

    return `
      <article class="attention-card ${severe ? "problem" : ""}" data-id="${escapeAttr(item.id)}">
        <div class="attention-card-top">
          <div style="min-width:0">
            <h3 title="${escapeAttr(item.aula)}">${escapeHtml(item.aula)}</h3>
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
            <span>Cobertura</span>
            <strong>${formatPercent(item.cobertura)}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");

  els.attentionList.querySelectorAll(".attention-card").forEach(card => {
    card.addEventListener("click", () => {
      const item = state.rawData.find(x => String(x.id) === String(card.dataset.id));
      if (item) openDrawer(item);
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
  const pageRows = rows.slice(start, start + state.pageSize);

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
        <td class="numeric">${formatMinutes(item.minutosGravados)}</td>
        <td class="numeric"><strong>${formatPercent(item.cobertura)}</strong></td>
        <td>${statusPill(item)}</td>
        <td class="table-action no-print">
          <button class="row-button" data-id="${escapeAttr(item.id)}" aria-label="Ver detalhes">›</button>
        </td>
      </tr>
    `).join("");
  }

  els.tableBody.querySelectorAll(".row-button").forEach(button => {
    button.addEventListener("click", () => {
      const item = state.rawData.find(x => String(x.id) === String(button.dataset.id));
      if (item) openDrawer(item);
    });
  });

  const shownFrom = total ? start + 1 : 0;
  const shownTo = Math.min(start + state.pageSize, total);

  els.tableInfo.textContent = `${formatNumber(shownFrom)}–${formatNumber(shownTo)} de ${formatNumber(total)} registros`;
  els.pageIndicator.textContent = `${state.page} / ${totalPages}`;
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= totalPages;
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
  setText(els.drawerCoverage, formatPercent(item.cobertura));
  setText(els.drawerMeetCode, item.codigoMeet || "—");

  const width = Math.max(0, Math.min(100, item.cobertura));
  els.drawerCoverageBar.style.width = `${width}%`;
  els.drawerCoverageBar.style.background = coverageGradient(item.cobertura);

  els.detailsDrawer.classList.add("open");
  els.drawerBackdrop.classList.add("open");
  els.detailsDrawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.detailsDrawer.classList.remove("open");
  els.drawerBackdrop.classList.remove("open");
  els.detailsDrawer.setAttribute("aria-hidden", "true");
}

function setView(view) {
  state.view = view;

  const executive = view === "executive";
  document.body.classList.toggle("executive-mode", executive);

  els.executiveViewBtn?.classList.toggle("active", executive);
  els.operationalViewBtn?.classList.toggle("active", !executive);

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
  const text = state.apiUpdatedAt || "Atualizado agora";
  els.apiUpdatedAt.textContent = text;
  els.footerUpdatedAt.textContent = `Atualização da API: ${text}`;
}

function renderApiError(error) {
  state.rawData = [];
  state.filteredData = [];

  renderAll();

  els.attentionList.innerHTML = `
    <div class="empty-state">
      <span style="color:#dc2626;background:#fef2f2">!</span>
      <strong>Não foi possível carregar a API</strong>
      <p>${escapeHtml(error.message)}</p>
    </div>
  `;
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
  if (value >= 90) return `rgba(34, 197, 94, ${alpha})`;
  if (value >= 75) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}

function coverageGradient(value) {
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
      av = toDate(av)?.getTime() || 0;
      bv = toDate(bv)?.getTime() || 0;
    }

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
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
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
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(safeNumber(value));
}

function formatDecimal(value, decimals = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(safeNumber(value));
}

function formatPercent(value) {
  return `${formatDecimal(value, 1)}%`;
}

function formatMinutes(value) {
  const n = safeNumber(value);
  return `${formatNumber(n)} min`;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sum(items, getter) {
  return items.reduce((acc, item) => acc + safeNumber(getter(item)), 0);
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
