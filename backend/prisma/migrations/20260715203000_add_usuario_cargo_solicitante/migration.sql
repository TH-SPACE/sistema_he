-- Add cargo from AD for access request workflow
ALTER TABLE `Usuario`
ADD COLUMN `cargoSolicitante` VARCHAR(191) NULL;
