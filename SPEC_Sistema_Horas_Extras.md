# Especificação Técnica — Sistema de Gestão de Horas Extras (HE)

> Documento de handoff para assistente de código (Claude Code / VSCode).
> Stack: **Node.js + Express + Prisma + MySQL/MariaDB** (backend) e **React + Vite + Ant Design** (frontend).
> Escopo: aplicação **web desktop-only**, autenticação via **Active Directory (LDAP)**.

---

## 0. Sumário

1. Visão geral e objetivo
2. Stack técnica e decisões de arquitetura
3. Estrutura de pastas (monorepo)
4. Variáveis de ambiente (`.env`)
5. Autenticação e autorização (AD/LDAP + modo dev)
6. Perfis e matriz de permissões
7. Modelo de dados (schema Prisma)
8. Regras de negócio (cálculo, limites, status)
9. Telas e fluxos (detalhado)
10. Menu lateral e navegação
11. **Sugestões de visões/dashboards (IA)**
12. Importação de planilhas
13. API — endpoints
14. Auditoria
15. Roadmap de implementação em fases
16. Pontos a confirmar antes/durante o build

---

## 1. Visão geral e objetivo

Sistema interno para **solicitar, aprovar, controlar e auditar horas extras** de colaboradores, com controle de **saldo/limite por gerência** e **valorização por cargo**.

Personas:
- **Solicitador** — cria e acompanha solicitações de HE.
- **Aprovador** — aprova ou recusa solicitações.
- **Focal** — gerencia a base de colaboradores, importa o HE efetivamente executado e consulta auditoria.
- **Admin** — configura tudo (usuários, tabelas de cargo/gerência, base de colaboradores, auditoria).

Ciclo de vida de uma solicitação:

```
Rascunho (opcional) → PENDENTE_APROVACAO → APROVADO
                                        ↘ RECUSADO
```

---

## 2. Stack técnica e decisões de arquitetura

### Backend
| Item | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js (LTS 20+) | Requisito do projeto |
| Framework HTTP | **Express** | Simples, maduro, fácil handoff |
| ORM | **Prisma** | Migrations versionadas, schema tipado |
| Banco | **MySQL 8 / MariaDB 10.6+** | Já roda no seu VPS |
| Auth AD | **activedirectory2** (ou `ldapjs`) | Bind LDAP + consulta de grupos |
| Sessão | **express-session** + **express-mysql-session** | Sem infra extra (usa o próprio MySQL) |
| Validação | **Zod** | Valida payloads na borda |
| Planilhas | **SheetJS (`xlsx`)** para leitura, **ExcelJS** para exportação estilizada | Import/export |
| Logs | **pino** | Log estruturado |

### Frontend
| Item | Escolha | Motivo |
|---|---|---|
| Build | **Vite** | Rápido, simples |
| UI | **React 18** | SPA reativa (forms dinâmicos) |
| Componentes | **Ant Design (antd)** | `Select` pesquisável, `Table` com filtros, `Form`, `DatePicker` — tudo pronto para tela administrativa desktop |
| Gráficos | **@ant-design/charts** (ou Recharts) | Dashboards |
| Requests | **Axios** + **TanStack Query** | Cache/estado de servidor |
| Roteamento | **React Router** | Navegação SPA |

> **Alternativa mais leve** (caso queira um único servidor sem SPA): Express + **EJS** + **Alpine.js** renderizado no servidor. Funciona, mas os formulários dinâmicos (multi-colaborador / multi-dia com resumo ao vivo) ficam bem mais trabalhosos. **Recomendação: seguir com React + antd.**

### Deploy
- Backend serve a API em `/api/*` e serve os estáticos do build do React (`frontend/dist`) na raiz.
- Um único processo Node no VPS (pm2), atrás de nginx.
- Banco MySQL/MariaDB existente.

---

## 3. Estrutura de pastas (monorepo)

