window.DASHBOARD_CONFIG = Object.freeze({
  apiUrl: "/api/",
  requestTimeoutMs: 25000,
  // Uma conta usa apenas uma gravação recortada por bloco, sem unir reinícios.
  // Pendente: confirmar a consolidação da API e as regras das demais contas.
  // Não ativar com base apenas em nomes de campos ou nos dados de demonstração.
  recordingContract: null
});
