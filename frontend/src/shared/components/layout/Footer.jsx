import { Link } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import { LOGOS } from '@utils/assets';
import { BUSINESS } from '@shared/config/business';

// Footer global de la aplicación.
// - `showFull` (home): marca, navegación y contacto + barra de copyright.
// - Resto de páginas: solo la barra de copyright.
// Sin contenedor ni divisor: solo los textos.
export default function Footer({ showFull = false, className = '' }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`relative z-10 mt-auto w-full px-[clamp(1rem,4vw,3rem)] py-4 ${className}`}>
      {showFull && (
        <div className="grid grid-cols-1 gap-8 pb-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Marca */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src={LOGOS.navbar()}
                alt="BarberERP"
                className="h-9 w-auto"
                loading="lazy"
              />
              <div>
                <p className="text-sm font-semibold text-white">BarberERP</p>
                <p className="text-xs text-gray-500">para The Brothers Barber Shop</p>
              </div>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-gray-500">
              ERP de gestión integral: citas, ventas, inventario y finanzas
              en un solo lugar.
            </p>
          </div>

          {/* Navegación */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Navegación
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/" className="text-gray-500 transition-colors hover:text-white">
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/barbers" className="text-gray-500 transition-colors hover:text-white">
                  Barberos
                </Link>
              </li>
              <li>
                <Link to="/appointment" className="text-gray-500 transition-colors hover:text-white">
                  Reservar cita
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Contacto
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" />
                <span>{BUSINESS.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0 text-gray-600" />
                <span>{BUSINESS.phoneIntl}</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Barra inferior (todas las páginas) */}
      <div className="flex flex-col items-center justify-between gap-1.5 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-gray-500">
          © {year} <span className="font-medium text-gray-400">IntoCode</span> · BarberERP
          <span className="mx-1.5 text-gray-600">—</span>
          Todos los derechos reservados
        </p>
        <p className="text-xs text-gray-600">
          Desarrollado por IntoCode · Programado por Dilan Acuña
        </p>
      </div>
    </footer>
  );
}