```
horas-extras/
├── package.json                 # workspaces: backend, frontend
├── .env.example
├── docker-compose.yml           # opcional (MySQL local para dev)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js              # seed de perfis, gerências, cargos, admin inicial
│   ├── src/
│   │   ├── server.js            # bootstrap Express
│   │   ├── app.js               # middlewares, rotas, static
│   │   ├── config/
│   │   │   ├── env.js           # carrega e valida env com Zod
│   │   │   └── prisma.js        # PrismaClient singleton
│   │   ├── middlewares/
│   │   │   ├── auth.js          # requireAuth
│   │   │   ├── rbac.js          # requirePerfil('ADMIN', ...)
│   │   │   ├── audit.js         # captura antes/depois
│   │   │   └── error.js         # handler global de erros
│   │   ├── modules/
│   │   │   ├── auth/            # login AD/dev, logout, /me
│   │   │   ├── usuarios/
│   │   │   ├── colaboradores/
│   │   │   ├── gerencias/
│   │   │   ├── cargos/
│   │   │   ├── solicitacoes/    # + itens, cálculo, resumo de limite
│   │   │   ├── aprovacoes/
│   │   │   ├── heExecutado/     # import + reconciliação
│   │   │   ├── auditoria/
│   │   │   ├── dashboard/       # KPIs e séries
│   │   │   └── importacao/      # parse xlsx genérico
│   │   └── utils/
│   │       ├── calculoHe.js     # regra única de cálculo (SSOT)
│   │       └── xlsx.js
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx              # rotas + layout
        ├── layout/
        │   ├── AppLayout.jsx    # Sider + Header + Content
        │   └── menuConfig.js    # itens de menu por perfil
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── NovaSolicitacao.jsx
        │   ├── FilaSolicitacoes.jsx
        │   ├── Aprovacoes.jsx
        │   ├── Colaboradores.jsx
        │   ├── HeExecutado.jsx
        │   ├── Relatorios.jsx
        │   └── admin/
        │       ├── Usuarios.jsx
        │       ├── Cargos.jsx
        │       ├── Gerencias.jsx
        │       └── Auditoria.jsx
        ├── components/          # SelectColaborador, ResumoLimite, ItemLinha etc.
        ├── services/api.js      # axios + interceptors
        ├── hooks/               # useAuth, useSolicitacoes...
        └── context/AuthContext.jsx
```

---

## 4. Variáveis de ambiente (`.env`)

```env
# App
NODE_ENV=development            # development | production
PORT=3000
APP_URL=http://localhost:3000

# Banco
DATABASE_URL="mysql://user:pass@localhost:3306/horas_extras"

# Sessão
SESSION_SECRET=troque-este-segredo
SESSION_MAX_AGE_HOURS=8

# Active Directory / LDAP (produção)
LDAP_URL=ldap://dc.empresa.local:389
LDAP_BASE_DN=DC=empresa,DC=local
LDAP_DOMAIN=empresa.local        # sufixo UPN: usuario@empresa.local
LDAP_USERNAME=svc_ldap@empresa.local   # conta de serviço p/ buscar dados
LDAP_PASSWORD=senha_service_account
# (opcional) grupo AD que libera acesso ao sistema
LDAP_GRUPO_ACESSO=CN=GRP_HE_ACESSO,OU=Grupos,DC=empresa,DC=local

# Modo desenvolvimento (bypass de AD)
DEV_USER=admin
DEV_PASSWORD=admin123
DEV_PERFIL=ADMIN                 # perfil assumido no login dev

# Upload
MAX_UPLOAD_MB=10
```

> **Regra:** se `NODE_ENV === 'development'`, o login aceita **apenas** `DEV_USER`/`DEV_PASSWORD` do `.env` e ignora o AD. Em produção, usa exclusivamente o AD.

---

## 5. Autenticação e autorização

### 5.1 Fluxo de login

```
POST /api/auth/login { username, password }
 ├─ NODE_ENV === development
 │    └─ compara com DEV_USER/DEV_PASSWORD → cria/atualiza usuário "admin" com DEV_PERFIL
 └─ produção
      ├─ bind LDAP com username@LDAP_DOMAIN + password
      ├─ (opcional) verifica pertencimento a LDAP_GRUPO_ACESSO
      ├─ busca nome/email no AD
      └─ upsert do usuário local (status inicial = PENDENTE)
```

- Após bind bem-sucedido, procura-se o registro em `usuarios`.
  - Se **não existe** → cria com `status = PENDENTE` e bloqueia o acesso com mensagem *"Cadastro aguardando aprovação do administrador"*.
  - Se `status = PENDENTE` → mesma mensagem.
  - Se `status = INATIVO` → *"Acesso desativado"*.
  - Se `status = ATIVO` → cria sessão.
