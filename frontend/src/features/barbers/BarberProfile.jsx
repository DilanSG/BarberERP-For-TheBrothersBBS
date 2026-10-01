import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { api } from '@services/api';
import {PageContainer} from '@components/layout/PageContainer';
import { 
  User, 
  ArrowLeft,
  Clock, 
  Phone, 
  Mail, 
  Star, 
  Scissors, 
  Calendar, 
  Award,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import GradientButton from '@components/ui/GradientButton';
import { PageSkeleton } from '@components/ui/Skeleton';

import logger from '@utils/logger';

// Formatea un valor como precio en pesos colombianos (COP).
const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price || 0);
};

// Perfil público de un barbero (ruta /barbers/:id).
// Carga sus datos por id; si quien consulta es admin, además pide sus estadísticas
// (citas, ingresos del mes, rating y servicios más solicitados).
// Muestra foto/avatar, contacto, horario semanal, servicios y el botón de reserva.
export default function BarberProfile() {
  const { id } = useParams();
  const [barber, setBarber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [imageError, setImageError] = useState(false);
  const { user } = useAuth();

  // Activa el avatar por defecto cuando la foto del barbero falla al cargar.
  const handleImageError = () => {
    setImageError(true);
  };

  // Al cambiar de barbero recarga los datos y reinicia el estado de error de imagen.
  useEffect(() => {
    fetchBarberData();
    setImageError(false); // Reset image error state cuando cambie el barbero
  }, [id]);

  // Obtiene el perfil del barbero; para administradores también consulta
  // las estadísticas, que son opcionales y no bloquean el perfil.
  const fetchBarberData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/barbers/${id}`);
      
      if (response.success) {
        logger.debug('Datos del barbero recibidos:', response.data);
        setBarber(response.data);
        
        // Si es admin, obtener estadísticas
        if (user?.role === 'admin') {
          try {
            const statsResponse = await api.get(`/barbers/${id}/stats`);
            if (statsResponse.success) {
              setStats(statsResponse.data);
            }
          } catch (statsError) {
            console.warn('No se pudieron cargar las estadísticas:', statsError);
          }
        }
      } else {
        setError('Error al cargar los datos del barbero');
      }
    } catch (error) {
      console.error('Error fetching barber data:', error);
      if (error.response?.status === 404) {
        setError('Barbero no encontrado');
      } else {
        setError('Error al conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de carga mientras llega el perfil.
  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center min-h-[60vh] p-4">
          <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/40 rounded-2xl p-8 shadow-xl shadow-soft text-center">
            <div className="mx-auto mb-4">
              <PageSkeleton variant="barbers" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Cargando perfil...</h3>
            <p className="text-gray-400">Obteniendo información del barbero</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Error de red o 404: muestra el mensaje y el enlace de regreso.
  if (error) {
    return (
      <PageContainer>
        <div className="flex flex-col justify-center items-center min-h-[60vh] p-4">
          <div className="bg-red-500/5 backdrop-blur-md border border-red-500/20 rounded-2xl shadow-2xl shadow-soft p-8 max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-red-300 mb-4">{error}</h3>
            <Link
              to="/barbers"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-medium hover:from-red-500 hover:to-red-400 transition-all duration-300 shadow-xl shadow-soft"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a barberos
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Caso sin datos: aviso de barbero no encontrado.
  if (!barber) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center min-h-[60vh] p-4">
          <div className="bg-amber-500/5 backdrop-blur-md border border-amber-500/20 rounded-2xl shadow-2xl shadow-soft p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-amber-300 mb-2">Barbero no encontrado</h3>
            <p className="text-gray-300 mb-6">El barbero que buscas no existe o ha sido eliminado.</p>
            <Link
              to="/barbers"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl font-medium hover:from-amber-500 hover:to-amber-400 transition-all duration-300 shadow-xl shadow-soft"
            >
              Ver barberos disponibles
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Vista del perfil: encabezado con regreso, tarjeta principal con foto y datos,
  // horario de atención, servicios disponibles (con reserva para clientes) y
  // bloque de estadísticas visible solo para administradores.
  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">

        {/* ── Top bar: regreso + nombre + acciones ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/barbers"
              className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              title="Volver a barberos"
              aria-label="Volver a barberos"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                Perfil del Barbero
              </h1>
              <p className="text-xs sm:text-sm text-gray-400">
                Información, horario y servicios disponibles
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-2 lg:justify-end">
            {barber?.rating?.average > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-amber-300">
                <Star className="w-3.5 h-3.5 fill-current" />
                {barber.rating.average.toFixed(1)}
                <span className="text-gray-500">({barber.rating.count} reseñas)</span>
              </span>
            )}
            {user && user.role === 'user' && (
              <GradientButton
                as={Link}
                to={`/appointment?barberId=${barber?._id}`}
                size="sm"
                className="shadow-soft hidden sm:inline-flex"
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Reservar cita
                </span>
              </GradientButton>
            )}
          </div>
        </div>

        {/* ── Stats strip (solo admin) ── */}
        {user?.role === 'admin' && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="p-2 rounded-lg border bg-blue-500/15 border-blue-500/25 flex-shrink-0">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-white leading-tight">{stats.totalAppointments || 0}</p>
                <p className="text-gray-400 text-xs truncate">Total citas</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="p-2 rounded-lg border bg-emerald-500/15 border-emerald-500/25 flex-shrink-0">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{formatPrice(stats.totalRevenue || 0)}</p>
                <p className="text-gray-400 text-xs truncate">Ingresos</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="p-2 rounded-lg border bg-brand-500/15 border-brand-500/25 flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-brand-300" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-white leading-tight">{stats.currentMonthAppointments || 0}</p>
                <p className="text-gray-400 text-xs truncate">Citas este mes</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="p-2 rounded-lg border bg-amber-500/15 border-amber-500/25 flex-shrink-0">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-white leading-tight">{stats.averageRating || '0.0'}</p>
                <p className="text-gray-400 text-xs truncate">Rating</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Perfil principal ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 sm:gap-6">
            {/* Foto de perfil */}
            <div className="relative flex-shrink-0">
              {(() => {
                // Si el perfil es el del propio usuario logueado se prioriza su foto actual
                const isCurrentUser = user && barber && (user._id === barber.user?._id || user._id === barber._id);
                const profilePicture = isCurrentUser
                  ? user.profilePicture
                  : (barber?.user?.profilePicture || barber?.photo?.url);

                return (profilePicture && !imageError) ? (
                  <img
                    src={profilePicture}
                    alt={barber?.user?.name || barber?.name}
                    className="w-24 h-24 lg:w-32 lg:h-32 rounded-full object-cover border-2 border-white/[0.08]"
                    onError={handleImageError}
                    onLoad={() => setImageError(false)}
                  />
                ) : (
                  <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <User className="w-10 h-10 lg:w-14 lg:h-14 text-gray-400" />
                  </div>
                );
              })()}
            </div>

            {/* Información principal */}
            <div className="flex-1 w-full min-w-0 text-center lg:text-left">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">
                {barber?.user?.name || barber?.name}
              </h2>
              <p className="text-sm sm:text-base text-gray-400 mb-4">
                {barber?.specialty || 'Barbero Profesional'}
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-gray-300">
                {(barber?.user?.email || barber?.email) && (
                  <span className="flex min-w-0 items-center gap-2">
                    <Mail className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    <span className="truncate">{barber?.user?.email || barber?.email}</span>
                  </span>
                )}
                {(barber?.user?.phone || barber?.phone) && (
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    <span>{barber?.user?.phone || barber?.phone}</span>
                  </span>
                )}
                {barber?.experience && (
                  <span className="flex items-center gap-2">
                    <Award className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    <span>{barber.experience} años de experiencia</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sobre mí */}
          {barber?.description && (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sobre mí</h3>
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed">{barber.description}</p>
            </div>
          )}
        </div>

        {/* ── Horario de atención ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Clock className="w-5 h-5 text-brand-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Horario de Atención</h2>
              <p className="text-xs text-gray-400">Disponibilidad semanal</p>
            </div>
          </div>

          {barber?.schedule ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.entries(barber.schedule).map(([day, info]) => {
                  // Nombres abreviados de los días para las tarjetas del horario
                  const dayNames = {
                    monday: 'Lun',
                    tuesday: 'Mar',
                    wednesday: 'Mié',
                    thursday: 'Jue',
                    friday: 'Vie',
                    saturday: 'Sáb',
                    sunday: 'Dom'
                  };

                  return (
                    <div
                      key={day}
                      className={`rounded-xl border p-2.5 text-center transition-colors ${
                        info.available
                          ? 'border-emerald-500/25 bg-emerald-500/5'
                          : 'border-white/[0.08] bg-white/[0.02]'
                      }`}
                    >
                      <p className={`text-xs font-semibold ${info.available ? 'text-emerald-300' : 'text-gray-500'}`}>
                        {dayNames[day]}
                      </p>
                      <p className={`mt-0.5 text-xs whitespace-nowrap ${info.available ? 'text-white' : 'text-gray-500'}`}>
                        {info.available ? `${info.start} - ${info.end}` : 'Cerrado'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Resumen de días disponibles (solo si hay días cerrados) */}
              {(() => {
                const availableDays = Object.values(barber.schedule).filter(day => day.available).length;
                const totalDays = Object.keys(barber.schedule).length;
                return availableDays > 0 && availableDays < totalDays ? (
                  <p className="text-center text-gray-400 text-xs mt-4">
                    Disponible {availableDays} de {totalDays} días
                  </p>
                ) : null;
              })()}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Horario no disponible</p>
            </div>
          )}
        </div>

        {/* ── Servicios disponibles ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Scissors className="w-5 h-5 text-brand-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-white">Servicios Disponibles</h2>
              <p className="text-xs text-gray-400">
                {barber?.services?.length || 0} servicio{(barber?.services?.length || 0) !== 1 ? 's' : ''} disponibles
              </p>
            </div>
          </div>

          {barber?.services?.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {barber.services.slice(0, 6).map((service, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="min-w-0 text-sm font-medium text-white">{service.name}</h4>
                      <span className="flex-shrink-0 text-sm font-semibold text-emerald-400">
                        {formatPrice(service.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {service.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {service.duration} min
                        </span>
                      )}
                      {service.description && (
                        <span className="min-w-0 truncate">{service.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Aviso cuando hay más servicios de los mostrados */}
              {barber.services.length > 6 && (
                <p className="text-center text-gray-500 text-xs mt-4">
                  Mostrando 6 de {barber.services.length} servicios disponibles
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Scissors className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay servicios disponibles</p>
            </div>
          )}

          {/* Reserva (móvil: CTA grande al final; desktop ya está en el top bar) */}
          {user && user.role === 'user' && (
            <div className="pt-5 mt-5 border-t border-white/[0.06] sm:hidden">
              <GradientButton
                as={Link}
                to={`/appointment?barberId=${barber?._id}`}
                variant="primary"
                size="lg"
                className="w-full shadow-soft"
              >
                <span className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Reservar Cita
                </span>
              </GradientButton>
            </div>
          )}
        </div>

        {/* ── Servicios populares (solo admin) ── */}
        {user?.role === 'admin' && stats?.appointmentsByService?.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Servicios Populares</h2>
                <p className="text-xs text-gray-400">Los más solicitados por los clientes</p>
              </div>
            </div>

            <div className="space-y-2">
              {stats.appointmentsByService.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{s.service}</p>
                    <p className="text-xs font-medium text-emerald-400">{formatPrice(s.revenue)}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">
                    {s.count} citas
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}