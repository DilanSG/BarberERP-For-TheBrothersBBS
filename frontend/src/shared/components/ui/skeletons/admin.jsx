// Skeletons de páginas de administración
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton } from './base';

// ── InventorySkeleton ──────────────────────────────
// Réplica de las filas del grid tipo Excel del inventario.
function InventorySkeleton({ rows = 6, className = '' }) {
  return (
    <div className={`min-w-[940px] ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-12 border-b border-white/[0.05] last:border-b-0 odd:bg-white/[0.015]"
        >
          {/* Producto */}
          <div className="col-span-2 px-3 py-3 border-r border-white/[0.05] space-y-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded-sm" />
            <Skeleton className="h-2.5 w-1/2 rounded-sm" />
          </div>

          {/* Columnas numéricas (Inicial, Entradas, Salidas, Ventas, Esperado, Real, Dif) */}
          {Array.from({ length: 7 }).map((_, j) => (
            <div key={j} className="col-span-1 px-2 py-3 border-r border-white/[0.05] flex items-center justify-center">
              <Skeleton className="h-3.5 w-8 rounded-sm" />
            </div>
          ))}

          {/* Estado */}
          <div className="col-span-1 px-2 py-3 border-r border-white/[0.05] flex items-center justify-center">
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>

          {/* Acciones */}
          <div className="col-span-2 px-3 py-3 flex items-center justify-center gap-1">
            {Array.from({ length: 4 }).map((_, k) => (
              <Skeleton key={k} className="w-7 h-7 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ReportsSkeleton ────────────────────────────────
// Solo el contenido (el top bar y los tabs reales ya están visibles):
// grilla de 8 cards, fila de 3 métricas rápidas y área de gráfico.
function ReportsSkeleton({ className = '' }) {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* ── Dashboard cards grid (4 cols) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 backdrop-blur-sm shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24 rounded-sm" />
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            </div>
            <Skeleton className="h-7 w-20 rounded-sm mb-2" />
            <Skeleton className="h-3 w-32 rounded-sm" />
          </div>
        ))}
      </div>

      {/* ── Quick metrics row (3 cols) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 backdrop-blur-sm shadow-soft">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 w-32 rounded-sm" />
            </div>
            <Skeleton className="h-6 w-28 rounded-sm mb-2" />
            <Skeleton className="h-3 w-20 rounded-sm" />
          </div>
        ))}
      </div>

      {/* ── Chart area ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-soft">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-5 w-40 rounded-sm" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex items-end justify-between gap-4" style={{ height: '180px' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
              <Skeleton className="w-full max-w-[50px] rounded-t-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
              <Skeleton className="h-3 w-10 rounded-sm mt-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AdminServicesSkeleton ──────────────────────────
// Replica la página de gestión de servicios: top bar, stats, filtros y grilla.
function AdminServicesSkeleton({ className = '' }) {
  return (
    <div className={`w-full space-y-5 ${className}`}>
      {/* ── Top Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded-sm" />
            <Skeleton className="h-3 w-64 rounded-sm hidden sm:block" />
          </div>
        </div>
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
          <Skeleton className="h-10 flex-1 sm:max-w-xs rounded-lg" />
          <Skeleton className="h-10 sm:w-48 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* ── Stats strip (4 cols) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="space-y-1 min-w-0">
              <Skeleton className="h-5 w-10 rounded-sm" />
              <Skeleton className="h-3 w-20 rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Status filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-lg" />
        ))}
      </div>

      {/* ── Section header + services grid (3 cols) ── */}
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-4 h-4 rounded-sm" />
            <Skeleton className="h-3.5 w-24 rounded-sm" />
            <Skeleton className="flex-1 h-px" />
            <Skeleton className="h-3 w-12 rounded-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-white/10 bg-white/5 rounded-2xl p-4 flex flex-col">
                {/* Header: icono + nombre + estado + acciones */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24 rounded-sm" />
                      <Skeleton className="w-4 h-4 rounded-sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="w-6 h-6 rounded-sm" />
                    <Skeleton className="w-6 h-6 rounded-sm" />
                  </div>
                </div>
                {/* Description */}
                <div className="space-y-1.5 mb-3">
                  <Skeleton className="h-3 w-full rounded-sm" />
                  <Skeleton className="h-3 w-3/4 rounded-sm" />
                </div>
                {/* Precio y duración */}
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-4 w-20 rounded-sm" />
                  <Skeleton className="h-4 w-14 rounded-sm" />
                </div>
                {/* Toggle button */}
                <Skeleton className="h-11 w-full rounded-lg mt-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AdminBarbersSkeleton ───────────────────────────
// Replica la página de estadísticas de barberos: top bar + stats + cards.
function AdminBarbersSkeleton({ className = '' }) {
  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── Top bar: título + filtro ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56 rounded-sm" />
            <Skeleton className="h-3 w-72 rounded-sm hidden sm:block" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Skeleton className="h-12 w-full lg:max-w-3xl lg:ml-auto rounded-xl" />
        </div>
      </div>

      {/* ── Stats strip (4 cols) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-5 w-20 rounded-sm" />
              <Skeleton className="h-2.5 w-24 rounded-sm" />
              <Skeleton className="h-2 w-16 rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Cards grid (3 cols) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            {/* Header: avatar + nombre */}
            <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
              <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 rounded-sm" />
                <Skeleton className="h-3 w-40 rounded-sm" />
              </div>
              <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
            </div>

            {/* 3 stat rows */}
            <div className="divide-y divide-white/[0.06]">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded-sm" />
                    <Skeleton className="h-2.5 w-20 rounded-sm" />
                  </div>
                  <Skeleton className="h-4 w-20 rounded-sm" />
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
              <Skeleton className="h-3 w-24 rounded-sm" />
              <Skeleton className="h-5 w-24 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UserRoleManagerSkeleton ────────────────────────
// Stats strip + filter pills + tabla de usuarios; incluye variante móvil en
// cards. El header real siempre está visible.
function UserRoleManagerSkeleton({ rows = 6, className = '' }) {
  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── Stats strip (4 cols) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="space-y-1 min-w-0">
              <Skeleton className="h-5 w-10 rounded-sm" />
              <Skeleton className="h-3 w-20 rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-lg" />
        ))}
      </div>

      {/* ── Table container ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm shadow-soft overflow-hidden">
        {/* Table header */}
        <div className="hidden md:block bg-gradient-to-r from-white/10 to-white/5 border-b border-white/10">
          <div className="grid grid-cols-12 gap-4 px-6 py-4">
            <div className="col-span-4"><Skeleton className="h-3.5 w-16 rounded-sm" /></div>
            <div className="col-span-3"><Skeleton className="h-3.5 w-12 rounded-sm" /></div>
            <div className="col-span-2"><Skeleton className="h-3.5 w-8 rounded-sm" /></div>
            <div className="col-span-3 flex justify-end"><Skeleton className="h-3.5 w-14 rounded-sm" /></div>
          </div>
        </div>
        {/* Table rows */}
        <div className="divide-y divide-white/5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="hidden md:grid grid-cols-12 gap-4 items-center px-6 py-4">
              {/* User */}
              <div className="col-span-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28 rounded-sm" />
                  <Skeleton className="h-2.5 w-20 rounded-sm" />
                </div>
              </div>
              {/* Email */}
              <div className="col-span-3">
                <Skeleton className="h-3.5 w-36 rounded-sm" />
              </div>
              {/* Badges */}
              <div className="col-span-2 flex gap-1.5">
                <Skeleton className="h-5 w-12 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </div>
              {/* Actions */}
              <div className="col-span-3 flex items-center justify-end gap-2">
                <Skeleton className="h-9 w-32 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
        {/* Mobile cards */}
        <div className="block md:hidden space-y-4 p-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-start gap-4 mb-4">
                <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-sm" />
                  <Skeleton className="h-3 w-40 rounded-sm" />
                  <Skeleton className="h-2.5 w-24 rounded-sm" />
                </div>
              </div>
              <div className="flex gap-1.5 mb-4">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </div>
              <div className="pt-4 border-t border-white/10 space-y-3">
                <Skeleton className="h-2.5 w-20 rounded-sm" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-11 rounded-lg" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { InventorySkeleton, ReportsSkeleton, AdminServicesSkeleton, AdminBarbersSkeleton, UserRoleManagerSkeleton };
