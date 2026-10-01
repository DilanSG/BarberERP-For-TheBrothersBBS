// Página pública con el listado de barberos.
// Obtiene los barberos desde /barbers, muestra solo los activos, calcula su
// disponibilidad según horario y ordena por rating; refresca al volver a la pestaña.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@services/api';
import { useAuth } from '@contexts/AuthContext';
import { PageContainer } from '@components/layout/PageContainer';
import GradientButton from '@components/ui/GradientButton';
import { PublicBarbersSkeleton } from '@components/ui/Skeleton';
import { Star, Award, User, Scissors, ChevronRight, Calendar } from 'lucide-react';

import logger from '@utils/logger';

// Formatear precio
const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price || 0);
};

// Componente de loading con skeleton del layout real
const LoadingSkeleton = () => (
  <PageContainer>
    <div className="relative z-10 w-full pb-6">
      <PublicBarbersSkeleton cards={6} />
    </div>
  </PageContainer>
);

// Pantalla de error con botón para recargar la página
const ErrorMessage = ({ message }) => (
  <PageContainer>
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-red-500/5 backdrop-blur-md border border-red-500/20 rounded-2xl shadow-2xl shadow-soft p-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-red-300 mb-4">Error al cargar</h3>
          <p className="text-gray-300 mb-6">{message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-medium hover:from-red-500 hover:to-red-400 transition-all duration-300 shadow-xl shadow-soft"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  </PageContainer>
);

// Determinar disponibilidad del barbero en tiempo real
// Compara la hora actual con el horario del día y devuelve { available, reason }
// donde reason explica el estado (sin horario, no trabaja hoy, abre/cerró, hasta las X).
const getBarberAvailability = (barber) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // 'HH:MM'

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayName = dayNames[now.getDay()];

  if (!barber.schedule || !barber.schedule[currentDayName]) {
    return { available: false, reason: 'Sin horario definido' };
  }

  const todaySchedule = barber.schedule[currentDayName];

  if (!todaySchedule.available) {
    return { available: false, reason: 'No trabaja hoy' };
  }

  const startTime = todaySchedule.start;
  const endTime = todaySchedule.end;

  if (currentTime < startTime) {
    return { available: false, reason: `Abre a las ${startTime}` };
  }

  if (currentTime > endTime) {
    return { available: false, reason: `Cerró a las ${endTime}` };
  }

  return { available: true, reason: `Hasta las ${endTime}` };
};

