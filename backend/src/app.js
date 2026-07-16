const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const pinoHttp = require("pino-http");

const env = require("./config/env");
const logger = require("./config/logger");
const { loadUsuario, requireAuth } = require("./middlewares/auth");
const { errorHandler, notFoundHandler } = require("./middlewares/error");

const authRoutes = require("./modules/auth/auth.routes");
const usuariosRoutes = require("./modules/usuarios/usuarios.routes");
const gerentesRoutes = require("./modules/gerentes/gerentes.routes");
const cargosRoutes = require("./modules/cargos/cargos.routes");
const colaboradoresRoutes = require("./modules/colaboradores/colaboradores.routes");
const solicitacoesRoutes = require("./modules/solicitacoes/solicitacoes.routes");
const aprovacoesRoutes = require("./modules/aprovacoes/aprovacoes.routes");
const heExecutadoRoutes = require("./modules/heExecutado/heExecutado.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const auditoriaRoutes = require("./modules/auditoria/auditoria.routes");

const app = express();

app.set("trust proxy", 1);
app.use(pinoHttp({ logger }));
app.use(cors({ origin: env.APP_URL, credentials: true }));
app.use(express.json({ limit: `${env.MAX_UPLOAD_MB}mb` }));
app.use(cookieParser());

const sessionStore = new MySQLStore({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  createDatabaseTable: true,
});

app.use(
  session({
    key: "he_sid",
    secret: env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: env.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", authRoutes);

// demais rotas exigem sessao + perfil carregado
app.use("/api", loadUsuario, requireAuth);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/gerentes", gerentesRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/colaboradores", colaboradoresRoutes);
app.use("/api/solicitacoes", solicitacoesRoutes);
app.use("/api/aprovacoes", aprovacoesRoutes);
app.use("/api/he-executado", heExecutadoRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auditoria", auditoriaRoutes);

app.use("/api", notFoundHandler);

const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.use(errorHandler);

module.exports = app;
