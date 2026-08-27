# ConsultaEDU · Monitor Meet Dashboard

Dashboard web para apresentação dos relatórios consolidados do Monitor Meet.

## Arquivos

- `index.html` — estrutura da interface
- `style.css` — identidade visual, responsividade e modo de impressão
- `script.js` — integração com API, filtros, indicadores, gráficos e tabela

## API configurada

O dashboard está configurado para consumir:

`https://monitor-meet-api.marcosdalleprane2.workers.dev/`

A URL pode ser alterada no início de `script.js`:

```js
const API_URL = "https://...";
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie `index.html`, `style.css` e `script.js` para a raiz do repositório.
3. Abra **Settings > Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Branch: `main`, pasta: `/ (root)`.
6. Salve.
7. Aguarde o GitHub publicar a URL.

## Recursos incluídos

- Filtros por semana, instituição, conta, turma, disciplina e status
- Abertura automática na semana mais recente
- Cards executivos
- Participantes únicos × pico simultâneo
- Status das aulas
- Cobertura das gravações
- Evolução semanal
- Lista de aulas que exigem atenção
- Pesquisa, ordenação e paginação
- Painel lateral com detalhes de cada aula
- Visão Executiva e Visão Operacional
- Layout responsivo
- Modo de impressão / PDF
- Atualização manual pela interface
- Tratamento visual de falhas da API

## Observação

O dashboard não utiliza a guia de participantes individuais e não exibe nomes de alunos.


## Versão 1.1

Adicionado filtro dinâmico por disciplina, usando o campo `AULA` da API. Todos os indicadores, gráficos, ocorrências e a tabela respondem ao filtro.

## Versão 1.2

- Identidade visual CE Suporte aplicada
- Logo oficial na sidebar e na tela de carregamento
- Favicon / ícone do site
- Paleta principal alterada de azul para verde
- Sidebar em verde escuro
- Gráficos atualizados para a nova identidade
- Mantido o filtro dinâmico por disciplina da versão 1.1
