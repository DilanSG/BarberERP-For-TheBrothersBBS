import React, { useState, useEffect, useRef } from 'react';
import { PageContainer } from '@components/layout/PageContainer';
import { useAuth } from '@contexts/AuthContext';
import { api } from '@services/api';
import { barberService } from '@services/barberService';
import { serviceService } from '@services/serviceService';
import { useNotification } from '@contexts/NotificationContext';
import GradientButton from '@components/ui/GradientButton';
import { BarberProfileEditSkeleton, ScheduleListSkeleton } from '@components/ui/Skeleton';
import logger from '@utils/logger';
import {
  User,
  Camera,
  Upload,
  Save,
  Scissors,
  Clock,
  Star,
  Phone,
  Mail,
  Calendar,
  FileText,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';

// Nombres en español de los días para la pestaña de horarios.
const daysInSpanish = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

// Horario por defecto: lunes a sábado 9:00-19:00 y domingo cerrado.
const defaultSchedule = {
  monday: { start: '09:00', end: '19:00', available: true },
  tuesday: { start: '09:00', end: '19:00', available: true },
  wednesday: { start: '09:00', end: '19:00', available: true },
  thursday: { start: '09:00', end: '19:00', available: true },
  friday: { start: '09:00', end: '19:00', available: true },
  saturday: { start: '09:00', end: '19:00', available: true },
  sunday: { start: '09:00', end: '19:00', available: false }
};

// Pestañas del editor: personal, seguridad, información, servicios y horarios.
const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'security', label: 'Seguridad', icon: Lock },
  { id: 'professional', label: 'Información', icon: Star },
  { id: 'services', label: 'Servicios', icon: Scissors },
  { id: 'schedule', label: 'Horarios', icon: Clock }
];

