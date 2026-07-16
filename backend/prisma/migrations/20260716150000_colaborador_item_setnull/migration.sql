-- Allow deleting Colaborador without losing the historical SolicitacaoItem
-- record: colaboradorId becomes nullable and the FK is set to ON DELETE SET
-- NULL, mirroring the same pattern already used for Solicitacao.solicitanteId
-- (see 20260715211000_setnull_usuario_relations). colaboradorNomeSnapshot
-- keeps the display name after the FK is nulled out.
ALTER TABLE `SolicitacaoItem` DROP FOREIGN KEY `SolicitacaoItem_colaboradorId_fkey`;
ALTER TABLE `SolicitacaoItem` MODIFY `colaboradorId` INTEGER NULL;
ALTER TABLE `SolicitacaoItem`
  ADD CONSTRAINT `SolicitacaoItem_colaboradorId_fkey`
  FOREIGN KEY (`colaboradorId`) REFERENCES `Colaborador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
