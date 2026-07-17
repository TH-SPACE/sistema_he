const prisma = require("../../config/prisma");
const { parseSheet, parseDataCelula } = require("../../utils/xlsx");
const { competenciaDe } = require("../../utils/calculoHe");

// Colunas de BASE_HE_EXECUTADO.xlsx (normalizadas): DATA, MATRICULA, NOME,
// CARGO, TIPO POSICAO 2, CARGO AGRUPADO, EVENTO, QTD HORAS, GESTOR IMEDIATO,
// GERENTE IMEDIATO, GERENTE_DIVISAO, CLUSTER, CIDADE, DIRETORIA.
//
// Não há coluna de tipo (50%/100%) separada: o texto de EVENTO classifica a
// linha (ex.: "Horas Extras 100%", "Hora Extra 50%", mas também eventos que
// NÃO são HE, como "Ajuste de ponto gestor", "Saldo de Hrs Flexível (-)").
// Só as linhas cujo EVENTO é reconhecido como HE 50%/100% são de fato
// horas extras executadas — as demais são descartadas na importação (não
// sobem para a tabela) e contadas à parte, como "ignoradas".
function tipoDoEvento(evento) {
  const e = String(evento || "").toUpperCase();
  if (e.includes("100%")) return "PCT_100";
  if (e.includes("50%")) return "PCT_50";
  return null;
}

async function importarHeExecutado(buffer, arquivoNome, usuarioId, commit) {
  const { rows } = parseSheet(buffer);

  const validos = [];
  const erros = [];
  const ignorados = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2;
    const matricula = row.MATRICULA != null ? String(row.MATRICULA).trim() : "";
    const dataRaw = row.DATA;
    const horas = row["QTD HORAS"];
    const evento = row.EVENTO ? String(row.EVENTO).trim() : "";

    if (!matricula) return erros.push({ linha, erro: "MATRICULA vazia" });
    if (!dataRaw) return erros.push({ linha, matricula, erro: "DATA vazia" });
    if (horas == null || Number.isNaN(Number(horas))) return erros.push({ linha, matricula, erro: "QTD HORAS inválida" });

    const dataHe = parseDataCelula(dataRaw);
    if (!dataHe) return erros.push({ linha, matricula, erro: `DATA inválida: ${dataRaw}` });

    const tipo = tipoDoEvento(evento);
    if (!tipo) return ignorados.push({ linha, matricula, evento });

    const texto = (v) => (v != null && v !== "" ? String(v).trim() : null);
    validos.push({
      matricula,
      nome: texto(row.NOME),
      dataHe,
      horas: Number(horas),
      tipo,
      eventoOriginal: evento,
      competencia: competenciaDe(dataHe),
      cargo: texto(row.CARGO),
      tipoPosicao2: texto(row["TIPO POSICAO 2"]),
      cargoAgrupado: texto(row["CARGO AGRUPADO"]),
      gestorImediato: texto(row["GESTOR IMEDIATO"]),
      gerenteImediato: texto(row["GERENTE IMEDIATO"]),
      gerenteDivisao: texto(row["GERENTE_DIVISAO"]),
      cluster: texto(row.CLUSTER),
      cidade: texto(row.CIDADE),
      diretoria: texto(row.DIRETORIA),
    });
  });

  let loteId = null;
  if (commit) {
    const lote = await prisma.loteImportacao.create({
      data: {
        tipo: "HE_EXECUTADO",
        arquivoNome,
        totalLinhas: rows.length,
        inseridos: validos.length,
        erros: erros.length,
        detalheErros: erros.length ? erros : undefined,
        usuarioId,
      },
    });
    loteId = lote.id;

    // A planilha sempre traz uma janela de meses (ex.: últimos 3). Para
    // reimportar sem duplicar, substitui por completo os dados das
    // competências presentes no arquivo, e deixa intactas as competências
    // mais antigas já importadas anteriormente (fora dessa janela).
    const competencias = [...new Set(validos.map((v) => v.competencia))];
    await prisma.$transaction([
      prisma.heExecutado.deleteMany({ where: { competencia: { in: competencias } } }),
      prisma.heExecutado.createMany({
        data: validos.map((v) => ({ ...v, loteImportId: loteId })),
      }),
    ]);
  }

  return {
    loteId,
    totalLinhas: rows.length,
    inseridos: validos.length,
    erros: erros.length,
    detalheErros: erros,
    ignorados: ignorados.length,
    detalheIgnorados: ignorados,
    preview: commit ? undefined : validos.slice(0, 20),
  };
}

module.exports = { importarHeExecutado, tipoDoEvento };
