-- CreateTable
CREATE TABLE `Gerente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `valorLimite` DECIMAL(12, 2) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Gerente_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cargo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `valorHora50` DECIMAL(12, 2) NOT NULL,
    `valorHora100` DECIMAL(12, 2) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cargo_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Colaborador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricula` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cargoId` INTEGER NOT NULL,
    `gerenteId` INTEGER NOT NULL,
    `gerencia` VARCHAR(191) NULL,
    `regional` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `gestorDireto` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Colaborador_matricula_key`(`matricula`),
    INDEX `Colaborador_gerenteId_idx`(`gerenteId`),
    INDEX `Colaborador_cargoId_idx`(`cargoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `perfil` ENUM('SOLICITADOR', 'APROVADOR', 'FOCAL', 'ADMIN') NOT NULL DEFAULT 'SOLICITADOR',
    `status` ENUM('PENDENTE', 'ATIVO', 'INATIVO') NOT NULL DEFAULT 'PENDENTE',
    `gerenteId` INTEGER NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Solicitacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `protocolo` VARCHAR(191) NOT NULL,
    `gerenteId` INTEGER NOT NULL,
    `solicitanteId` INTEGER NOT NULL,
    `observacao` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Solicitacao_protocolo_key`(`protocolo`),
    INDEX `Solicitacao_gerenteId_idx`(`gerenteId`),
    INDEX `Solicitacao_solicitanteId_idx`(`solicitanteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitacaoItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitacaoId` INTEGER NOT NULL,
    `colaboradorId` INTEGER NOT NULL,
    `dataHe` DATE NOT NULL,
    `tipo` ENUM('PCT_50', 'PCT_100') NOT NULL,
    `horas` DECIMAL(5, 2) NOT NULL,
    `justificativa` ENUM('B2B_AVANCADO', 'CELULA_AGENDAMENTO_REGIONAL', 'IMPLANTACAO', 'PROJETOS_ESPECIAIS', 'BACKOFFICE', 'REPARO', 'PRODUCAO', 'MANUTENCAO_DE_REDES', 'MOVEL', 'O_E_M') NOT NULL,
    `valorHora` DECIMAL(12, 2) NOT NULL,
    `valorCalculado` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDENTE_APROVACAO', 'APROVADO', 'RECUSADO') NOT NULL DEFAULT 'PENDENTE_APROVACAO',
    `aprovadorId` INTEGER NULL,
    `dataDecisao` DATETIME(3) NULL,
    `motivoRecusa` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `SolicitacaoItem_colaboradorId_dataHe_idx`(`colaboradorId`, `dataHe`),
    INDEX `SolicitacaoItem_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeExecutado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricula` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `dataHe` DATE NOT NULL,
    `horas` DECIMAL(6, 2) NOT NULL,
    `tipo` ENUM('PCT_50', 'PCT_100') NULL,
    `eventoOriginal` VARCHAR(191) NULL,
    `competencia` VARCHAR(191) NOT NULL,
    `loteImportId` INTEGER NOT NULL,

    INDEX `HeExecutado_matricula_dataHe_idx`(`matricula`, `dataHe`),
    INDEX `HeExecutado_competencia_idx`(`competencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoteImportacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(191) NOT NULL,
    `arquivoNome` VARCHAR(191) NOT NULL,
    `totalLinhas` INTEGER NOT NULL,
    `inseridos` INTEGER NOT NULL,
    `erros` INTEGER NOT NULL,
    `detalheErros` JSON NULL,
    `usuarioId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NULL,
    `dadosAntes` JSON NULL,
    `dadosDepois` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Auditoria_entidade_entidadeId_idx`(`entidade`, `entidadeId`),
    INDEX `Auditoria_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Colaborador` ADD CONSTRAINT `Colaborador_cargoId_fkey` FOREIGN KEY (`cargoId`) REFERENCES `Cargo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Colaborador` ADD CONSTRAINT `Colaborador_gerenteId_fkey` FOREIGN KEY (`gerenteId`) REFERENCES `Gerente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_gerenteId_fkey` FOREIGN KEY (`gerenteId`) REFERENCES `Gerente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitacao` ADD CONSTRAINT `Solicitacao_gerenteId_fkey` FOREIGN KEY (`gerenteId`) REFERENCES `Gerente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitacao` ADD CONSTRAINT `Solicitacao_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitacaoItem` ADD CONSTRAINT `SolicitacaoItem_solicitacaoId_fkey` FOREIGN KEY (`solicitacaoId`) REFERENCES `Solicitacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitacaoItem` ADD CONSTRAINT `SolicitacaoItem_colaboradorId_fkey` FOREIGN KEY (`colaboradorId`) REFERENCES `Colaborador`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitacaoItem` ADD CONSTRAINT `SolicitacaoItem_aprovadorId_fkey` FOREIGN KEY (`aprovadorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeExecutado` ADD CONSTRAINT `HeExecutado_loteImportId_fkey` FOREIGN KEY (`loteImportId`) REFERENCES `LoteImportacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoteImportacao` ADD CONSTRAINT `LoteImportacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Auditoria` ADD CONSTRAINT `Auditoria_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

