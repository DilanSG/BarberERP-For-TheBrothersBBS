import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { api } from '@services/api';
import GradientButton from '@components/ui/GradientButton';
import { PageContainer } from '@components/layout/PageContainer';
import { ProfileEditSkeleton } from '@components/ui/Skeleton';
import ToggleSwitch from '@components/ui/ToggleSwitch';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Camera,
  Save,
  Upload,
  Eye,
  EyeOff,
  Settings,
  Bell,
  Lock,
  Trash2
} from 'lucide-react';

// Configuración de pestañas del editor (personal, seguridad y preferencias)
const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'security', label: 'Seguridad', icon: Lock },
  { id: 'preferences', label: 'Preferencias', icon: Bell }
];

// Formulario de edición de perfil para clientes y admins.
// Gestiona tres pestañas: datos personales (con subida de foto), cambio de
// contraseña y preferencias de notificación; persiste cada una en /users/*.
const UserProfileEdit = () => {
  const { user, setUser, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Referencia al input de archivo oculto de la foto de perfil
  const fileInputRef = useRef(null);

  // loading global de los guardados; activeTab y preview local de la imagen
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [previewImage, setPreviewImage] = useState(null);

  // Función para formatear fecha sin desfase de zona horaria
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
  };

  // Datos del formulario personal, inicializados desde el usuario autenticado
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    birthdate: formatDateForInput(user?.birthdate),
    profilePicture: user?.profilePicture || ''
  });

  // Campos del cambio de contraseña (se limpian tras guardar)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Preferencias de notificación con valores por defecto si no están definidas
  const [preferencesData, setPreferencesData] = useState({
    emailNotifications: user?.preferences?.emailNotifications ?? true,
    marketingEmails: user?.preferences?.marketingEmails ?? false
  });

  // Visibilidad de cada campo de contraseña (ojo/ojo tachado)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Sincronizar el estado del formulario cuando el usuario se actualice
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        birthdate: formatDateForInput(user.birthdate),
        profilePicture: user.profilePicture || ''
      });

      setPreferencesData({
        emailNotifications: user.preferences?.emailNotifications ?? true,
        marketingEmails: user.preferences?.marketingEmails ?? false
      });
    }
  }, [user]);

  // Actualiza el campo correspondiente del formulario personal
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Actualiza el campo correspondiente del formulario de contraseña
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  // Actualiza el toggle de preferencias (email/marketing)
  const handlePreferencesChange = (e) => {
    const { name, checked } = e.target;
    setPreferencesData(prev => ({ ...prev, [name]: checked }));
  };

  // Manejar selección de archivo para foto de perfil
  // Valida tamaño (máx 5MB) y tipo imagen, y genera una vista previa local (base64)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showError('La imagen no puede ser mayor a 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Solo se permiten archivos de imagen');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Limpia la vista previa, el campo del formulario y el input de archivo
  const handleRemoveProfilePicture = () => {
    setPreviewImage(null);
    setFormData(prev => ({ ...prev, profilePicture: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sube la imagen como multipart y devuelve la URL pública generada por el backend
  const uploadProfilePicture = async (file) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await api.upload('/users/upload-profile-picture', formData);
      return response.profilePictureUrl;
    } catch (error) {
      throw new Error(error.message || 'Error al subir la imagen');
    }
  };

  // Guardar cambios del perfil
  const handleProfileSave = async () => {
    try {
      setLoading(true);

      // Si hay un archivo nuevo se sube primero; si no, se conserva la URL actual
      let profilePictureUrl = formData.profilePicture;

      if (fileInputRef.current?.files[0]) {
        profilePictureUrl = await uploadProfilePicture(fileInputRef.current.files[0]);
      }

      // Solo se envían los campos con valor (evita sobrescribir con vacíos)
      const updatedData = {};

      if (formData.name && formData.name.trim()) {
        updatedData.name = formData.name.trim();
      }

      if (formData.email && formData.email.trim()) {
        updatedData.email = formData.email.trim();
      }

      if (formData.phone && formData.phone.trim()) {
        updatedData.phone = formData.phone.trim();
      }

      if (formData.birthdate && formData.birthdate.trim()) {
        updatedData.birthdate = formData.birthdate.trim();
      }

      if (profilePictureUrl) {
        updatedData.profilePicture = profilePictureUrl;
      }

      const response = await api.put('/users/profile', updatedData);
      const userData = response.data || response;
      // Refleja los cambios en el contexto de auth y reinicia el formulario
      const updatedUser = {
        ...user,
        ...userData,
        profilePicture: profilePictureUrl
      };

      setUser(updatedUser);

      setFormData({
        name: updatedUser.name || '',
        email: updatedUser.email || '',
        phone: updatedUser.phone || '',
        birthdate: formatDateForInput(updatedUser.birthdate),
        profilePicture: updatedUser.profilePicture || ''
      });

      setPreviewImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      showSuccess('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error al actualizar perfil:', error);

      // Mensajes específicos para conflictos de índice único de MongoDB (email duplicado)
      if (error.message && error.message.includes('duplicate key error') && error.message.includes('email')) {
        showError('Este email ya está siendo usado por otro usuario. Por favor, elige un email diferente.');
      } else if (error.message && error.message.includes('E11000')) {
        showError('Ya existe un usuario con esta información. Verifica los datos ingresados.');
      } else {
        showError(error.message || 'Error al actualizar el perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  // Cambiar contraseña (validación alineada con el backend: 8+ con mayúscula, minúscula y número)
  const handlePasswordSave = async () => {
    try {
      // Validaciones locales antes de llamar al endpoint
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        showError('Todos los campos de contraseña son obligatorios');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        showError('Las contraseñas nuevas no coinciden');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        showError('La nueva contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (!/[a-z]/.test(passwordData.newPassword)) {
        showError('La nueva contraseña debe contener al menos una minúscula');
        return;
      }
      if (!/[A-Z]/.test(passwordData.newPassword)) {
        showError('La nueva contraseña debe contener al menos una mayúscula');
        return;
      }
      if (!/\d/.test(passwordData.newPassword)) {
        showError('La nueva contraseña debe contener al menos un número');
        return;
      }

      setLoading(true);

      await api.put('/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      // Limpia los campos para evitar reenvíos accidentales
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      showSuccess('Contraseña actualizada correctamente');
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      showError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  // Guarda las preferencias de notificación y las sincroniza en el contexto de auth
  const handlePreferencesSave = async () => {
    try {
      setLoading(true);

      const response = await api.put('/users/preferences', preferencesData);
      const userData = response.data || response;

      setUser(prev => ({
        ...prev,
        preferences: userData.preferences || preferencesData
      }));

      showSuccess('Preferencias actualizadas correctamente');
    } catch (error) {
      console.error('Error al actualizar preferencias:', error);
      showError(error.message || 'Error al actualizar las preferencias');
    } finally {
      setLoading(false);
    }
  };

  // Imagen a mostrar: vista previa local si existe, si no la del usuario
  const avatarSrc = previewImage || formData.profilePicture;

  // Mientras se resuelve la sesión
  if (authLoading && !user) {
    return (
      <PageContainer>
        <div className="w-full pb-6">
          <ProfileEditSkeleton />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Editar Perfil</h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">
              Gestiona tu información personal, seguridad y preferencias
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        {/* Selector de pestaña activa (Personal / Seguridad / Preferencias) */}
        <div className="flex w-full max-w-full gap-1 overflow-x-auto p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm sm:inline-flex sm:w-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex min-h-11 flex-shrink-0 items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 ${
                activeTab === id
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5 sm:p-6">

          {/* Tab: Información Personal */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              {/* Foto de perfil */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-white/[0.06]">
                <div className="relative group mx-auto sm:mx-0 flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/[0.12] bg-white/[0.04] flex items-center justify-center">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-2xl font-bold text-white">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                    title="Cambiar foto"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-sm font-semibold text-white">Foto de perfil</h3>
                  <p className="text-xs text-gray-500 mt-0.5">JPG o PNG, máximo 5MB</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-gray-300 hover:text-white text-xs font-medium transition-colors duration-200"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir foto
                    </button>
                    {avatarSrc && (
                      <button
                        type="button"
                        onClick={handleRemoveProfilePicture}
                        disabled={loading}
                        className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-300 text-xs font-medium transition-colors duration-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Campos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="glassmorphism-input"
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="glassmorphism-input"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="glassmorphism-input"
                    placeholder="+57 300 123 4567"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    name="birthdate"
                    value={formData.birthdate}
                    onChange={handleInputChange}
                    className="glassmorphism-input"
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                <GradientButton
                  onClick={handleProfileSave}
                  disabled={loading}
                  loading={loading}
                  loadingText="Guardando..."
                  variant="primary"
                  size="md"
                >
                  <div className="flex items-center gap-2">
                    <Save size={16} />
                    <span>Guardar Cambios</span>
                  </div>
                </GradientButton>
              </div>
            </div>
          )}

          {/* Tab: Seguridad */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Cambiar contraseña</h3>
                <p className="text-xs text-gray-500">
                  Mínimo 8 caracteres, con mayúscula, minúscula y número
                </p>
              </div>

              {/* Campos de contraseña generados desde la lista, con botón de mostrar/ocultar */}
              {[
                { key: 'current', name: 'currentPassword', label: 'Contraseña Actual', placeholder: 'Tu contraseña actual' },
                { key: 'new', name: 'newPassword', label: 'Nueva Contraseña', placeholder: 'Tu nueva contraseña' },
                { key: 'confirm', name: 'confirmPassword', label: 'Confirmar Nueva Contraseña', placeholder: 'Confirma tu nueva contraseña' }
              ].map(({ key, name, label, placeholder }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    {label}
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords[key] ? 'text' : 'password'}
                      name={name}
                      value={passwordData[name]}
                      onChange={handlePasswordChange}
                      className="glassmorphism-input pr-11"
                      placeholder={placeholder}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-gray-500 hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPasswords[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                <GradientButton
                  onClick={handlePasswordSave}
                  disabled={loading}
                  loading={loading}
                  loadingText="Actualizando..."
                  variant="primary"
                  size="md"
                >
                  <div className="flex items-center gap-2">
                    <Save size={16} />
                    <span>Cambiar Contraseña</span>
                  </div>
                </GradientButton>
              </div>
            </div>
          )}

          {/* Tab: Preferencias */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Toggles de preferencias; cada uno actualiza su clave en preferencesData */}
              {[
                {
                  name: 'emailNotifications',
                  title: 'Notificaciones por Email',
                  description: 'Recibe notificaciones importantes por correo electrónico'
                },
                {
                  name: 'marketingEmails',
                  title: 'Emails de Marketing',
                  description: 'Recibe información sobre promociones y novedades'
                }
              ].map(({ name, title, description }) => (
                <div
                  key={name}
                  className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] transition-colors duration-200"
                >
                  <ToggleSwitch
                    id={`pref-${name}`}
                    checked={Boolean(preferencesData[name])}
                    onChange={(checked) => handlePreferencesChange({ target: { name, checked } })}
                    label={title}
                    description={description}
                    color="blue"
                  />
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                <GradientButton
                  onClick={handlePreferencesSave}
                  disabled={loading}
                  loading={loading}
                  loadingText="Guardando..."
                  variant="primary"
                  size="md"
                >
                  <div className="flex items-center gap-2">
                    <Save size={16} />
                    <span>Guardar Preferencias</span>
                  </div>
                </GradientButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default UserProfileEdit;
