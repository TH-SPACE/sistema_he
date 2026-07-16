const prisma = require("../../config/prisma");
const { parseSheet } = require("../../utils/xlsx");

const PERFIS_VALIDOS = ["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"];

// Colunas esperadas na planilha (normalizadas: sem acento, upper):
// USERNAME, NOME, EMAIL, PERFIL, GERENTE
// PERFIL vazio vira SOLICITADOR. GERENTE resolve por nome em `Gerente` (fica
// nulo para APROVADOR, que não é restrito a uma gerência). Usuários
// importados em massa entram já como ATIVO (é um cadastro feito pelo admin,
// não uma solicitação de acesso pendente de aprovação).
async function importarUsuarios(buffer, arquivoNome, usuarioId, commit) {
  const { rows } = parseSheet(buffer);

  const gerentes = await prisma.gerente.findMany();
  const gerentePorNome = new Map(gerentes.map((g) => [g.nome.trim().toUpperCase(), g]));

  const validos = [];
  const erros = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 header, +1 base 1
    const username = String(row.USERNAME ?? "").trim();
    const nome = String(row.NOME ?? "").trim();
    const email = row.EMAIL ? String(row.EMAIL).trim() : "";
    const perfilBruto = String(row.PERFIL ?? "").trim().toUpperCase();
    const gerenteNome = row.GERENTE ? String(row.GERENTE).trim() : "";

    if (!username) return erros.push({ linha, erro: "USERNAME vazio" });
    if (!nome) return erros.push({ linha, username, erro: "NOME vazio" });

    const perfil = perfilBruto || "SOLICITADOR";
    if (!PERFIS_VALIDOS.includes(perfil)) {
      return erros.push({ linha, username, erro: `Perfil inválido: "${perfilBruto}" (use SOLICITADOR, APROVADOR, FOCAL ou ADMIN)` });
    }

    let gerenteId = null;
    if (gerenteNome && perfil !== "APROVADOR") {
      const gerente = gerentePorNome.get(gerenteNome.toUpperCase());
      if (!gerente) return erros.push({ linha, username, erro: `Gerente não cadastrado: "${gerenteNome}"` });
      gerenteId = gerente.id;
    }

    validos.push({ username, nome, email: email || null, perfil, gerenteId, status: "ATIVO" });
  });

  let loteId = null;
  if (commit) {
    const lote = await prisma.loteImportacao.create({
      data: {
        tipo: "USUARIOS",
        arquivoNome,
        totalLinhas: rows.length,
        inseridos: validos.length,
        erros: erros.length,
        detalheErros: erros.length ? erros : undefined,
        usuarioId,
      },
    });
    loteId = lote.id;

    for (const u of validos) {
      await prisma.usuario.upsert({
        where: { username: u.username },
        update: u,
        create: u,
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

module.exports = { importarUsuarios };
