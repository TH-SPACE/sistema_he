# Portal HE - CONO

Aplicacao interna para solicitar, aprovar, controlar e auditar horas extras,
com controle de limite por gerente e valorizacao por cargo.

Especificacao completa em [SPEC_Sistema_Horas_Extras.md](SPEC_Sistema_Horas_Extras.md).

Stack:
- **Backend**: Node.js + Express + Prisma + MySQL/MariaDB
- **Frontend**: React + Vite + Ant Design

---

## 1. Pre-requisitos

- Node.js 20+ e npm
- MySQL 8 ou MariaDB 10.6+ rodando localmente (ou acessivel pela rede)
- Uma base de dados **dedicada** para o sistema (nao reutilize um banco que ja
  tenha tabelas de outra aplicacao — o Prisma sincroniza o schema inteiro do
  banco configurado em `DATABASE_URL`)

---

## 2. Estrutura do projeto

```
sistema_he/
├── backend/     # API Express + Prisma
├── frontend/    # SPA React + Vite + antd
├── img_vivo/    # SVGs de ilustracao usados no layout (copiados para frontend/public/img_vivo)
└── *.xlsx       # planilhas de referencia (cargos, gerentes, colaboradores, HE executado)
```

Cada workspace (`backend`, `frontend`) tem seu proprio `package.json`; o
`package.json` da raiz apenas declara os workspaces e atalhos de script.

---

## 3. Instalacao

Na raiz do projeto:

```bash
npm install
```

Isso instala as dependencias de `backend` e `frontend` de uma vez
(npm workspaces).

---

## 4. Configuracao (`backend/.env`)

Crie/edite `backend/.env` (ja existe um de exemplo no repo). Principais
variaveis:

```env
NODE_ENV=development            # development = login local (bypass de AD) | production = AD/LDAP
PORT=3001
APP_URL=http://localhost:3001

# Banco de dados dedicado ao sistema
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=horas_extras
DATABASE_URL="mysql://root:123456@localhost:3306/horas_extras"

SESSION_SECRET=troque-este-segredo-em-producao
SESSION_MAX_AGE_HOURS=8

# Active Directory / LDAP (usado apenas quando NODE_ENV=production)
LDAP_URL=ldap://dc.empresa.local:389
LDAP_BASE_DN=dc=empresa,dc=local
LDAP_DOMAIN=empresa.local
LDAP_USER=            # conta de servico para buscas no AD (findUser/isUserMemberOf)
LDAP_PASS=
LDAP_GRUPO_ACESSO=    # opcional: grupo AD que libera acesso ao sistema

# Login local de desenvolvimento (bypass de AD) — um usuario por perfil
DEV_USER=admin@local
DEV_PASSWORD=Yugioh25569
DEV_PERFIL=ADMIN
DEV_USER_SOLICITADOR=solicitador@local
DEV_PASSWORD_SOLICITADOR=solicitador123
DEV_USER_APROVADOR=aprovador@local
DEV_PASSWORD_APROVADOR=aprovador123
DEV_USER_FOCAL=focal@local
DEV_PASSWORD_FOCAL=focal123
DEV_USER_ADMIN=admin@local
DEV_PASSWORD_ADMIN=Yugioh25569

MAX_UPLOAD_MB=10
```

> Em `NODE_ENV=development`, o login usa **apenas** as credenciais
> `DEV_USER*` acima (ignora o AD). Em `production`, usa exclusivamente LDAP.

---

## 5. Banco de dados (Prisma)

### 5.1 Criar o banco (se ainda nao existir)

```bash
node -e "
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '123456' });
  await conn.query('CREATE DATABASE IF NOT EXISTS horas_extras CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.end();
})();
"
```

### 5.2 Aplicar o schema

Em ambiente **local/dev** (shell interativo), o fluxo padrao do Prisma funciona:

```bash
cd backend
npx prisma migrate dev
```

Em ambiente **nao-interativo** (CI, scripts) ou para sincronizar rapidamente
sem gerar uma nova migration:

```bash
cd backend
npx prisma db push
```

> **Atencao**: `prisma db push` e `prisma migrate` sincronizam o banco inteiro
> com o `schema.prisma` — rodar contra um banco que ja tem outras tabelas fora
> do controle do Prisma pode apagar dados. Sempre use um banco dedicado
> (`DB_NAME=horas_extras` acima).

Para aplicar as migrations existentes em producao:

```bash
cd backend
npx prisma migrate deploy
```

### 5.3 Popular dados iniciais (seed)

O seed cria o usuario admin e importa `CARGO_VALOR.xlsx`,
`VALOR_GERENTES.xlsx` e `COLABORADORES.xlsx` (localizados na raiz do
projeto) para as tabelas `Cargo`, `Gerente` e `Colaborador`:

```bash
cd backend
node prisma/seed.js
```

Rode o seed novamente sempre que as planilhas de referencia forem
atualizadas — ele faz `upsert` (nao duplica registros).

---

## 6. Desenvolvimento x Producao (leia antes de rodar)

Existem dois jeitos de rodar o sistema, dependendo do que voce quer fazer:

