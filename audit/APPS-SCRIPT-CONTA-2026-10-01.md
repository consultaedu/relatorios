# Adendo — Apps Scripts de uma conta

**Evidência posterior:** a API `doGet` da planilha geral também foi recebida. O mapeamento dos três campos e os parâmetros agora estão confirmados no código; falta a importação/fórmulas da base. O [adendo da API geral](API-GERAL-2026-10-01.md) atualiza as pendências descritas neste registro da primeira etapa. Total atual: 54 testes, sem publicação.

Recebidos em 01/10/2026 após a auditoria inicial. Revisão estática dos dois anexos e testes locais de três funções puras. Nenhum gatilho, chamada Google, envio ao Telegram, alteração de planilha ou rotina de exclusão foi executado. Os anexos originais permanecem intactos. A conta não foi identificada/mapeada para as linhas da API.

## Fontes e alcance

| Referência | Arquivo recebido | SHA-256 |
|---|---|---|
| Monitor | `7f74998a-a104-4529-8cec-6abd870d553a/Texto colado.txt` | `7c8f4b47ce4a4f565b998da881148cc3e6e0aa8730ca1ed2b316da0b571471fd` |
| Relatórios | `82e5fe64-7b43-4251-917d-f6c8b67a0c40/Texto colado.txt` | `b044362eea26cdf012a3b48c2a7df9203343a4e30220c08b124fd81424942acc` |

Arquivos sob `C:/Users/FSoci/.codex/attachments/`. As linhas abaixo são dos anexos originais. Os trechos literais usados nos testes estão em [apps-script-account1.js](../tests/fixtures/apps-script-account1.js), com hash e linhas de origem. Não contêm credenciais nem rotinas de serviços externos.

**Não recebidos:** `Codigo.gs V3` e auxiliares como `listarGravacoes_`, `listarConferencias_`, `listarEventosAgenda_` e `calcularSobreposicaoMs_`; consolidação das planilhas, `BASE_DASHBOARD`/`doGet`, fórmula dos campos da API, código das demais contas. Não foram confirmadas paginação, permissões, completude dos resultados Google nem implantação. Esta revisão parcial não é uma auditoria do servidor completo da API.

## Significado confirmado e limites

Em Relatórios, `rel_processarAula_` escolhe uma conferência e uma gravação. `rel_encontrarGravacaoDaAula_` (1858–2013) filtra pelo **início** da gravação e escolhe a candidata mais próxima do início previsto. `rel_calcularMinutosGravados_` (2020–2088) calcula:

```text
início = máximo(início da gravação escolhida, início previsto)
fim = mínimo(fim da gravação ou agora, fim previsto, agora)
minutos = 0 se ausente ou sem interseção; senão arredondar((fim − início)/60000)
```

O valor é salvo na coluna **MINUTOS GRAVADOS NO BLOCO** (2158). Tempo antes/depois do bloco não entra nessa função, e gravação aberta usa `agora`. Gravação única válida não excede o bloco em tempo contínuo, mas o arredondamento pode alcançar o minuto inteiro sem cobrir todos os segundos.

**Não há união de intervalos de gravações.** `rel_unirIntervalos_` existe no relatório para sessões de **participantes**; não é usada para agregar gravações. Não confundir essa função com a regra de gravação. O relatório também escolhe apenas uma conferência por bloco por meio de `selecionarConferenciaDaAula_` do monitor (1434–1500); reaberturas de conferência podem ficar fora da análise.

O monitor documenta em 820–827 que busca uma **nova gravação por aula** e que a gravação anterior não vale automaticamente. Portanto, existe uma regra operacional explícita, diferente de medir todo tempo efetivamente gravado dentro do horário. Ela foi preservada: corrigir a duração por união não autoriza mudar os alertas sobre início de uma nova gravação. O comentário de 855–858 diz que a finalização verifica todas as gravações do bloco para cobrir reinícios; isso é implementado para finalização, mas não para os minutos do relatório.

`minutosGravados`, `duracaoPrevista` e `cobertura` como campos da API não aparecem nesses anexos. Início/fim previstos existem, e o monitor divide a duração do evento entre os blocos, mas isso não comprova o cálculo de `duracaoPrevista` no consolidado. Não foi inferido que `cobertura` usa esse tempo, nem que seja limitada a 100%.

Zero significa que essa rotina produziu zero: pode ser nenhuma gravação associada, gravação sem interseção ou menos de 30 segundos arredondados. Não comprova inexistência de gravação no Meet. A linha de ausência de conferência também é gerada com zero. Da mesma forma, 60 minutos arredondados em um bloco de 60 não comprovam todos os segundos gravados.

## Problemas, impacto e estado

P1: pode alterar conclusões gerenciais, gerar alertas incorretos ou colocar dados em risco. P2: precisão e contrato de integração. Os casos sintéticos reproduzem o código fornecido; não são afirmações de ocorrência em produção.