// Editor del perfil del barbero organizado por pestañas.
// Carga el perfil del barbero y el catálogo de servicios; permite actualizar
// datos personales (incluida la foto), contraseña, información profesional,
// los servicios ofrecidos y el horario semanal.
const BarberProfileEdit = () => {
  const { user, setUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const fileInputRef = useRef(null);

  // Estados principales
  const [barber, setBarber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [previewImage, setPreviewImage] = useState(null);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

  // Estados para el formulario del usuario
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthdate: ''
  });

  // Estados para el formulario del barbero
  const [barberFormData, setBarberFormData] = useState({
    specialty: '',
    experience: '',
    description: '',
    services: []
  });

  // Estados para servicios y horarios
  const [availableServices, setAvailableServices] = useState([]);
  const [schedule, setSchedule] = useState(defaultSchedule);

  // Estados para contraseñas
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Convierte una fecha al formato yyyy-MM-dd que espera un input type=date.
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Carga inicial del perfil y del catálogo de servicios.
  useEffect(() => {
    fetchData();
  }, []);

  // Sincronizar el formulario del usuario cuando el contexto cambie
  // Mantiene sincronizado el formulario personal con los datos del contexto.
  useEffect(() => {
    if (user) {
      setUserFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        birthdate: formatDateForInput(user.birthdate)
      });

      if (user.profilePicture && !previewImage) {
        setPreviewImage(user.profilePicture);
      }
    }
  }, [user]);

  // Carga en paralelo el perfil del barbero y los servicios disponibles.
  // Normaliza el horario recibido contra el horario por defecto.
  const fetchData = async () => {
    setLoading(true);
    setScheduleLoaded(false);
    try {
      const [barberData, servicesData] = await Promise.all([
        barberService.getBarberProfile(),
        serviceService.getAllServices()
      ]);

      if (barberData.success) {
        const barberInfo = barberData.data;
        setBarber(barberInfo);

        setBarberFormData({
          specialty: barberInfo.specialty || '',
          experience: barberInfo.experience?.toString() || '',
          description: barberInfo.description || '',
          services: barberInfo.services?.map(s => s._id) || []
        });

        setUserFormData({
          name: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          birthdate: formatDateForInput(user?.birthdate)
        });

        const profilePicture = user?.profilePicture || barberInfo.user?.profilePicture;
        if (profilePicture) {
          setPreviewImage(profilePicture);
        }

        if (barberInfo.schedule) {
          // Completa con valores por defecto los días que falten o vengan incompletos.
          // Validar que el schedule tenga la estructura correcta
          const validSchedule = { ...defaultSchedule };
          Object.keys(validSchedule).forEach(day => {
            if (barberInfo.schedule[day]) {
              validSchedule[day] = {
                start: barberInfo.schedule[day].start || validSchedule[day].start,
                end: barberInfo.schedule[day].end || validSchedule[day].end,
                available: barberInfo.schedule[day].available !== undefined
                  ? barberInfo.schedule[day].available
                  : validSchedule[day].available
              };
            }
          });
          setSchedule(validSchedule);
        } else {
          setSchedule(defaultSchedule);
        }
        setScheduleLoaded(true);
      }

      if (servicesData.success) {
        setAvailableServices(servicesData.data || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos del perfil');
    } finally {
      setLoading(false);
    }
  };

  // Actualiza cualquier campo del formulario personal por su name.
  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    setUserFormData(prev => ({ ...prev, [name]: value }));
  };

  // Actualiza cualquier campo del formulario profesional por su name.
  const handleBarberInputChange = (e) => {
    const { name, value } = e.target;
    setBarberFormData(prev => ({ ...prev, [name]: value }));
  };

  // Añade o quita un servicio del listado de servicios que ofrece el barbero.
  const handleServiceToggle = (serviceId, isChecked) => {
    setBarberFormData(prev => ({
      ...prev,
      services: isChecked
        ? [...prev.services, serviceId]
        : prev.services.filter(id => id !== serviceId)
    }));
  };

  // Selector de hora con búsqueda
  // Genera opciones de hora en punto entre las 7:00 y las 22:00.
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 7; hour <= 22; hour++) {
      options.push({
        value: `${hour.toString().padStart(2, '0')}:00`,
        label: `${hour === 12 ? 12 : hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
      });
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  // Selector de hora personalizado con búsqueda y cierre al hacer clic fuera.
  // Se usa en la edición del horario semanal.
  const CustomTimeSelector = ({ value, onChange, options, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);

    // Filtra las opciones de hora según el texto de búsqueda.
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(option => option.value === value);

    // Cierra el desplegable al hacer clic fuera del botón o de la lista.
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
            buttonRef.current && !buttonRef.current.contains(event.target)) {
          setIsOpen(false);
          setSearchTerm('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Confirma la hora elegida, cierra el desplegable y limpia la búsqueda.
    const handleSelect = (option) => {
      onChange(option.value);
      setIsOpen(false);
      setSearchTerm('');
    };

    return (
      <div className="relative w-full">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="glassmorphism-input flex items-center justify-between text-left"
        >
          <span className={selectedOption ? 'text-white' : 'text-gray-500'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-500 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute w-full mt-1 z-[100] bg-[#1c2030] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Barra de búsqueda */}
            <div className="p-2 border-b border-white/[0.08]">
              <input
                type="text"
                placeholder="Buscar hora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 text-sm"
              />
            </div>

            {/* Lista de opciones */}
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full px-4 py-2.5 text-left transition-colors duration-150 text-sm flex items-center justify-between ${
                      value === option.value
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span>{option.label}</span>
                    {value === option.value && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  No se encontraron opciones
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Normaliza cualquier hora al inicio de su hora en punto (09:37 -> 09:00).
  const adjustTimeToInterval = (timeString) => {
    const [hours] = timeString.split(':').map(Number);
    return `${hours.toString().padStart(2, '0')}:00`;
  };

  // Actualiza el horario de un día; si cambia inicio o fin recalcula si el día
  // queda disponible (se requiere al menos una hora de diferencia).
  const handleScheduleChange = (day, field, value) => {
    if (field === 'available') {
      setSchedule(prev => ({
        ...prev,
        [day]: { ...prev[day], available: value }
      }));
      return;
    }

    let adjustedValue = adjustTimeToInterval(value);

    setSchedule(prev => {
      const currentDaySchedule = prev[day];
      let newSchedule = {
        ...prev,
        [day]: { ...currentDaySchedule, [field]: adjustedValue }
      };

      const startTime = field === 'start' ? adjustedValue : currentDaySchedule.start;
      const endTime = field === 'end' ? adjustedValue : currentDaySchedule.end;

      const getMinutes = (timeStr) => {
        const [hours] = timeStr.split(':').map(Number);
        return hours * 60;
      };

      const timeDifference = getMinutes(endTime) - getMinutes(startTime);
      newSchedule[day].available = timeDifference >= 60;

      return newSchedule;
    });
  };

  // Manejo de foto de perfil
  // Valida tamaño (máx. 5MB) y tipo de imagen, y genera la vista previa
  // en base64 con FileReader.
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

  // Quita la foto seleccionada y limpia el input de archivo.
  const handleRemoveProfilePicture = () => {
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sube la imagen al backend y devuelve la URL del archivo guardado.
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

  // Guardar información personal
  // Guarda los datos personales: sube la foto si se eligió una nueva y
  // envía solo los campos con valor; actualiza el usuario del contexto.
  // Detecta el error de email duplicado para mostrar un mensaje claro.
  const handlePersonalSave = async () => {
    try {
      setSaving(true);

      let profilePictureUrl = user?.profilePicture;

      if (fileInputRef.current?.files[0]) {
        profilePictureUrl = await uploadProfilePicture(fileInputRef.current.files[0]);
      }

      const updatedData = {};

      if (userFormData.name && userFormData.name.trim()) {
        updatedData.name = userFormData.name.trim();
      }

      if (userFormData.email && userFormData.email.trim()) {
        updatedData.email = userFormData.email.trim();
      }

      if (userFormData.phone && userFormData.phone.trim()) {
        updatedData.phone = userFormData.phone.trim();
      }

      if (userFormData.birthdate && userFormData.birthdate.trim()) {
        updatedData.birthdate = userFormData.birthdate.trim();
      }

      if (profilePictureUrl) {
        updatedData.profilePicture = profilePictureUrl;
      }

      const response = await api.put('/users/profile', updatedData);
      const userData = response.data || response;
      const updatedUser = {
        ...user,
        ...userData,
        profilePicture: profilePictureUrl
      };

      setUser(updatedUser);

      setUserFormData({
        name: updatedUser.name || '',
        email: updatedUser.email || '',
        phone: updatedUser.phone || '',
        birthdate: formatDateForInput(updatedUser.birthdate)
      });

      if (profilePictureUrl && profilePictureUrl !== user?.profilePicture) {
        setPreviewImage(profilePictureUrl);
      } else {
        setPreviewImage(null);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      showSuccess('Información personal actualizada correctamente');
    } catch (error) {
      console.error('Error al actualizar información personal:', error);

      if (error.message && error.message.includes('duplicate key error') && error.message.includes('email')) {
        showError('Este email ya está siendo usado por otro usuario. Por favor, elige un email diferente.');
      } else {
        showError(error.message || 'Error al actualizar la información personal');
      }
    } finally {
      setSaving(false);
    }
  };

  // Guardar información profesional
  // Guarda la información profesional (especialidad, experiencia y descripción).
  // La experiencia se convierte a número antes de enviarla.
  const handleProfessionalSave = async () => {
    try {
      setSaving(true);

      const updateData = {
        ...barberFormData,
        experience: parseInt(barberFormData.experience) || 0
      };

      const response = await barberService.updateMyProfile(updateData);

      if (response.success) {
        showSuccess('Información profesional actualizada exitosamente');

        setBarber(prev => ({ ...prev, ...updateData }));
      } else {
        showError(response.message || 'Error al actualizar la información profesional');
      }
    } catch (error) {
      console.error('Error updating professional info:', error);
      showError('Error al actualizar la información profesional');
    } finally {
      setSaving(false);
    }
  };

  // Guardar horarios
  // Persiste el horario semanal completo y sincroniza el estado local.
  const handleScheduleSave = async () => {
    try {
      setSaving(true);

      const response = await barberService.updateMyProfile({ schedule });

      if (response.success) {
        showSuccess('Horarios actualizados exitosamente');
        setBarber(prev => ({ ...prev, schedule }));
      } else {
        showError(response.message || 'Error al actualizar los horarios');
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      showError('Error al actualizar los horarios');
    } finally {
      setSaving(false);
    }
  };

  // Funciones para manejar contraseñas
  // Actualiza el campo de contraseña correspondiente.
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  // Validación alineada con el backend: 8+ con mayúscula, minúscula y número
  // Cambia la contraseña validando reglas alineadas con el backend:
  // campos completos, coincidencia y mínimo 8 caracteres con mayúscula,
  // minúscula y número.
  const handlePasswordSave = async () => {
    try {
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

      setSaving(true);

      await api.put('/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

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
      setSaving(false);
    }
  };

  // Esqueleto de carga mientras se obtienen perfil y servicios.
  if (loading) {
    return (
      <PageContainer>
        <div className="w-full pb-6">
          <BarberProfileEditSkeleton />
        </div>
      </PageContainer>
    );
  }

  // Foto a mostrar: la vista previa local o la del usuario autenticado.
  const avatarSrc = previewImage || user?.profilePicture;

  // Editor en pestañas: Personal (foto y datos), Seguridad (contraseña),
  // Información profesional, Servicios y Horarios, cada una con su botón de guardado.
  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex-shrink-0">
            <Scissors className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
              Editar Perfil de Barbero
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">
              Gestiona tu información profesional, servicios y horarios
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="inline-flex p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm max-w-full overflow-x-auto custom-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 flex-shrink-0 ${
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

          {/* Tab: Personal */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              {/* Foto de perfil */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-white/[0.06]">
                <div className="relative group mx-auto sm:mx-0 flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-red-500/30 bg-white/[0.04] flex items-center justify-center">
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
                    disabled={saving}
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
                      disabled={saving}
                      className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-gray-300 hover:text-white text-xs font-medium transition-colors duration-200"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir foto
                    </button>
                    {avatarSrc && (
                      <button
                        type="button"
                        onClick={handleRemoveProfilePicture}
                        disabled={saving}
                        className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-300 text-xs font-medium transition-colors duration-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
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
                    value={userFormData.name}
                    onChange={handleUserInputChange}
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
                    value={userFormData.email}
                    onChange={handleUserInputChange}
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
                    value={userFormData.phone}
                    onChange={handleUserInputChange}
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
                    value={userFormData.birthdate}
                    onChange={handleUserInputChange}
                    className="glassmorphism-input"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                <GradientButton
                  onClick={handlePersonalSave}
                  disabled={saving}
                  loading={saving}
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
                  disabled={saving}
                  loading={saving}
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

          {/* Tab: Profesional */}
          {activeTab === 'professional' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Información profesional</h3>
                <p className="text-xs text-gray-500">
                  Estos datos se muestran en tu perfil público
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <Scissors className="w-3.5 h-3.5 text-gray-500" />
                    Especialidad
                  </label>
                  <input
                    type="text"
                    name="specialty"
                    value={barberFormData.specialty}
                    onChange={handleBarberInputChange}
                    className="glassmorphism-input"
                    placeholder="Ej: Cortes clásicos, barbas, etc."
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <Star className="w-3.5 h-3.5 text-gray-500" />
                    Años de Experiencia
                  </label>
                  <input
                    type="number"
                    name="experience"
                    min="0"
                    value={barberFormData.experience}
                    onChange={handleBarberInputChange}
                    className="glassmorphism-input"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={barberFormData.description}
                    onChange={handleBarberInputChange}
                    rows={4}
                    className="glassmorphism-textarea"
                    placeholder="Cuéntanos sobre tu experiencia y estilo de trabajo..."
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                <GradientButton
                  onClick={handleProfessionalSave}
                  disabled={saving}
                  loading={saving}
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

          {/* Tab: Servicios */}
          {activeTab === 'services' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Servicios que ofreces</h3>
                  <p className="text-xs text-gray-500">
                    Selecciona los servicios que puedes realizar
                  </p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {barberFormData.services.length} de {availableServices.length}
                </span>
              </div>

              {availableServices.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No hay servicios disponibles. Contacta al administrador.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableServices.map((service) => {
                    // Marca visualmente los servicios seleccionados y permite alternarlos.
                    const isSelected = barberFormData.services.includes(service._id);
                    return (
                      <label
                        key={service._id}
                        className={`relative rounded-xl border p-4 cursor-pointer transition-colors duration-200 ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/10'
                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleServiceToggle(service._id, e.target.checked)}
                          className="sr-only"
                        />

                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] flex-shrink-0">
                            <Scissors className={`w-4 h-4 ${isSelected ? 'text-blue-300' : 'text-gray-400'}`} />
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'border-blue-400 bg-blue-500' : 'border-gray-600'
                          }`}>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </div>

                        <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-blue-200' : 'text-white'}`}>
                          {service.name}
                        </h4>
                        {service.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{service.description}</p>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                          <span className="text-xs font-semibold text-brand-300">
                            ${service.price}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <Clock className="w-3 h-3" />
                            {service.duration} min
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-white/[0.06]">
                <GradientButton
                  onClick={handleProfessionalSave}
                  disabled={saving}
                  loading={saving}
                  loadingText="Guardando..."
                  variant="primary"
                  size="md"
                >
                  <div className="flex items-center gap-2">
                    <Save size={16} />
                    <span>Guardar Servicios</span>
                  </div>
                </GradientButton>
              </div>
            </div>
          )}

          {/* Tab: Horarios */}
          {activeTab === 'schedule' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Horarios de trabajo</h3>
                  <p className="text-xs text-gray-500">
                    Define tu disponibilidad semanal
                  </p>
                </div>
                {scheduleLoaded && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {Object.values(schedule).filter(d => d.available).length} de 7 días
                  </span>
                )}
              </div>

              {!scheduleLoaded ? (
                <ScheduleListSkeleton rows={7} />
              ) : (
                <div className="space-y-2">
                  {Object.entries(schedule).map(([day, daySchedule]) => (
                    <div
                      key={day}
                      className={`rounded-xl border p-3 sm:p-4 transition-colors duration-200 ${
                        daySchedule.available
                          ? 'border-white/[0.08] bg-white/[0.02]'
                          : 'border-white/[0.06] bg-white/[0.01] opacity-70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Toggle del día */}
                        <label className="flex min-h-11 items-center gap-3 sm:w-44 flex-shrink-0 cursor-pointer">
                          <span className="relative inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={daySchedule.available}
                              onChange={(e) => handleScheduleChange(day, 'available', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-white/10 border border-white/[0.12] rounded-full peer peer-checked:bg-emerald-500/50 peer-checked:border-emerald-500/40 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-4 transition-colors duration-200"></div>
                          </span>
                          <span className={`text-sm font-medium ${daySchedule.available ? 'text-white' : 'text-gray-500'}`}>
                            {daysInSpanish[day]}
                          </span>
                        </label>

                        {/* Horas */}
                        {daySchedule.available ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CustomTimeSelector
                              value={daySchedule.start || '09:00'}
                              onChange={(value) => handleScheduleChange(day, 'start', value)}
                              options={timeOptions}
                              placeholder="Inicio"
                            />
                            <span className="text-gray-500 text-sm flex-shrink-0">–</span>
                            <CustomTimeSelector
                              value={daySchedule.end || '19:00'}
                              onChange={(value) => handleScheduleChange(day, 'end', value)}
                              options={timeOptions}
                              placeholder="Fin"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-600 italic">Descanso</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setSchedule(defaultSchedule);
                    showSuccess('Horarios restablecidos a 9AM-7PM');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-gray-300 hover:text-white text-xs font-medium transition-colors duration-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer a 9AM-7PM
                </button>

                <GradientButton
                  onClick={handleScheduleSave}
                  disabled={saving}
                  loading={saving}
                  loadingText="Guardando..."
                  variant="primary"
                  size="md"
                >
                  <div className="flex items-center gap-2">
                    <Save size={16} />
                    <span>Guardar Horarios</span>
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

export default BarberProfileEdit;
