import { Skeleton } from './base';

// Skeletons personalizados para los modales de desglose (Reports).
// Imitan la estructura real: resumen de stats, filtros y cards de registros
// (icono, título, badges, meta y monto) con el acento de cada modal.

// Clases de acento por color para cada zona del modal (resumen, barra, card, caja y chip).
const ACCENTS = {
  emerald: {
    summary: 'bg-emerald-500/10 border-emerald-500/20',
    bar: 'bg-emerald-500/20',
    card: 'bg-emerald-500/5 border-emerald-500/20',
    box: 'bg-emerald-500/10 border-emerald-500/20',
    chip: 'bg-emerald-500/15 border-emerald-500/25',
  },
  blue: {
    summary: 'bg-blue-500/10 border-blue-500/20',
    bar: 'bg-blue-500/20',
    card: 'bg-blue-500/5 border-blue-500/20',
    box: 'bg-blue-500/10 border-blue-500/20',
    chip: 'bg-blue-500/15 border-blue-500/25',
  },
  amber: {
    summary: 'bg-amber-500/10 border-amber-500/20',
    bar: 'bg-amber-500/20',
    card: 'bg-amber-500/5 border-amber-500/20',
    box: 'bg-amber-500/10 border-amber-500/20',
    chip: 'bg-amber-500/15 border-amber-500/25',
  },
  brand: {
    summary: 'bg-brand-500/10 border-brand-500/20',
    bar: 'bg-brand-500/20',
    card: 'bg-brand-500/5 border-brand-500/20',
    box: 'bg-brand-500/10 border-brand-500/20',
    chip: 'bg-brand-500/15 border-brand-500/25',
  },
  red: {
    summary: 'bg-red-500/10 border-red-500/20',
    bar: 'bg-red-500/20',
    card: 'bg-red-500/5 border-red-500/20',
    box: 'bg-red-500/10 border-red-500/20',
    chip: 'bg-red-500/15 border-red-500/25',
  },
};

// Resumen de stats (imita la tarjeta superior del modal); `stats` admite 2 o 3 columnas.
export function BreakdownSummarySkeleton({ color = 'blue', stats = 2, className = '' }) {
  const a = ACCENTS[color] || ACCENTS.blue;
  return (
    <div className={`mb-4 p-4 rounded-xl border ${a.summary} ${className}`}>
      <div className={`grid gap-3 ${stats === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {Array.from({ length: stats }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className={`h-3 w-20 rounded-md ${a.bar}`} />
            <Skeleton className={`h-4 w-16 rounded-md ${a.bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Filtros del modal (píldoras + badge de activos).
export function BreakdownFiltersSkeleton({ color = 'blue', className = '' }) {
  const a = ACCENTS[color] || ACCENTS.blue;
  return (
    <div className={`mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className={`h-3.5 w-3.5 rounded-md ${a.bar}`} />
          <Skeleton className={`h-3 w-14 rounded-md ${a.bar}`} />
        </div>
        <Skeleton className="h-4 w-4 rounded-md opacity-60" />
      </div>
    </div>
  );
}

// Lista de registros (imita las cards reales de cada desglose).
export function BreakdownListSkeleton({ rows = 3, color = 'blue', className = '' }) {
  const a = ACCENTS[color] || ACCENTS.blue;
  return (
    <div className={`space-y-2 sm:space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`p-3 sm:p-4 border rounded-lg sm:rounded-xl ${a.card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
              <Skeleton className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg border flex-shrink-0 ${a.box}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-2">
                  <Skeleton className={`h-3.5 rounded-md ${i % 2 ? 'w-28 sm:w-36' : 'w-36 sm:w-44'}`} />
                  <Skeleton className={`h-4 w-14 sm:w-16 rounded-full border ${a.chip}`} />
                </div>
                <Skeleton className="h-3 w-32 sm:w-40 rounded-md opacity-70" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Skeleton className={`h-4 w-16 sm:w-20 rounded-md ${a.bar}`} />
              <Skeleton className="h-3 w-10 rounded-md opacity-60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Cuerpo completo del modal mientras carga (resumen + filtros + lista).
export function BreakdownModalSkeleton({ color = 'blue', rows = 3, stats = 2, className = '' }) {
  return (
    <div className={className}>
      <BreakdownSummarySkeleton color={color} stats={stats} />
      <BreakdownFiltersSkeleton color={color} />
      <BreakdownListSkeleton rows={rows} color={color} />
    </div>
  );
}
