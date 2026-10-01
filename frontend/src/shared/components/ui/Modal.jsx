import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';

// Shell unificado de modal.
//
// Estructura garantizada (evita el bug de modales que no se pueden cerrar):
// - Overlay `fixed inset-0` con atributo `data-modal-overlay` → oculta el navbar.
// - Contenedor con `max-h-[90vh] flex flex-col`.
// - Header fijo (flex-shrink-0) con icono, título, subtítulo, slot derecho y cierre.
// - Cuerpo scrollable (`flex-1 overflow-y-auto min-h-0`).
// - Footer fijo opcional (flex-shrink-0).
//
// Color por función (prop `color`):
// - neutral  → modales informativos/neutros
// - blue     → gestión general (citas, servicios, inventario, métodos de pago)
// - red      → destructivo/dinero negativo (eliminar, reembolsar, ventas)
// - emerald  → dinero positivo (ventas, ingresos, caja)
// - amber    → advertencias/gastos
// - brand    → premium (roles, socios, fundadores)
//
// Uso:
//   <Modal isOpen={open} onClose={close} color="red" title="Gestionar Ventas"
//          subtitle="Reembolsos y anulaciones" icon={Minus} size="4xl"
//          footer={<Botones />}>
//     ...contenido...
//   </Modal>

// Tamaños predefinidos del panel (ancho máximo).
const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
};

// Niveles de apilamiento para modales anidados (alert > top > high > base).
const Z_LEVELS = {
  base: 'z-50',
  high: 'z-[9999]',
  top: 'z-[10001]',
  alert: 'z-[10003]',
};

// Paletas por color semántico: acento del panel, icono, caja del icono y título.
export const MODAL_COLORS = {
  neutral: {
    accentClassName: 'bg-[#151821] border-white/[0.10]',
    iconClassName: 'text-gray-300',
    iconBoxClassName: 'bg-white/[0.06] border-white/[0.10]',
    titleClassName: 'text-white',
  },
  blue: {
    accentClassName: 'bg-blue-500/5 border-blue-500/20',
    iconClassName: 'text-blue-400',
    iconBoxClassName: 'bg-blue-500/10 border-blue-500/20',
    titleClassName: 'text-blue-300',
  },
  red: {
    accentClassName: 'bg-red-500/5 border-red-500/20',
    iconClassName: 'text-red-400',
    iconBoxClassName: 'bg-red-500/10 border-red-500/20',
    titleClassName: 'text-red-300',
  },
  emerald: {
    accentClassName: 'bg-emerald-500/5 border-emerald-500/20',
    iconClassName: 'text-emerald-400',
    iconBoxClassName: 'bg-emerald-500/10 border-emerald-500/20',
    titleClassName: 'text-emerald-300',
  },
  amber: {
    accentClassName: 'bg-amber-500/5 border-amber-500/20',
    iconClassName: 'text-amber-400',
    iconBoxClassName: 'bg-amber-500/10 border-amber-500/20',
    titleClassName: 'text-amber-300',
  },
  brand: {
    accentClassName: 'bg-brand-500/5 border-brand-500/20',
    iconClassName: 'text-brand-300',
    iconBoxClassName: 'bg-brand-500/10 border-brand-500/20',
    titleClassName: 'text-brand-300',
  },
};

// Componente Modal.
// Props: isOpen/onClose (visibilidad y cierre), title/subtitle/icon (header),
// color (preset de MODAL_COLORS), size ('sm'..'6xl'), zIndex ('base'|'high'|'top'|'alert'),
// closeOnBackdrop/closeOnEsc, footer/headerExtra (slots) y overrides de clases.
export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  color = 'neutral',
  iconClassName,
  iconBoxClassName,
  size = 'md',
  zIndex = 'high',
  closeOnBackdrop = true,
  closeOnEsc = true,
  children,
  footer,
  headerExtra,
  className = '',
  bodyClassName = '',
  accentClassName,
}) => {
  // Bloquea scroll del body + oculta el navbar (clase modal-open)
  useBodyScrollLock(isOpen);

  // Cierra con Escape (desactivable vía closeOnEsc); el listener vive en document.
  const handleEsc = useCallback((event) => {
    if (event.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeOnEsc, handleEsc]);

  if (!isOpen) return null;

  const preset = MODAL_COLORS[color] || MODAL_COLORS.neutral;
  const accent = accentClassName || preset.accentClassName;
  const iconColor = iconClassName || preset.iconClassName;
  const iconBox = iconBoxClassName || preset.iconBoxClassName;

  return (
    <div
      data-modal-overlay
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      style={{ margin: 0 }}
      className={`fixed inset-0 m-0 bg-black/70 flex items-center justify-center p-2 sm:p-4 ${Z_LEVELS[zIndex] || Z_LEVELS.high}`}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose?.(); } : undefined}
    >
      <div className={`relative w-full ${SIZES[size] || SIZES.md} mx-auto max-h-[min(90dvh,calc(100dvh-1rem))] flex flex-col ${className}`}>
        <div
          data-modal-color={color}
          className={`modal-panel relative border rounded-2xl shadow-2xl shadow-soft flex flex-col overflow-hidden ${accent}`}
        >
          {/* Header fijo */}
          {(title || onClose) && (
            <div className="flex-shrink-0 flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                {Icon && (
                  <div className={`p-2 rounded-xl border flex-shrink-0 ${iconBox}`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                )}
                <div className="min-w-0">
                  {title && <h3 className={`text-base sm:text-lg font-semibold truncate ${preset.titleClassName || 'text-white'}`}>{title}</h3>}
                  {subtitle && <p className="text-xs sm:text-sm text-gray-400 truncate">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerExtra}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors duration-200"
                    aria-label="Cerrar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cuerpo scrollable (overscroll-contain: el scroll no encadena a la página) */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar overscroll-contain min-h-0 p-4 sm:p-6 ${bodyClassName}`}>
            {children}
          </div>

          {/* Footer fijo */}
          {footer && (
            <div className="flex-shrink-0 p-4 sm:p-6 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
