import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import GradientButton from '@components/ui/GradientButton';
import { Mail, Lock, AlertTriangle } from 'lucide-react';
import { LOGOS } from '@utils/assets';

// Pantalla de inicio de sesión: captura email y contraseña y delega en
// AuthContext. Al autenticarse navega al home; si falla muestra el error
// del backend (o uno genérico) tanto en aviso como dentro del formulario.
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

    // Envía las credenciales, gestiona éxito/error y controla el estado de carga.
    const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        showSuccess('¡Bienvenido! Has iniciado sesión correctamente');
        navigate('/');
      } else {
        const errorMessage = authError || 'Credenciales incorrectas. Por favor verifica tu email y contraseña.';
        showError(errorMessage);
        setLocalError(errorMessage);
      }
    } catch (error) {
      const errorMessage = 'Error al iniciar sesión. Por favor intenta nuevamente.';
      showError(errorMessage);
      setLocalError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Vista: fondo animado, logo con fallback, formulario de login y enlace a registro.
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

      {/* Particulas flotantes - global via AppLayout */}

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
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Iniciar Sesion</h1>
              <p className="text-sm text-gray-500">Ingresa a tu cuenta para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium mb-1.5 text-gray-400">
                  Correo electronico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    className="block w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-base sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-300"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium mb-1.5 text-gray-400">
                  Contrasena
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-base sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-300"
                  />
                </div>
              </div>

              {localError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-300">{localError}</span>
                </div>
              )}

              <GradientButton
                type="submit"
                disabled={loading}
                loading={loading}
                loadingText="Iniciando sesion..."
                variant="primary"
                className="w-full py-3"
              >
                Iniciar sesion
              </GradientButton>

              <div className="text-center">
                <span className="text-sm text-gray-500">
                  No tienes cuenta?{' '}
                </span>
                <Link to="/register" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  Registrate
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
