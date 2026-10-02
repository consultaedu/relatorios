# Auditoria — ConsultaEDU · Monitor Meet Dashboard

Data: 01/10/2026, America/Sao_Paulo. Base local: commit `80ff8d8`, branch original `main`. Correções na branch `codex/auditoria-monitor-meet`. A árvore estava limpa no início; não havia alterações preexistentes a preservar. Não houve publicação, push, exclusão de dados, alteração de configuração de produção ou execução de Apps Script.

**Resultado:** problemas reproduzíveis do frontend, Worker e API da planilha geral recebida foram corrigidos localmente. O indicador apresenta horas/minutos e a relação entre somas dos tempos informados pela API, com deduplicação, filtros, base parcial e ressalva do significado. Após os anexos da conta e da API, são 54 testes aprovados: 44 regressões e 10 caracterizações da origem. Fluxos principais foram testados no navegador com dados sintéticos. As revisões parciais estão nos adendos da [conta](APPS-SCRIPT-CONTA-2026-10-01.md) e da [API geral](API-GERAL-2026-10-01.md); a consolidação semanal, todas as contas e a implantação real não foram declaradas auditadas.

## Fontes e limites

- Código do projeto aberto: HTML, CSS, JavaScript, assets, README e histórico Git local.
- Worker recuperado da mensagem do usuário no chat **Pedir auditoria completa do sistema**. A referência literal está em [worker-fornecido.txt](worker-fornecido.txt). O módulo revisado está em [worker.mjs](../worker/worker.mjs). O Worker não calcula minutos, duração ou cobertura: apenas encaminha consultas.
- Histórico de **Auditar repositório DROPTECH** acessível. Usado como referência de profundidade: evidência, prioridade, validação local e limites de acesso. Nenhuma conclusão daquele projeto foi transferida para este.
- O chat **RALATÓRIO MEET TELEGRAM** cita anexos de Apps Script, mas seus conteúdos não estavam disponíveis no histórico acessível. A busca no projeto e nos diretórios ConsultaEDU não localizou os scripts deste monitor. Um `Codigo.gs` de outro módulo não foi tratado como código desta API.
- Inicialmente o usuário informou que os dados vêm de vários Apps Scripts e não conseguia fornecer o trecho de cálculo. Posteriormente enviou monitor e relatório de uma conta. A revisão desses anexos confirmou seleção de uma única gravação, corte ao horário e arredondamento nessa conta, com limitações de associação; a consolidação dos três campos da API continua ausente. Veja o adendo para a evidência recebida depois da auditoria inicial.
- Em seguida foi recebida a API `doGet` da planilha geral. Foi confirmado o mapeamento das colunas `MINUTOS_GRAVADOS`, `DURACAO_PREVISTA_MIN`, `COBERTURA` e os seis filtros. A API lê a base, mas não contém sua importação ou as fórmulas dessas colunas. O usuário informou periodicidade semanal. Foram implementadas correções locais de desconhecidos, resumo ponderado, conflitos, timestamps, schema/erros e compatibilidade de ping no Worker; detalhes no adendo da API geral.
- A ferramenta web não conseguiu abrir o endereço publicado. A revisão automática do navegador rejeitou a navegação por possível acesso a `accounts.google.com` e à sessão privada do Google. Não houve tentativa de contornar esse bloqueio. Não está comprovado, por esse resultado, qual autenticação ou roteamento está implantado.

## Estrutura e fluxo real

O frontend estático carrega `/api/`, espera `{ok:true,dados:[...],atualizadoEm:...}` e recebe uma linha por vínculo acadêmico. Todos os filtros do dashboard são aplicados no navegador; não são enviados como filtros ao Worker. A requisição inicial usa a URL configurada; Atualizar acrescenta `refresh=1`.

`dashboard-core.js` valida a estrutura, preserva números ausentes como `null`, prepara chaves de linha/sessão, sinaliza divergências e fornece regras testáveis. `script.js` controla seleção, gráficos, tabela, detalhes e os estados de erro. Indicadores/gráficos/ocorrências contam sessões; a tabela mantém as disciplinas separadas. Pesquisa, ordenação e paginação só afetam a tabela, como agora explicado na interface.

