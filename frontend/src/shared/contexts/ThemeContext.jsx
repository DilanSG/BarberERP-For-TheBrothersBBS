import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

// Tema claro / oscuro.
// - El tema por defecto es 'dark' (diseño original).
// - La preferencia se persiste en localStorage ('tbb-theme').
// - La clase `light` se aplica a <html>; el CSS de `styles/theme-light.css`
// sobreescribe las utilidades de Tailwind para el tema claro.

const STORAGE_KEY = 'tbb-theme';
const ThemeContext = createContext(null);

// Resuelve el tema inicial: ?theme=... fuerza uno, si no lee localStorage.
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  try {
    // Permite forzar el tema vía ?theme=light|dark (testing / enlaces directos)
    const forced = new URLSearchParams(window.location.search).get('theme');
    if (forced === 'light' || forced === 'dark') return forced;
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

const THEME_COLORS = {
  dark: '#111318',
  light: '#f4f5f7',
};

// Provider del tema: aplica clases/data-attributes en <html>, persiste la
// preferencia y actualiza el meta theme-color. Valor: { theme, setTheme,
// toggleTheme, isDark, isLight }.
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const isLight = theme === 'light';

    root.classList.toggle('light', isLight);
    root.classList.toggle('dark', !isLight);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage no disponible (modo privado, etc.)
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark', isLight: theme === 'light' }),
    [theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Hook de acceso al tema; lanza error si se usa fuera de ThemeProvider
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
};

export default ThemeContext;
