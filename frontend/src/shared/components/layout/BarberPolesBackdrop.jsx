// Fondo decorativo de mini postes de barbero semi-transparentes.
// - Franjas con el mismo movimiento que el GradientButton (background-position
//   por un tile exacto → bucle infinito perfecto, sincronizado en todos).
// - Reparto por grilla con jitter: una celda por poste (filas alternas
//   desplazadas media celda) para que queden bien distribuidos sin juntarse.
// - Deriva tipo partícula (bucle suave alrededor de su posición) con rango
//   acotado para que no se acerquen entre sí.
// - `variant="dark"` usa la paleta profunda del tema oscuro con el mismo
//   tamaño de poste que el tema claro.

// PRNG determinista basado en seno: misma distribución en cada render.
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Grilla 6x5: 30 postes, uno por celda con jitter para evitar amontonamientos
const COLS = 6;
const ROWS = 5;

// Posiciones y parámetros de animación de cada poste, precalculados una sola vez
// (jitter acotado a media celda y deriva/rotación limitadas para no solaparse).
const POLES = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;
  // Filas alternas desplazadas media celda → distribución diagonal orgánica
  const offsetX = (row % 2) * cellW * 0.5;
  const jitterX = (seededRandom(i * 13 + 1) - 0.5) * cellW * 0.5;
  const jitterY = (seededRandom(i * 17 + 2) - 0.5) * cellH * 0.5;

  return {
    top: `${(row * cellH + cellH / 2 + jitterY).toFixed(1)}%`,
    left: `${((((col * cellW + offsetX + cellW / 2 + jitterX) % 100) + 100) % 100).toFixed(1)}%`,
    size: 16 + Math.round(seededRandom(i * 19 + 3) * 14), // 16–30px
    opacity: +(0.22 + seededRandom(i * 23 + 4) * 0.16).toFixed(2), // 0.22–0.38
    blur: seededRandom(i * 29 + 5) < 0.35
      ? +(seededRandom(i * 31 + 6) * 1.6).toFixed(1)
      : 0,
    dur: +(10 + seededRandom(i * 37 + 7) * 14).toFixed(1), // 10–24s
    delay: +(-seededRandom(i * 41 + 8) * 20).toFixed(1), // negativo: repartidos
    range: Math.round(28 + seededRandom(i * 43 + 9) * 36), // 28–64px de deriva
    rot: Math.round(-10 + seededRandom(i * 47 + 10) * 20), // -10°..10°
  };
});

// Renderiza la grilla fija (pointer-events-none, aria-hidden). `variant` alterna
// la paleta clara/oscura (en dark baja opacidad y cambia el blur).
export default function BarberPolesBackdrop({ variant = 'light', className = '' }) {
  const isDark = variant === 'dark';

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {POLES.map((p, i) => {
        const size = p.size;
        const width = Math.max(4, Math.round(size * 0.34));
        const opacity = isDark ? +(p.opacity * 0.7).toFixed(2) : p.opacity;
        const blur = isDark
          ? (seededRandom(i * 53 + 11) < 0.3
            ? +(seededRandom(i * 59 + 12) * 1.2).toFixed(1)
            : 0)
          : p.blur;

        return (
          <div
            key={i}
            className="barber-pole-float"
            style={{
              top: p.top,
              left: p.left,
              opacity,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              '--range': `${p.range}px`,
              '--rot': `${p.rot}deg`,
            }}
          >
            <span
              className={`barber-pole${isDark ? ' barber-pole--dark' : ''}`}
              style={{
                width: `${width}px`,
                height: `${size}px`,
                filter: blur ? `blur(${blur}px)` : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