| ID / prioridade | Evidência | Impacto | Estado / correção necessária |
|---|---|---|---|
| S01 · P1 | Relatórios 1975–2011 retorna uma candidata; 724–733 calcula apenas essa gravação | Trechos 19:00–19:20 e 19:25–20:00 resultam em **20 min**, embora existam 55 min distintos no bloco. Trechos sobrepostos 19:00–19:35 e 19:25–20:00 resultam em **35 min**, embora a união cubra 60 min | Aviso corrigido no dashboard e caso reproduzido. Para medir total efetivo na origem, usar todos os intervalos elegíveis, recortar e unir antes de converter em minutos; não somar durações de arquivos. Falta o acesso completo/consolidação para integrar a correção |
| S02 · P1 | Relatórios 1891–1953 usa meia duração para os limites entre blocos; Monitor 1512–1545 usa início−10 min até fim | Para primeiro bloco 19–20 de evento 19–21, início às 19:40 é reconhecido pelo monitor e rejeitado pelo relatório. Gravação contínua 19–21 é rejeitada no segundo bloco por ambas as janelas | Documentação do relatório explica a intenção de evitar associação a dois blocos; a implementação não mede todo tempo efetivamente gravado em cada horário. É preciso definir se status exige gravação iniciada em cada bloco, enquanto tempo deve refletir interseção de todos os trechos. Não alterar silenciosamente a regra de alertas |
| S03 · P1 | Monitor 755–771 e 794–809 converte falha de listagem em `[]`; 914–928 abre alerta sem gravação após tolerância | Falha de gravações pode provocar alerta indevido; falha de participantes produz contagem zero sem indicar indisponibilidade | Pendente na origem: preservar estado desconhecido, registrar falha e evitar alertas de ausência dependentes da consulta que falhou. Auxiliares de acesso não recebidos; nenhum envio executado |
| S04 · P1 condicional | Relatórios 302–329 remove linhas antigas antes de processar as aulas; 2317–2371 usa `deleteRow`; condição só verifica `eventos.length > 0` | Se a listagem estiver incompleta ou a expansão omitir evento, linhas válidas podem ser apagadas; falha posterior não desfaz exclusão anterior | Risco identificado, sem comprovar listagem parcial na implantação. Não executado nem alterado. Antes de usar, comprovar completude/paginação, preparar relatório com sucesso, revisar candidatos a exclusão e manter recuperação. Qualquer alteração destrutiva em produção requer decisão do responsável |
| S05 · P2 | Relatórios 2026–2031, 2072–2085 e seleção por início | 20 segundos viram 0; 59min40s viram 60; zero ou relação 100% não prova ausência/inteireza | Ressalva mantida no dashboard; testes cobrem os dois extremos. API deve documentar unidade, precisão, zero e estado desconhecido. Data inválida também produz NaN; frontend já a mantém indisponível |
| S06 · P2 condicional | Monitor 1434–1500 seleciona conferência de maior interseção; relatório usa essa seleção | Conferências reabertas no mesmo bloco podem não participar dos minutos e participantes | Revisar com exemplos reais e lista completa de conferências. Não há evidência de ocorrência nem acesso ao auxiliar de interseção |
| S07 · P2 condicional | Monitor 1207–1223 forma ID com evento, bloco e início, sem conta explícita | Cópias do mesmo evento entre contas podem compartilhar ID. Deduplicação global só é correta se representarem a mesma sessão física | Confirmar regra de identidade no consolidado antes de adicionar namespace de conta ou unir sessões. Nenhuma colisão real foi comprovada |

## Mudanças locais após os anexos

- Explicação do card identifica o método da conta analisada e o limite das demais origens.
- Aviso visível e detalhes informam que reinícios podem ficar fora do tempo recebido; relação de durações continua sem promessa de cobertura integral.
- Mantida soma de minutos / soma de duração das mesmas sessões comparáveis, respeitando filtros/deduplicação. Nenhum minuto perdido foi inventado, nenhum campo ausente virou zero e não foi ativado `recordingContract`.
- Criados nove testes de caracterização de funções literais dos anexos e uma regressão da ressalva no dashboard. Os nove passam **reproduzindo as limitações**, não comprovando correção do Apps Script. As 29 regressões do dashboard/Worker também passam; total 38.
- README e relatório principal atualizados para distinguir ausência inicial de código da evidência recebida posteriormente.

A ressalva revisada foi conferida no navegador local em 1280 px, com o texto dentro do card; em 320 px, o aviso permaneceu dentro do card e a página não teve rolagem horizontal. Em 390 px, os detalhes mantiveram 150% para o excedente e o aviso sobre reinícios; Escape fechou o painel. Nenhum erro/warning de console foi observado nessa validação. Dados exclusivamente sintéticos. [Captura desktop](C:/Users/FSoci/.codex/visualizations/2026/10/01/01a0f9b9-3201-7143-bde3-00aff7c856b8/consultaedu-indicadores-appscript.png).

## O que falta para concluir o indicador na origem

A informação necessária é o trecho de consolidação/`doGet` que monta `minutosGravados`, `duracaoPrevista`, `cobertura`, conta e chave de sessão — ou a especificação desse mapeamento. Não é necessário enviar todos os scripts para confirmar esse contrato inicial. Para corrigir total real na origem, também será necessária uma lista completa de intervalos de todas as gravações/conferências elegíveis, com estado da consulta e datas/fusos válidos. Um único início/fim exportado não recupera reinícios já descartados.

Até lá, o indicador corrigido responde **quanto tempo a API informou em relação ao previsto**, com suas limitações explícitas. Os Apps Scripts recebidos não foram instalados, modificados na conta ou publicados. As pendências de acesso à produção e PDF nativo da auditoria principal continuam válidas.
