# API da planilha geral — versão local

[api-dashboard.gs](api-dashboard.gs) é a versão revisada do endpoint recebido em 01/10/2026. Não foi instalada nem publicada. Apenas lê `BASE_DASHBOARD`; não importa dados das contas, não altera células, não exclui linhas, não cria gatilhos nem envia mensagens.

## Fluxo confirmado

```text
Relatórios individuais → importação/consolidação semanal → BASE_DASHBOARD
→ API doGet → Worker → dashboard
```

A rotina de importação e eventuais fórmulas da base não foram fornecidas. A API recebida só lê estas colunas:

| Coluna da base | Campo enviado |
|---|---|
| MINUTOS_GRAVADOS | minutosGravados |
| DURACAO_PREVISTA_MIN | duracaoPrevista |
| COBERTURA | cobertura |
| CHAVE_SESSAO_GLOBAL / CHAVE_GLOBAL | chaveSessao |

Assim, foi confirmado o mapeamento na API, mas não como a consolidação gera essas colunas e as chaves globais. A conta individual analisada descarta reinícios no cálculo do relatório; nem o Worker nem a API conseguem recuperá-los de uma linha com um único intervalo exportado.

## Alterações

- Vazio/inválido vira `null`; 0 explícito é preservado; números com vírgula decimal são aceitos. Valores negativos de contagem/duração ficam indisponíveis; atraso negativo pode representar início adiantado.
- Cabeçalhos obrigatórios/duplicados são verificados. Dados de uma mesma sessão divergentes não dependem da ordem das linhas e são sinalizados antes dos filtros.
- `resumo.tempoGravado` inclui minutos informados, previstos, percentual ponderado e tamanho da base comparável; incompletos saem dos dois totais. Não há limite artificial de 100% nem promessa de cobertura integral.
- `resumo.coberturaMedia` continua sendo o campo legado de média simples, preservado por compatibilidade. Não usar esse campo para o novo indicador. O frontend corrigido calcula a relação das somas de `dados`, e os testes conferem sua coerência com `resumo.tempoGravado`.
- Participantes/pico/atraso ausentes não são confirmados como zero/no prazo. Resumo expõe as bases parciais.
- `consultadoEm` identifica a consulta. `atualizadoEm` é `null` enquanto não houver evidência da última consolidação bem-sucedida. O endpoint anterior usava `new Date()` como atualização da base, o que era enganoso para importação semanal. Não preencher com a hora de `doGet` nem do Worker.
- Mensagem de erro pública é controlada; diagnóstico vai ao log do Apps Script. Status desconhecido não vira OK apenas por conter a substring `OK`.
- Mantidos os filtros `semana`, `instituicao`, `conta`, `turma`, `disciplina`, `status` e o endpoint de vida `ping=1`. Opções são geradas da base completa, como antes. O Worker local agora suporta a resposta de ping sem cache.

## Revisão antes da publicação

1. Comparar o código efetivamente instalado com o anexo; esta versão substitui somente o arquivo da API. Confirmar se outras funções da planilha chamam os helpers de mesmo nome ou dependem de zero em vez de `null`. Essa rotina de consolidação não foi recebida.
2. Conferir cabeçalhos e datas em `BASE_DASHBOARD`, usando uma cópia de homologação. Datas continuam exigindo valores Date da planilha; não é inventado um parser para formatos de texto desconhecidos.
3. Validar API, Worker revisado e frontend juntos: incompletos, 0 explícito, sessões simultâneas, filtros combinados, duração variável e excedente. O código recebido não mostra as permissões de implantação; manter a política de acesso existente até revisá-la.
4. Depois de autorização, atualizar a implantação existente do Web App para a nova versão. Se criar outra implantação com URL diferente, ajustar `APPS_SCRIPT_URL` no Worker. Não foi realizada nenhuma dessas ações aqui.
5. Para mostrar a data real da base, conectar `atualizadoEm` ao registro de sucesso da importação semanal, quando o código de consolidação estiver disponível. Preservar diferença entre data de consulta, data de execução da aula e data de importação.

Não alterar o agendamento semanal para tornar a tela "mais atual" sem uma decisão sobre frequência/custo. O botão Atualizar apenas consulta o estado presente da base e ignora o cache curto do Worker; não executa a importação.

## Testes e preview

Na raiz: `node --test tests/*.test.cjs tests/*.test.mjs`. As funções Apps Script usam mocks de leitura de células sintéticas; não acessam Google. Os testes conferem também o contrato API → Worker → cálculo do frontend. Não comprovam autorização, latência ou comportamento do ambiente real do Apps Script.

Para testar no navegador, iniciar `node tools/preview.cjs` e abrir `/scenario/api/index.html`. Essa rota executa a API revisada em um ambiente simulado com células sintéticas, sem Google. O preview iniciado nesta etapa está em http://127.0.0.1:4189/scenario/api/index.html.
