import React, { useState, useCallback, useEffect } from "react";
import { Select, Spin } from "antd";
import api from "../services/api";

let debounceTimer;

export default function SelectColaborador({ gerenteId, value, initialLabel, onChange }) {
  const [opcoes, setOpcoes] = useState(() => (value && initialLabel ? [{ value, label: initialLabel }] : []));
  const [buscando, setBuscando] = useState(false);

  // Ao restaurar um rascunho salvo, garante que o rótulo do colaborador já
  // selecionado apareça mesmo antes de qualquer busca.
  useEffect(() => {
    if (value && initialLabel) {
      setOpcoes((atual) => (atual.some((o) => o.value === value) ? atual : [{ value, label: initialLabel }, ...atual]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initialLabel]);

  const buscar = useCallback(
    (texto) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        setBuscando(true);
        try {
          const { data } = await api.get("/colaboradores/lookup", { params: { gerenteId, q: texto } });
          setOpcoes(
            data.data.map((c) => ({
              value: c.id,
              label: `${c.nome} — ${c.matricula} (${c.cargo.nome})`,
            }))
          );
        } finally {
          setBuscando(false);
        }
      }, 300);
    },
    [gerenteId]
  );

  return (
    <Select
      showSearch
      value={value}
      placeholder="Buscar colaborador por nome ou matrícula"
      filterOption={false}
      onSearch={buscar}
      onFocus={() => buscar("")}
      onChange={(v, option) => onChange(v, option)}
      notFoundContent={buscando ? <Spin size="small" /> : "Nenhum colaborador encontrado"}
      options={opcoes}
      style={{ width: "100%" }}
      disabled={!gerenteId}
    />
  );
}
