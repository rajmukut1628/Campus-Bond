import { useEffect, useState } from "react";
const key = "nub-connect-theme";
export function applyTheme(theme) {
  const value = ["blue", "light"].includes(theme) ? "blue" : "dark";
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "blue" ? "#09152b" : "#09141c");
  try { localStorage.setItem(key, value); } catch {}
  window.dispatchEvent(new Event("nub-theme-change"));
}
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme || "dark");
    const sync = event => { if (event.key === key) applyTheme(event.newValue); };
    window.addEventListener("nub-theme-change", update);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("nub-theme-change", update); window.removeEventListener("storage", sync); };
  }, []);
  return { theme, toggleTheme: () => applyTheme(theme === "dark" ? "blue" : "dark") };
}
