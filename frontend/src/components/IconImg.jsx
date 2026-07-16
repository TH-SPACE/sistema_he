import React from "react";

// Icone inline (SVGs de /img_vivo) do tamanho certo para uso dentro de
// Button/Tag do antd, no lugar dos icones do @ant-design/icons.
export default function IconImg({ icon, size = 14 }) {
  return <img src={`/img_vivo/${icon}`} alt="" style={{ width: size, height: size, verticalAlign: "-2px" }} />;
}
