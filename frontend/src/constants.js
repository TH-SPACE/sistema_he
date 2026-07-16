export const JUSTIFICATIVAS = [
  { value: "B2B_AVANCADO", label: "B2B Avançado" },
  { value: "CELULA_AGENDAMENTO_REGIONAL", label: "Célula Agendamento Regional" },
  { value: "IMPLANTACAO", label: "Implantação" },
  { value: "PROJETOS_ESPECIAIS", label: "Projetos Especiais" },
  { value: "BACKOFFICE", label: "Backoffice" },
  { value: "REPARO", label: "Reparo" },
  { value: "PRODUCAO", label: "Produção" },
  { value: "MANUTENCAO_DE_REDES", label: "Manutenção de Redes" },
  { value: "MOVEL", label: "Móvel" },
  { value: "O_E_M", label: "O&M" },
];

export const STATUS_ITEM = {
  PENDENTE_APROVACAO: { label: "Pendente", color: "gold" },
  APROVADO: { label: "Aprovado", color: "green" },
  RECUSADO: { label: "Recusado", color: "red" },
};

export const STATUS_GERAL = {
  PENDENTE: { label: "Pendente", color: "gold" },
  APROVADO: { label: "Aprovado", color: "green" },
  RECUSADO: { label: "Recusado", color: "red" },
  CONCLUIDO_PARCIAL: { label: "Concluído (parcial)", color: "blue" },
};

export const formatadorMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
