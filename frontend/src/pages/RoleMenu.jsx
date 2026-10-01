import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { PageContainer } from '@components/layout/PageContainer';
import GradientText from '@components/ui/GradientText';
import UserAvatar from '@components/ui/UserAvatar';
import { Skeleton } from '@components/ui/Skeleton';
import { Reveal, StaggerGrid } from '@components/motion/Reveal';
import { MENU_ITEMS, ROLE_MENU, ROLE_STYLES } from '@shared/config/roleMenu';
import { barberService } from '@services/barberService';
import { salesService } from '@services/salesService';
import { appointmentsService } from '@services/appointmentsService';
import { appointmentService } from '@services/appointmentService';
import { inventoryService } from '@services/inventoryService';
import { formatCurrency } from '@utils/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, DollarSign, CalendarClock, AlertTriangle, Shield, Scissors } from 'lucide-react';
import logger from '@utils/logger';

// Tonos estáticos por stat (Tailwind necesita strings completos)
const STAT_TONES = {
  emerald: {
    box: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    glow: 'bg-emerald-500/20'
  },
  amber: {
    box: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    glow: 'bg-amber-500/20'
  },
  red: {
    box: 'bg-red-500/10 border-red-500/20 text-red-400',
    glow: 'bg-red-500/20'
  }
};

// Tono de color por opción del menú (cards principales y secundarias)
const ITEM_TONES = {
  pos: {
    icon: 'text-emerald-300',
    box: 'bg-emerald-500/10 border-emerald-500/20',
    glow: 'bg-emerald-500/20',
    accent: 'via-emerald-500/40',
    hover: 'hover:border-emerald-400/30'
  },
  appointments: {
    icon: 'text-amber-300',
    box: 'bg-amber-500/10 border-amber-500/20',
    glow: 'bg-amber-500/20',
    accent: 'via-amber-500/40',
    hover: 'hover:border-amber-400/30'
  },
  inventory: {
    icon: 'text-sky-300',
    box: 'bg-sky-500/10 border-sky-500/20',
    glow: 'bg-sky-500/20',
    accent: 'via-sky-500/40',
    hover: 'hover:border-sky-400/30'
  },
  reports: {
    icon: 'text-blue-300',
    box: 'bg-blue-500/10 border-blue-500/20',
    glow: 'bg-blue-500/20',
    accent: 'via-blue-500/40',
    hover: 'hover:border-blue-400/30'
  },
  barbers: {
    icon: 'text-violet-300',
    box: 'bg-violet-500/10 border-violet-500/20',
    glow: 'bg-violet-500/20',
    accent: 'via-violet-500/40',
    hover: 'hover:border-violet-400/30'
  },
  services: {
    icon: 'text-red-300',
    box: 'bg-red-500/10 border-red-500/20',
    glow: 'bg-red-500/20',
    accent: 'via-red-500/40',
    hover: 'hover:border-red-400/30'
  },
  invoices: {
    icon: 'text-orange-300',
    box: 'bg-orange-500/10 border-orange-500/20',
    glow: 'bg-orange-500/20',
    accent: 'via-orange-500/40',
    hover: 'hover:border-orange-400/30'
  },
  roles: {
    icon: 'text-brand-300',
    box: 'bg-brand-500/10 border-brand-500/20',
    glow: 'bg-brand-500/20',
    accent: 'via-brand-500/40',
    hover: 'hover:border-brand-400/30'
  },
  profile: {
    icon: 'text-gray-300',
    box: 'bg-white/[0.05] border-white/[0.10]',
    glow: 'bg-white/10',
    accent: 'via-white/20',
    hover: 'hover:border-white/[0.2]'
  }
};

