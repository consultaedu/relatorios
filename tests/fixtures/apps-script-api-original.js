// Trechos literais da API 1.1.0 recebida em 01/10/2026. Apenas caracterização.
// SHA-256: 8f821525d5ee3635dc69ae546470e9586e6b8a29b07634bf2199521fc98e4c0b

// Linhas originais 567-614
function apiDeduplicarPorSessao_(
  dados
) {

  const mapa =
    new Map();


  for (
    const item
    of dados
  ) {

    const chave =
      String(
        item.chaveSessao ||
        item.idSessao ||
        item.id ||
        ""
      ).trim();


    if (
      !chave ||
      !mapa.has(
        chave
      )
    ) {

      mapa.set(
        chave ||
        (
          "SEM_CHAVE_" +
          mapa.size
        ),
        item
      );

    }

  }


  return [
    ...mapa.values()
  ];

}

// Linhas originais 621-811
function apiCalcularResumo_(
  dados
) {

  const sessoes =
    apiDeduplicarPorSessao_(
      dados
    );


  const totalAulas =
    sessoes.length;


  if (
    totalAulas === 0
  ) {

    return {

      aulas:
        0,

      disciplinas:
        0,

      participacoes:
        0,

      mediaParticipantes:
        0,

      maiorPico:
        0,

      coberturaMedia:
        0,

      gravacoesNoPrazoPercentual:
        0,

      ok:
        0,

      atencao:
        0,

      problemas:
        0

    };

  }


  let participacoes = 0;

  let maiorPico = 0;

  let somaCobertura = 0;

  let aulasComCobertura = 0;

  let gravacoesNoPrazo = 0;

  let ok = 0;

  let atencao = 0;

  let problemas = 0;


  for (
    const item
    of sessoes
  ) {

    participacoes +=
      item.participantes;


    maiorPico =
      Math.max(
        maiorPico,
        item.pico
      );


    if (
      item.duracaoPrevista > 0
    ) {

      somaCobertura +=
        item.cobertura;

      aulasComCobertura++;

    }


    if (
      item.gravacao
        .toUpperCase() === "SIM" &&
      item.atrasoGravacao <= 10
    ) {

      gravacoesNoPrazo++;

    }


    switch (
      item.statusTipo
    ) {

      case "OK":

        ok++;
        break;


      case "ATRASO":

      case "SEM_PARTICIPANTES":

        atencao++;
        break;


      default:

        problemas++;
        break;

    }

  }


  return {

    aulas:
      totalAulas,

    disciplinas:
      dados.length,

    participacoes:
      participacoes,

    mediaParticipantes:
      apiArredondar_(
        participacoes /
        totalAulas,
        1
      ),

    maiorPico:
      maiorPico,

    coberturaMedia:
      aulasComCobertura > 0
        ? apiArredondar_(
            somaCobertura /
            aulasComCobertura,
            1
          )
        : 0,

    gravacoesNoPrazoPercentual:
      apiArredondar_(
        (
          gravacoesNoPrazo /
          totalAulas
        ) *
        100,
        1
      ),

    ok:
      ok,

    atencao:
      atencao,

    problemas:
      problemas

  };

}

// Linhas originais 1042-1058
function apiNumero_(
  valor
) {

  const numero =
    Number(
      valor
    );


  return Number.isFinite(
    numero
  )
    ? numero
    : 0;

}

// Linhas originais 1065-1085
function apiArredondar_(
  numero,
  casas
) {

  const fator =
    Math.pow(
      10,
      casas
    );


  return (
    Math.round(
      numero *
      fator
    ) /
    fator
  );

}