O Worker revisado encaminha parâmetros à origem fixa, normaliza a chave de cache e valida respostas antes do cache de 30 s. `t` legado e `refresh` são comandos locais de bypass. O navegador recebe `no-store`. Esses ajustes permanecem uma proposta local, sem comprovação da versão implantada.

## Problemas com evidência, impacto e prioridade

P1 = resultado gerencial incorreto, falha de disponibilidade ou relatório incompleto. P2 = problema de uso, manutenção, clareza ou integração. A evidência “antes” refere-se ao commit base ou ao Worker fornecido, não a observação da produção.

| ID / prioridade | Evidência antes | Impacto | Correção local / resultado |
|---|---|---|---|
| A01 · P1 | `normalizeItem` chamava `safeNumber`, que devolvia zero para ausente/inválido; `Number(null)` também resultava em zero | Ausência parecia gravação de 0 min, presença 0 e atraso 0; distorcia médias e prazo | Normalização com `null`, zero explícito preservado, médias com base informada, `—` para desconhecidos |
| A02 · P1 | `applyFilters` calculava `filteredData` antes de `refreshDependentFilters` remover seleções inválidas | Cards/tabela podiam mostrar uma seleção diferente daquela visível nos selects | Reconciliar dependências antes de calcular; troca de semana Alfa → Beta comprovada no navegador |
| A03 · P1 | `populateInitialFilters` reconstruía os selects, perdendo valores; qualquer semana vazia reabria a mais recente | Atualização desfazia filtros e a seleção de todas as semanas | Seleção inicial aplicada uma única vez; refresh preserva filtros válidos e “Todas as semanas” |
| A04 · P1 | `renderWeeklyChart` usava `state.rawData`, enquanto os outros gráficos usavam a seleção | Evolução semanal podia contradizer cards e filtro de instituição/disciplina | Usa `filteredData` e deduplicação; semanas e valores acompanham seis filtros |
| A05 · P1 | `loadData` não tinha timeout; `dados` não-array era convertido em lista vazia; `renderApiError` apagava os dados e renderizava zeros | Carregamento indefinido, erro tratado como seleção vazia ou perda do relatório anterior | Timeout cobre corpo, schema validado, falha inicial exibe indisponibilidade; falha de refresh mantém dados com aviso persistente |
| A06 · P1 | `renderKpis` usava atraso `<=10`, inclusive quando atraso ausente tinha virado 0 | Gravação sem evidência de início podia ser contada como no prazo | SIM + atraso conhecido é necessário; sem informação fica explícito. Percentual semanal fica como lacuna quando sua base está incompleta |
| A07 · P1 | Impressão reaproveitava `pageRows`; CSS `body.executive-mode .operational-section` tinha maior especificidade que a regra de impressão | PDF com apenas a página atual ou sem tabela na visão Executiva | `beforeprint` prepara todas as linhas filtradas/pesquisadas; `afterprint` restaura página; CSS revela tabela na visão Executiva |
| A08 · P1 | `deduplicarPorSessao` escolhia silenciosamente a primeira linha de cada chave | Dados divergentes da mesma sessão geravam resultado dependente da ordem da API | Conflitos deixam campos divergentes indisponíveis e status divergente como OUTRO; aviso de integridade. Linhas sem identificador permanecem separadas |
| A09 · P2 | “Cobertura média” era média simples de `cobertura`, com mesmo peso para aulas de durações diferentes | Não respondia quanto tempo foi gravado em relação ao total | Relação das somas dos minutos informados / previstos. Para 30/60 e 120/120 min, mostra 150/180 = 83,3%, em vez de 75%; sessão simultânea conta uma vez |
| A10 · P2 | Gráfico fixava máximo 100%; tabela/detalhes usavam `cobertura` como se fosse duração comprovada | Excesso era ocultado e conceitos podiam divergir sem explicação | Relação por aula consistente e sem teto; exemplo 90/60 = 150%. Campo original mantido separadamente como “Cobertura informada pela API” |
| A11 · P2 | Detalhes buscavam `rawData.find` por `id` acadêmico | ID ausente ou repetido podia abrir a primeira aula, em vez da linha acionada | Chave interna exclusiva de linha em cards/botões; não conflita com a deduplicação por sessão |
| A12 · P2 | CDN de Chart.js carregava antes da página, sem fallback; exceção `Chart is not defined` interromperia renderização | Falha externa podia bloquear ocorrências e tabela | Mesma versão 4.4.7 servida localmente, com licença/hash, scripts deferidos e degradação explícita se a biblioteca faltar |
| A13 · P2 | Ordenação numérica tratava ausentes como zero; cabeçalhos e cards só respondiam ao mouse | Ordem enganosa e acesso incompleto por teclado | Ausentes no fim nas duas direções, Enter/Espaço, `aria-sort`, nomes de pesquisa/paginação e gráficos acessíveis |
| A14 · P2 | Drawer não tinha semântica de diálogo nem controle de foco; sidebar móvel fora da tela continuava focável | Navegação por teclado podia atingir conteúdo oculto ou perder o contexto | Dialog, foco inicial/restauração, Escape, fundo/controles ocultos inertes, menu com `aria-expanded`, movimento reduzido |
| A15 · P2 | Navegação Detalhamento não ativava Operacional; ocorrências limitadas a 9 sem explicação do limite | Link parecia não funcionar e contagem podia parecer incoerente | Navegação ativa a visão correta; “9 de N” indicado, com orientação para a tabela |
| A16 · P2 | Formatadores de data usavam o fuso do navegador | Horários com offset válido podiam aparecer diferentes entre usuários | Exibição explícita em America/Sao_Paulo; formatos sem offset permanecem pendência do contrato |
| A17 · P2 | README citava workers.dev e dizia que todos os gráficos respondiam à disciplina, divergindo de `/api/` e do gráfico semanal | Execução/revisão mal orientadas | README atualizado com rota real do código, fixtures, testes e limite da integração implantada |
| W01 · P1 | Worker cacheava qualquer HTTP OK como JSON, sem validar corpo ou `ok` | HTML/login ou erro de negócio com HTTP 200 podia ser armazenado e servido como JSON | Validação de JSON/shape antes do cache; erros 502/504 controlados, não cacheados |
| W02 · P1 | Frontend gerava `t=Date.now()` e Worker o encaminhava e incluía na chave | Cache de 30 s era fragmentado a cada consulta | Inicial sem parâmetro aleatório; bypass explícito remove `t`/`refresh` da origem e atualiza chave estável |
| W03 · P2 | Worker não tinha timeout/limite de corpo, refletia toda Origin sem `Vary` e retornava `erro.message` | Espera indefinida, recursos excessivos, CORS inconsistente e detalhes internos expostos | Timeout do fetch/corpo, limite 10 MiB, origens permitidas + Vary, mensagens controladas e métodos/rotas validados |
| W04 · P2 | Falhas de cache podiam interromper a consulta; 405 sem Allow; parâmetros duplicados sobrescritos silenciosamente | Falhas evitáveis e ambiguidade no proxy | Cache com fallback, Allow explícito, limites de parâmetros e rejeição de duplicados |

