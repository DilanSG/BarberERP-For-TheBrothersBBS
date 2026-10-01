import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotification } from '@contexts/NotificationContext';
import GradientButton from '@components/ui/GradientButton';
import { User, Mail, Lock, AlertTriangle, UserPlus } from 'lucide-react';
import { LOGOS } from '@utils/assets';
import { authService } from '@services/authService';

// Pantalla de registro de clientes: valida los datos localmente, crea la
// cuenta a través de authService y redirige al login al completarse.
function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

  // Actualiza el campo del formulario que dispara el evento.
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Valida nombre (solo letras, 2-50), email con formato y contraseña
  // (mínimo 8 con minúscula, mayúscula y número). Devuelve el mensaje de error.
  const validateForm = () => {
    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(form.name)) {
      return 'El nombre solo puede contener letras y espacios';
    }
    if (form.name.length < 2 || form.name.length > 50) {
      return 'El nombre debe tener entre 2 y 50 caracteres';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'Debe proporcionar un email válido';
    }
    if (form.password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!/[a-z]/.test(form.password)) {
      return 'La contraseña debe contener al menos una minúscula';
    }
    if (!/[A-Z]/.test(form.password)) {
      return 'La contraseña debe contener al menos una mayúscula';
    }
    if (!/\d/.test(form.password)) {
      return 'La contraseña debe contener al menos un número';
    }
    return null;
  };

  // Ejecuta la validación, registra al usuario con rol 'user' y muestra los
  // errores del backend (details/errors) cuando el registro falla.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      showError(validationError);
      setLoading(false);
      return;
    }

    try {
      const userData = {
        name: form.name,
        email: form.email.toLowerCase(),
        password: form.password,
        role: 'user'
      };

      const data = await authService.register(userData);
      
      // El backend puede responder success:false con detalles; se muestran concatenados.
      if (data.success === false) {
        let errorMsg = data.message || 'Error en el registro';
        if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          errorMsg = data.details.map(d => d.message).join('. ');
        }
        setError(errorMsg);
        showError(errorMsg);
        setLoading(false);
        return;
      }
      
      const successMsg = 'Registro exitoso! Redirigiendo al login...';
      setSuccess(successMsg);
      showSuccess(successMsg);
      
      // Guarda token y usuario si el backend los devuelve en el registro.
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // Tras un segundo de confirmación visual redirige al login.
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (err) {
      console.error('Error durante el registro:', err);
      let errorMsg = 'Error en el registro. Por favor, intenta de nuevo.';
      if (err.details && Array.isArray(err.details) && err.details.length > 0) {
        errorMsg = err.details.map(d => d.message).join('. ');
      } else if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        errorMsg = err.errors.map(e => e.msg || e.message).join('. ');
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Vista: logo, formulario de registro con mensajes de error/éxito y enlace a login.
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
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Crear cuenta</h1>
              <p className="text-sm text-gray-500">Unete a nuestra comunidad</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium mb-1.5 text-gray-400">
                  Nombre completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="John Doe"
                    className="block w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-base sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-300"
                  />
                </div>
              </div>

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
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
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
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-base sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-300"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Mínimo 8 caracteres, incluyendo mayúscula, minúscula y un número
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <UserPlus className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-emerald-300">{success}</span>
                </div>
              )}

              <GradientButton
                type="submit"
                disabled={loading}
                loading={loading}
                loadingText="Creando cuenta..."
                variant="primary"
                className="w-full py-3"
              >
                Crear cuenta
              </GradientButton>

              <div className="text-center">
                <span className="text-sm text-gray-500">
                  Ya tienes cuenta?{' '}
                </span>
                <Link to="/login" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  Inicia sesion
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
