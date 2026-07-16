import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "he_tema";

export function ThemeProvider({ children }) {
  const [modoEscuro, setModoEscuro] = useState(() => localStorage.getItem(STORAGE_KEY) === "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", modoEscuro ? "dark" : "light");
    localStorage.setItem(STORAGE_KEY, modoEscuro ? "dark" : "light");
  }, [modoEscuro]);

  function alternar() {
    setModoEscuro((atual) => !atual);
  }

  return <ThemeContext.Provider value={{ modoEscuro, alternar }}>{children}</ThemeContext.Provider>;
}

export function useTema() {
  return useContext(ThemeContext);
}