// Menú principal para admin y barber (reemplaza el Home público para estos roles).
// Layout bento: header + stats en una barra, acción principal destacada
// y opciones con color por tipo de tarea.
function RoleMenu() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Configuración de menú y estilos según el rol (admin o barbero)
  const role = user?.role === 'admin' ? 'admin' : 'barber';
  const roleConfig = ROLE_MENU[role];
  const roleStyles = ROLE_STYLES[role];
  const RoleIcon = role === 'admin' ? Shield : Scissors;

  // Carga las 3 métricas del menú según el rol; cada llamada falla de forma
  // independiente (allSettled) y el valor queda en null si no está disponible.
  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const loadStats = async () => {
      setStatsLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      try {
        // Admin: reporte diario de ventas + citas por estado + productos con stock bajo
        if (role === 'admin') {
          const [dailyRes, appointmentsRes, lowStockRes] = await Promise.allSettled([
            salesService.getDailyReport(today),
            appointmentsService.getAppointmentStats(),
            inventoryService.getLowStockItems()
          ]);

          if (!mounted) return;
          setStats({
            salesToday: dailyRes.status === 'fulfilled'
              ? (dailyRes.value?.data?.totals?.grandTotal ?? null)
              : null,
            pendingAppointments: appointmentsRes.status === 'fulfilled'
              ? (appointmentsRes.value?.data?.byStatus?.pending?.count ?? 0)
              : null,
            lowStock: lowStockRes.status === 'fulfilled' && Array.isArray(lowStockRes.value?.data)
              ? lowStockRes.value.data.length
              : null
          });
        } else {
          // Barbero: resolver perfil para consultar sus estadísticas de ventas
          let barberId = null;
          try {
            const profileRes = await barberService.getBarberByUserId(user._id);
            barberId = profileRes?.data?._id || null;
          } catch (profileError) {
            logger.warn('No se pudo obtener el perfil del barbero para stats:', profileError?.message);
          }

          const [salesRes, appointmentsRes, lowStockRes] = await Promise.allSettled([
            barberId
              ? salesService.getBarberSalesStats(barberId, { date: today })
              : Promise.resolve(null),
            appointmentService.getAppointments(),
            inventoryService.getLowStockItems()
          ]);

          if (!mounted) return;

          const appointments = appointmentsRes.status === 'fulfilled' && Array.isArray(appointmentsRes.value?.data)
            ? appointmentsRes.value.data
            : null;

          setStats({
            salesToday: salesRes.status === 'fulfilled' && salesRes.value
              ? (salesRes.value?.data?.total ?? null)
              : null,
            pendingAppointments: appointments
              ? appointments.filter(a => a.status === 'pending').length
              : null,
            lowStock: lowStockRes.status === 'fulfilled' && Array.isArray(lowStockRes.value?.data)
              ? lowStockRes.value.data.length
              : null
          });
        }
      } catch (error) {
        logger.warn('Error cargando estadísticas del menú:', error?.message);
      } finally {
        if (mounted) setStatsLoading(false);
      }
    };

    loadStats();
    return () => { mounted = false; };
  }, [user, role]);

  if (!user) return null;

  // Saludo según la hora del día
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  // Métricas mostradas en la barra de stats (formato y tono por tarjeta)
  const statCards = [
    {
      id: 'sales',
      label: role === 'admin' ? 'Ventas hoy' : 'Mis ventas hoy',
      value: stats?.salesToday,
      icon: DollarSign,
      format: (v) => formatCurrency(v),
      tone: 'emerald'
    },
    {
      id: 'appointments',
      label: 'Citas pendientes',
      value: stats?.pendingAppointments,
      icon: CalendarClock,
      format: (v) => v,
      tone: 'amber'
    },
    {
      id: 'lowStock',
      label: 'Productos con stock bajo',
      value: stats?.lowStock,
      icon: AlertTriangle,
      format: (v) => v,
      tone: 'red'
    }
  ];

  // Busca la definición del ítem y aplica los overrides específicos del rol
  const resolveItem = (itemId) => {
    const item = MENU_ITEMS[itemId];
    if (!item) return null;
    const override = item.overrides?.[role];
    return override ? { ...item, ...override } : item;
  };

  // Tono de color del ítem (fallback al tono neutro de perfil)
  const getTone = (itemId) => ITEM_TONES[itemId] || ITEM_TONES.profile;

  // ── Card principal (bento) ──
  const renderPrimary = (itemId) => {
    const item = resolveItem(itemId);
    if (!item) return null;
    const Icon = item.icon;
    const tone = getTone(item.id);

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.05] hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:p-7 lg:col-span-3 ${tone.hover}`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${tone.accent} to-transparent`} />
        <Icon className={`pointer-events-none absolute -bottom-10 -right-6 h-48 w-48 opacity-[0.05] ${tone.icon}`} />

        <div className={`relative mb-6 w-fit rounded-2xl border p-3.5 transition-transform duration-300 group-hover:scale-105 ${tone.box}`}>
          <Icon className={`h-7 w-7 ${tone.icon}`} />
        </div>

        <h3 className="relative mb-2 text-2xl font-bold text-white sm:text-3xl">{item.label}</h3>
        <p className="relative mb-6 max-w-md text-sm leading-relaxed text-gray-400">{item.description}</p>

        <span className="relative mt-auto inline-flex w-fit items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition-all duration-300 group-hover:border-white/[0.2] group-hover:bg-white/[0.1]">
          Abrir
          <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Link>
    );
  };

  // ── Card destacada compacta ──
  const renderFeatured = (itemId) => {
    const item = resolveItem(itemId);
    if (!item) return null;
    const Icon = item.icon;
    const tone = getTone(item.id);

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.05] ${tone.hover}`}
      >
        <div className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-0 blur-[60px] transition-opacity duration-500 group-hover:opacity-100 ${tone.glow}`} />

        <div className="relative mb-6 flex items-start justify-between">
          <div className={`rounded-xl border p-3 transition-transform duration-300 group-hover:scale-105 ${tone.box}`}>
            <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${tone.icon}`} />
          </div>
          <ChevronRight className="h-5 w-5 text-gray-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white" />
        </div>

        <div className="relative">
          <h3 className="mb-1 text-base font-semibold text-white sm:text-lg">{item.label}</h3>
          <p className="text-xs leading-relaxed text-gray-400">{item.description}</p>
        </div>
      </Link>
    );
  };

  // ── Card secundaria ──
  const renderSecondary = (itemId) => {
    const item = resolveItem(itemId);
    if (!item) return null;
    const Icon = item.icon;
    const tone = getTone(item.id);

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.05] ${tone.hover}`}
      >
        <div className={`pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full opacity-0 blur-[55px] transition-opacity duration-500 group-hover:opacity-100 ${tone.glow}`} />

        <div className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105 ${tone.box}`}>
          <Icon className={`h-5 w-5 ${tone.icon}`} />
        </div>

        <div className="relative min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{item.label}</p>
          <p className="truncate text-xs text-gray-500">{item.description}</p>
        </div>

        <ChevronRight className="relative h-4 w-4 flex-shrink-0 text-gray-600 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
      </Link>
    );
  };

  // La primera acción destacada se renderiza como card principal y el resto como compactas
  const [primaryId, ...restFeatured] = roleConfig.featured;

  return (
    <PageContainer>
      <div className="relative z-10 w-full px-[clamp(1rem,4vw,3rem)] pt-5 sm:pt-6 pb-6 space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-[100px] ${roleStyles.glow}`} />
            <RoleIcon className={`pointer-events-none absolute -bottom-8 -right-4 h-36 w-36 opacity-[0.05] ${roleStyles.iconColor}`} />

            <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatar user={user} size="lg" className="shadow-lg shadow-soft flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs sm:text-sm">{greeting},</p>
                  <GradientText className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
                    {user.name || user.email}
                  </GradientText>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleStyles.badge}`}>
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig.label}
                    </span>
                    <span className="text-gray-500 text-xs capitalize">
                      {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ── Stats (barra segmentada) ── */}
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className="relative grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {statCards.map(({ id, label, value, icon: Icon, format: formatValue, tone }) => {
                const toneStyles = STAT_TONES[tone];
                return (
                  <div key={id} className="group relative flex items-center gap-3 p-4 sm:p-5">
                    <div className={`pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full blur-[45px] opacity-50 ${toneStyles.glow}`} />
                    <div className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border ${toneStyles.box}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="relative min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                      {/* Skeleton mientras cargan las estadísticas; "—" si no hay dato */}
                      {statsLoading ? (
                        <Skeleton className="h-6 w-20 rounded-md mt-1" />
                      ) : (
                        <p className="text-xl font-bold text-white leading-tight truncate">
                          {value === null || value === undefined ? '—' : formatValue(value)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* ── Acciones principales (bento) ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Acciones principales</h2>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>
          <StaggerGrid className="grid gap-4 lg:grid-cols-5">
            {renderPrimary(primaryId)}
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
              {restFeatured.map(renderFeatured)}
            </div>
          </StaggerGrid>
        </div>

        {/* ── Más opciones ── */}
        {roleConfig.secondary.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Más opciones</h2>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roleConfig.secondary.map(renderSecondary)}
            </StaggerGrid>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default RoleMenu;
