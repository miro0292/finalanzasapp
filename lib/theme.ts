"use client";

import { useEffect, useState } from "react";

// Componentes que dibujan colores fuera de CSS (ej. recharts) necesitan saber
// el tema activo en JS. Un MutationObserver detecta el toggle sin acoplar
// este hook al componente que lo dispara.
export function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));

    const observer = new MutationObserver(() =>
      setIsDark(root.classList.contains("dark"))
    );
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}