- Sessão em cookie `httpOnly`, `sameSite=lax`, expira em `SESSION_MAX_AGE_HOURS`.

### 5.2 Endpoints de sessão
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me` → dados do usuário logado + perfil + permissões.

### 5.3 Autorização
- Middleware `requireAuth` protege todas as rotas `/api` (exceto login).
- Middleware `requirePerfil(...perfis)` valida o perfil. Regras finas (ex.: "só edita a própria solicitação") ficam no service.

---

## 6. Perfis e matriz de permissões

Perfis: `SOLICITADOR`, `APROVADOR`, `FOCAL`, `ADMIN`.

| Ação | SOLICITADOR | APROVADOR | FOCAL | ADMIN |
|---|:--:|:--:|:--:|:--:|
| Criar solicitação | ✅ | ✅ | ✅ | ✅ |
| Ver **próprias** solicitações | ✅ | ✅ | ✅ | ✅ |
| Editar/excluir **própria** solicitação (se não aprovada) | ✅ | ✅ | ✅ | ✅ |
| Ver **todas** as solicitações | ❌ | ✅ | ✅ | ✅ |
| Aprovar / recusar | ❌ | ✅ | ❌ | ✅ |
| Gerenciar colaboradores (CRUD + importar) | ❌ | ❌ | ✅ | ✅ |
| Importar `base_he_executado` + reconciliação | ❌ | ❌ | ✅ | ✅ |
| Consultar auditoria | ❌ | ❌ | ✅ | ✅ |
| Gerenciar usuários (aprovar/editar/perfil) | ❌ | ❌ | ❌ | ✅ |
| Editar tabela **cargo → valor** | ❌ | ❌ | ❌ | ✅ |
| Editar tabela **gerência → limite** | ❌ | ❌ | ❌ | ✅ |

> Regra especial: **excluir/editar** só é permitido ao **autor** da solicitação e **somente enquanto não estiver aprovada** (itens em `PENDENTE_APROVACAO` ou `RECUSADO`). Item `APROVADO` fica travado para edição/exclusão.
>
> **A confirmar:** o Aprovador aprova solicitações de **todas** as gerências ou apenas das gerências às quais está vinculado? Default assumido: todas.

---

## 7. Modelo de dados (schema Prisma)

> Snapshots: os itens guardam `valorHora` e `valorCalculado` **no momento da criação**, para que edições futuras nas tabelas de cargo/gerência não alterem retroativamente valores já solicitados.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "mysql"; url = env("DATABASE_URL") }

enum Perfil       { SOLICITADOR APROVADOR FOCAL ADMIN }
enum StatusUsuario{ PENDENTE ATIVO INATIVO }
enum TipoHe       { PCT_50 PCT_100 }
enum StatusItem   { PENDENTE_APROVACAO APROVADO RECUSADO }
enum Justificativa{
  B2B_AVANCADO CELULA_AGENDAMENTO_REGIONAL IMPLANTACAO PROJETOS_ESPECIAIS
  BACKOFFICE REPARO PRODUCAO MANUTENCAO_DE_REDES MOVEL O_E_M
}

model Usuario {
  id            Int          @id @default(autoincrement())
  username      String       @unique          // sAMAccountName do AD
  nome          String
  email         String?
  perfil        Perfil       @default(SOLICITADOR)
  status        StatusUsuario@default(PENDENTE)
  gerenciaId    Int?                            // opcional: vínculo do usuário
  gerencia      Gerencia?    @relation(fields: [gerenciaId], references: [id])
  criadoEm      DateTime     @default(now())
  atualizadoEm  DateTime     @updatedAt

  solicitacoes  Solicitacao[] @relation("SolicitanteSolic")
  decisoes      SolicitacaoItem[] @relation("AprovadorItem")
  auditorias    Auditoria[]
}

model Gerencia {
  id           Int      @id @default(autoincrement())
  nome         String   @unique
  valorLimite  Decimal  @db.Decimal(12,2)      // limite de saldo (soft limit)
  ativo        Boolean  @default(true)
  colaboradores Colaborador[]
  solicitacoes  Solicitacao[]
  usuarios      Usuario[]
}

model Cargo {
  id           Int      @id @default(autoincrement())
  nome         String   @unique
  valorHora    Decimal  @db.Decimal(12,2)      // valor por cargo (base do cálculo)
  ativo        Boolean  @default(true)
  colaboradores Colaborador[]
}

model Colaborador {
  id           Int      @id @default(autoincrement())
  matricula    String   @unique                // chave vinda do xlsx (confirmar)
  nome         String
  cargoId      Int
  cargo        Cargo    @relation(fields: [cargoId], references: [id])
  gerenciaId   Int
  gerencia     Gerencia @relation(fields: [gerenciaId], references: [id])
  ativo        Boolean  @default(true)
  itens        SolicitacaoItem[]
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt
}

model Solicitacao {
  id            Int       @id @default(autoincrement())
  protocolo     String    @unique               // ex.: HE-2026-000123
  gerenciaId    Int
  gerencia      Gerencia  @relation(fields: [gerenciaId], references: [id])
  solicitanteId Int
  solicitante   Usuario   @relation("SolicitanteSolic", fields: [solicitanteId], references: [id])
  observacao    String?
  criadoEm      DateTime  @default(now())
  atualizadoEm  DateTime  @updatedAt
  itens         SolicitacaoItem[]
}

model SolicitacaoItem {
  id             Int          @id @default(autoincrement())
  solicitacaoId  Int
  solicitacao    Solicitacao  @relation(fields: [solicitacaoId], references: [id], onDelete: Cascade)
  colaboradorId  Int
  colaborador    Colaborador  @relation(fields: [colaboradorId], references: [id])
  dataHe         DateTime     @db.Date          // dia da HE
  tipo           TipoHe
  horas          Decimal      @db.Decimal(5,2)
  justificativa  Justificativa
  // snapshots no momento da criação:
  valorHora      Decimal      @db.Decimal(12,2)
  valorCalculado Decimal      @db.Decimal(12,2)
  status         StatusItem   @default(PENDENTE_APROVACAO)
  aprovadorId    Int?
  aprovador      Usuario?     @relation("AprovadorItem", fields: [aprovadorId], references: [id])
  dataDecisao    DateTime?
  motivoRecusa   String?
  criadoEm       DateTime     @default(now())
  atualizadoEm   DateTime     @updatedAt

  @@index([colaboradorId, dataHe])
  @@index([status])
}

model HeExecutado {
  id            Int      @id @default(autoincrement())
  matricula     String
  nome          String?
  dataHe        DateTime @db.Date
  horas         Decimal  @db.Decimal(5,2)
  tipo          TipoHe?
  competencia   String                          // "2026-07"
  loteImportId  Int
  loteImport    LoteImportacao @relation(fields: [loteImportId], references: [id])
  @@index([matricula, dataHe])
}

model LoteImportacao {
  id           Int      @id @default(autoincrement())
  tipo         String                            // "COLABORADORES" | "HE_EXECUTADO"
  arquivoNome  String
  totalLinhas  Int
  inseridos    Int
  erros        Int
  detalheErros Json?
  usuarioId    Int
  criadoEm     DateTime @default(now())
  executados   HeExecutado[]
}

model Auditoria {
  id          Int      @id @default(autoincrement())
  usuarioId   Int?
  usuario     Usuario? @relation(fields: [usuarioId], references: [id])
  acao        String                             // LOGIN, CRIAR_SOLICITACAO, APROVAR, EDITAR_CARGO...
  entidade    String                             // Solicitacao, Cargo, Usuario...
  entidadeId  String?
  dadosAntes  Json?
  dadosDepois Json?
  ip          String?
  criadoEm    DateTime @default(now())
  @@index([entidade, entidadeId])
  @@index([criadoEm])
}
```