// Tarjeta de un barbero: foto, disponibilidad, badges (rating/experiencia),
// servicios destacados y acciones (ver perfil / reservar cita).
const BarberCard = ({ barber }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!barber || !barber.user) {
    console.error('Barbero inválido:', barber);
    return null;
  }

  // Solo mostrar botón de reservar a usuarios normales
  const canBook = user && user.role === 'user';
  
  // Determinar el estado del barbero
  const availability = getBarberAvailability(barber);
  const isAvailable = barber.isActive && availability.available;

  return (
    <article className="group relative overflow-hidden rounded-2xl transition-colors duration-300 bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.05] flex flex-col h-full">
      {/* Efecto de brillo */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-2xl"></div>
      
      {/* Header con imagen */}
      <div className="theme-dark-island relative h-56 sm:h-80 overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10"></div>
        {barber.photo?.url || barber.user?.profilePicture ? (
          <button
            onClick={() => navigate(`/barbers/${barber._id}`)}
            className="w-full h-full group/photo cursor-pointer"
          >
            <img
              src={barber.photo?.url || barber.user?.profilePicture}
              alt={barber.user?.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-105"
            />
          </button>
        ) : (
          <button
            onClick={() => navigate(`/barbers/${barber._id}`)}
            className="w-full h-full bg-white/[0.03] flex items-center justify-center group/photo cursor-pointer hover:bg-white/[0.05] transition-colors duration-300"
          >
            <div className="p-4 rounded-full bg-white/[0.04] border border-white/[0.08]">
              <User className="w-20 h-20 text-gray-500 group-hover/photo:text-gray-400 transition-colors duration-300" />
            </div>
          </button>
        )}
          
          {/* Estado de disponibilidad */}
          <div className="absolute top-5 left-5 z-20">
            <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition-colors duration-300
              ${isAvailable 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                <div className="flex flex-col">
                  <span className="font-semibold leading-tight">
                    {isAvailable ? 'Disponible' : 'No disponible'}
                  </span>
                  <span className="opacity-80 leading-tight">
                    {availability.reason}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Badges flotantes */}
          <div className="absolute top-5 right-5 flex flex-col gap-2 z-20">
            {/* Rating */}
            {barber.rating?.average > 0 && (
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-500/25 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{barber.rating.average.toFixed(1)}</span>
                {barber.rating.count > 0 && (
                  <span className="text-amber-200/60">({barber.rating.count})</span>
                )}
              </div>
            )}
            
            {/* Experiencia */}
            {barber.experience > 0 && (
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-brand-300 border border-brand-500/25 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                <span>{barber.experience} años</span>
              </div>
            )}
          </div>

          {/* Nombre y especialidad */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20">
            <h2 className="text-xl font-bold mb-1.5 text-white truncate">
              {barber.user?.name}
            </h2>
            <div className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
              <p className="text-gray-300 font-medium text-sm truncate">
                {barber.specialty || 'Barbero Profesional'}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido y botones */}
        <div className="p-5 flex flex-col flex-grow">
          {/* Servicios populares */}
          <div className="flex-grow">
            {barber.services && barber.services.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Servicios destacados
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {barber.services.slice(0, 4).map((service, index) => (
                    <div
                      key={`${barber._id}-service-${service._id}-${index}`}
                      className="min-w-0 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs hover:border-white/[0.16] hover:bg-white/[0.05] transition-colors duration-200"
                    >
                      <div className="font-medium text-white mb-0.5 leading-tight truncate">
                        {service.name}
                      </div>
                      <div className="font-semibold leading-tight text-brand-300 truncate">
                        {formatPrice(service.price)}
                      </div>
                    </div>
                  ))}
                </div>
                {barber.services.length > 4 && (
                  <p className="text-xs text-center font-medium text-gray-500">
                    Y {barber.services.length - 4} servicios más...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4 mt-auto">
            <Link
              to={`/barbers/${barber._id}`}
              className="flex-1 min-h-11 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl font-semibold text-center text-sm text-gray-300 hover:text-white transition-colors duration-200 border border-white/[0.08] hover:border-white/[0.16] flex items-center justify-center gap-2 group"
            >
              Ver Perfil
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200" />
            </Link>
            {canBook && isAvailable && (
              <Link
                to={`/appointment?barberId=${barber._id}`}
                className="flex-1 min-h-11 px-4 py-2.5 bg-brand-500/15 hover:bg-brand-500/25 rounded-xl font-semibold text-center text-sm text-brand-200 hover:text-brand-100 transition-colors duration-200 border border-brand-500/30 hover:border-brand-500/50 flex items-center justify-center gap-2 group"
              >
                Reservar
                <Calendar className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
            )}
          </div>
        </div>
      </article>
  );
};

// Componente principal del listado público de barberos.
// Carga los datos, controla loading/error y calcula los barberos disponibles ahora.
const PublicBarbers = () => {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Para forzar re-render

  useEffect(() => {
    // Trae los barberos y descarta los inactivos o cuyo usuario no es barbero
    const fetchBarbers = async () => {
      try {
        const response = await api.get('/barbers');
        
        if (!response.success) {
          throw new Error('La respuesta no fue exitosa');
        }
        
        if (!Array.isArray(response.data)) {
          throw new Error('Los datos de barberos no son válidos');
        }
        
        // Mostrar todos los barberos activos con rol de barbero
        const activeBarbers = response.data.filter(barber => 
          barber.user && 
          barber.user.role === 'barber' && 
          barber.user.isActive !== false &&
          barber.isActive !== false
        );
        
        logger.debug('🔍 [PublicBarbers] Barberos activos encontrados:', activeBarbers.length);
        
        setBarbers(activeBarbers);
        setLoading(false);
      } catch (error) {
        setError(error.message || 'Error al cargar los barberos');
        setLoading(false);
      }
    };

    fetchBarbers();
    
    // También refrescar cuando la página vuelve a ser visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        logger.debug('📱 Página visible de nuevo, refrescando barberos...');
        fetchBarbers();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Actualizar disponibilidad cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 60000); // Cada 60 segundos

    return () => clearInterval(interval);
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage message={error} />;

  // Orden descendente por rating promedio
  const filteredBarbers = [...barbers].sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));

  // Contador de barberos activos que están dentro de su horario ahora mismo
  const availableNow = filteredBarbers.filter(
    (b) => b.isActive && getBarberAvailability(b).available
  ).length;

  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">
        
        {/* ── Top bar ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Scissors className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Nuestros Barberos</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                {filteredBarbers.length} profesional{filteredBarbers.length !== 1 ? 'es' : ''} · elige el tuyo y reserva tu cita
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-300">
              <span className={`w-1.5 h-1.5 rounded-full ${availableNow > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              {availableNow} disponible{availableNow !== 1 ? 's' : ''} ahora
            </span>
            <GradientButton as={Link} to="/appointment" size="sm" className="shadow-soft">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Reservar cita
              </span>
            </GradientButton>
          </div>
        </div>

        {/* Content */}
        {/* Estado vacío si no hay barberos activos; si hay, grid de tarjetas */}
        {barbers.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/40 rounded-2xl p-12 max-w-md mx-auto shadow-xl">
              <div className="w-16 h-16 bg-gray-700/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">No hay barberos disponibles</h3>
              <p className="text-gray-400 leading-relaxed">
                No hay barberos disponibles en este momento. Por favor, vuelve más tarde.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredBarbers.map((barber, index) => (
              <div 
                // key ligada a lastUpdate para forzar el re-render de la disponibilidad
                key={`${barber._id}-${lastUpdate}`}
                style={{ zIndex: filteredBarbers.length - index }}
                className="ml-1 mr-1"
              >
                <BarberCard barber={barber} />
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default PublicBarbers;