Também foi corrigido o agrupamento semanal em objeto sem protótipo: um nome de semana como `__proto__` não pode quebrar o gráfico. Somas não finitas ficam indisponíveis. A dependência remota de fonte foi retirada, mantendo fonte de sistema e identidade verde.

## Significado do indicador e decisão conservadora

Na auditoria inicial só foi possível confirmar **como o frontend consumia os campos**. Os anexos posteriores confirmam o cálculo de `MINUTOS GRAVADOS NO BLOCO` em uma conta e o mapeamento dos campos da API a partir de `BASE_DASHBOARD`. Falta a importação/fórmulas que ligam esses dois estágios. O Worker não calcula tempos. Esses campos continuam tratados como valores informados pela origem, sem inferir a fórmula de `COBERTURA` ou `DURACAO_PREVISTA_MIN` na base. A ressalva visível e os detalhes avisam que reinícios podem estar fora do total; consulta e consolidação agora têm datas distintas.

A apresentação corrigida é útil como **relação de durações informadas**. O título é Tempo gravado; o destaque é horas/minutos gravados de horas/minutos previstos; a linha complementar diz “em relação ao previsto”. A ressalva sobre horário/sobreposição fica visível, sem depender do tooltip. A relação não recebe o rótulo de cobertura efetiva. `recordingContract` continua `null`.

