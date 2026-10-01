import { Award, Star, Users } from 'lucide-react';
import { DEFAULT_IMAGES } from '@utils/assets';

// Tarjeta 3:4 de barbero: foto con zoom al hover y badges de experiencia/rating
// que se revelan sobre un degradado inferior.
// Props: barber ({ user, photo, name, specialty, experience, rating }).
export default function HoverRevealCard({ barber }) {
  // Fallback a la imagen de perfil por defecto si la foto no carga.
  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = DEFAULT_IMAGES.profile();
    e.target.classList.add('fallback-image');
  };

  // Normaliza el rating: acepta número simple u objeto { average, count }.
  const formatRating = (rating) => {
    if (!rating) return null;
    if (typeof rating === 'object') {
      const average = rating.average || 0;
      const count = rating.count || 0;
      return { average, count };
    }
    return { average: rating, count: 0 };
  };

  // Datos derivados: usuario embebido y rating ya normalizado.
  const userData = barber.user || {};
  const rating = formatRating(barber?.rating);

  return (
    <div className="group theme-dark-island relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer">
      {/* Photo */}
      {(userData.profilePicture || barber.photo?.url) ? (
        <img
          src={userData.profilePicture || barber.photo?.url}
          alt={userData.name || 'Barbero'}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          onError={handleImageError}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-white/[0.03]">
          <div className="p-6 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.08]">
            <Users className="w-20 h-20 text-gray-500" />
          </div>
        </div>
      )}

      {/* Default gradient overlay (always visible) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.08] group-hover:border-white/[0.16] transition-colors duration-500 pointer-events-none" />

      {/* Bottom info - always visible */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 transition-transform duration-500 group-hover:-translate-y-2">
        <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 group-hover:text-brand-300 transition-colors">
          {userData.name || barber.name || 'Nombre no disponible'}
        </h3>
        <p className="text-gray-300 text-xs sm:text-sm mb-3">
          {barber.specialty || 'Barbero Profesional'}
        </p>

        {/* Reveal on hover - always visible on mobile via group-hover de parent */}
        <div className="flex flex-wrap gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-500 sm:delay-100">
          {barber.experience && (
            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-white/10 text-white border border-white/10 backdrop-blur-sm">
              <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {barber.experience}
            </span>
          )}
          {rating && rating.average > 0 && (
            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 backdrop-blur-sm">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" />
              {rating.average.toFixed(1)} {rating.count > 0 && `(${rating.count})`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
