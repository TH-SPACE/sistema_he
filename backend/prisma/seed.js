require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { parseSheet } = require("../src/utils/xlsx");

const prisma = new PrismaClient();

const ROOT = path.join(__dirname, "..", "..");

async function seedAdmin() {
  const username = process.env.DEV_USER || "admin@local";
  await prisma.usuario.upsert({
    where: { username },
    update: {},
    create: {
      username,
      nome: "Administrador",
      email: username.includes("@") ? username : null,
      perfil: "ADMIN",
      status: "ATIVO",
    },
  });
  console.log(`Usuário admin garantido: ${username}`);
}

async function seedCargos() {
  const filePath = path.join(ROOT, "CARGO_VALOR.xlsx");
  if (!fs.existsSync(filePath)) return console.log("CARGO_VALOR.xlsx não encontrado, pulando seed de cargos");

  const buffer = fs.readFileSync(filePath);
  const { rows } = parseSheet(buffer);
  let count = 0;
  for (const row of rows) {
    const nome = String(row.CARGO ?? "").trim();
    const v50 = Number(row["HE 50% (R$)"]);
    const v100 = Number(row["HE 100% (R$)"]);
    if (!nome || Number.isNaN(v50) || Number.isNaN(v100)) continue;
    await prisma.cargo.upsert({
      where: { nome },
      update: { valorHora50: v50, valorHora100: v100 },
      create: { nome, valorHora50: v50, valorHora100: v100 },
    });
    count++;
  }
  console.log(`Cargos importados/atualizados: ${count}`);
}

async function seedGerentes() {
  const filePath = path.join(ROOT, "VALOR_GERENTES.xlsx");
  if (!fs.existsSync(filePath)) return console.log("VALOR_GERENTES.xlsx não encontrado, pulando seed de gerentes");

  const buffer = fs.readFileSync(filePath);
  const { rows } = parseSheet(buffer);
  let count = 0;
  for (const row of rows) {
    const nome = String(row.GERENTES ?? "").trim();
    const limite = Number(row["VALOR LIMITE (R$)"]);
    if (!nome || Number.isNaN(limite)) continue;
    await prisma.gerente.upsert({
      where: { nome },
      update: { valorLimite: limite },
      create: { nome, valorLimite: limite },
    });
    count++;
  }
  console.log(`Gerentes importados/atualizados: ${count}`);
}

async function seedColaboradores() {
  const filePath = path.join(ROOT, "COLABORADORES.xlsx");
  if (!fs.existsSync(filePath)) return console.log("COLABORADORES.xlsx não encontrado, pulando seed de colaboradores");

  const buffer = fs.readFileSync(filePath);
  const { rows } = parseSheet(buffer);

  const cargos = await prisma.cargo.findMany();
  const gerentes = await prisma.gerente.findMany();
  const cargoPorNome = new Map(cargos.map((c) => [c.nome.trim().toUpperCase(), c]));
  const gerentePorNome = new Map(gerentes.map((g) => [g.nome.trim().toUpperCase(), g]));

  let count = 0;
  let semCargo = 0;
  let semGerente = 0;

  for (const row of rows) {
    const matricula = String(row.MATRICULA ?? "").trim();
    const nome = String(row.NOME ?? "").trim();
    if (!matricula || !nome) continue;

    const cargo = cargoPorNome.get(String(row.CARGO ?? "").trim().toUpperCase());
    const gerente = gerentePorNome.get(String(row.GERENTE ?? "").trim().toUpperCase());
    if (!cargo) { semCargo++; continue; }
    if (!gerente) { semGerente++; continue; }

    const data = {
      matricula,
      nome,
      cargoId: cargo.id,
      gerenteId: gerente.id,
      gerencia: row.GERENCIA ? String(row.GERENCIA).trim() : null,
      regional: row.REGIONAL ? String(row.REGIONAL).trim() : null,
      estado: row.ESTADO ? String(row.ESTADO).trim() : null,
      cidade: row.CIDADE ? String(row.CIDADE).trim() : null,
      gestorDireto: row.GESTOR_DIRETO ? String(row.GESTOR_DIRETO).trim() : null,
    };

    await prisma.colaborador.upsert({
      where: { matricula },
      update: data,
      create: { ...data, ativo: true },
    });
    count++;
  }
  console.log(`Colaboradores importados/atualizados: ${count} (sem cargo: ${semCargo}, sem gerente: ${semGerente})`);
}

async function main() {
  await seedAdmin();
  await seedCargos();
  await seedGerentes();
  await seedColaboradores();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
