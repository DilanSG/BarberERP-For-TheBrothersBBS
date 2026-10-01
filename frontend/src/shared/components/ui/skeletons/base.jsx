// Skeletons primitivas genéricas (base, tablas, listas, formularios, modales)
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

// ── Base ───────────────────────────────────────────
// Bloque gris pulsante; `animate={false}` desactiva el pulso para piezas estáticas.
function Skeleton({ className = '', animate = true }) {
  return (
    <div
      className={`rounded-lg bg-white/[0.06] ${animate ? 'animate-pulse' : ''} ${className}`}
      aria-hidden="true"
    />
  );
}

// ── ButtonSkeleton ─────────────────────────────────
// Placeholder de botón estándar (40px de alto).
function ButtonSkeleton({ className = '' }) {
  return <Skeleton className={`h-10 w-24 rounded-lg ${className}`} />;
}

// ── FormSkeleton ───────────────────────────────────
// Formulario genérico: `fields` campos (label + input) y fila de dos botones.
function FormSkeleton({ fields = 4, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24 rounded-sm" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ── ModalSkeleton ──────────────────────────────────
// Cuerpo de modal: header con cierre, divisor y 3 filas con avatar y dos líneas.
function ModalSkeleton({ className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded-sm" />
              <Skeleton className="h-2.5 w-20 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TableSkeleton ──────────────────────────────────
// Tabla `rows` x `cols` con cabecera y bordes; el contenedor imita la card real.
function TableSkeleton({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden ${className}`}>
      <div className="flex gap-4 p-4 border-b border-white/[0.06]">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 rounded-sm" />
        ))}
      </div>
      {[...Array(rows)].map((_, row) => (
        <div key={row} className="flex gap-4 p-4 border-b border-white/[0.04] last:border-0">
          {[...Array(cols)].map((_, col) => (
            <Skeleton key={col} className="h-3 flex-1 rounded-sm" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── ListSkeleton ───────────────────────────────────
// Lista vertical de filas con avatar, dos líneas de texto y un pill a la derecha.
function ListSkeleton({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32 rounded-sm" />
            <Skeleton className="h-2.5 w-20 rounded-sm" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, ButtonSkeleton, FormSkeleton, ModalSkeleton, TableSkeleton, ListSkeleton };
