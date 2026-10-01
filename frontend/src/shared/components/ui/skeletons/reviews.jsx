// Skeletons de reseñas de barberos
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton } from './base';

// ── BarberReviewsSkeleton ───────────────────────
// Card de estadísticas (promedio, distribución por estrellas) + `reviews` reseñas.
function BarberReviewsSkeleton({ reviews = 3, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Card */}
      <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48 rounded-sm" />
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="w-5 h-5 rounded-sm" />
                ))}
              </div>
              <Skeleton className="h-7 w-10 rounded-sm" />
              <Skeleton className="h-4 w-24 rounded-sm" />
            </div>
          </div>
          <Skeleton className="w-12 h-12 rounded-sm" />
        </div>
        {/* Distribution bars */}
        <div className="mt-6 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => (
            <div key={stars} className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-16 rounded-sm" />
              <Skeleton className="flex-1 h-2 rounded-full" />
              <Skeleton className="h-3.5 w-8 rounded-sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Review Cards */}
      <div className="space-y-4">
        {Array.from({ length: reviews }).map((_, i) => (
          <div key={i} className="p-5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-start gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28 rounded-sm" />
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="w-4 h-4 rounded-sm" />
                  ))}
                </div>
              </div>
              <Skeleton className="h-3.5 w-20 rounded-sm" />
            </div>
            <Skeleton className="h-4 w-full rounded-sm" />
            <Skeleton className="h-4 w-3/4 rounded-sm mt-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { BarberReviewsSkeleton };
