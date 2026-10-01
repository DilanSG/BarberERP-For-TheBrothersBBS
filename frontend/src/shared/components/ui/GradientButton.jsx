import { useState } from 'react';

// Botón reutilizable con franjas de barber pole animadas (variant 'primary').
// Props: variant ('primary'|'secondary'|'outline'|'ghost'), size ('sm'..'xl'),
// loading/loadingText (spinner + bloquea interacción), disabled, `as` (permite
// renderizar <Link> u otra etiqueta), type y ...props hacia el elemento raíz.
const GradientButton = ({
  children,
  variant = 'primary',
  size = 'md',
  gradient = 'barber',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  loadingText = 'Cargando...',
  as: Component = 'button',
  ...props
}) => {
  // El hover se controla en JS porque la animación de las franjas se activa/desactiva aquí.
  const [isHovered, setIsHovered] = useState(false);
  
  // Tamaños: padding y tipografía de cada variante de tamaño.
  const sizes = {
    sm: 'text-sm px-4 py-2',
    md: 'text-base px-6 py-3',
    lg: 'text-xl px-8 py-4',
    xl: 'text-2xl px-10 py-5'
  };

  const sizeClass = sizes[size];

  return (
    <Component
      type={Component === 'button' ? type : undefined}
      onClick={onClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative isolate inline-flex items-center justify-center whitespace-nowrap
        rounded-2xl font-semibold tracking-wide 
        shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-slate-600/40
        outline-none transition-all duration-400 overflow-hidden
        active:scale-[0.98] focus:ring-3 focus:ring-blue-400/40
        bg-slate-600 min-w-fit
        ${sizeClass}
        ${disabled || loading 
          ? "opacity-60 cursor-not-allowed" 
          : "hover:shadow-[0_8px_20px_rgba(220,38,38,0.15)] hover:scale-[1.01]"
        }
        ${className}
      `}
      {...props}
    >
      {/* Texto del botón con spinner si está cargando */}
      <span className="relative z-10 flex items-center justify-center space-x-2">
        {loading && (
          <svg 
            className="animate-spin h-5 w-5 mr-2 text-white/90" 
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        
        <span className="relative">
          {variant === 'outline' ? (
            <span 
              className="font-extrabold bg-gradient-to-r from-red-400 via-white to-blue-400 bg-clip-text text-transparent"
            >
              {loading ? loadingText : children}
            </span>
          ) : (
            <span 
              className="font-bold tracking-wide"
              style={{
                color: '#1e293b',
                textShadow: `
                  0 1px 2px rgba(255, 255, 255, 0.3),
                  0 0 4px rgba(255, 255, 255, 0.2)
                `,
                filter: 'contrast(1.2)',
                letterSpacing: '0.02em'
              }}
            >
              {loading ? loadingText : children}
            </span>
          )}
        </span>
      </span>

      {/* Background para variant primary - Patrón sincronizado sin paneles */}
      {variant === 'primary' && (
        <>
          <span 
            aria-hidden 
            className="absolute inset-0 rounded-2xl"
            style={{
              background: `repeating-linear-gradient(
                -45deg,
                #a84949ff 0px,
                #e75757 12.5px,
                #dc2626 25px,
                #ffffff 25px,
                #ffffff 50px,
                #2563eb 50px,
                #4e7beb 62.5px,
                #2563eb 75px,
                #ffffff 75px,
                #ffffff 100px
              )`,
              backgroundSize: '141.42px 141.42px',
              animation: isHovered ? 'barberPoleSynced 3s linear infinite' : 'none',
              opacity: 0.95,
              border: '2px solid rgba(59, 130, 246, 0.6)',
              boxShadow: `
                0 0 15px rgba(59, 130, 246, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
              `
            }}
          >
            {/* Overlay mínimo para profundidad */}
            <span 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: `linear-gradient(
                  135deg,
                  rgba(0, 0, 0, 0.05) 0%,
                  transparent 50%,
                  rgba(255, 255, 255, 0.05) 100%
                )`,
                mixBlendMode: 'soft-light'
              }}
            />
          </span>
          
          {/* Animación CSS perfectamente sincronizada - Ángulo invertido */}
          <style>{`
            @keyframes barberPoleSynced {
              0% {
                background-position: 0px 0px;
              }
              100% {
                background-position: 141.42px 0px;
              }
            }
          `}</style>
        </>
      )}

      {/* Fondos alternativos para otras variantes */}
      {variant === 'secondary' && (
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-[#1a1f3c]/80 backdrop-blur-md" />
      )}

      {variant === 'outline' && (
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-transparent" />
      )}

      {variant === 'ghost' && (
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-white/5 backdrop-blur-md" />
      )}

      {/* Efecto de iluminación superior muy sutil */}
      <span aria-hidden className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <span 
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(
              to bottom,
              rgba(255, 255, 255, 0.08) 0%,
              rgba(255, 255, 255, 0.03) 40%,
              transparent 100%
            )`,
            transition: 'opacity 400ms ease',
            opacity: isHovered ? 0.7 : 0.5
          }}
        />
      </span>
    </Component>
  );
};

export default GradientButton;
