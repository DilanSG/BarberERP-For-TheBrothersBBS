import React, { useEffect, useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useSocioStatus } from '@hooks/useSocioStatus';
import { Link } from 'react-router-dom';
import { PageContainer } from '@components/layout/PageContainer';
import GradientButton from '@components/ui/GradientButton';
import UserAvatar from '@components/ui/UserAvatar';
import { Skeleton, ProfileSkeleton, ScheduleListSkeleton } from '@components/ui/Skeleton';
import { barberService } from '@services/barberService';
import { formatCurrency } from '@utils/formatters';
import logger from '@utils/logger';
import {
  User,
  Mail,
  Phone,
  Cake,
  Edit3,
  Crown,
  Clock,
  Scissors,
  Shield,
  Star,
  Award,
  CheckCircle2
} from 'lucide-react';

// Configuración visual por rol (admin = azul · barber = rojo · cliente = neutro)
const ROLE_CONFIG = {
  admin: {
    label: 'Administrador',
    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    banner: 'from-blue-500/[0.12] to-transparent',
    glow: 'bg-blue-500/10',
    icon: Shield
  },
  barber: {
    label: 'Barbero',
    badge: 'bg-red-500/10 border-red-500/20 text-red-300',
    banner: 'from-red-500/[0.12] to-transparent',
    glow: 'bg-red-500/10',
    icon: Scissors
  },
  user: {
    label: 'Cliente',
    badge: 'bg-white/[0.06] border-white/[0.10] text-gray-300',
    banner: 'from-white/[0.07] to-transparent',
    glow: 'bg-white/[0.05]',
    icon: User
  }
};

// Días de la semana en orden de lunes a domingo, con su índice JS (getDay)
const WEEK_DAYS = [
  { key: 'monday', label: 'Lunes', jsDay: 1 },
  { key: 'tuesday', label: 'Martes', jsDay: 2 },
  { key: 'wednesday', label: 'Miércoles', jsDay: 3 },
  { key: 'thursday', label: 'Jueves', jsDay: 4 },
  { key: 'friday', label: 'Viernes', jsDay: 5 },
  { key: 'saturday', label: 'Sábado', jsDay: 6 },
  { key: 'sunday', label: 'Domingo', jsDay: 0 }
];

// ── Sub-componentes ────────────────────────────────

