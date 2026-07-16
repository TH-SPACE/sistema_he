const express = require("express");
const prisma = require("../../config/prisma");
const { requirePerfil } = require("../../middlewares/rbac");
const { registrarAuditoria, auditContext } = require("../../middlewares/audit");

const router = express.Router();

router.get("/", requirePerfil("FOCAL", "ADMIN"), async (req, res, next) => {
  try {
    const { usuarioId, acao, entidade, dataInicio, dataFim, page = "1", pageSize = "50" } = req.query;
    const where = {
      usuarioId: usuarioId ? Number(usuarioId) : undefined,
      acao: acao || undefined,
      entidade: entidade || undefined,
      criadoEm: dataInicio || dataFim ? { gte: dataInicio ? new Date(dataInicio) : undefined, lte: dataFim ? new Date(dataFim) : undefined } : undefined,
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [itens, total] = await Promise.all([
      prisma.auditoria.findMany({ where, include: { usuario: true }, orderBy: { criadoEm: "desc" }, skip, take: Number(pageSize) }),
      prisma.auditoria.count({ where }),
    ]);
    res.json({ data: { itens, total }, error: null });
  } catch (err) {
    next(err);
  }
});

// Limpa todo o historico de auditoria. Destrutivo e irreversivel; so ADMIN.
// Registra uma unica entrada apos a limpeza para manter rastro de quem executou.
router.delete("/", requirePerfil("ADMIN"), async (req, res, next) => {
  try {
    const { count } = await prisma.auditoria.deleteMany({});
    await registrarAuditoria({
      ...auditContext(req),
      acao: "LIMPAR_AUDITORIA",
      entidade: "Auditoria",
      dadosDepois: { registrosRemovidos: count },
    });
    res.json({ data: { removidos: count }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
