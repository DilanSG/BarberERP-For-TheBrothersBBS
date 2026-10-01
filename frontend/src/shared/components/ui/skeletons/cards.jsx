// Skeletons de tarjetas y grids de servicios/barberos
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton } from './base';

// ── ServiceCardSkeleton ────────────────────────────
// Replica la estructura de ServiceCard.jsx (icono, nombre, duración, precio y CTA).
function ServiceCardSkeleton({ className = '' }) {
  return (
    <div className={`group relative rounded-3xl border border-white/[0.06] overflow-hidden bg-white/[0.02] h-full flex flex-col ${className}`}>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

      <div className="p-4 sm:p-8 flex flex-col flex-grow">
        {/* Header: Icon + Name + Price */}
        <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Icon square */}
            <Skeleton className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl" />
            <div>
              {/* Service name */}
              <Skeleton className="h-5 sm:h-6 w-28 sm:w-36 rounded-md" />
              {/* Duration */}
              <div className="flex items-center gap-1.5 mt-1">
                <Skeleton className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm" />
                <Skeleton className="h-2.5 sm:h-3 w-12 rounded-sm" />
              </div>
            </div>
          </div>
          {/* Price */}
          <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-md mt-1" />
        </div>

        {/* Description - 2 lines */}
        <div className="space-y-1.5 mb-4 sm:mb-6 flex-grow">
          <Skeleton className="h-3 sm:text-sm w-full rounded-sm" />
          <Skeleton className="h-3 sm:text-sm w-3/4 rounded-sm" />
        </div>

        {/* CTA Button */}
        <Skeleton className="h-9 sm:h-10 w-28 sm:w-32 rounded-lg sm:rounded-xl" />
      </div>

      {/* Bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

// ── BarberCardSkeleton ─────────────────────────────
// Replica la tarjeta 3:4 de HoverRevealCard.jsx (foto, degradado y badges).
function BarberCardSkeleton({ className = '' }) {
  return (
    <div className={`group relative rounded-2xl overflow-hidden aspect-[3/4] ${className}`}>
      {/* Photo area - full cover */}
      <Skeleton className="absolute inset-0 w-full h-full rounded-none" />

      {/* Default gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
        {/* Name */}
        <Skeleton className="h-6 sm:h-7 w-32 sm:w-40 rounded-md mb-1.5" />
        {/* Specialty */}
        <Skeleton className="h-3 sm:h-3.5 w-24 sm:w-28 rounded-sm mb-3" />
        {/* Badge pills */}
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>

      {/* Border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.08] pointer-events-none" />
    </div>
  );
}

// ── ServiceGridSkeleton ────────────────────────────
// Grilla responsive (1/2/3 columnas) de ServiceCardSkeleton.
function ServiceGridSkeleton({ count = 6, className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── BarberGridSkeleton ─────────────────────────────
// Grilla responsive (1/2/3 columnas) de BarberCardSkeleton.
function BarberGridSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <BarberCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── StatsCardSkeleton ──────────────────────────────
// Tarjeta de métrica: etiqueta, valor y variación.
function StatsCardSkeleton({ className = '' }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 ${className}`}>
      <Skeleton className="h-3 w-20 rounded-sm" />
      <Skeleton className="h-7 w-16 rounded-md" />
      <Skeleton className="h-2 w-24 rounded-sm" />
    </div>
  );
}

// ── SkeletonCard (legacy compat) ───────────────────
// Alias histórico que delega en ServiceCardSkeleton.
function SkeletonCard({ className = '' }) {
  return <ServiceCardSkeleton className={className} />;
}

export { ServiceCardSkeleton, BarberCardSkeleton, ServiceGridSkeleton, BarberGridSkeleton, StatsCardSkeleton, SkeletonCard };