**Desenvolvimento** (testar, mexer no codigo, ver mudanca na hora)
Precisa dos **dois processos rodando ao mesmo tempo**, em dois terminais
separados:
- Backend (`cd backend && npm run dev`) — a API, na porta 3001
- Frontend (`cd frontend && npm run dev`) — o Vite, na porta 5173, que serve
  as telas e repassa (faz "proxy") as chamadas de API para o backend

Voce acessa pelo `http://localhost:5173`. O Vite fica de olho nos arquivos e
recarrega a tela sozinho a cada alteracao — otimo para ir testando, mas nao e
como o sistema roda de verdade em um servidor.

**Producao** (deixar rodando "de verdade", para os usuarios finais)
Aqui **nao se roda mais o Vite**. O processo e:
1. `cd frontend && npm run build` — isso compila todo o React em arquivos
   estaticos prontos (HTML/CSS/JS), salvos em `frontend/dist`. E o "build".
2. `cd backend && npm start` — o backend sobe e **ja serve essas telas
   prontas junto com a API**, tudo na mesma porta (a de `PORT` no `.env`,
   3001 por padrao).

Ou seja: em producao roda **um unico processo** (o backend) — ele faz o
papel dos dois.

| | Desenvolvimento | Producao |
|---|---|---|
| Processos rodando | 2 (frontend + backend) | 1 (backend serve tudo) |
| Comando | `npm run dev` nos dois | `npm run build` (frontend) + `npm start` (backend) |
| Porta que voce acessa | 5173 | a porta do backend (3001 por padrao) |
| Recarrega sozinho ao editar codigo? | Sim | Nao — precisa rodar o build de novo |

Se voce so quer testar o sistema no seu computador, use o modo
**desenvolvimento** (secao 7 abaixo) e continue com os dois `npm run dev`. O
"build" (secao 8) so importa quando for colocar o sistema para rodar de
verdade em um servidor.

---

## 7. Rodando em desenvolvimento

Em dois terminais separados:

```bash
# Terminal 1 — backend (porta 3001)
cd backend
npm run dev

# Terminal 2 — frontend (porta 5173, com proxy /api -> :3001)
cd frontend
npm run dev
```

Acesse `http://localhost:5173` e entre com um dos usuarios de
`DEV_USER*` do `.env`.

---

## 8. Build de producao

### 8.1 Build do frontend

```bash
cd frontend
npm run build
```

Gera `frontend/dist`, que o backend serve automaticamente como estatico em
`app.js` (rota raiz `/`, tudo fora de `/api/*`).

### 8.2 Subir o backend

```bash
cd backend
npm start
```

Isso serve a API em `/api/*` **e** os arquivos estaticos do frontend
(`frontend/dist`) na raiz — um unico processo Node.

### 8.3 Deploy sugerido

- Processo Node gerenciado por **pm2** (ou systemd)
- **nginx** na frente, proxy reverso para a porta do backend (`PORT` no `.env`)
- `NODE_ENV=production` no `.env` do servidor (ativa autenticacao via AD/LDAP)
- Rodar `npx prisma migrate deploy` antes de subir uma nova versao, se houver
  migrations pendentes

---

## 9. Estrutura do backend

```
backend/
├── prisma/
│   ├── schema.prisma       # modelo de dados
│   ├── migrations/         # historico de migrations
│   └── seed.js             # seed de admin + import de cargos/gerentes/colaboradores
└── src/
    ├── server.js           # bootstrap (listen + job de retencao de auditoria)
    ├── app.js              # middlewares, sessao, rotas, estaticos do frontend
    ├── config/             # env (Zod), prisma client, logger, LDAP
    ├── middlewares/         # auth, rbac, auditoria, tratamento de erro
    ├── modules/             # um modulo por dominio (auth, usuarios, colaboradores,
    │                        #   gerentes, cargos, solicitacoes, aprovacoes,
    │                        #   heExecutado, dashboard, auditoria)
    └── utils/               # calculoHe.js (regra de valor de HE), xlsx.js (parser),
                              #   auditRetention.js (purga automatica de 90 dias)
```

## 10. Estrutura do frontend

```
frontend/
├── public/img_vivo/         # SVGs de ilustracao usados no layout
└── src/
    ├── main.jsx             # bootstrap (React Query, antd ConfigProvider, Router)
    ├── App.jsx               # rotas + guarda de perfil
    ├── layout/               # Sider/Header (AppLayout) + menuConfig por perfil
    ├── pages/                # uma pagina por tela (+ pages/admin/*)
    ├── components/           # SelectColaborador, ResumoLimite, PageTitle, EmptyState
    ├── context/AuthContext.jsx
    └── services/api.js       # axios com cookies de sessao
```

---

## 11. Notas operacionais

- **Auditoria**: registros com mais de 90 dias sao removidos automaticamente
  (job diario em `utils/auditRetention.js`). O perfil ADMIN tambem pode limpar
  todo o historico manualmente pela tela Auditoria — acao irreversivel.
- **Importacao de planilhas**: `colaboradores.xlsx` e `base_he_executado.xlsx`
  sao importadas com preview (linhas invalidas nao bloqueiam o lote, ficam
  listadas em `detalheErros`).
- **Calculo de HE**: a regra vive em `backend/src/utils/calculoHe.js` — a
  tabela de cargos ja traz o valor pronto por tipo (`HE 50%` / `HE 100%`),
  sem multiplicador adicional.
