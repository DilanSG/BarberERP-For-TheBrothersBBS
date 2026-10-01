// Skeletons de punto de venta y facturas
// (extraído de Skeleton.jsx para mejorar mantenibilidad)

import { Skeleton } from './base';

// ── PaymentMethodsSkeleton ──────────────────────
// Réplica de la página de métodos de pago: header admin, 2 cards de acción
// (azul y brand) y grilla de `methods` tarjetas.
function PaymentMethodsSkeleton({ methods = 4, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64 rounded-sm" />
            <Skeleton className="h-4 w-48 rounded-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* Admin action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-5 h-5 rounded-sm" />
            <Skeleton className="h-4 w-32 rounded-sm" />
          </div>
          <Skeleton className="h-3.5 w-full rounded-sm mb-3" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-5 h-5 rounded-sm" />
            <Skeleton className="h-4 w-32 rounded-sm" />
          </div>
          <Skeleton className="h-3.5 w-full rounded-sm mb-3" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Payment method cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: methods }).map((_, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24 rounded-sm" />
                  <Skeleton className="h-3 w-16 rounded-sm" />
                </div>
              </div>
              <Skeleton className="h-5 w-12 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-full rounded-sm mb-2" />
            <Skeleton className="h-3.5 w-2/3 rounded-sm" />
            <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CartInvoicesSkeleton ────────────────────────
// Réplica de facturas de carrito: header + filtros + grilla de cards a 3 columnas
// con nombre, total, badge, fecha e info de pago.
function CartInvoicesSkeleton({ cards = 6, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-sm" />
          <Skeleton className="h-4 w-72 rounded-sm" />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Invoice cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-md border border-blue-500/20 rounded-lg p-3">
            {/* Header: name + total + badge */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Skeleton className="w-3.5 h-3.5 rounded-sm flex-shrink-0" />
                <Skeleton className="h-4 w-28 rounded-sm" />
              </div>
              <div className="text-right flex-shrink-0 ml-2 space-y-1">
                <Skeleton className="h-5 w-20 rounded-sm ml-auto" />
                <Skeleton className="h-3.5 w-10 rounded-md ml-auto" />
              </div>
            </div>

            {/* Date + items count */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <Skeleton className="w-3 h-3 rounded-sm" />
                <Skeleton className="h-3 w-20 rounded-sm" />
              </div>
              <Skeleton className="h-3 w-8 rounded-sm" />
            </div>

            {/* Email / info line */}
            <div className="flex items-center gap-1 mb-1.5">
              <Skeleton className="w-3 h-3 rounded-sm" />
              <Skeleton className="h-3 w-36 rounded-sm" />
            </div>

            {/* Payment methods */}
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-12 rounded-sm" />
              <Skeleton className="h-3 w-14 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BarberSalesSkeleton ──────────────────────────
// Réplica del POS: top bar, toolbar de búsqueda/categorías, selector de barbero
// y layout de 2 columnas (productos/servicios + carrito sticky).
function BarberSalesSkeleton({ items = 8, className = '' }) {
  return (
    <div className={`relative z-10 w-full pb-6 space-y-4 ${className}`}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-6 w-40 max-w-full rounded-sm" />
            <Skeleton className="h-3 w-48 max-w-full rounded-sm hidden sm:block" />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <Skeleton className="w-11 h-11 rounded-xl" />
        </div>
      </div>

      {/* ── Toolbar: búsqueda + categorías ── */}
      <div className="hidden sm:grid grid-cols-2 gap-3 max-w-xl">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <div className="flex items-center gap-2 sm:hidden">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <Skeleton className="w-11 h-11 rounded-xl" />
      </div>

      {/* ── User info + barber selector ── */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-48 rounded-sm" />
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      {/* ── Main 2-col layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6 items-start">
        {/* ── Products/Services ── */}
        <div className="space-y-4">
          {/* Services section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-4 h-4 rounded-sm" />
              <Skeleton className="h-3.5 w-20 rounded-sm" />
              <Skeleton className="flex-1 h-px" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`svc-${i}`} className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3">
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Skeleton className="w-3 h-3 rounded-sm" />
                        <Skeleton className="h-3.5 w-20 rounded-sm" />
                      </div>
                      <Skeleton className="h-2.5 w-full rounded-sm" />
                      <Skeleton className="h-4 w-12 rounded-full mt-1.5" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3.5 w-14 rounded-sm" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Products section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-4 h-4 rounded-sm" />
              <Skeleton className="h-3.5 w-20 rounded-sm" />
              <Skeleton className="flex-1 h-px" />
              <Skeleton className="h-3 w-16 rounded-sm" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: Math.min(items, 6) }).map((_, i) => (
                <div key={`prod-${i}`} className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3">
                  <div className="space-y-2">
                    <div>
                      <Skeleton className="h-3.5 w-24 rounded-sm mb-0.5" />
                      <Skeleton className="h-2.5 w-full rounded-sm" />
                      <Skeleton className="h-4 w-12 rounded-full mt-1.5" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Skeleton className="h-3.5 w-14 rounded-sm" />
                        <Skeleton className="h-2.5 w-10 rounded-sm" />
                      </div>
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Cart (sticky sidebar) ── */}
        <div className="lg:sticky lg:top-4 order-first lg:order-last">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl shadow-soft p-4">
            {/* Cart header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded-sm" />
                <Skeleton className="h-4 w-16 rounded-sm" />
                <Skeleton className="h-3.5 w-5 rounded-sm" />
              </div>
              <Skeleton className="w-7 h-7 rounded-md" />
            </div>
            {/* Cart items */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <Skeleton className="h-3.5 flex-1 rounded-sm" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-3 w-14 rounded-sm" />
                      <Skeleton className="h-2.5 w-8 rounded-sm" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-6 w-14 rounded" />
                      <Skeleton className="h-6 w-6 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Payment summary */}
            <div className="border-t border-blue-500/20 pt-2.5 mt-2.5 space-y-1">
              <Skeleton className="h-2.5 w-32 rounded-sm" />
              <Skeleton className="h-3 w-24 rounded-sm" />
              <Skeleton className="h-3 w-28 rounded-sm" />
            </div>
            {/* Total + button */}
            <div className="border-t border-blue-500/20 pt-2.5 mt-2.5">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-10 rounded-sm" />
                <Skeleton className="h-5 w-20 rounded-sm" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PaymentMethodsSkeleton, CartInvoicesSkeleton, BarberSalesSkeleton };
