# Worker — proposta local para revisão

`worker.mjs` foi criado a partir do Worker enviado no chat **Pedir auditoria completa do sistema**. A referência literal, com a formatação recebida, está em `../audit/worker-fornecido.txt`. A formatação Markdown escapada dessa referência não deve ser executada.

O módulo corrigido foi testado com mocks. Não foi publicado nem comparado com o script efetivamente implantado na Cloudflare.

## Alterações

- Timeout inclui fetch e leitura do corpo. Limite de 10 MiB mesmo sem Content-Length.
- Somente GET e OPTIONS nas rotas `/`, `/api` e `/api/`.
- Origem fixa HTTPS Google Apps Script; configuração inválida retorna JSON controlado.
- JSON e estrutura `ok:true`, `dados:[]` validados antes de armazenar no cache.
- Erros HTTP, HTML/login, `ok:false` e falhas não são cacheados. Detalhes internos não são enviados ao cliente.
- Chave ordenada e estável para filtros. `t` e `refresh` não são encaminhados; ambos podem ignorar o cache. Atualização válida substitui a mesma entrada.
- TTL de 30 s exclusivamente no Cache API; navegador recebe `no-store`.
- CORS usa origens permitidas e `Vary: Origin`; respostas do cache recebem CORS da requisição atual.
- Falhas de leitura/escrita do cache não invalidam uma resposta válida da origem.
- Requisições com Cookie/Authorization não usam o cache compartilhado. Esses cabeçalhos não são encaminhados ao Apps Script, como no Worker fornecido.
- `ping=1` aceita o schema de teste de vida da API recebida e consulta a origem sem cache; não exige `dados` nessa resposta.

## Configuração a revisar antes de qualquer deploy

| Variável | Default local | Revisão necessária |
|---|---|---|
| `APPS_SCRIPT_URL` | Mesmo deployment informado pelo usuário | Confirmar que é a origem correta e sua política de acesso |
| `ALLOWED_ORIGINS` | `https://relatorio.consultaedu.com.br` | Acrescentar apenas origens realmente necessárias, separadas por vírgula |
| `UPSTREAM_TIMEOUT_MS` | `20000` | Validar latência real da origem |

Os nomes/valores dos filtros são preservados para compatibilidade com o proxy fornecido. A API recebida posteriormente aceita `semana`, `instituicao`, `conta`, `turma`, `disciplina`, `status` e `ping`. Parâmetros duplicados e consultas excessivas são rejeitados (20 nomes, 4096 caracteres). Rever os limites com dados/volume reais antes de publicar.

**CORS não é autenticação.** Requisições sem Origin continuam aceitas como no proxy original. Se estes relatórios precisarem de acesso restrito, é necessário definir autenticação e aplicar proteção também ao Worker, ao deployment Apps Script e à planilha de origem. Esconder a visão Operacional ou um campo no frontend não protege o payload. Nada disso foi alterado em produção.

O dashboard filtra a lista completa no navegador. Os parâmetros acima foram confirmados no código da API recebida e o contrato API corrigida → Worker → cálculo do frontend foi testado com planilha/serviços sintéticos. Não foi comprovado que a implantação atualmente apontada pelo Worker corresponde a esse anexo. Atualizar/bypassar cache não importa as planilhas das contas nem muda o agendamento semanal.

## Testar localmente

Na raiz, execute `node --test tests/worker.test.mjs`. A suíte simula Request/Response, fetch, caches.default e ctx.waitUntil sem consultar a origem real. O comportamento de borda Cloudflare, sua rota, Cache API implantada e autenticação continuam pendentes de uma homologação autorizada.

Referências técnicas usadas na revisão: [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) e [MDN Access-Control-Allow-Origin / Vary](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin).
