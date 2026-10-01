import React, { useEffect, useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import GradientButton from '@components/ui/GradientButton';
import GradientText from '@components/ui/GradientText';
import ServiceCard from '@components/ui/ServiceCard';
import HoverRevealCard from '@components/ui/HoverRevealCard';
import { Reveal, StaggerGrid } from '@components/motion/Reveal';
import { FluidPage } from '@components/layout/AppLayout';
import { HomeSkeleton } from '@components/ui/Skeleton';
import HomeHero from '@components/home/HomeHero';
import RoleMenu from './RoleMenu';
import { useNavigate } from 'react-router-dom';
import { api } from '@services/api';
import logger from '@utils/logger';
import { BUSINESS } from '@shared/config/business';
import {
  Scissors,
  Clock,
  MapPin,
  Phone,
  Star,
  ArrowRight,
  Calendar,
  Users,
  Shield,
} from 'lucide-react';

// Separador visual decorativo entre secciones del landing (línea con degradado)
const SectionDivider = () => (
  <div className="relative h-px w-full max-w-5xl mx-auto my-4 sm:my-0">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-white/[0.06] border border-white/[0.1]" />
  </div>
);

// Página de inicio pública.
// Carga servicios y barberos desde la API para el landing (destacados en Home);
// si el usuario autenticado es admin o barbero, delega en RoleMenu.
function Home() {
  // Servicios y barberos destacados del landing; loading/error controlan el skeleton
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Esperar a que auth resuelva para decidir si se carga el home público
    if (authLoading) return;
    if (dataLoaded) return;
    // Admin y barber ven el menú de rol, no necesitan los datos del landing
    if (user && (user.role === 'admin' || user.role === 'barber')) return;

    // Carga en paralelo servicios y barberos; aborta si alguna respuesta falla
    const fetchData = async () => {
      try {
        const [servicesRes, barbersRes] = await Promise.all([
          api.get('/services'),
          api.get('/barbers')
        ]);

        logger.debug('Respuesta de servicios:', servicesRes);
        logger.debug('Respuesta de barberos:', barbersRes);

        if (!servicesRes.success || !barbersRes.success) {
          throw new Error('Error al cargar los datos');
        }

        const servicesData = Array.isArray(servicesRes.data) ? servicesRes.data : [];
        const barbersData = Array.isArray(barbersRes.data) ? barbersRes.data : [];

        // Solo barberos activos (usuario activo y perfil activo)
        const activeBarbers = barbersData.filter(barber => {
          return barber.user &&
            barber.user.role === 'barber' &&
            (barber.user.isActive !== false) &&
            (barber.isActive !== false);
        });

        // Se muestran los barberos marcados como principales; si no hay, los 3 primeros
        const mainBarbers = activeBarbers.filter(barber => barber.isMainBarber === true);
        const barbersToShow = mainBarbers.length > 0 ? mainBarbers : activeBarbers.slice(0, 3);

        // Solo los 3 primeros servicios marcados con showInHome
        const homeServices = servicesData.filter(service => service.showInHome === true).slice(0, 3);
        setServices(homeServices);
        setBarbers(barbersToShow);
        setDataLoaded(true);

      } catch (err) {
        console.error('Error completo:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, user, dataLoaded]);

  // Admin y barber: menú de rol en vez del landing público
  // (user se hidrata desde localStorage, no hace falta esperar a authLoading)
  if (user && (user.role === 'admin' || user.role === 'barber')) {
    return <RoleMenu />;
  }

  return (
    <FluidPage>
      {/* ============================================ */}
      {/* USER FLOATING CARD (solo auth)               */}
      {/* ============================================ */}
      {user && (
        // Tarjeta flotante de bienvenida para usuarios autenticados (avatar, rol y acceso a editar perfil)
        <div className="sticky top-14 sm:top-16 z-40 pt-3 pb-1 px-4 pointer-events-none">
          <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl backdrop-blur-md border shadow-lg pointer-events-auto transition-colors duration-300 ${
            user.role === 'admin' ? 'bg-blue-500/[0.06] border-blue-500/15' :
            user.role === 'barber' ? 'bg-red-500/[0.06] border-red-500/15' :
            'bg-white/[0.04] border-white/[0.08]'
          }`}>
            {/* Avatar */}
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.name || 'Usuario'}
                className="w-9 h-9 rounded-full object-cover border-2 border-white/20"
              />
            ) : (
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm border ${
                user.role === 'admin' ? 'bg-blue-500/20 border-blue-500/30' :
                user.role === 'barber' ? 'bg-red-500/20 border-red-500/30' :
                'bg-white/10 border-white/15'
              }`}>
                {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}

            {/* Info */}
            <div className="leading-tight min-w-0">
              <p className="text-gray-400 text-[10px]">Bienvenido,</p>
              <p className="text-sm font-semibold text-white truncate max-w-[45vw] sm:max-w-[220px]">
                {user.username || user.name || user.email}
              </p>
            </div>

            {/* Badge rol */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              user.role === 'admin' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' :
              user.role === 'barber' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
              'bg-white/[0.06] border-white/[0.10] text-gray-300'
            }`}>
              {user.role === 'admin' && <Shield className="w-2.5 h-2.5" />}
              {user.role === 'barber' && <Scissors className="w-2.5 h-2.5" />}
              {user.role === 'user' && <Users className="w-2.5 h-2.5" />}
              {user.role === 'admin' ? 'Admin' : user.role === 'barber' ? 'Barbero' : 'Cliente'}
            </span>

            {/* Botón editar perfil */}
            <button
              onClick={() => navigate('/profile-edit')}
              className="p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300"
              title="Editar Perfil"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* HERO SECTION — render inmediato              */}
      {/* (no depende de la carga de datos)            */}
      {/* ============================================ */}
      {/* Hero solo para visitantes (los autenticados ven la tarjeta superior) */}
      {!user && <HomeHero />}

      {/* ============================================ */}
      {/* SERVICES - Grid independiente                 */}
      {/* ============================================ */}
      {/* Skeleton durante la carga; al terminar, grid o mensaje de vacío */}
      {loading ? (
        <HomeSkeleton isAuthenticated={!!user} />
      ) : (
        <>
      <section id="services" className="relative py-8 sm:py-24">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <Reveal className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-6">
              {user ? 'Nuestros' : 'Elige tu'} <GradientText>{user ? 'servicios' : 'experiencia'}</GradientText>
            </h2>
            <p className="text-gray-400 text-sm sm:text-lg max-w-2xl mx-auto">
              {user 
                ? 'Explora los servicios que tenemos para ti y reserva tu cita favorita'
                : 'Ofrecemos una amplia gama de servicios de barberia profesional para que luzcas tu mejor version'
              }
            </p>
          </Reveal>

          {services.length === 0 ? (
            <div className="text-center py-16">
              <div className="mb-6 mx-auto w-16 h-16 bg-white/[0.06] rounded-2xl border border-white/[0.08] flex items-center justify-center">
                <Scissors className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-500 text-lg">No hay servicios disponibles en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {services.map((service, index) => (
                <ServiceCard key={service._id} service={service} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <SectionDivider />

      {/* ============================================ */}
      {/* BARBERS - Hover Grid                         */}
      {/* ============================================ */}
      <section className="relative py-8 sm:py-24">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <Reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-16">
            <div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 sm:mb-4">
                {user ? 'Nuestro' : 'Barberos'} <GradientText>{user ? 'equipo' : 'expertos'}</GradientText>
              </h2>
              <p className="text-gray-400 text-sm sm:text-lg max-w-xl">
                {user
                  ? 'Conoce a los profesionales que cuidarán tu estilo'
                  : 'Conoce a nuestro equipo de profesionales expertos en el arte de la barberia'
                }
              </p>
            </div>
            {barbers.length > 0 && (
              <GradientButton
                variant="primary"
                size="md"
                className="px-6 py-2.5 flex-shrink-0 flex justify-center"
                onClick={() => navigate('/barbers')}
              >
                <span className="flex items-center gap-2">
                  Ver todos
                  <ArrowRight className="w-4 h-4" />
                </span>
              </GradientButton>
            )}
          </Reveal>

          {/* Equipo: tarjetas con reveal al hover, o mensaje si aún no hay barberos */}
          {barbers.length === 0 ? (
            <div className="text-center py-20">
              <div className="mb-8 mx-auto w-20 h-20 bg-white/[0.06] rounded-2xl border border-white/[0.08] flex items-center justify-center">
                <Users className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-300 mb-4">Estamos construyendo nuestro equipo</h3>
              <p className="text-gray-400 text-base max-w-md mx-auto">
                Pronto agregaremos nuevos profesionales especializados a nuestro equipo de barberos expertos
              </p>
            </div>
          ) : (
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {barbers.map((barber) => (
                <HoverRevealCard key={barber._id || barber.id} barber={barber} />
              ))}
            </StaggerGrid>
          )}
        </div>
      </section>
        </>
      )}

      <SectionDivider />

      {/* ============================================ */}
      {/* MAP + CONTACT - Full-bleed                   */}
      {/* ============================================ */}
      <section className="relative py-8 sm:py-24">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <Reveal className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 sm:mb-4">
              {user ? 'Encuéntranos' : 'Ven y'} <GradientText>{user ? 'aquí' : 'visitanos'}</GradientText>
            </h2>
            <p className="text-gray-400 text-sm sm:text-lg max-w-xl mx-auto">
              {user
                ? 'Te esperamos en nuestro espacio para darte la mejor experiencia'
                : 'Conoce nuestra ubicacion, visita nuestro espacio y experimenta la diferencia por ti mismo'
              }
            </p>
          </Reveal>

          <Reveal>
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              {/* Map */}
              {/* Mapa embebido con la ubicación configurada en BUSINESS */}
              <div className="relative h-[250px] sm:h-[400px] lg:h-[500px]">
                <iframe
                  src={BUSINESS.mapsEmbedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  style={{ filter: 'grayscale(30%) contrast(1.1) brightness(0.9)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
              </div>

              {/* Contact Card - debajo del mapa en mobile, flotante en desktop */}
              <div className="relative sm:absolute sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm bg-gray-900/95 sm:bg-gray-900/90 backdrop-blur-md sm:rounded-2xl border-t sm:border border-white/[0.1] sm:shadow-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-xl font-bold text-white mb-3 sm:mb-4">Informacion de Contacto</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:space-y-0 sm:gap-0 sm:space-y-3">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs sm:text-sm font-medium">Direccion</p>
                      <p className="text-gray-400 text-xs">{BUSINESS.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs sm:text-sm font-medium">Telefono</p>
                      <p className="text-gray-400 text-xs">{BUSINESS.phoneIntl}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs sm:text-sm font-medium">Horario</p>
                      <p className="text-gray-400 text-xs">Lun-Sab 9AM-8PM | Dom 10AM-6PM</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 pt-3 border-t border-white/[0.06]">
                  <GradientButton
                    variant="primary"
                    size="sm"
                    className="w-full min-h-11 py-2"
                    onClick={() => navigate('/appointment')}
                  >
                    <span className="flex items-center justify-center gap-2">
                      Reservar una cita
                      <Calendar className="w-4 h-4" />
                    </span>
                  </GradientButton>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SectionDivider />

      {/* ============================================ */}
      {/* CTA FINAL                                    */}
      {/* ============================================ */}
      {!user && (
        <section className="relative py-14 sm:py-28">
          <Reveal>
            <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6">
                ¿Listo para tu mejor look?
              </h2>
              <p className="text-gray-400 text-sm sm:text-lg mb-4 max-w-xl mx-auto">
                Agenda tu cita ahora y descubre por que somos la barberia preferida en Bogota.
              </p>
              <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400 mb-8 sm:mb-10">
                <span>500+ clientes</span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span>4.9 <Star className="w-4 h-4 inline text-amber-400" fill="currentColor" /></span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span>10+ anos</span>
              </div>
              <GradientButton
                variant="primary"
                size="lg"
                className="px-8 py-4 sm:px-10 sm:py-5 text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-[0_8px_30px_rgba(59,130,246,0.25)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.35)] hover:scale-[1.02] transition-all duration-300"
                onClick={() => navigate('/appointment')}
              >
                <span className="flex items-center gap-2 sm:gap-3">
                  Reservar mi cita
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </span>
              </GradientButton>
            </div>
          </Reveal>
        </section>
      )}
    </FluidPage>
  );
}

export default Home;
