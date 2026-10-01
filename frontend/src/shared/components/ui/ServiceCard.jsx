import { Scissors, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '@components/motion/Reveal';

// Tarjeta de servicio del catálogo público: icono, nombre, duración, precio y CTA
// de reserva. Se envuelve en <Reveal> para animar su entrada y no maneja estado.
// Props: service ({ name, duration, price, description }) e index (posición en la grilla).
export default function ServiceCard({ service, index }) {
  // Formatea el precio en COP sin decimales; devuelve null si no viene valor.
  const formatPrice = (price) => {
    if (!price && price !== 0) return null;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Reveal>
      <div className="group relative rounded-2xl border border-white/[0.08] hover:border-white/[0.16] transition-all duration-300 overflow-hidden bg-white/[0.03] hover:bg-white/[0.05] h-full flex flex-col">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/25 to-transparent" />

        <div className="p-4 sm:p-6 flex flex-col flex-grow">
          {/* Header: Icon + Name + Price */}
          <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:border-brand-500/30 transition-colors duration-300">
                <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-brand-300 transition-colors duration-300" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white transition-colors duration-300">
                  {service.name}
                </h3>
                {service.duration && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" />
                    <span className="text-[10px] sm:text-xs text-gray-500">{service.duration} min</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price */}
            {service.price !== undefined && service.price !== null && (
              <div className="text-right">
                <span className="text-lg sm:text-xl font-bold text-white">
                  {formatPrice(service.price)}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {service.description && (
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6 line-clamp-2 flex-grow">
              {service.description}
            </p>
          )}

          {/* CTA */}
          <Link
            to="/appointment"
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-gray-300 hover:text-white text-xs sm:text-sm font-medium transition-all duration-300"
          >
            Reservar
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
