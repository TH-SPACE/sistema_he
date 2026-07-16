const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { iniciarRetencaoAuditoria } = require("./utils/auditRetention");

app.listen(env.PORT, () => {
  logger.info(`Servidor rodando em ${env.APP_URL} (porta ${env.PORT}, ${env.NODE_ENV})`);
  iniciarRetencaoAuditoria();
});