// Card de sección reutilizable: título con icono/accento opcional y contenido
const SectionCard = ({ title, icon: Icon, accentBox, accentText, children, action }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-xl border flex-shrink-0 ${accentBox}`}>
          <Icon className={`w-5 h-5 ${accentText}`} />
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-white truncate">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </div>
);

// Fila de dato etiqueta/valor usada en las cards de información
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-white/[0.06] last:border-0 last:pb-0">
    <Icon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-white font-medium break-words">{value}</p>
    </div>
  </div>
);

// Métrica compacta del header (valor grande + etiqueta)
const QuickStat = ({ icon: Icon, value, label, accentBox, accentText }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <div className={`p-2 rounded-lg border flex-shrink-0 ${accentBox}`}>
      <Icon className={`w-4 h-4 ${accentText}`} />
    </div>
    <div className="min-w-0">
      <p className="text-base sm:text-lg font-bold text-white leading-tight truncate">{value}</p>
      <p className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</p>
    </div>
  </div>
);

// Skeleton de la grilla de servicios mientras carga el perfil de barbero
const ServicesSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3.5 w-24 rounded-sm" />
            <Skeleton className="h-2.5 w-14 rounded-sm" />
          </div>
        </div>
        <Skeleton className="h-4 w-20 rounded-sm" />
      </div>
    ))}
  </div>
);

// ── Página ─────────────────────────────────────────

// Página "Mi Perfil".
// Muestra los datos del usuario autenticado y, si es barbero, amplía la vista
// con su perfil profesional (horario semanal, servicios, rating y experiencia).
function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { isSocio, isFounder, porcentaje } = useSocioStatus();

  // Perfil de barbero (solo se consulta cuando el rol es barber)
  const [barberProfile, setBarberProfile] = useState(null);
  const [barberLoading, setBarberLoading] = useState(false);

  const isBarber = user?.role === 'barber';
  const roleConfig = ROLE_CONFIG[user?.role] || ROLE_CONFIG.user;
  const RoleIcon = roleConfig.icon;

  // Cargar perfil de barbero (horario + servicios)
  // Se resuelve por user._id y se ignora en silencio si falla (la vista básica sigue)
  useEffect(() => {
    if (!isBarber || !user?._id) return;

    let mounted = true;
    const loadBarberProfile = async () => {
      setBarberLoading(true);
      try {
        const response = await barberService.getBarberByUserId(user._id);
        if (mounted) setBarberProfile(response?.data || null);
      } catch (error) {
        logger.warn('No se pudo cargar el perfil de barbero:', error?.message);
      } finally {
        if (mounted) setBarberLoading(false);
      }
    };

    loadBarberProfile();
    return () => { mounted = false; };
  }, [isBarber, user?._id]);

  // Mientras se resuelve la sesión
  if (authLoading && !user) {
    return (
      <PageContainer>
        <div className="w-full pb-6">
          <ProfileSkeleton />
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <div className="w-full py-16 text-center">
          <p className="text-gray-400">No has iniciado sesión.</p>
        </div>
      </PageContainer>
    );
  }

  // Fecha local del usuario (ajustada por zona horaria) en formato largo es-ES
  const formatDate = (dateString) => {
    if (!dateString) return 'No especificado';
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
    return adjustedDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Normaliza el rating (objeto {average,count} o número) a un decimal; null si es 0
  const formatRating = (rating) => {
    if (!rating) return null;
    const average = typeof rating === 'object' ? rating.average : rating;
    return average > 0 ? Number(average).toFixed(1) : null;
  };

  const schedule = barberProfile?.schedule;
  const services = Array.isArray(barberProfile?.services) ? barberProfile.services : [];
  const rating = formatRating(barberProfile?.rating);
  const todayJsDay = new Date().getDay();

  // Días activos del horario
  const activeDays = schedule
    ? WEEK_DAYS.filter(d => schedule[d.key]?.available).length
    : 0;

  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">

        {/* ── Header: identidad ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
          {/* Decoración del header: capas absolutas dentro de la card, se desvanecen sin cortes */}
          <div className={`absolute inset-x-0 top-0 h-48 bg-gradient-to-b ${roleConfig.banner} pointer-events-none`} aria-hidden />
          <div className={`absolute -top-32 left-1/4 w-80 h-80 rounded-full blur-3xl ${roleConfig.glow} pointer-events-none`} aria-hidden />

          <div className="relative px-5 sm:px-8 py-5 sm:py-6">
            {/* Avatar + identidad + acción */}
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-4 sm:gap-6">
              <UserAvatar
                user={{ ...user, isFounder }}
                size="xl"
                className="flex-shrink-0"
              />

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                  {user.name || 'Sin nombre'}
                </h1>
                <p className="text-sm text-gray-400 truncate mt-0.5">{user.email}</p>
              </div>

              <div className="w-full sm:w-auto flex-shrink-0">
                <Link
                  to="/profile-edit"
                  state={{ breadcrumbParent: { label: 'Mi Perfil', path: '/profile' } }}
                  className="block w-full sm:w-auto"
                >
                  <GradientButton variant="primary" size="md" className="w-full sm:w-auto">
                    <div className="flex items-center justify-center gap-2">
                      <Edit3 size={16} />
                      <span className="text-sm">Editar Perfil</span>
                    </div>
                  </GradientButton>
                </Link>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-4 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleConfig.badge}`}>
                <RoleIcon className="w-3 h-3" />
                {roleConfig.label}
              </span>

              {isSocio && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-brand-500/10 border-brand-500/20 text-brand-300">
                  <Crown className="w-3 h-3" />
                  {isFounder ? 'Socio Fundador' : 'Socio'}
                  {porcentaje > 0 && <span className="text-brand-400/80">· {porcentaje}%</span>}
                </span>
              )}

              {isBarber && barberProfile?.specialty && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white/[0.06] border-white/[0.10] text-gray-300">
                  <Scissors className="w-3 h-3" />
                  {barberProfile.specialty}
                </span>
              )}
            </div>

            {/* Quick stats (solo barbero) */}
            {isBarber && !barberLoading && (rating || barberProfile?.experience > 0 || services.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-white/[0.06]">
                {rating && (
                  <QuickStat
                    icon={Star}
                    value={rating}
                    label="Calificación"
                    accentBox="bg-amber-500/10 border-amber-500/20"
                    accentText="text-amber-300"
                  />
                )}
                <QuickStat
                  icon={Award}
                  value={barberProfile?.experience || 0}
                  label={barberProfile?.experience === 1 ? 'Año de experiencia' : 'Años de experiencia'}
                  accentBox="bg-blue-500/10 border-blue-500/20"
                  accentText="text-blue-400"
                />
                <QuickStat
                  icon={Scissors}
                  value={services.length}
                  label={services.length === 1 ? 'Servicio' : 'Servicios'}
                  accentBox="bg-brand-500/10 border-brand-500/20"
                  accentText="text-brand-300"
                />
                <QuickStat
                  icon={CheckCircle2}
                  value={`${activeDays}/7`}
                  label="Días activos"
                  accentBox="bg-emerald-500/10 border-emerald-500/20"
                  accentText="text-emerald-400"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Información: personal + contacto ── */}
        <div className="grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-2">
          <SectionCard
            title="Información Personal"
            icon={User}
            accentBox="bg-blue-500/10 border-blue-500/20"
            accentText="text-blue-400"
          >
            <InfoRow icon={User} label="Nombre completo" value={user.name || 'No especificado'} />
            <InfoRow icon={Cake} label="Fecha de nacimiento" value={formatDate(user.birthdate)} />
          </SectionCard>

          <SectionCard
            title="Información de Contacto"
            icon={Mail}
            accentBox="bg-blue-500/10 border-blue-500/20"
            accentText="text-blue-400"
          >
            <InfoRow icon={Mail} label="Correo electrónico" value={user.email} />
            <InfoRow icon={Phone} label="Teléfono" value={user.phone || 'No especificado'} />
          </SectionCard>
        </div>

        {/* ── Secciones exclusivas de barbero ── */}
        {isBarber && (
          <>
            {/* Horario semanal */}
            <SectionCard
              title="Horario de Atención"
              icon={Clock}
              accentBox="bg-emerald-500/10 border-emerald-500/20"
              accentText="text-emerald-400"
              action={
                !barberLoading && schedule && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {activeDays} de 7 días
                  </span>
                )
              }
            >
              {barberLoading ? (
                <ScheduleListSkeleton rows={7} />
              ) : schedule ? (
                <div>
                  {/* Un renglón por día: resalta el día actual y muestra horario o "Descanso" */}
                  {WEEK_DAYS.map(({ key, label, jsDay }) => {
                    const day = schedule[key];
                    const available = Boolean(day?.available);
                    const isToday = jsDay === todayJsDay;

                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between gap-3 py-3 px-3 -mx-3 rounded-xl border-b border-white/[0.06] last:border-0 transition-colors ${
                          isToday ? 'bg-white/[0.04]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${available ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                          <span className={`text-sm truncate ${isToday ? 'text-white font-semibold' : 'text-gray-300'}`}>
                            {label}
                            {isToday && <span className="ml-2 text-[10px] font-medium text-brand-300 uppercase tracking-wide">Hoy</span>}
                          </span>
                        </div>

                        {available ? (
                          <span className={`text-sm font-medium flex-shrink-0 ${isToday ? 'text-emerald-300' : 'text-gray-400'}`}>
                            {day.start} – {day.end}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 flex-shrink-0">Descanso</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay horario configurado. Edita tu perfil para establecerlo.
                </p>
              )}
            </SectionCard>

            {/* Servicios */}
            <SectionCard
              title="Servicios que Ofrezco"
              icon={Scissors}
              accentBox="bg-brand-500/10 border-brand-500/20"
              accentText="text-brand-300"
              action={
                services.length > 0 && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {services.length} servicio{services.length !== 1 ? 's' : ''}
                  </span>
                )
              }
            >
              {barberLoading ? (
                <ServicesSkeleton />
              ) : services.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {services.map((service) => (
                    <div
                      key={service._id}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:border-white/[0.16] hover:bg-white/[0.04] transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 mb-3">
                        <div className="p-2 rounded-lg bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
                          <Scissors className="w-4 h-4 text-brand-300" />
                        </div>
                        <p className="text-sm text-white font-medium truncate">{service.name}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
                        {service.price !== undefined && service.price !== null ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
                            {formatCurrency(service.price)}
                          </span>
                        ) : <span />}

                        {service.duration && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {service.duration} min
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No tienes servicios asignados. Contacta al administrador.
                </p>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </PageContainer>
  );
}

export default Profile;