### Seed inicial (`prisma/seed.js`)
- 1 usuário `ADMIN` (o `DEV_USER`) com `status = ATIVO`.
- Enum de justificativas já embutido no schema (não precisa de tabela).
- Gerências e cargos: importar das suas duas tabelas (limite por gerência / valor por cargo). Deixar um seed de exemplo e um endpoint/painel para editar.

---

## 8. Regras de negócio

### 8.1 Cálculo do valor de um item
Fonte única de verdade em `utils/calculoHe.js`:

```
valorHora     = colaborador.cargo.valorHora            // snapshot
fator(tipo)   = tipo === PCT_50  ? 1.5
              : tipo === PCT_100 ? 2.0
valorCalculado = valorHora * horas * fator(tipo)
```

> **⚠️ Confirmar a fórmula.** Isto assume que `valorHora` na sua tabela de cargo é o **valor da hora normal** e que 50%/100% é o **adicional** de HE (→ ×1,5 / ×2,0). Se a sua tabela **já traz o valor da hora extra** (adicional embutido), então o fator deve ser `1.0` para ambos e o `tipo` vira só uma classificação. Mantenha essa decisão **isolada nessa função** para trocar em um só lugar.

### 8.2 Resumo de limite (mostrado na tela de nova solicitação)
Para a gerência selecionada:

