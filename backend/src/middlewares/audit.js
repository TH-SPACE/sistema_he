const prisma = require("../config/prisma");

async function registrarAuditoria({ usuarioId, acao, entidade, entidadeId, dadosAntes, dadosDepois, ip }) {
  await prisma.auditoria.create({
    data: {
      usuarioId: usuarioId ?? null,
      acao,
      entidade,
      entidadeId: entidadeId != null ? String(entidadeId) : null,
      dadosAntes: dadosAntes ?? undefined,
      dadosDepois: dadosDepois ?? undefined,
      ip: ip ?? null,
    },
  });
}

function auditContext(req) {
  return {
    usuarioId: req.usuario?.id ?? null,
    ip: req.ip,
  };
}

module.exports = { registrarAuditoria, auditContext };
