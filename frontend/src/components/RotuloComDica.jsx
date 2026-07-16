import React from "react";
import { Space, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";

// Rótulo com um ícone de interrogação ao lado, mostrando uma dica ao passar
// o mouse — pensado para usuários que não conhecem o sistema.
export default function RotuloComDica({ children, dica }) {
  return (
    <Space size={4}>
      <span>{children}</span>
      <Tooltip title={dica}>
        <QuestionCircleOutlined style={{ color: "var(--he-text-muted)", cursor: "help" }} />
      </Tooltip>
    </Space>
  );
}
