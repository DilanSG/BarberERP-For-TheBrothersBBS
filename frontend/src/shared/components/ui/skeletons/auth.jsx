// Skeletons de las páginas de autenticación (Login / Register).
// El logo, la flecha de regreso y los textos estáticos se muestran reales;
// solo los campos del formulario y el botón se representan con placeholders.

import { Link } from 'react-router-dom';
import { Skeleton } from './base';
import { LOGOS } from '@utils/assets';

// ── Campo de formulario ────────────────────────────
// Label + input; `hint` agrega una línea de ayuda (p. ej. requisitos de contraseña).
function AuthFieldSkeleton({ hint = false }) {
  return (
    <div>
      <Skeleton className="h-3 w-24 rounded-sm mb-1.5" />
      <Skeleton className="h-12 w-full rounded-xl" />
      {hint && <Skeleton className="h-3 w-64 max-w-full rounded-sm mt-1.5" />}
    </div>
  );
}

// ── Estructura común Login/Register ────────────────
// Card centrada con logo real, título/subtítulo y `fields` campos; el último
// muestra hint si `passwordHint` y el footer real se inyecta por prop.
function AuthSkeleton({ title, subtitle, fields = 2, passwordHint = false, footer }) {
  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
      {/* Flecha de regreso */}
      <Link
        to="/"
        className="fixed top-6 left-6 z-50 -m-2 flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors duration-300"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 5l-7 7 7 7" />
        </svg>
      </Link>

      <div className="relative z-10 w-full max-w-sm sm:max-w-md px-4 py-8">
        {/* Logo grande centrado */}
        <div className="text-center mb-8">
          <style>{`
            @keyframes logoBreath {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.03); }
            }
          `}</style>
          <img
            src={LOGOS.main()}
            alt="The Brothers Barber Shop"
            width="1240"
            height="1585"
            className="w-32 sm:w-40 mx-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            style={{ animation: 'logoBreath 4s ease-in-out infinite' }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = LOGOS.fallback();
            }}
          />
        </div>

        {/* Formulario */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-blue-700/10 to-blue-600/5 rounded-2xl blur-xl opacity-50"></div>
          <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/[0.06]">
            <div className="text-center mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{title}</h1>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>

            <div className="space-y-4">
              {[...Array(fields)].map((_, i) => (
                <AuthFieldSkeleton key={i} hint={passwordHint && i === fields - 1} />
              ))}
              <Skeleton className="h-11 w-full rounded-xl" />
              <div className="text-center">{footer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LoginSkeleton ──────────────────────────────────
// Variante de Login: 2 campos y enlace real a Registro.
function LoginSkeleton() {
  return (
    <AuthSkeleton
      title="Iniciar Sesion"
      subtitle="Ingresa a tu cuenta para continuar"
      fields={2}
      footer={
        <span className="text-sm text-gray-500">
          No tienes cuenta?{' '}
          <Link to="/register" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
            Registrate
          </Link>
        </span>
      }
    />
  );
}

// ── RegisterSkeleton ───────────────────────────────
// Variante de Registro: 3 campos (el último con hint) y enlace real a Login.
function RegisterSkeleton() {
  return (
    <AuthSkeleton
      title="Crear cuenta"
      subtitle="Unete a nuestra comunidad"
      fields={3}
      passwordHint
      footer={
        <span className="text-sm text-gray-500">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
            Inicia sesion
          </Link>
        </span>
      }
    />
  );
}

export { LoginSkeleton, RegisterSkeleton };
