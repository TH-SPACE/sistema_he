import React from "react";

// Título de página com um ícone ilustrado (SVGs da Vivo em /img_vivo).
export default function PageTitle({ icon, children, tamanhoIcone = 28 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {icon && <img src={`/img_vivo/${icon}`} alt="" style={{ width: tamanhoIcone, height: tamanhoIcone, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
