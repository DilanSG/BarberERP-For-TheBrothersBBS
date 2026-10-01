// Skeleton genérico de página (variantes dashboard/services)
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton, TableSkeleton, ListSkeleton } from './base';
import { StatsCardSkeleton, ServiceCardSkeleton } from './cards';

// ── PageSkeleton ───────────────────────────────────
// `variant`: 'dashboard' (4 stats + panel + tabla), 'list' (ListSkeleton)
// o 'default' (título/subtítulo + grilla de ServiceCardSkeleton).
function PageSkeleton({ variant = 'default', className = '' }) {
  if (variant === 'dashboard') {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
          <Skeleton className="h-4 w-40 mb-4 rounded-sm" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (variant === 'list') {
    return <ListSkeleton rows={5} className={className} />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Skeleton className="h-8 w-48 rounded-md" />
      <Skeleton className="h-4 w-96 rounded-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <ServiceCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export { PageSkeleton };