```
valorLimite       = gerencia.valorLimite
valorJaSolicitado = Σ valorCalculado dos itens da gerência
                    WHERE status IN (PENDENTE_APROVACAO, APROVADO)
                    AND competência(dataHe) = competência atual
valorAposSolicitar = valorJaSolicitado + Σ valorCalculado dos itens desta solicitação
```

- **Não é trava**: se `valorAposSolicitar > valorLimite`, exibir **alerta visual** (badge vermelho + aviso), mas **permitir** o envio.
- `competência` = `YYYY-MM` derivada de `dataHe`. **A confirmar:** o limite é mensal (por competência) ou por outro ciclo? Default: mensal.

### 8.3 Status e transições
- Ao enviar → cada item nasce `PENDENTE_APROVACAO`.
- Aprovador define por item (ou em lote na tela de aprovações): `APROVADO` ou `RECUSADO` (com `motivoRecusa` obrigatório na recusa).
- Item `APROVADO` → imutável (não edita/exclui).
- Status "geral" da solicitação (derivado, para exibição):
  - todos aprovados → **Aprovado**
  - todos recusados → **Recusado**
  - mistura com pendentes → **Pendente**
  - mistura aprovados/recusados sem pendentes → **Concluído (parcial)**

### 8.4 Permissões de edição/exclusão
- Editar item: autor + item não aprovado.
- Excluir solicitação inteira: autor + nenhum item aprovado (senão, permitir excluir só os itens não aprovados).

---

## 9. Telas e fluxos

### 9.1 Login
- Campos: usuário, senha. Sem "lembrar senha".
- Mensagens de erro específicas (aguardando aprovação / desativado / credenciais inválidas).
- Em `development`, um aviso discreto "Modo DEV".

### 9.2 Nova Solicitação — o formulário dinâmico (núcleo do sistema)

Layout em uma página com 3 blocos:

**Bloco 1 — Cabeçalho da solicitação**
- `Gerência` — `Select` (dropdown). Ao escolher, dispara o cálculo do **Resumo de Limite** (Bloco 3) e filtra os colaboradores disponíveis para essa gerência.

**Bloco 2 — Colaboradores (lista dinâmica)**
Cada linha de colaborador é um "card" com:
- `Colaborador` — `Select` **pesquisável** (`showSearch`, busca por nome/matrícula), filtrado pela gerência.
- `Tipo` — toggle/radio `50%` | `100%`.
- `Horas` — input numérico (aceita decimais, ex. 2,5).
- `Justificativa` — `Select` com as opções fixas:
  `B2B AVANÇADO, CÉLULA AGENDAMENTO REGIONAL, IMPLANTAÇÃO, PROJETOS ESPECIAIS, BACKOFFICE, REPARO, PRODUÇÃO, MANUTENÇÃO DE REDES, MÓVEL, O&M`.
- **Datas / "Solicitar mais de um dia?"**: dentro do card há uma sub-lista de datas. Começa com 1 `DatePicker`. Botão **"+ Adicionar dia"** acrescenta outra data. Cada data gera **um item** (colaborador × data). Alternativa de UX: um `DatePicker multiple` (seleção de vários dias de uma vez) — recomendo oferecer os dois: seleção múltipla no calendário **e** o "+ dia" avulso.
- Botão **🗑 remover** o card do colaborador.

Abaixo da lista: botão **"+ Adicionar colaborador"** (o "+" que você descreveu) que adiciona outro card.

> **Expansão de itens:** a solicitação final é o produto cartesiano `colaboradores × datas`. Ex.: 2 colaboradores com 3 dias = 6 itens. Mostrar um contador "X itens serão gerados".

