require("dotenv").config();
const { z } = require("zod");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().default("http://localhost:3001"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  DB_HOST: z.string().default("localhost"),
  DB_USER: z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().default("co"),
  DB_PORT: z.coerce.number().default(3306),

  SESSION_SECRET: z.string().min(1, "SESSION_SECRET é obrigatório"),
  SESSION_MAX_AGE_HOURS: z.coerce.number().default(8),

  LDAP_URL: z.string().optional(),
  LDAP_BASE_DN: z.string().optional(),
  LDAP_DOMAIN: z.string().optional(),
  LDAP_USER: z.string().optional(),
  LDAP_PASS: z.string().optional(),
  LDAP_GRUPO_ACESSO: z.string().optional(),

  DEV_USER: z.string().optional(),
  DEV_PASSWORD: z.string().optional(),
  DEV_PERFIL: z.enum(["SOLICITADOR", "APROVADOR", "FOCAL", "ADMIN"]).default("ADMIN"),

  DEV_USER_SOLICITADOR: z.string().optional(),
  DEV_PASSWORD_SOLICITADOR: z.string().optional(),
  DEV_USER_APROVADOR: z.string().optional(),
  DEV_PASSWORD_APROVADOR: z.string().optional(),
  DEV_USER_FOCAL: z.string().optional(),
  DEV_PASSWORD_FOCAL: z.string().optional(),
  DEV_USER_ADMIN: z.string().optional(),
  DEV_PASSWORD_ADMIN: z.string().optional(),

  MAX_UPLOAD_MB: z.coerce.number().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Erro nas variáveis de ambiente:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;
