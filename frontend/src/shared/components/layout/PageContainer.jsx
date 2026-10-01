import React from 'react';

// Contenedor de página.
// El offset del navbar fijo lo maneja AppLayout (espaciador + breadcrumbs),
// por lo que aquí no se agrega padding superior adicional.
export const PageContainer = ({ children, className = '' }) => {
  return (
    // isolation:isolate crea un stacking context que mantiene el contenido sobre los fondos decorativos.
    <div className={`relative min-h-full w-full ${className}`} style={{ isolation: 'isolate' }}>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
