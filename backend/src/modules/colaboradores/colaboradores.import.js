const prisma = require("../../config/prisma");
const { parseSheet } = require("../../utils/xlsx");

// Colunas esperadas em COLABORADORES.xlsx (normalizadas: sem acento, upper):
// MATRICULA, NOME, CARGO, GERENCIA, REGIONAL, ESTADO, CIDADE, GERENTE, GESTOR_DIRETO
// CARGO resolve por nome em `Cargo`; GERENTE resolve por nome em `Gerente`.
// GERENCIA/REGIONAL/ESTADO/CIDADE/GESTOR_DIRETO são gravados como texto livre.
async function importarColaboradores(buffer, arquivoNome, usuarioId, commit) {
  const { rows } = parseSheet(buffer);

  const cargos = await prisma.cargo.findMany();
  const gerentes = await prisma.gerente.findMany();
  const cargoPorNome = new Map(cargos.map((c) => [c.nome.trim().toUpperCase(), c]));
  const gerentePorNome = new Map(gerentes.map((g) => [g.nome.trim().toUpperCase(), g]));

  const validos = [];
  const erros = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 header, +1 base 1
    const matricula = String(row.MATRICULA ?? "").trim();
    const nome = String(row.NOME ?? "").trim();
    const cargoNome = String(row.CARGO ?? "").trim();
    const gerenteNome = String(row.GERENTE ?? "").trim();

    if (!matricula) return erros.push({ linha, erro: "MATRICULA vazia" });
    if (!nome) return erros.push({ linha, erro: "NOME vazio" });

    const cargo = cargoPorNome.get(cargoNome.toUpperCase());
    if (!cargo) return erros.push({ linha, matricula, erro: `Cargo não cadastrado: "${cargoNome}"` });

    const gerente = gerentePorNome.get(gerenteNome.toUpperCase());
    if (!gerente) return erros.push({ linha, matricula, erro: `Gerente não cadastrado: "${gerenteNome}"` });

    validos.push({
      matricula,
      nome,
      cargoId: cargo.id,
      gerenteId: gerente.id,
      gerencia: row.GERENCIA ? String(row.GERENCIA).trim() : null,
      regional: row.REGIONAL ? String(row.REGIONAL).trim() : null,
      estado: row.ESTADO ? String(row.ESTADO).trim() : null,
      cidade: row.CIDADE ? String(row.CIDADE).trim() : null,
      gestorDireto: row.GESTOR_DIRETO ? String(row.GESTOR_DIRETO).trim() : null,
      ativo: true,
    });
  });

  let loteId = null;
  if (commit) {
    const lote = await prisma.loteImportacao.create({
      data: {
        tipo: "COLABORADORES",
        arquivoNome,
        totalLinhas: rows.length,
        inseridos: validos.length,
        erros: erros.length,
        detalheErros: erros.length ? erros : undefined,
        usuarioId,
      },
    });
    loteId = lote.id;

    for (const c of validos) {
      await prisma.colaborador.upsert({
        where: { matricula: c.matricula },
        update: c,
        create: c,
      });
    }
  }

  return {
    loteId,
    totalLinhas: rows.length,
    inseridos: validos.length,
    erros: erros.length,
    detalheErros: erros,
    preview: commit ? undefined : validos.slice(0, 20),
  };
}

module.exports = { importarColaboradores };
