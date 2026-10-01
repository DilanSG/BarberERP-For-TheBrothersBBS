import React from 'react';

// Componente reutilizable para texto con gradiente.
// Props: children (texto), className (extra), gradient (preset de la tabla de abajo),
// customGradient (clases from-/via-/to- completas que anulan el preset) y
// as (etiqueta a renderizar, por defecto 'span').
const GradientText = ({ 
  children, 
  className = '', 
  gradient = 'primary',
  customGradient,
  as: Component = 'span',
  ...props 
}) => {
  // Gradientes de barbería clásica - rojo, blanco, azul con toques metálicos
  // (predefinidos; `customGradient` tiene prioridad sobre ellos).
  const gradients = {
    // Gradiente principal - como letrero de barbería clásico
    primary: 'from-red-600 via-white to-blue-600',
    // Versión invertida
    secondary: 'from-blue-600 via-white to-red-600',
    // Con efecto metálico sutil
    metallic: 'from-slate-400 via-red-500 via-white via-blue-500 to-slate-400',
    // Versión patriótica elegante
    patriot: 'from-red-700 via-gray-100 to-blue-700',
    // Clásico con toques dorados
    classic: 'from-red-800 via-amber-100 via-white via-blue-100 to-blue-800',
    // Variante premium
    premium: 'from-blue-800 via-red-600 via-gray-100 to-blue-800',
    // Efecto barbería vintage
    vintage: 'from-red-900 via-amber-100 via-white via-blue-100 to-blue-900',
    // Suave y elegante
    elegant: 'from-red-500 via-gray-200 to-blue-500'
  };

  // Usar gradiente personalizado o uno predefinido
  const gradientClass = customGradient || gradients[gradient] || gradients.primary;

  return (
    <Component 
      className={`
        text-transparent bg-clip-text bg-gradient-to-r ${gradientClass} 
        font-bold relative
        [text-shadow:0_2px_4px_rgba(0,0,0,0.1)]
        before:absolute before:inset-0 before:bg-gradient-to-r before:${gradientClass}
        before:bg-clip-text before:text-transparent before:opacity-20
        before:[filter:blur(0.5px)] before:-z-10
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  );
};

export default GradientText;