**Bloco 3 — Resumo de Limite (painel lateral fixo, atualiza ao vivo)**
```
Gerência: <nome>
Valor limite:        R$ 00.000,00
Valor já solicitado: R$ 00.000,00   (mês corrente)
Valor desta solic.:  R$ 00.000,00
────────────────────────────────
Valor após solicitar:R$ 00.000,00   [🔴 acima do limite / 🟢 dentro]
```
- Recalcula a cada alteração (debounce ~300ms) via `POST /api/solicitacoes/preview`.

**Ações**: `Salvar rascunho` (opcional), `Enviar` (cria a solicitação e todos os itens como `PENDENTE_APROVACAO`).

Validações: gerência obrigatória; ao menos 1 colaborador; cada colaborador com ≥1 data, tipo, horas>0 e justificativa.

### 9.3 Fila de Solicitações
- **Tabela** (antd `Table`) com colunas: Protocolo, Data solicitação, Gerência, Colaborador, Data HE, Tipo, Horas, Valor, Justificativa, Status, Solicitante, Ações.
- **Visão**: solicitador vê só as próprias; aprovador/focal/admin veem todas.
- **Filtros**: por status, gerência, colaborador, período (data HE / data solicitação), tipo, solicitante, justificativa. Busca livre por protocolo/nome.
- **Ações por linha** (respeitando permissões): Ver detalhe, Editar (se não aprovado e for autor), Excluir (idem).
- **Exportar** resultado filtrado para XLSX.
- Agrupamento opcional por protocolo (expandir para ver os itens).

### 9.4 Aprovações (perfil Aprovador/Admin)
- Tabela igual à fila, focada em itens `PENDENTE_APROVACAO`.
- Seleção múltipla (checkbox) → **Aprovar selecionados** / **Recusar selecionados** (modal pedindo `motivoRecusa`).
- Ação individual por linha também.
- Ao aprovar/recusar: registra `aprovadorId`, `dataDecisao`, grava auditoria.

### 9.5 Painel Admin
Sub-abas:
1. **Usuários** — tabela com filtro por status/perfil. Ações: aprovar cadastro pendente, editar (nome, perfil, gerência, status), desativar. Cadastro manual também.
2. **Cargos & Valores** — CRUD da tabela cargo→valorHora.
3. **Gerências & Limites** — CRUD da tabela gerência→valorLimite.
4. **Colaboradores** — CRUD + importação (compartilhado com Focal).
5. **Auditoria** — tabela read-only com filtros (usuário, ação, entidade, período), detalhe com `dadosAntes`/`dadosDepois` (diff em JSON).

### 9.6 Área do Focal
- **Colaboradores**: CRUD unitário + **importação em massa** via `colaboradores.xlsx`.
- **HE Executado**: upload de `base_he_executado.xlsx` → grava `HeExecutado` + tela de **reconciliação** (ver §11).
- **Auditoria**: consulta (read-only).

---

## 10. Menu lateral e navegação

Layout antd: `Sider` (recolhível) + `Header` (usuário logado, perfil, sair) + `Content`. Itens do menu **filtrados por perfil** (`menuConfig.js`):

```
◇ Dashboard                     (todos)
◇ Nova Solicitação              (todos)
◇ Solicitações                  (todos — próprias; aprov/focal/admin: todas)
◇ Aprovações            🔒      (APROVADOR, ADMIN)
◇ Colaboradores         🔒      (FOCAL, ADMIN)
◇ HE Executado          🔒      (FOCAL, ADMIN)
◇ Relatórios                    (APROVADOR, FOCAL, ADMIN)
▸ Administração         🔒      (ADMIN)
    • Usuários
    • Cargos & Valores
    • Gerências & Limites
    • Auditoria         (FOCAL vê como item próprio no menu do Focal)
◇ Sair
```

---

## 11. Sugestões de visões/dashboards (IA)

> Você pediu sugestão de visões — aqui vai o conjunto que recomendo. Priorize os itens marcados **[MVP]**.

### 11.1 Dashboard principal (home)
**Cards de KPI (topo)** [MVP]
- Valor total **solicitado** no mês.
- Valor total **aprovado** no mês.
- Valor **pendente de aprovação** (quantidade + R$).
- **% médio de consumo do limite** entre gerências.

