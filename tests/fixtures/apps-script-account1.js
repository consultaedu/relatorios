// Trechos literais de funções puras fornecidas pelo usuário em 01/10/2026.
// Apenas caracterização da origem; não são uma implementação corrigida.
// Nenhum serviço Google, gatilho, envio ou acesso a planilha é executado.

// Relatórios; SHA-256 do anexo: b044362eea26cdf012a3b48c2a7df9203343a4e30220c08b124fd81424942acc
// Linhas originais 1858-2013
function rel_encontrarGravacaoDaAula_(
  gravacoes,
  aula
) {

  if (
    !gravacoes ||
    gravacoes.length === 0
  ) {

    return null;

  }


  const duracaoBloco =
    aula.fim.getTime() -
    aula.inicio.getTime();


  const metade =
    duracaoBloco / 2;


  let inicioJanela;

  let fimJanela;


  /*
   Primeira aula do evento.
  */

  if (
    aula.indice === 0
  ) {

    inicioJanela =
      aula.inicio.getTime() -
      10 * 60000;

  }

  else {

    inicioJanela =
      aula.inicio.getTime() -
      metade;

  }


  /*
   Última aula do evento.
  */

  if (
    aula.indice ===
    aula.quantidadeBlocos - 1
  ) {

    fimJanela =
      aula.fim.getTime() +
      30 * 60000;

  }

  else {

    fimJanela =
      aula.inicio.getTime() +
      metade;

  }


  const candidatas =
    gravacoes.filter(
      function(gravacao) {

        if (
          !gravacao.startTime
        ) {
          return false;
        }


        const inicio =
          new Date(
            gravacao.startTime
          ).getTime();


        return (
          inicio >= inicioJanela &&
          inicio < fimJanela
        );

      }
    );


  if (
    candidatas.length === 0
  ) {

    return null;

  }


  /*
   Se houver mais de uma,
   usa a mais próxima do
   horário previsto.
  */

  candidatas.sort(
    function(a, b) {

      const distanciaA =
        Math.abs(

          new Date(
            a.startTime
          ).getTime() -

          aula.inicio.getTime()

        );


      const distanciaB =
        Math.abs(

          new Date(
            b.startTime
          ).getTime() -

          aula.inicio.getTime()

        );


      return (
        distanciaA -
        distanciaB
      );

    }
  );


  return candidatas[0];

}
// Linhas originais 2020-2088
function rel_calcularMinutosGravados_(
  gravacao,
  aula,
  agora
) {

  if (
    !gravacao ||
    !gravacao.startTime
  ) {

    return 0;

  }


  const inicioGravacao =
    new Date(
      gravacao.startTime
    ).getTime();


  const fimGravacao =
    gravacao.endTime
      ? new Date(
          gravacao.endTime
        ).getTime()
      : agora.getTime();


  const inicio =
    Math.max(

      inicioGravacao,

      aula.inicio.getTime()

    );


  const fim =
    Math.min(

      fimGravacao,

      aula.fim.getTime(),

      agora.getTime()

    );


  if (
    fim <= inicio
  ) {

    return 0;

  }


  return Math.round(
    (
      fim -
      inicio
    ) / 60000
  );

}

// Monitor; SHA-256 do anexo: 7c8f4b47ce4a4f565b998da881148cc3e6e0aa8730ca1ed2b316da0b571471fd
// Linhas originais 1507-1600
function encontrarGravacaoDaAula_(
  gravacoes,
  aula
) {

  const inicioJanela =
    aula.inicio.getTime() -
    CONFIG_MONITOR
      .JANELA_ANTES_GRAVACAO_MINUTOS *
    60000;


  const fimJanela =
    aula.fim.getTime();


  const candidatas =
    gravacoes.filter(
      function(
        gravacao
      ) {

        if (
          !gravacao.startTime
        ) {
          return false;
        }


        const inicio =
          new Date(
            gravacao.startTime
          ).getTime();


        return (
          inicio >= inicioJanela &&
          inicio < fimJanela
        );

      }
    );


  if (
    candidatas.length === 0
  ) {

    return null;

  }


  /*
   Escolhe a gravação cujo início
   ficou mais próximo do início previsto.
  */

  candidatas.sort(
    function(
      a,
      b
    ) {

      const distanciaA =
        Math.abs(
          new Date(
            a.startTime
          ).getTime() -
          aula.inicio.getTime()
        );


      const distanciaB =
        Math.abs(
          new Date(
            b.startTime
          ).getTime() -
          aula.inicio.getTime()
        );


      return (
        distanciaA -
        distanciaB
      );

    }
  );


  return candidatas[0];

}
