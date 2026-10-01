import React from 'react';

// Toggle switch reutilizable (theme-aware) inspirado en GradientButton:
// cuando está activo, la pista muestra las franjas de barber pole en
// movimiento con un borde/glow del color elegido.
//
// Uso:
// <ToggleSwitch
// checked={form.isActive}
// onChange={(checked) => setForm(prev => ({ ...prev, isActive: checked }))}
// label="Servicio activo"
// description="Visible para reservar"
// icon={Scissors}
// color="blue" | "emerald" | "amber" | "red" | "brand"
// />
//
// Props: checked/onChange (controlado), label/description/icon, color, disabled, id.
// Accesibilidad: label envuelve un <input type="checkbox"> real (sr-only) y los
// estilos usan selectores `peer-checked:*`, por lo que el foco/teclado quedan intactos.

// Estilos del estado activo (borde + glow) por color semántico.
const CHECKED_STYLES = {
  blue: 'peer-checked:border-blue-500/60 peer-checked:shadow-[0_0_10px_rgba(59,130,246,0.40)]',
  emerald: 'peer-checked:border-emerald-500/60 peer-checked:shadow-[0_0_10px_rgba(16,185,129,0.40)]',
  amber: 'peer-checked:border-amber-500/60 peer-checked:shadow-[0_0_10px_rgba(245,158,11,0.40)]',
  red: 'peer-checked:border-red-500/60 peer-checked:shadow-[0_0_10px_rgba(239,68,68,0.40)]',
  brand: 'peer-checked:border-brand-500/60 peer-checked:shadow-[0_0_10px_rgba(198,166,100,0.40)]',
};

const ToggleSwitch = ({
  checked = false,
  onChange,
  label,
  description,
  icon: Icon,
  color = 'blue',
  disabled = false,
  id,
  className = '',
}) => {
  const checkedStyle = CHECKED_STYLES[color] || CHECKED_STYLES.blue;

  return (
    <label
      htmlFor={id}
      className={`flex min-h-11 items-center justify-between gap-3 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-gray-400" />}
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-gray-300">{label}</span>}
          {description && <span className="block text-xs text-gray-500">{description}</span>}
        </span>
      </span>

      <span className="relative inline-flex flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />

        {/* Pista base */}
        <span className="block h-6 w-11 rounded-full border border-white/[0.12] bg-white/10 transition-colors duration-200" />

        {/* Franjas barber pole (activo) */}
        <span
          aria-hidden
          className={`toggle-switch-stripes pointer-events-none absolute inset-0 rounded-full border border-transparent opacity-0 transition-opacity duration-300 peer-checked:opacity-100 ${checkedStyle}`}
        />

        {/* Pulgar */}
        <span className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white ring-1 ring-black/10 shadow-md transition-all duration-200 peer-checked:translate-x-5 peer-checked:ring-black/40 peer-checked:shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_0_8px_rgba(0,0,0,0.65),0_2px_4px_rgba(0,0,0,0.45)]" />
      </span>
    </label>
  );
};

export default ToggleSwitch;