**Gráficos**
- **Barras "Solicitado vs Limite por gerência"** [MVP] — barra do solicitado com linha/meta do limite; gerências acima do limite em vermelho. Responde direto à sua regra de saldo.
- **Rosca por status** (Pendente / Aprovado / Recusado).
- **Barras 50% vs 100%** (distribuição de horas por tipo).
- **Linha temporal** — valor de HE por dia/semana no mês.
- **Top 10 colaboradores** por horas/valor no período.
- **Distribuição por justificativa** (barras horizontais) — mostra onde a HE está concentrada (Reparo, Produção, etc.).

**Alertas** [MVP]
- Lista de gerências que **ultrapassaram** o limite no mês.
- Solicitações paradas há X dias sem decisão (SLA de aprovação).

### 11.2 Visão do Aprovador
- Fila de pendências com "envelhecimento" (dias parado), valor e impacto no limite da gerência — para priorizar decisões.

### 11.3 Visão do Focal — Reconciliação Solicitado × Executado [alto valor]
Cruzamento entre HE **aprovada** e `base_he_executado`:
- Tabela por colaborador/competência: `Horas Aprovadas`, `Horas Executadas`, `Diferença`, `Status` (OK / Executado a mais / Executado a menos / Executado sem aprovação).
- KPIs: **aderência** (% executado dentro do aprovado), total de horas "executadas sem solicitação aprovada", total aprovado não executado.
- Filtros por gerência, competência, colaborador. Exportação XLSX.
- Chave de cruzamento: `matricula + dataHe` (confirmar granularidade — por dia ou por competência).

### 11.4 Relatórios exportáveis
- HE por gerência / por cargo / por justificativa / por período.
- Todos com botão "Exportar XLSX" (ExcelJS, com cabeçalho e formatação de moeda).

---

## 12. Importação de planilhas

### 12.1 `colaboradores.xlsx`
Fluxo: upload → parse (SheetJS) → validação linha a linha → preview com erros → confirmar → gravar (`upsert` por `matricula`) → cria `LoteImportacao`.

**Colunas assumidas (CONFIRMAR com o arquivo real):**
| Coluna xlsx | Campo | Regra |
|---|---|---|
| Matrícula | `matricula` | obrigatório, único |
| Nome | `nome` | obrigatório |
| Cargo | `cargoId` | resolve por nome do cargo; se não existir → erro ou criar? (definir) |
| Gerência | `gerenciaId` | resolve por nome; idem |
| Ativo | `ativo` | opcional (default true) |

Regras: linhas inválidas não bloqueiam o lote inteiro — importa as válidas e reporta as com erro em `detalheErros`.

### 12.2 `base_he_executado.xlsx`
**Colunas assumidas (CONFIRMAR):** Matrícula, Nome, Data, Horas, Tipo (50/100), Competência.
- Grava em `HeExecutado` vinculado a um `LoteImportacao`.
- Alimenta a tela de **Reconciliação** (§11.3).

> **Importante:** assim que você me passar os dois arquivos reais (ou só os cabeçalhos), eu ajusto o mapeamento de colunas e as validações. Enquanto isso, o parser deve ler os cabeçalhos e mapear por **nome de coluna** (case-insensitive, sem acento), com um `columnMap` configurável.

---

## 13. API — endpoints

Todas sob `/api`, exigem sessão (exceto login). Respostas JSON padronizadas `{ data, error }`.

**Auth**
- `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`

**Solicitações**
- `POST /solicitacoes/preview` — recebe rascunho, retorna itens calculados + resumo de limite (sem gravar).
- `POST /solicitacoes` — cria solicitação + itens.
- `GET  /solicitacoes` — lista com filtros/paginação (respeita escopo por perfil).
- `GET  /solicitacoes/:id` — detalhe com itens.
- `PUT  /solicitacoes/:id` — edita (autor, não aprovada).
- `DELETE /solicitacoes/:id` — exclui (autor, sem itens aprovados).
- `PUT  /solicitacoes/itens/:itemId` — edita item.
- `DELETE /solicitacoes/itens/:itemId` — exclui item.
- `GET  /solicitacoes/export` — XLSX do resultado filtrado.

