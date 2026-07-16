const prisma = require("../config/prisma");
const logger = require("../config/logger");

const DIAS_RETENCAO = 90;
const INTERVALO_MS = 24 * 60 * 60 * 1000; // roda uma vez por dia

async function purgarAuditoriaAntiga() {
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_RETENCAO);

  const { count } = await prisma.auditoria.deleteMany({
    where: { criadoEm: { lt: limite } },
  });

  if (count > 0) {
    logger.info(`Retencao de auditoria: ${count} registro(s) com mais de ${DIAS_RETENCAO} dias removido(s)`);
  }
}

function iniciarRetencaoAuditoria() {
  purgarAuditoriaAntiga().catch((err) => logger.error({ err }, "Falha ao purgar auditoria antiga"));
  setInterval(() => {
    purgarAuditoriaAntiga().catch((err) => logger.error({ err }, "Falha ao purgar auditoria antiga"));
  }, INTERVALO_MS);
}

module.exports = { iniciarRetencaoAuditoria, purgarAuditoriaAntiga };
