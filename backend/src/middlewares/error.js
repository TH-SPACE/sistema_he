const logger = require("../config/logger");

function errorHandler(err, req, res, next) {
  logger.error({ err }, "Erro não tratado");

  if (err.name === "ZodError") {
    return res.status(400).json({ data: null, error: err.errors.map((e) => e.message).join("; ") });
  }

  const status = err.status || 500;
  const message = err.expose ? err.message : "Erro interno do servidor";
  res.status(status).json({ data: null, error: message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ data: null, error: "Rota não encontrada" });
}

module.exports = { errorHandler, notFoundHandler };
