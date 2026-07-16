import React from "react";
import { Empty } from "antd";

export default function EmptyState({ description = "Nenhum registro encontrado" }) {
  return (
    <Empty
      image="/img_vivo/vivo-chat-duvida-cinza-centro-320x320.svg"
      styles={{ image: { height: 80 } }}
      description={description}
    />
  );
}
