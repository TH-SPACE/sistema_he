import React, { useEffect, useMemo, useState, useRef } from "react";
import { Row, Col, Card, Select, Button, Radio, InputNumber, DatePicker, Space, Typography, message, Modal, Tooltip, Popover } from "antd";
import { PlusOutlined, DeleteOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import SelectColaborador from "../components/SelectColaborador";
import ResumoLimite from "../components/ResumoLimite";
import PageTitle from "../components/PageTitle";
import RotuloComDica from "../components/RotuloComDica";
import { JUSTIFICATIVAS } from "../constants";

const RASCUNHO_KEY = "he_rascunho_nova_solicitacao";

let novoId = 0;
let novoDataId = 0;
function novaData() {
  return { id: ++novoDataId, data: null, tipo: "PCT_50", horas: 1 };
}
function linhaVazia() {
  return { key: ++novoId, colaboradorId: null, colaboradorNome: null, justificativa: null, datas: [novaData()] };
}

function rascunhoTemConteudo(gerenteId, linhas) {
  return !!gerenteId || linhas.some((l) => l.colaboradorId || l.justificativa || l.datas.some((d) => d.data));
}

function salvarRascunho(gerenteId, linhas) {
  if (!rascunhoTemConteudo(gerenteId, linhas)) {
    localStorage.removeItem(RASCUNHO_KEY);
    return;
  }
  const serializado = {
    gerenteId,
    linhas: linhas.map((l) => ({ ...l, datas: l.datas.map((d) => ({ ...d, data: d.data ? d.data.format("YYYY-MM-DD") : null })) })),
  };
  localStorage.setItem(RASCUNHO_KEY, JSON.stringify(serializado));
}

function lerRascunho() {
  try {
    const raw = localStorage.getItem(RASCUNHO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const linhas = parsed.linhas.map((l) => ({ ...l, datas: l.datas.map((d) => ({ ...d, data: d.data ? dayjs(d.data) : null })) }));
    if (!rascunhoTemConteudo(parsed.gerenteId, linhas)) return null;
    return { gerenteId: parsed.gerenteId, linhas };
  } catch {
    return null;
  }
}


export default function NovaSolicitacao() {
  const navigate = useNavigate();
  const [gerentes, setGerentes] = useState([]);
  const [gerenteId, setGerenteId] = useState(null);
  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [preview, setPreview] = useState(null);
  const [resumoBase, setResumoBase] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const prontoParaSalvar = useRef(false);
  const verificouRascunho = useRef(false);

  useEffect(() => {
    api.get("/gerentes", { params: { ativo: true } }).then(({ data }) => setGerentes(data.data));
  }, []);

  // Ao entrar na tela, verifica se há um rascunho salvo (de uma queda de
  // conexão ou atualização de página) e pergunta se o usuário quer retomar.
  // Guarda com um ref porque o React.StrictMode roda os efeitos de montagem
  // duas vezes em desenvolvimento, o que sem essa proteção abria o mesmo
  // Modal.confirm duas vezes (um diálogo "escondido" atrás do outro).
  useEffect(() => {
    if (verificouRascunho.current) return;
    verificouRascunho.current = true;
    const rascunho = lerRascunho();
    if (rascunho) {
      Modal.confirm({
        title: "Você começou uma solicitação",
        content: "Encontramos uma solicitação que você estava preenchendo e não chegou a enviar. Deseja continuar de onde parou?",
        okText: "Continuar solicitação",
        cancelText: "Começar do zero",
        onOk: () => {
          setGerenteId(rascunho.gerenteId);
          setLinhas(rascunho.linhas.length ? rascunho.linhas : [linhaVazia()]);
          prontoParaSalvar.current = true;
        },
        onCancel: () => {
          localStorage.removeItem(RASCUNHO_KEY);
          prontoParaSalvar.current = true;
        },
      });
    } else {
      prontoParaSalvar.current = true;
    }
  }, []);

  useEffect(() => {
    if (!prontoParaSalvar.current) return;
    salvarRascunho(gerenteId, linhas);
  }, [gerenteId, linhas]);

  // Assim que o gerente é escolhido, já busca o resumo do limite dele (sem
  // nenhum colaborador ainda) para mostrar o Resumo de Limite de imediato —
  // o preview completo (com o valor desta solicitação) substitui isso assim
  // que o usuário preencher pelo menos um colaborador.
  useEffect(() => {
    if (!gerenteId) {
      setResumoBase(null);
      return;
    }
    let ativo = true;
    api
      .get("/solicitacoes/resumo-limite", { params: { gerenteId } })
      .then(({ data }) => { if (ativo) setResumoBase(data.data); })
      .catch(() => { if (ativo) setResumoBase(null); });
    return () => { ativo = false; };
  }, [gerenteId]);

  const payload = useMemo(() => {
    if (!gerenteId) return null;
    const colaboradores = linhas
      .filter((l) => l.colaboradorId && l.justificativa && l.datas.some((d) => d.data && d.horas > 0))
      .map((l) => ({
        colaboradorId: l.colaboradorId,
        tipo: l.tipo,
        justificativa: l.justificativa,
        datas: l.datas
          .filter((d) => d.data && d.horas > 0)
          .map((d) => ({ data: d.data.format("YYYY-MM-DD"), tipo: d.tipo, horas: d.horas })),
      }));
    if (colaboradores.length === 0) return null;
    return { gerenteId, colaboradores };
  }, [gerenteId, linhas]);

  useEffect(() => {
    if (!payload) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post("/solicitacoes/preview", payload);
        setPreview(data.data);
      } catch (err) {
        message.error(err.message);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [payload]);

  function atualizarLinha(key, campo, valor) {
    setLinhas((atual) => atual.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function atualizarColaborador(key, value, option) {
    setLinhas((atual) =>
      atual.map((l) => (l.key === key ? { ...l, colaboradorId: value, colaboradorNome: option?.label || null } : l))
    );
  }

  function adicionarColaborador() {
    setLinhas((atual) => [...atual, linhaVazia()]);
  }

  function removerColaborador(key) {
    setLinhas((atual) => atual.filter((l) => l.key !== key));
  }

  function adicionarData(linhaKey) {
    setLinhas((atual) => atual.map((l) => (l.key === linhaKey ? { ...l, datas: [...l.datas, novaData()] } : l)));
  }

  function removerData(linhaKey, dataId) {
    setLinhas((atual) =>
      atual.map((l) => {
        if (l.key !== linhaKey) return l;
        const datas = l.datas.filter((d) => d.id !== dataId);
        return { ...l, datas: datas.length ? datas : [novaData()] };
      })
    );
  }

  function atualizarData(linhaKey, dataId, campo, valor) {
    setLinhas((atual) =>
      atual.map((l) =>
        l.key === linhaKey ? { ...l, datas: l.datas.map((d) => (d.id === dataId ? { ...d, [campo]: valor } : d)) } : l
      )
    );
  }

  async function enviar() {
    if (!payload) {
      message.warning("Preencha ao menos um colaborador com data, tipo, horas e justificativa");
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post("/solicitacoes", payload);
      localStorage.removeItem(RASCUNHO_KEY);
      message.success(`Solicitação ${data.data.protocolo} criada com sucesso`);
      navigate("/solicitacoes");
    } catch (err) {
      message.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Row gutter={16}>
      <Col span={17}>
        <Card
          title={
            <Space size={8}>
              <PageTitle icon="vivo-formulario-folha-lapis-purpura-esquerda-320x320.svg">Nova Solicitação de Horas Extras</PageTitle>
              <Popover
                trigger="click"
                title="Como preencher"
                content={
                  <div style={{ maxWidth: 320, fontWeight: 400 }}>
                    Escolha o gerente responsável pela equipe, depois adicione um ou mais colaboradores. Para cada colaborador,
                    informe a justificativa e depois, para cada dia trabalhado, selecione a data, o tipo (50% ou 100%) e a
                    quantidade de horas — use o + para adicionar outros dias, cada um pode ter um tipo e uma quantidade de horas
                    diferente. O resumo ao lado mostra o valor calculado em tempo real.
                  </div>
                }
              >
                <QuestionCircleOutlined style={{ color: "var(--he-text-muted)", cursor: "pointer", fontSize: 16 }} />
              </Popover>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <div>
              <Typography.Text strong>
                <RotuloComDica dica="O gerente define o limite mensal de horas extras que será consumido por esta solicitação.">
                  Gerente
                </RotuloComDica>
              </Typography.Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: "100%", marginTop: 4 }}
                placeholder="Selecione o gerente responsável"
                value={gerenteId}
                onChange={(v) => {
                  setGerenteId(v);
                  setLinhas([linhaVazia()]);
                }}
                options={gerentes.map((g) => ({ value: g.id, label: g.nome }))}
              />
            </div>
          </Space>
        </Card>

        {linhas.map((linha, idx) => (
          <Card
            key={linha.key}
            size="small"
            title={`Colaborador ${idx + 1}`}
            extra={
              linhas.length > 1 && (
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removerColaborador(linha.key)} />
              )
            }
            style={{ marginBottom: 12 }}
          >
            <Row gutter={12}>
              <Col span={24} style={{ marginBottom: 12 }}>
                <SelectColaborador
                  gerenteId={gerenteId}
                  value={linha.colaboradorId}
                  initialLabel={linha.colaboradorNome}
                  onChange={(v, option) => atualizarColaborador(linha.key, v, option)}
                />
              </Col>
              <Col span={24}>
                <Typography.Text type="secondary">
                  <RotuloComDica dica="Motivo da hora extra. Usado para relatórios e para entender onde a HE está sendo mais utilizada.">
                    Justificativa
                  </RotuloComDica>
                </Typography.Text>
                <Select
                  style={{ width: "100%", marginTop: 4 }}
                  placeholder="Selecione"
                  value={linha.justificativa}
                  onChange={(v) => atualizarLinha(linha.key, "justificativa", v)}
                  options={JUSTIFICATIVAS}
                />
              </Col>
              <Col span={24} style={{ marginTop: 12 }}>
                <Typography.Text type="secondary">
                  <RotuloComDica dica="Cada linha é um dia de HE com seu próprio tipo (50% ou 100%) e quantidade de horas. Clique no + para adicionar outro dia.">
                    Datas, tipo e horas da HE
                  </RotuloComDica>
                </Typography.Text>
                <Row gutter={8} style={{ marginTop: 4 }}>
                  <Col span={7}><Typography.Text type="secondary" style={{ fontSize: 12 }}>Data</Typography.Text></Col>
                  <Col span={8}><Typography.Text type="secondary" style={{ fontSize: 12 }}>Tipo</Typography.Text></Col>
                  <Col span={5}><Typography.Text type="secondary" style={{ fontSize: 12 }}>Horas</Typography.Text></Col>
                </Row>
                <Space direction="vertical" style={{ width: "100%", marginTop: 4 }} size={8}>
                  {linha.datas.map((d) => (
                    <Row gutter={8} key={d.id} align="middle">
                      <Col span={7}>
                        <DatePicker
                          style={{ width: "100%" }}
                          format="DD/MM/YYYY"
                          placeholder="Data"
                          value={d.data}
                          onChange={(v) => atualizarData(linha.key, d.id, "data", v)}
                          disabledDate={(data) => linha.datas.some((outra) => outra.id !== d.id && outra.data && outra.data.isSame(data, "day"))}
                        />
                      </Col>
                      <Col span={8}>
                        <Radio.Group
                          value={d.tipo}
                          onChange={(e) => atualizarData(linha.key, d.id, "tipo", e.target.value)}
                          style={{ display: "flex" }}
                        >
                          <Radio.Button value="PCT_50" style={{ flex: 1, textAlign: "center" }}>50%</Radio.Button>
                          <Radio.Button value="PCT_100" style={{ flex: 1, textAlign: "center" }}>100%</Radio.Button>
                        </Radio.Group>
                      </Col>
                      <Col span={5}>
                        <InputNumber
                          min={0.5}
                          step={0.5}
                          style={{ width: "100%" }}
                          placeholder="Horas"
                          value={d.horas}
                          onChange={(v) => atualizarData(linha.key, d.id, "horas", v)}
                        />
                      </Col>
                      <Col span={4}>
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          disabled={linha.datas.length === 1}
                          onClick={() => removerData(linha.key, d.id)}
                        />
                      </Col>
                    </Row>
                  ))}
                </Space>
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => adicionarData(linha.key)} style={{ marginTop: 8 }}>
                  Adicionar data
                </Button>
              </Col>
            </Row>
          </Card>
        ))}

        <Button type="dashed" icon={<PlusOutlined />} onClick={adicionarColaborador} block style={{ marginBottom: 16 }}>
          Adicionar colaborador
        </Button>

        <Card>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button type="primary" size="large" loading={enviando} onClick={enviar}>
              Enviar solicitação
            </Button>
          </Space>
        </Card>
      </Col>

      <Col span={7}>
        <ResumoLimite resumo={preview?.resumo || resumoBase} totalItens={preview?.itens?.length || 0} />
        {preview?.itens?.length > 0 && (
          <Card title="Itens que serão gerados" size="small" style={{ marginTop: 16 }}>
            {preview.itens.map((i, idx) => (
              <div key={idx} style={{ fontSize: 12, marginBottom: 4 }}>
                {i.colaboradorNome} — {dayjs(i.dataHe).format("DD/MM/YYYY")} — {i.tipo === "PCT_50" ? "50%" : "100%"} — {i.horas}h
              </div>
            ))}
          </Card>
        )}
      </Col>
    </Row>
  );
}
