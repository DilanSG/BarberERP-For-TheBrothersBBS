// Skeletons de página de citas (todos los roles)
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton } from './base';

// ── AppointmentPageSkeleton ─────────────────────
// Réplica genérica: título + tabs, stats opcionales (`showStats`) y `cards` citas.
function AppointmentPageSkeleton({ cards = 3, showStats = true, className = '' }) {
  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Header: title + tab switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <Skeleton className="h-7 w-48 rounded-sm" />
        <div className="w-full sm:w-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-1">
          <div className="grid grid-cols-2 sm:flex">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats row (for barbers/admins) */}
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-emerald-700">
              <Skeleton className="h-3.5 w-20 rounded-sm mb-1.5" />
              <Skeleton className="h-7 w-10 rounded-sm mb-1" />
              <Skeleton className="h-3.5 w-16 rounded-sm" />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-amber-700">
              <Skeleton className="h-3.5 w-16 rounded-sm mb-1.5" />
              <Skeleton className="h-7 w-10 rounded-sm" />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-red-700">
              <Skeleton className="h-3.5 w-16 rounded-sm mb-1.5" />
              <Skeleton className="h-7 w-10 rounded-sm" />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <Skeleton className="h-3.5 w-16 rounded-sm mb-1.5" />
              <Skeleton className="h-7 w-10 rounded-sm" />
            </div>
          </div>
        )}

        {/* Appointment cards */}
        <div className="grid gap-4 sm:gap-6">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32 rounded-sm" />
                    <Skeleton className="h-3.5 w-24 rounded-sm" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <Skeleton className="h-3.5 w-28 rounded-sm" />
                <Skeleton className="h-3.5 w-24 rounded-sm" />
                <Skeleton className="h-3.5 w-20 rounded-sm" />
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-700">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AppointmentDetailSkeleton ───────────────────
// Header + banner de estado + grilla de info a 2 columnas + botones de acción.
function AppointmentDetailSkeleton({ className = '' }) {
  return (
    <div className={`max-w-4xl mx-auto space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0" />
          <Skeleton className="h-7 sm:h-8 w-48 rounded-sm" />
        </div>
      </div>

      {/* Card */}
      <div className="border border-white/10 rounded-2xl backdrop-blur-sm">
        <div className="p-6 lg:p-8">
          {/* Status banner */}
          <Skeleton className="h-12 w-full rounded-xl mb-6" />

          {/* Info grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: appointment info */}
            <div className="space-y-4">
              <Skeleton className="h-5 w-44 rounded-sm mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4 rounded-sm flex-shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16 rounded-sm" />
                      <Skeleton className="h-4 w-32 rounded-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: barber info */}
            <div className="space-y-4">
              <Skeleton className="h-5 w-44 rounded-sm mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4 rounded-sm flex-shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16 rounded-sm" />
                      <Skeleton className="h-4 w-36 rounded-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/10">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AppointmentEditSkeleton ─────────────────────
// Header + card de formulario (info actual, selects de servicio/barbero,
// fecha y grilla de horarios).
function AppointmentEditSkeleton({ className = '' }) {
  return (
    <div className={`max-w-4xl mx-auto space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0" />
          <Skeleton className="h-7 sm:h-8 w-40 rounded-sm" />
        </div>
      </div>

      {/* Form card */}
      <div className="border border-white/10 rounded-2xl backdrop-blur-sm">
        <div className="p-6 lg:p-8 space-y-6">
          {/* Current info box */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <Skeleton className="h-5 w-40 rounded-sm mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3.5 w-16 rounded-sm" />
                  <Skeleton className="h-4 w-32 rounded-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Service select */}
          <div>
            <Skeleton className="h-4 w-24 rounded-sm mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Barber select */}
          <div>
            <Skeleton className="h-4 w-20 rounded-sm mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Date */}
          <div>
            <Skeleton className="h-4 w-16 rounded-sm mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Time slots */}
          <div>
            <Skeleton className="h-4 w-14 rounded-sm mb-2" />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Submit buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AdminAppointmentsSkeleton ───────────────────
// Header + 5 stat cards + lista de citas en filas horizontales.
function AdminAppointmentsSkeleton({ rows = 5, className = '' }) {
  return (
    <div className={`w-full space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0" />
          <Skeleton className="h-8 w-64 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-80 rounded-sm mx-auto" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="text-right space-y-1">
                <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                <Skeleton className="h-6 w-8 rounded-sm ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* List card */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
          <Skeleton className="h-5 w-40 rounded-sm" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="border border-white/10 bg-white/[0.02] rounded-lg p-4 mx-1 my-2">
              <div className="flex items-center justify-between">
                {/* Info columns */}
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-4 mr-6">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <Skeleton className="w-3 h-3 rounded-sm flex-shrink-0" />
                      <div className="space-y-1 min-w-0">
                        <Skeleton className="h-2.5 w-12 rounded-sm" />
                        <Skeleton className="h-3.5 w-20 rounded-sm" />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Status + actions */}
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 4 }).map((_, k) => (
                      <Skeleton key={k} className="w-6 h-6 rounded-md" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BarberAppointmentsSkeleton ──────────────────
// Header + layout a 2 columnas (tabs/estados a la izquierda, lista de citas a la derecha).
function BarberAppointmentsSkeleton({ cards = 4, className = '' }) {
  return (
    <div className={`w-full space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0" />
          <Skeleton className="h-8 w-56 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-80 rounded-sm mx-auto" />
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Left: tabs / states */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-white/10">
          <div className="flex items-center space-x-3 mb-6">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <Skeleton className="h-7 w-48 rounded-sm" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>

        {/* Right: appointment list */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-white/10">
          <div className="flex items-center space-x-3 mb-6">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <Skeleton className="h-7 w-44 rounded-sm" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: cards }).map((_, i) => (
              <div key={i} className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
                {/* Service + status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <Skeleton className="h-4 w-32 rounded-sm" />
                      <Skeleton className="h-3 w-40 rounded-sm" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
                </div>
                {/* Date + actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3.5 w-16 rounded-sm" />
                    <Skeleton className="h-3.5 w-12 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── UserAppointmentsSkeleton ────────────────────
// Lista de tarjetas de cita para la sección "Mis Citas".
function UserAppointmentsSkeleton({ cards = 4, className = '' }) {
  return (
    <div className={`space-y-2 max-h-none xl:max-h-96 xl:overflow-hidden pl-1 pt-2 ${className}`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="border border-white/10 bg-white/[0.02] rounded-lg p-4 mx-1">
          {/* Service + status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-32 rounded-sm" />
                <Skeleton className="h-3 w-40 rounded-sm" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
          </div>
          {/* Date + time + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-3.5 w-16 rounded-sm" />
              <Skeleton className="h-3.5 w-12 rounded-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { AppointmentPageSkeleton, AppointmentDetailSkeleton, AppointmentEditSkeleton, AdminAppointmentsSkeleton, BarberAppointmentsSkeleton, UserAppointmentsSkeleton };
