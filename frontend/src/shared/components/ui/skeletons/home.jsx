// Skeletons de la página de inicio (pública y autenticada).
// El logo/hero nunca se esqueletiza: se renderiza real desde el primer
// instante. Aquí solo se complementan las cards dinámicas (servicios
// y barberos) con encabezados de texto real.

import { Skeleton } from './base';
import { ServiceGridSkeleton, BarberGridSkeleton } from './cards';

// ── Divisor idéntico al del Home ───────────────────
// Réplica del separador decorativo entre secciones del Home.
function SkeletonDivider() {
  return (
    <div className="relative h-px w-full max-w-5xl mx-auto my-8 sm:my-0">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-white/[0.06] border border-white/[0.1]" />
    </div>
  );
}

// ── Card flotante de usuario (solo auth) ───────────
// Réplica de la tarjeta sticky con avatar/nombre/rol del Home autenticado.
function HomeUserCardSkeleton() {
  return (
    <div className="sticky top-14 sm:top-16 z-40 pt-3 pb-1 px-4 pointer-events-none">
      <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] shadow-lg pointer-events-auto">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="leading-tight space-y-1">
          <Skeleton className="h-2 w-12 rounded-sm" />
          <Skeleton className="h-3.5 w-24 max-w-[45vw] rounded-sm" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0" />
      </div>
    </div>
  );
}

// ── HomeSkeleton ───────────────────────────────────
// Solo las secciones con datos dinámicos: servicios y barberos.
// `isAuthenticated` cambia los textos a la variante de usuario logueado.
function HomeSkeleton({ isAuthenticated = false, className = '' }) {
  return (
    <div className={className}>
      {/* ── Services ── */}
      <section id="services" className="relative py-12 sm:py-24">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-6">
              {isAuthenticated ? 'Nuestros' : 'Elige tu'}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-white to-blue-600 font-bold">
                {isAuthenticated ? 'servicios' : 'experiencia'}
              </span>
            </h2>
            <p className="text-gray-400 text-sm sm:text-lg max-w-2xl mx-auto">
              {isAuthenticated
                ? 'Explora los servicios que tenemos para ti y reserva tu cita favorita'
                : 'Ofrecemos una amplia gama de servicios de barberia profesional para que luzcas tu mejor version'
              }
            </p>
          </div>
          <ServiceGridSkeleton count={3} />
        </div>
      </section>

      <SkeletonDivider />

      {/* ── Barbers ── */}
      <section className="relative py-12 sm:py-24">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-16">
            <div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 sm:mb-4">
                {isAuthenticated ? 'Nuestro' : 'Barberos'}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-white to-blue-600 font-bold">
                  {isAuthenticated ? 'equipo' : 'expertos'}
                </span>
              </h2>
              <p className="text-gray-400 text-sm sm:text-lg max-w-xl">
                {isAuthenticated
                  ? 'Conoce a los profesionales que cuidarán tu estilo'
                  : 'Conoce a nuestro equipo de profesionales expertos en el arte de la barberia'
                }
              </p>
            </div>
            <Skeleton className="hidden sm:block h-10 w-32 rounded-lg flex-shrink-0" />
          </div>
          <BarberGridSkeleton count={3} />
        </div>
      </section>
    </div>
  );
}

// ── HomeAuthenticatedSkeleton ──────────────────────
// Fallback de página completa (ProtectedRoute) con card de usuario.
function HomeAuthenticatedSkeleton({ className = '' }) {
  return (
    <div className={`min-h-screen ${className}`}>
      <HomeUserCardSkeleton />
      <HomeSkeleton isAuthenticated />
    </div>
  );
}

// ── RoleMenuSkeleton ───────────────────────────────
// Replica el dashboard de admin/barbero (RoleMenu): header + stats
// segmentadas + bento de acciones principales + más opciones.
// El tinte del header y la cantidad de opciones cambian según el rol.
function RoleMenuSkeleton({ role = 'admin', className = '' }) {
  // Variantes por rol: admin usa azul y 5 opciones secundarias; barbero rojo y 2.
  const isAdmin = role === 'admin';
  const secondaryCount = isAdmin ? 5 : 2;
  const glowClass = isAdmin ? 'bg-blue-500/15' : 'bg-red-500/15';
  const badgeClass = isAdmin ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20';

  return (
    <div className={`relative z-10 w-full px-[clamp(1rem,4vw,3rem)] pt-5 sm:pt-6 pb-6 ${className}`}>
      <div className="space-y-5 sm:space-y-6">
        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
          <div className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-[100px] ${glowClass}`} />
          <div className="relative flex items-center gap-4 p-5 sm:p-6">
            <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-20 rounded-sm" />
              <Skeleton className="h-7 w-44 max-w-full rounded-md" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className={`h-5 w-24 rounded-full border ${badgeClass}`} />
                <Skeleton className="h-3 w-32 rounded-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats (barra segmentada) ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
          <div className="relative grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 sm:p-5">
                <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-24 rounded-sm" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Acciones principales (bento) ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-3.5 w-40 rounded-sm" />
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Card principal */}
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-7 lg:col-span-3">
              <Skeleton className="w-14 h-14 rounded-2xl mb-6" />
              <Skeleton className="h-8 w-56 max-w-full rounded-md mb-3" />
              <Skeleton className="h-3 w-full max-w-md rounded-sm mb-2" />
              <Skeleton className="h-3 w-2/3 rounded-sm mb-6" />
              <Skeleton className="h-11 w-28 rounded-xl" />
            </div>
            {/* Cards compactas */}
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between mb-6">
                    <Skeleton className="w-11 h-11 rounded-xl" />
                    <Skeleton className="w-5 h-5 rounded-sm" />
                  </div>
                  <Skeleton className="h-5 w-36 max-w-full rounded-sm mb-2" />
                  <Skeleton className="h-3 w-full rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Más opciones ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-3.5 w-24 max-w-[45vw] rounded-sm" />
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: secondaryCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32 rounded-sm" />
                  <Skeleton className="h-2.5 w-24 rounded-sm" />
                </div>
                <Skeleton className="w-4 h-4 rounded-sm flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { HomeSkeleton, HomeAuthenticatedSkeleton, RoleMenuSkeleton };
