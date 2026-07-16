-- Snapshot fields for names, reducing dependency on joins for display/history
ALTER TABLE `Solicitacao`
  ADD COLUMN `gerenteNomeSnapshot` VARCHAR(191) NULL,
  ADD COLUMN `solicitanteNomeSnapshot` VARCHAR(191) NULL;

ALTER TABLE `SolicitacaoItem`
  ADD COLUMN `colaboradorNomeSnapshot` VARCHAR(191) NULL;
