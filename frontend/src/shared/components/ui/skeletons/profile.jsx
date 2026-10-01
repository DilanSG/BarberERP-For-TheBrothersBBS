// Skeletons de las páginas de perfil:
// - ProfileSkeleton: vista del perfil (con secciones extra para barberos)
// - ProfileEditSkeleton: edición de perfil (user/admin)
// - BarberProfileEditSkeleton: edición de perfil de barbero
// - ScheduleListSkeleton: lista de horarios (tab de horarios / perfil barbero)

import { Skeleton } from './base';

// ── ProfileSkeleton ────────────────────────────────
// Réplica de la página de perfil: banner, header con avatar, badges, grilla de
// info y, con `showBarberSections`, horario y servicios (con ScheduleListSkeleton).
function ProfileSkeleton({ showBarberSections = false, className = '' }) {
  return (
    <div className={`w-full space-y-5 ${className}`}>
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        {/* Banner */}
        <div className="h-24 sm:h-28 bg-white/[0.02]" />

        <div className="px-5 sm:px-8 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <Skeleton className="h-6 w-48 rounded-sm mx-auto sm:mx-0" />
              <Skeleton className="h-4 w-56 rounded-sm mx-auto sm:mx-0" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl mx-auto sm:mx-0" />
          </div>

          {/* Badges */}
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Quick stats (barber) */}
          {showBarberSections && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-white/[0.06]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-10 rounded-sm" />
                    <Skeleton className="h-3 w-16 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info grid: personal + contacto */}
      <div className="grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
              <Skeleton className="h-5 w-40 rounded-sm" />
            </div>
            <div className="space-y-1">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-start gap-3 py-3 border-b border-white/[0.06] last:border-0">
                  <Skeleton className="w-4 h-4 rounded-sm flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24 rounded-sm" />
                    <Skeleton className="h-4 w-40 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Secciones de barbero: horario + servicios */}
      {showBarberSections && (
        <>
          {/* Horario */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <Skeleton className="h-5 w-44 rounded-sm" />
              </div>
              <Skeleton className="h-3.5 w-20 rounded-sm" />
            </div>
            <ScheduleListSkeleton rows={7} />
          </div>

          {/* Servicios */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <Skeleton className="h-5 w-48 rounded-sm" />
              </div>
              <Skeleton className="h-3.5 w-16 rounded-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <Skeleton className="h-4 w-28 rounded-sm" />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
                    <Skeleton className="h-5 w-16 rounded-lg" />
                    <Skeleton className="h-3.5 w-14 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── ScheduleListSkeleton ───────────────────────────
// Lista vertical de `rows` días de horario (día + rango de horas).
function ScheduleListSkeleton({ rows = 7, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3 px-3 -mx-3 rounded-xl border-b border-white/[0.06] last:border-0">
          <div className="flex items-center gap-3">
            <Skeleton className="w-1.5 h-1.5 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 w-20 rounded-sm" />
          </div>
          <Skeleton className="h-4 w-24 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

// ── ProfileEditSkeleton ────────────────────────────
// Réplica de la edición de perfil: top bar, `tabs`, card con foto y campos.
function ProfileEditSkeleton({ tabs = 3, className = '' }) {
  return (
    <div className={`w-full space-y-5 ${className}`}>
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-44 rounded-sm" />
          <Skeleton className="h-3.5 w-64 rounded-sm hidden sm:block" />
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
        {Array.from({ length: tabs }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        {/* Foto de perfil */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-white/[0.06]">
          <Skeleton className="w-24 h-24 rounded-full flex-shrink-0 mx-auto sm:mx-0" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <Skeleton className="h-4 w-28 rounded-sm mx-auto sm:mx-0" />
            <Skeleton className="h-3 w-40 rounded-sm mx-auto sm:mx-0" />
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Campos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-32 rounded-sm" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-5 border-t border-white/[0.06]">
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── BarberProfileEditSkeleton ──────────────────────
// Edición de perfil de barbero: 5 tabs (personal, seguridad, profesional, servicios, horarios).
function BarberProfileEditSkeleton({ className = '' }) {
  return <ProfileEditSkeleton tabs={5} className={className} />;
}

export { ProfileSkeleton, ScheduleListSkeleton, ProfileEditSkeleton, BarberProfileEditSkeleton };