**Aprovações**
- `POST /aprovacoes/aprovar` — body `{ itemIds: [] }`.
- `POST /aprovacoes/recusar` — body `{ itemIds: [], motivo }`.

**Colaboradores**
- `GET/POST/PUT/DELETE /colaboradores`
- `GET /colaboradores/lookup?gerenciaId=&q=` — para o Select pesquisável.
- `POST /colaboradores/importar` (multipart) — preview/commit.

**Cargos / Gerências** (ADMIN)
- `GET/POST/PUT/DELETE /cargos`
- `GET/POST/PUT/DELETE /gerencias`

**Usuários** (ADMIN)
- `GET /usuarios` · `PUT /usuarios/:id` · `POST /usuarios/:id/aprovar` · `POST /usuarios` (cadastro manual)

**HE Executado** (FOCAL/ADMIN)
- `POST /he-executado/importar` (multipart)
- `GET  /he-executado/reconciliacao?gerenciaId=&competencia=`

**Dashboard**
- `GET /dashboard/kpis?competencia=`
- `GET /dashboard/series?tipo=por_gerencia|por_status|por_tipo|por_justificativa&competencia=`

**Auditoria** (FOCAL/ADMIN)
- `GET /auditoria` — filtros por usuário/ação/entidade/período.

---

## 14. Auditoria

- Middleware/serviço `registrarAuditoria(usuario, acao, entidade, id, antes, depois, ip)`.
- Registrar no mínimo: `LOGIN`, `LOGOUT`, `CRIAR/EDITAR/EXCLUIR_SOLICITACAO`, `APROVAR`, `RECUSAR`, `CRIAR/EDITAR_COLABORADOR`, `IMPORTAR_*`, `EDITAR_CARGO`, `EDITAR_GERENCIA`, `APROVAR_USUARIO`, `EDITAR_USUARIO`.
- `dadosAntes`/`dadosDepois` como JSON para diff.
- Tela de auditoria com diff lado a lado.

---

## 15. Roadmap de implementação (fases)

**Fase 0 — Fundação**
Monorepo, Prisma + migrations, seed, login AD + modo dev, sessão, layout com Sider, RBAC, `/auth/me`.

**Fase 1 — Cadastros base**
CRUD de cargos, gerências, colaboradores + importação de `colaboradores.xlsx`. Painel admin de usuários (aprovar/editar).

**Fase 2 — Solicitações (núcleo)**
Tela Nova Solicitação (form dinâmico multi-colaborador/multi-dia), `preview` de cálculo/limite, criação de itens, Fila de Solicitações com filtros e edição/exclusão por regra.

**Fase 3 — Aprovações**
Tela de aprovações, aprovar/recusar (individual e em lote), status derivado, auditoria dessas ações.

**Fase 4 — Focal & Reconciliação**
Import `base_he_executado`, tela de reconciliação solicitado×executado.

**Fase 5 — Dashboards & Relatórios**
KPIs, gráficos, exportações XLSX, alertas de limite/SLA.

**Fase 6 — Refino**
Auditoria completa, tratamento de erros, testes, ajustes de UX.

---

## 16. Pontos a confirmar (impactam o build)

1. **Fórmula do valor**: `valorHora` da tabela de cargo é a **hora normal** (→ ×1,5 / ×2,0) ou já é o **valor da HE**? *(§8.1)*
2. **Período do limite**: mensal por competência da data da HE, ou outro ciclo? E o "já solicitado" conta `PENDENTE + APROVADO` ou só `APROVADO`? *(§8.2)*
3. **Escopo do Aprovador**: aprova todas as gerências ou só as vinculadas a ele? *(§6)*
4. **Colunas reais** de `colaboradores.xlsx` e `base_he_executado.xlsx` (me mande os cabeçalhos). *(§12)*
5. **Cadastro de novos usuários**: qualquer pessoa do AD que loga vira "PENDENTE" aguardando aprovação, ou só quem está em um grupo AD específico entra? *(§5)*
6. **Granularidade da reconciliação**: casar por dia (`matricula+data`) ou por competência (`matricula+mês`)? *(§11.3)*
7. **Rascunho**: precisa salvar solicitação como rascunho antes de enviar, ou só "enviar" direto?
8. **Vínculo Solicitador ↔ Gerência**: um solicitador pode pedir para qualquer gerência ou só para a(s) dele(s)?