Se faltarem minutos ou duração positiva, a sessão sai **dos dois totais**, com base parcial e quantidade excluída explícitas. Uma sessão sem gravação só participa como zero quando a origem envia zero numérico; o frontend não cria zero a partir de vazio, status ou flag. Isso não comprova a qualidade do zero gerado na origem. Um tempo excedente é preservado, não cortado, mas nunca descrito como cobertura integral do horário. O campo `cobertura` permanece visível nos detalhes para evidenciar eventual diferença.

Para medir cobertura real será necessário, no futuro, confirmar que a origem une intervalos de gravação da sessão e os intersecta com início/fim previstos, sem somar sobreposições. Alternativamente, a API pode fornecer intervalos completos, com fusos e critérios de elegibilidade documentados. Um único início/fim global ou a soma de arquivos não permite reconstituir lacunas e sobreposições. Essa parte permanece não verificada.

## Validação realizada

| Verificação | Evidência / resultado |
|---|---|
| Testes automatizados | `node --test tests/*.test.cjs tests/*.test.mjs`: 28 passaram, 0 falhas. Node 24.19.0. Inclui 10 regras do core, 7 regressões do controlador e 11 testes do Worker |
| Sintaxe e integridade | `node --check`, `git diff --check`, sem erros; nenhum ID DOM duplicado ou asset local ausente |
| Filtros combinados | Semana + Alfa + Conta A + Turma 1 + Física + OK → 1 sessão, 30 min / 60 min, 50%; refresh mantém seleção |
| Dependências | Troca para semana Beta limpa instituição/disciplina inválidas e já exibe a sessão correta, sem segundo clique |
| Todas as semanas | Limpar + atualizar mantém semana vazia; 29 sessões / 30 vínculos; gráfico mostra duas semanas |
| Pesquisa/paginação/ordenação | 20 linhas, depois 10; História → 1 vínculo sem alterar card de 29 sessões; busca inexistente → estado vazio; ordenação de Gravado por Enter funciona |
| Detalhes | História mantém 120 min e 100% de relação; excedente mantém 90 min e 150%, com `cobertura` original 100% explicitamente separado; Escape/Enter fecham e devolvem foco |
| Dados incompletos / zero | Incompletos → média/pico/tempo `—`, prazo `0/1` com aviso de desconhecido; Sem gravação com 0 explícito → 0 min / 60 min |
| HTML não confiável | Título sintético `<img ... onerror=...>` aparece como texto; nenhum elemento img inserido na tabela e nenhum alerta executado |
| Falha de API no navegador | HTTP 503, shape inválido, HTML e timeout encerram loader; indicadores indisponíveis. Lista vazia mostra 0 aulas e aviso de lista vazia. Refresh 503 mantém Física e seus valores, com aviso persistente |
| Console | Sem erros/avisos de aplicação nos fluxos normais observados; falhas simuladas tratadas na interface |
| Celular | Viewports 390×844 e 320×700. Sem overflow horizontal do documento; tabela tem rolagem interna. Menu abre/fecha e Detalhamento ativa Operacional |
| Impressão | Regressão confirma 30 linhas ao imprimir todas as semanas, restaura página 2 com 10 linhas depois. Simulação visual no navegador mostra 29 linhas da semana na visão Executiva. Tabela cabe na largura da simulação |
| Desempenho sintético | Preparar/deduplicar/agregar 10.000 linhas → 5.000 sessões, 150.000/300.000 min, aproximadamente 43,9 ms em Node. Não mede renderização, rede, Google ou Cloudflare |
| Padrões de credenciais | Busca por chaves privadas, tokens GitHub e access keys AWS nos arquivos de código: nenhum padrão encontrado. Não é uma prova abrangente de ausência de segredos |

A validação revelou e corrigiu dois problemas introduzidos durante o trabalho: uma referência incorreta no resumo de impressão, detectada pelo teste de regressão; e a necessidade de identificar cenários pela rota, pois a política no-referrer remove o Referer. Os testes afetados foram repetidos e passaram.

## Segurança e pendências reais

