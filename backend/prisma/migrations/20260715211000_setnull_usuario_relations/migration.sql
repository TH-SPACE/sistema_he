-- Allow deleting Usuario without reassignment by setting FK references to NULL
ALTER TABLE `Solicitacao` DROP FOREIGN KEY `Solicitacao_solicitanteId_fkey`;
ALTER TABLE `Solicitacao` MODIFY `solicitanteId` INTEGER NULL;
ALTER TABLE `Solicitacao`
  ADD CONSTRAINT `Solicitacao_solicitanteId_fkey`
  FOREIGN KEY (`solicitanteId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LoteImportacao` DROP FOREIGN KEY `LoteImportacao_usuarioId_fkey`;
ALTER TABLE `LoteImportacao` MODIFY `usuarioId` INTEGER NULL;
ALTER TABLE `LoteImportacao`
  ADD CONSTRAINT `LoteImportacao_usuarioId_fkey`
  FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
