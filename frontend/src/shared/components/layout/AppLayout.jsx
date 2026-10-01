import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '@components/layout/Navbar';
import Breadcrumbs from '@components/navigation/Breadcrumbs';
import BarberPolesBackdrop from './BarberPolesBackdrop';
import Footer from './Footer';
import { PageSkeleton, HomeSkeleton, RoleMenuSkeleton, LoginSkeleton, RegisterSkeleton } from '@components/ui/Skeleton';
import HomeHero from '@components/home/HomeHero';
import { useRoutePreloader, useNavigationPerformance } from '@hooks/useRoutePreloader';
import { useCacheMonitor } from '@components/dev/CacheMonitor';
import { useAnalyticsDashboard } from '@components/dev/AnalyticsDashboard';
import { useNavigationAnalytics } from '@hooks/useNavigationAnalytics';
import { usePWA } from '@hooks/usePWA';
import { useAuth } from '@contexts/AuthContext';
import { useTheme } from '@contexts/ThemeContext';
import ScrollToTop from '@components/common/ScrollToTop';
import { WifiOff, Download } from 'lucide-react';

// Layout raíz de la app: fondos decorativos, navbar + breadcrumbs, <Outlet> en
// Suspense con skeleton por ruta y avisos de offline/instalación PWA.
// Decide el offset del navbar: home público full-bleed vs resto de páginas.
export default function AppLayout() {
  // Hooks globales: precarga de rutas, métricas de navegación, analytics,
  // sesión, tema, estado de red/PWA y monitores de desarrollo.
  useRoutePreloader();
  useNavigationPerformance();
  useNavigationAnalytics();
  const { user } = useAuth();
  const { isLight } = useTheme();
  const { isOnline, isInstallable, installPWA } = usePWA();
  const { CacheMonitorComponent } = useCacheMonitor();
  const { AnalyticsDashboardComponent } = useAnalyticsDashboard();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isLogin = location.pathname === '/login';
  const isRegister = location.pathname === '/register';
  const isAuthPage = isLogin || isRegister;
  // El home público es full-bleed (hero debajo del navbar); el resto requiere compensar la altura del navbar fijo
  const isStaffHome = isHome && user && (user.role === 'admin' || user.role === 'barber');
  // El POS en móvil no muestra navbar → tampoco su espaciador
  const isPos = location.pathname === '/admin/sales';
  // El offset se aplica salvo en auth; el home de staff (menú de rol) también lo necesita.
  const needsNavOffset = !isAuthPage && (!isHome || isStaffHome);

  // Fallback del Home: el hero/logo se renderiza real (nunca esqueletizado).
  // - rol user → skeleton del home autenticado (servicios/barberos)
  // - admin/barber → skeleton de su dashboard (RoleMenu)
  const homeFallback = isStaffHome ? (
    <RoleMenuSkeleton role={user.role} />
  ) : user ? (
    <HomeSkeleton isAuthenticated />
  ) : (
    <>
      <HomeHero animate={false} />
      <HomeSkeleton />
    </>
  );

  // Fallback de Login/Register: logo y textos reales, skeleton solo en campos y botón.
  const authFallback = isRegister ? <RegisterSkeleton /> : <LoginSkeleton />;

  return (
    <div className="relative min-h-[100dvh] w-full bg-[var(--app-bg)] text-[color:var(--text-primary)] overflow-x-clip" style={{ isolation: 'isolate' }}>
      <ScrollToTop />
      {/* Fondo base uniforme — fijo al viewport para cubrir siempre toda la pantalla
          (independiente del scroll, padding de páginas o modales abiertos) */}
      <div className="app-bg-layer fixed inset-0 pointer-events-none" aria-hidden />
      {/* Fondo decorativo: postes de barbero (variante según el tema) */}
      <BarberPolesBackdrop variant={isLight ? 'light' : 'dark'} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {!isAuthPage && <Navbar />}
        {/* Espaciador: compensa la altura del navbar fijo para que no tape el contenido */}
        {needsNavOffset && <div className={`h-16 shrink-0 ${isPos ? 'hidden md:block' : ''}`} aria-hidden />}
        {/* Breadcrumbs fluido - hidden on home and auth pages */}
        {!isHome && !isAuthPage && (
          <div className="w-full px-[clamp(1rem,4vw,3rem)] pt-4">
            <Breadcrumbs />
          </div>
        )}
        {/* Main fluido */}
        <main className={`flex-1 w-full ${isHome || isAuthPage ? '' : 'px-[clamp(1rem,4vw,3rem)] py-[clamp(1rem,2.5vw,2rem)]'}`}>
          <div className="w-full">
            <Suspense fallback={isHome ? homeFallback : isAuthPage ? authFallback : <PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* Footer global (no en auth): completo solo en el home */}
        {!isAuthPage && <Footer showFull={isHome} />}

        {!isOnline && (
          <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur-md">
            <WifiOff className="w-4 h-4 inline" /> Sin conexión — offline
          </div>
        )}
        {isInstallable && (
          <div className="fixed bottom-4 left-4 z-40">
            <button onClick={installPWA} className="rounded-xl border border-blue-400/30 bg-blue-500/90 px-4 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur-md transition hover:scale-105">
              <Download className="w-4 h-4 inline" /> Instalar App
            </button>
          </div>
        )}
        <CacheMonitorComponent />
        <AnalyticsDashboardComponent />
      </div>
    </div>
  );
}

// Para páginas públicas sin card contenedor (Home hero) — full-bleed
export function FluidPage({ children, className = '' }) {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