1. **P1 condicional — política de acesso aos relatórios.** O Worker fornecido não autentica; refletia Origin. A versão local restringe CORS, mas requisições sem Origin continuam possíveis. CORS e filtros de interface não substituem autenticação. Não foi comprovado se a produção já aplica Cloudflare Access ou outro mecanismo. Definir quem pode acessar e verificar proteção do Worker, Apps Script e planilhas antes de publicar. Não houve alteração de permissões.
2. **P1 — contrato de gravação na origem.** Uma conta usa gravação única recortada/arredondada, com reinícios descartados e associação divergente entre monitor/relatório (adendo S01/S02). Falta confirmar a consolidação da API e as demais contas. Não foi calculada cobertura real nem auditado o servidor completo. A união de intervalos não pode ser afirmada com os códigos recebidos.
3. **P2 — homologação de integração.** Nomes dos parâmetros e schema de `doGet` foram confirmados no anexo da API, e sua compatibilidade foi testada com mocks. Falta confirmar `/api/`, Worker/versão de Web App implantados, IDs globais produzidos pela consolidação, CORS necessário e latência real. Não foi comprovada a integração em produção.
4. **P2 — PDF nativo.** O botão foi acionado, mas o diálogo bloqueou comandos do navegador integrado. A aba de teste foi fechada para continuar. Preparação/retorno da tabela e CSS foram validados; salvamento de PDF, paginação física A4 e impressão em papel permanecem não verificados. Nenhum mecanismo alternativo de controle de navegador foi usado.
5. **P2 — navegadores e acessibilidade assistiva.** Testes feitos no navegador integrado; faltam Safari/Firefox, aparelho físico, leitor de tela real e auditoria automatizada completa de contraste. Melhorias de semântica/foco foram verificadas em DOM e navegação por teclado.
6. **P2 — tempo/dados reais.** Sem acesso à API publicada, não foi medida sua latência, volume, disponibilidade histórica ou custo; nem reconciliação com planilhas/arquivos reais. Timestamps sem timezone ou formatos locais não confirmados podem exigir ajuste do parser após contrato.
7. **P3 — assets/manutenção.** Logo 512 px permanece preservado, embora não referenciado no HTML atual. Nenhuma limpeza de arquivos preexistentes foi necessária. Atualizações futuras da biblioteca exigem revisão/teste; o hash e a licença estão registrados.

A consulta aos [advisories oficiais do Chart.js](https://github.com/chartjs/Chart.js/security/advisories) não apresentou advisories publicados na página consultada; isso não certifica a biblioteca como livre de vulnerabilidades. A versão preexistente foi mantida para limitar mudanças de compatibilidade. Cache/CORS foram revisados com [documentação Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/cache/) e [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin).

## Executar e revisar

O [README](../README.md) contém comandos e rotas de teste. Na raiz:

```powershell
node --test tests/*.test.cjs tests/*.test.mjs
$env:PORT = '4188'
node tools/preview.cjs
```

Abra http://127.0.0.1:4188/. Se o preview da auditoria ainda estiver ativo nessa porta, basta abrir o endereço. Para imprimir, use Chrome/Edge e confira A4 paisagem, filtros, indicação de base parcial e todas as linhas pesquisadas. A rota `/scenario/print/index.html` serve somente para inspeção visual.

Revise `git status --short`, o diff dos arquivos originais e os novos arquivos `dashboard-core.js`, `config.js`, `worker/`, `tests/`, `tools/` e `audit/`. As mudanças locais estão na branch solicitada e ainda não foram publicadas. Não enviar a produção sem autorização e sem revisar as pendências de origem/autenticação/integração.

Evidências visuais, com dados sintéticos:

- [Desktop](C:/Users/FSoci/.codex/visualizations/2026/10/01/01a0f9b9-3201-7143-bde3-00aff7c856b8/consultaedu-desktop.jpg)
- [Celular](C:/Users/FSoci/.codex/visualizations/2026/10/01/01a0f9b9-3201-7143-bde3-00aff7c856b8/consultaedu-mobile.jpg)
- [Simulação de impressão](C:/Users/FSoci/.codex/visualizations/2026/10/01/01a0f9b9-3201-7143-bde3-00aff7c856b8/consultaedu-print-simulation.jpg)
