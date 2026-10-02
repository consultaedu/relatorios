# ConsultaEDU · Monitor Meet Dashboard

Dashboard estático de relatórios de aulas. Identidade verde e visões Executiva/Operacional preservadas.

## Executar a versão corrigida

Requer Node.js 20 ou superior. Não precisa instalar pacotes.

```powershell
git switch codex/auditoria-monitor-meet
node tools/preview.cjs
```

Abra http://127.0.0.1:4173/. Se a porta estiver ocupada:

```powershell
$env:PORT = '4188'
node tools/preview.cjs
```

O preview serve **somente dados sintéticos**, vinculado a `127.0.0.1`. Não consulta Google, Cloudflare nem aulas reais. Ctrl+C encerra o servidor. O preview da etapa inicial está em http://127.0.0.1:4188/; a etapa com API simulada está em http://127.0.0.1:4189/scenario/api/index.html.

## Testar

```powershell
node --test tests/*.test.cjs tests/*.test.mjs
```

Também estão disponíveis `npm start` e `npm test`. Os 54 testes incluem 44 regressões do frontend/Worker/API corrigida e 10 caracterizações de comportamentos dos anexos originais. A caracterização reproduz limitações da origem; não significa que esses scripts foram corrigidos na conta. Nenhum teste acessa produção ou serviços Google.

Rotas de teste do preview (substitua a porta se necessário):

| Rota | Cenário |
|---|---|
| `/` | Aulas de durações diferentes, simultâneas, dados incompletos, zero e excesso |
| `/scenario/api/index.html` | API revisada executada com células e serviços sintéticos; consulta separada da consolidação |
| `/scenario/error/index.html` | HTTP 503 inicial |
| `/scenario/invalid/index.html` | `dados` com formato incorreto |
| `/scenario/html/index.html` | HTML em vez de JSON |
| `/scenario/timeout/index.html` | Resposta lenta; limite de 100 ms só neste teste |
| `/scenario/empty/index.html` | Lista vazia válida |
| `/scenario/stale/index.html` | Primeiro carregamento válido; atualização retorna 503 |
| `/scenario/print/index.html` | Simulação visual do CSS de impressão e tabela inteira |

A simulação de impressão não exporta PDF e não comprova paginação física A4. A exportação final deve ser conferida em Chrome/Edge, com PDF / Imprimir, A4 paisagem.

## Indicadores e filtros

- Semana, instituição, conta, turma, disciplina e status afetam os indicadores, os quatro gráficos, as ocorrências e a tabela.
- Opções dependentes são reconciliadas antes do cálculo: semana → instituição → conta → turma → disciplina. Status permite combinações sem resultados.
- A abertura inicial usa a semana mais recente. Atualizar preserva a seleção, inclusive “Todas as semanas”. Limpar filtros também limpa a pesquisa.
- Pesquisa, ordenação e paginação afetam somente a tabela. A tabela apresenta vínculos acadêmicos; cards, gráficos e ocorrências contam sessões únicas.
- Deduplicação usa `chaveSessao`, depois `idSessao`, depois `id`; sem identificador mantém cada linha separada. IDs devem ser globalmente estáveis. Divergências numéricas/status de uma sessão ficam indisponíveis e recebem aviso.
- A média de participantes usa apenas sessões com valor informado. Zero explícito é válido. Atraso ausente não comprova gravação no prazo.

**Tempo gravado** exibe a soma de `minutosGravados` de sessões comparáveis e a soma de `duracaoPrevista` dessas mesmas sessões. O percentual é a relação entre as somas, sem limitar a 100%. Não usa média de porcentagens nem deriva minutos de `cobertura`.

Se faltar um dos tempos ou a duração prevista não for positiva, o par inteiro é excluído dos totais e a base parcial é indicada. A relação por aula aparece no gráfico, na tabela e nos detalhes. `cobertura` original continua nos detalhes como **valor informado pela API**.

**Limite do significado:** foram analisados o monitor e o relatório de uma conta enviados posteriormente. Esse relatório escolhe **uma única gravação** por bloco, recorta seu intervalo ao início/fim previstos e a `agora`, e arredonda os minutos. Não une gravações sobrepostas nem soma reinícios. Suas janelas podem rejeitar uma gravação que cruza o bloco; zero também pode vir de arredondamento ou de ausência de associação. Portanto, 0 não prova inexistência de arquivos e 60/60 não prova cobertura integral.

Foi recebida posteriormente a API `doGet` da planilha geral. Ela lê `MINUTOS_GRAVADOS`, `DURACAO_PREVISTA_MIN` e `COBERTURA` de `BASE_DASHBOARD`; o mapeamento para os três campos da API está confirmado. Falta a função de importação ou as fórmulas que geram essas colunas e ligam o relatório individual à base. As demais contas e os auxiliares de acesso ao Google também não foram verificados. O frontend não consegue recuperar trechos descartados pela origem. A interface avisa que reinícios podem estar fora do total e mantém `recordingContract: null`. Veja a [análise das contas](audit/APPS-SCRIPT-CONTA-2026-10-01.md) e o [adendo da API geral](audit/API-GERAL-2026-10-01.md).

O usuário informou consolidação semanal. Atualizar no dashboard consulta a base presente, sem executar a importação. A API revisada separa `consultadoEm` de `atualizadoEm`; este fica `null` enquanto não houver registro confiável do sucesso da importação. O frontend também distingue hora da consulta de data da consolidação, evitando apresentar o `new Date()` da API antiga como atualização da base.

Datas ISO com fuso explícito são exibidas em `America/Sao_Paulo`. Formatos e fusos de timestamps sem offset enviados pela origem ainda precisam de confirmação.

## Integração e arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps-script/api-dashboard.gs` | API da planilha geral revisada, somente leitura, ainda não instalada |
| `apps-script/README.md` | Compatibilidade, revisão e limites da API/consolidação semanal |
| `index.html`, `style.css` | Interface, acessibilidade, responsividade e impressão |
| `config.js` | URL da API, timeout e estado de confirmação do contrato |
| `dashboard-core.js` | Normalização, validação, sessões, filtros e cálculos testáveis |
| `script.js` | Integração, eventos, gráficos, tabela e detalhes |
| `assets/vendor/` | Chart.js 4.4.7 local, licença e hash |
| `worker/worker.mjs` | Proposta local corrigida do Worker fornecido |
| `tests/`, `tools/preview.cjs` | Regressão e servidor com cenários sintéticos |
| `audit/AUDITORIA-2026-10-01.md` | Evidências, prioridades, resultados e pendências |

A API de produção permanece `/api/`, exatamente como estava no código local. O README anterior citava `workers.dev`; isso não comprovava a rota implantada. Não troque o endpoint sem confirmar o roteamento/autenticação existentes. Não coloque credenciais em `config.js`.

Carregamento inicial não cria parâmetro aleatório de cache. Atualização manual envia `refresh=1`. O Worker corrigido trata esse parâmetro como bypass local e aceita `t` legado como bypass. Com o Worker antigo, o bypass de `refresh` ainda não está garantido; frontend e Worker corrigidos devem ser revisados juntos antes da publicação.

## Revisar e publicar

```powershell
git status --short
git diff --check
git diff -- index.html script.js style.css
```

Revise também os arquivos novos e `worker/README.md`. Valide os cenários acima, os tamanhos de tela 320/390 px, detalhes por teclado e exportação PDF. Não há workflow de deploy adicionado. Nenhuma publicação, push, configuração do Cloudflare ou Apps Script foi realizada nesta auditoria. A publicação depende de autorização do responsável e das pendências do relatório.
