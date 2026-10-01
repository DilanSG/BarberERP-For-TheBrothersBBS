// Skeletons de página pública de barberos
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton } from './base';

// ── PublicBarbersSkeleton ───────────────────────
// Top bar + grilla de `cards` tarjetas públicas (foto, badges de disponibilidad,
// nombre/especialidad, servicios y botones de acción).
function PublicBarbersSkeleton({ cards = 6, className = '' }) {
  return (
    <div className={`w-full space-y-5 ${className}`}>
      {/* ── Top bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-52 rounded-sm" />
            <Skeleton className="h-3 w-72 max-w-full rounded-sm" />
          </div>
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-2 lg:justify-end">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {Array.from({ length: cards }).map((_, i) => (
          <article key={i} className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col h-full">
            {/* Photo area */}
            <div className="relative h-56 sm:h-80 overflow-hidden rounded-t-2xl">
              <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent"></div>

              {/* Availability badge (top-left) */}
              <div className="absolute top-5 left-5 z-20">
                <Skeleton className="h-12 w-36 rounded-2xl" />
              </div>

              {/* Floating badges (top-right) */}
              <div className="absolute top-5 right-5 flex flex-col gap-2 z-20">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>

              {/* Name + specialty (bottom) */}
              <div className="absolute bottom-0 left-0 right-0 p-5 z-20 space-y-2">
                <Skeleton className="h-6 w-44 rounded-sm" />
                <Skeleton className="h-4 w-36 rounded-sm" />
              </div>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col flex-grow">
              {/* Services */}
              <div className="flex-grow space-y-2">
                <Skeleton className="h-3 w-32 rounded-sm" />
                <div className="grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg space-y-1">
                      <Skeleton className="h-3 w-full rounded-sm" />
                      <Skeleton className="h-3 w-14 rounded-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 mt-auto">
                <Skeleton className="h-11 flex-1 rounded-xl" />
                <Skeleton className="h-11 flex-1 rounded-xl" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export { PublicBarbersSkeleton };
