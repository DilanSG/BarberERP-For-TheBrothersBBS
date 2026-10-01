import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@components/layout/PageContainer';
import { useAuth } from '@contexts/AuthContext';
import { appointmentService } from '@services/appointmentService';
import { serviceService } from '@services/serviceService';
import { barberService } from '@services/barberService';
import { useNotification } from '@contexts/NotificationContext';
import { format, parse, isAfter, isBefore, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import GradientButton from '@components/ui/GradientButton';
import Modal from '@components/ui/Modal';
import { Calendar, Clock, User, Scissors, CheckCircle, XCircle, AlertCircle, Info, Star, Trash2, ChevronDown } from 'lucide-react';

import { UserAppointmentsSkeleton, Skeleton } from '@components/ui/Skeleton';

import logger from '@utils/logger';

// Sección colapsable (acordeón) reutilizable del formulario de nueva cita.
// Fila acordeón con encabezado, resumen del valor elegido y contenido plegable.
// Se usa para los pasos de servicio, barbero y fecha/hora del agendamiento.
const FormSection = ({ icon: Icon, iconClass = 'text-gray-400', title, summary, isOpen, onToggle, children }) => (
  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
        <span className="flex-shrink-0 text-sm font-medium text-gray-300">{title}</span>
        {summary && <span className="min-w-0 truncate text-sm text-white">· {summary}</span>}
      </span>
      <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <div className="border-t border-white/[0.06] p-3">{children}</div>}
  </div>
);
// Vista de citas del cliente: permite agendar una cita nueva y consultar
// sus citas próximas o su historial. Carga servicios, barberos y horarios,
// valida disponibilidad y ofrece cancelar (simple o con motivo), ver el detalle,
// dejar reseña y eliminar reportes de citas cerradas.
const UserAppointment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [openFormSection, setOpenFormSection] = useState('service');
  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');
  
  // Estados para cancelación con motivo
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAppointmentId, setCancelAppointmentId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Estado para modal de eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState(null);
  
  // Estado para modal de información de cita
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [viewInfoData, setViewInfoData] = useState(null);
  
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Cargar datos iniciales
  useEffect(() => {
    logger.debug('Component mounted, user:', user);
    fetchAppointments();
    fetchServices();
    fetchBarbers();
  }, [user]);

  // Efecto para monitorear cambios en services y barbers
  useEffect(() => {
    logger.debug('🔄 Services state changed:', services);
  }, [services]);

  useEffect(() => {
    logger.debug('🔄 Barbers state changed:', barbers);
  }, [barbers]);

  // Si la URL trae ?barberId=, preselecciona ese barbero y abre el formulario.
  // Manejar barberId desde URL params: selecciona el barbero y abre el formulario
  useEffect(() => {
    const barberId = searchParams.get('barberId');
    if (!barberId || barbers.length === 0) return;

    const barberExists = barbers.find(b => b._id === barberId);
    if (!barberExists) return;

    setSelectedBarber(barberId);
    setShowForm(true);
    // El siguiente paso pendiente es elegir el servicio
    setOpenFormSection('service');
  }, [searchParams, barbers]);

  // Cargar horarios cuando se selecciona fecha y barbero
  useEffect(() => {
    if (selectedDate && selectedBarber) {
      logger.debug('🔄 Date or barber changed, fetching available times');
      fetchAvailableTimes();
    } else {
      logger.debug('🔄 Clearing available times - missing date or barber');
      setAvailableTimes([]);
      setSelectedTime('');
    }
  }, [selectedDate, selectedBarber]);

  // Limpiar tiempo seleccionado si ya no está disponible
  useEffect(() => {
    if (selectedTime && availableTimes.length > 0) {
      const isTimeStillAvailable = availableTimes.some(timeSlot => 
        typeof timeSlot === 'object' ? timeSlot.datetime === selectedTime : timeSlot === selectedTime
      );
      if (!isTimeStillAvailable) {
        logger.debug('🔄 Selected time no longer available, clearing selection');
        setSelectedTime('');
      }
    }
  }, [availableTimes, selectedTime]);

  // Monitorear estado del botón de envío
  useEffect(() => {
    const isButtonDisabled = submitting || !selectedService || !selectedBarber || !selectedDate || !selectedTime;
    logger.debug('🎯 Button state check:', {
      submitting,
      selectedService: !!selectedService,
      selectedBarber: !!selectedBarber, 
      selectedDate: !!selectedDate,
      selectedTime: !!selectedTime,
      isButtonDisabled
    });
  }, [submitting, selectedService, selectedBarber, selectedDate, selectedTime]);

  // Carga las citas del usuario autenticado.
  const fetchAppointments = async () => {
    if (!user?._id) return;
    
    try {
      setLoading(true);
      const response = await appointmentService.getAppointments();
      if (response.success) {
        setAppointments(response.data || []);
      } else {
        setError(response.message || 'Error al cargar las citas');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError('Error al cargar las citas');
    } finally {
      setLoading(false);
    }
  };

  // Obtiene el catálogo de servicios tolerando distintas formas de respuesta
  // del backend (success, data.success, arreglo directo, etc.).
  const fetchServices = async () => {
    try {
      logger.debug('Fetching services...');
      const response = await serviceService.getAllServices();
      logger.debug('Services response:', response);
      
      // Manejar diferentes estructuras de respuesta
      if (response.success) {
        setServices(response.data || []);
        logger.debug('Services loaded (success):', response.data);
      } else if (response.data && response.data.success) {
        setServices(response.data.data || []);
        logger.debug('Services loaded (data.success):', response.data.data);
      } else if (Array.isArray(response.data)) {
        setServices(response.data);
        logger.debug('Services loaded (array):', response.data);
      } else if (Array.isArray(response)) {
        setServices(response);
        logger.debug('Services loaded (direct array):', response);
      } else {
        logger.warn('Unexpected services response format:', response);
      }
    } catch (error) {
      logger.error('Error fetching services:', error);
    }
  };

  // Obtiene la lista de barberos con el mismo parseo tolerante de respuestas.
  const fetchBarbers = async () => {
    try {
      logger.debug('Fetching barbers...');
      const response = await barberService.getAllBarbers();
      logger.debug('Barbers response:', response);
      
      // Manejar diferentes estructuras de respuesta
      if (response.success) {
        setBarbers(response.data || []);
        logger.debug('Barbers loaded (success):', response.data);
      } else if (response.data && response.data.success) {
        setBarbers(response.data.data || []);
        logger.debug('Barbers loaded (data.success):', response.data.data);
      } else if (Array.isArray(response.data)) {
        setBarbers(response.data);
        logger.debug('Barbers loaded (array):', response.data);
      } else if (Array.isArray(response)) {
        setBarbers(response);
        logger.debug('Barbers loaded (direct array):', response);
      } else {
        logger.warn('Unexpected barbers response format:', response);
      }
    } catch (error) {
      logger.error('Error fetching barbers:', error);
    }
  };

  // Pide los horarios disponibles para la fecha y el barbero elegidos; también
  // guarda el motivo cuando el backend responde que no hay disponibilidad.
  const fetchAvailableTimes = async () => {
    if (!selectedDate || !selectedBarber) return;

    try {
      setLoadingTimes(true);
      setAvailabilityReason('');
      logger.debug('🕐 Fetching available times for:', { selectedBarber, selectedDate });
      const response = await appointmentService.getAvailableTimes(selectedBarber, selectedDate);
      logger.debug('🕐 Available times response:', response);
      
      let timesArray = [];
      
      if (response.success && response.data && Array.isArray(response.data.slots)) {
        timesArray = response.data.slots;
        setAvailabilityReason(response.data.reason || '');
        logger.debug('🕐 Available times loaded (slots):', response.data.slots);
        logger.debug('🕐 Barber name:', response.data.barber);
        logger.debug('🕐 Date:', response.data.date);
        if (response.data.reason) {
          logger.debug('🕐 Reason:', response.data.reason);
        }
      } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        timesArray = response.data.data;
        logger.debug('Available times loaded (nested success + array):', response.data.data);
      } else if (Array.isArray(response.data)) {
        timesArray = response.data;
        logger.debug('Available times loaded (direct array):', response.data);
      } else if (Array.isArray(response)) {
        timesArray = response;
        logger.debug('Available times loaded (response is array):', response);
      } else {
        logger.warn('Available times response structure unexpected:', response);
        timesArray = [];
      }
      
      setAvailableTimes(timesArray);
      logger.debug('🕐 Final available times set:', timesArray);
    } catch (error) {
      console.error('❌ Error fetching available times:', error);
      setAvailableTimes([]);
    } finally {
      setLoadingTimes(false);
    }
  };

  // Valida campos y disponibilidad del horario, crea la cita y limpia el
  // formulario al confirmarse el agendamiento.
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    logger.debug('🚀 Submit button clicked! Form state:', {
      selectedService,
      selectedBarber,
      selectedDate,
      selectedTime,
      submitting
    });
    
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) {
      logger.debug('❌ Missing required fields');
      setError('Por favor completa todos los campos');
      return;
    }

    // Verificar que el tiempo seleccionado está disponible
    const isTimeAvailable = availableTimes.some(timeSlot => 
      typeof timeSlot === 'object' ? timeSlot.datetime === selectedTime : timeSlot === selectedTime
    );
    
    logger.debug('🔍 Validating time availability:', {
      selectedTime,
      availableTimes,
      isTimeAvailable
    });
    
    if (!isTimeAvailable) {
      setError('El horario seleccionado ya no está disponible');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      // Validar que selectedTime contiene una fecha válida
      if (!selectedTime || !new Date(selectedTime).getTime()) {
        setError('Por favor selecciona un horario válido');
        return;
      }

      const appointmentData = {
        serviceId: selectedService,
        barberId: selectedBarber,
        date: selectedTime  // selectedTime contiene el datetime completo (fecha + hora)
      };

      logger.debug('📤 Sending appointment data:', appointmentData);
      logger.debug('📤 Selected date from input:', selectedDate);
      logger.debug('📤 Selected time (datetime):', selectedTime);
      logger.debug('📤 Date object from selectedTime:', new Date(selectedTime));

      const response = await appointmentService.createAppointment(appointmentData);
      
      if (response.success) {
        setSuccess('Cita agendada exitosamente. El barbero confirmará tu cita pronto.');
        showSuccess('Cita agendada exitosamente');

        // Cerrar el acordeón y limpiar formulario
        setShowForm(false);
        setSelectedService('');
        setSelectedBarber('');
        setSelectedDate('');
        setSelectedTime('');
        setAvailableTimes([]);
        
        // Recargar citas
        await fetchAppointments();
      } else {
        throw new Error(response.message || 'Error al agendar la cita');
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al agendar la cita';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancela la cita pendiente seleccionada (sin motivo) y recarga la lista.
  const handleCancel = async () => {
    if (!cancelId) return;

    try {
      const response = await appointmentService.cancelAppointment(cancelId);
      if (response.success) {
        showSuccess('Cita cancelada exitosamente');
        setCancelId(null);
        await fetchAppointments();
      } else {
        showError(response.message || 'Error al cancelar la cita');
      }
    } catch (error) {
      console.error('Error canceling appointment:', error);
      showError('Error al cancelar la cita');
    }
  };

  // Abre el modal de confirmación para eliminar un reporte de cita.
  const handleDeleteAppointment = (appointmentId) => {
    setDeleteAppointmentId(appointmentId);
    setShowDeleteModal(true);
  };

  // Elimina el reporte de la cita y recarga la lista; cierra el modal al final.
  const handleConfirmDelete = async () => {
    if (!deleteAppointmentId) return;

    try {
      const response = await appointmentService.deleteAppointment(deleteAppointmentId);
      if (response.success) {
        showSuccess('Reporte de cita eliminado exitosamente');
        await fetchAppointments();
      } else {
        showError(response.message || 'Error al eliminar el reporte de la cita');
      }
    } catch (error) {
      console.error('Error deleting appointment:', error);
      showError('Error al eliminar el reporte de la cita');
    } finally {
      setShowDeleteModal(false);
      setDeleteAppointmentId(null);
    }
  };

  // Cierra el modal de eliminación sin borrar nada.
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteAppointmentId(null);
  };

  // Funciones para modal de cancelación con motivo
  // Abre el modal de cancelación con motivo para una cita confirmada.
  const handleOpenCancelModal = (appointmentId) => {
    setCancelAppointmentId(appointmentId);
    setShowCancelModal(true);
    setCancellationReason('');
  };

  // Cierra el modal de cancelación y descarta el motivo escrito.
  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancelAppointmentId(null);
    setCancellationReason('');
  };

  // Envía la cancelación con motivo validando que exista y no pase de
  // 100 palabras; notifica al barbero.
  const handleSubmitCancellation = async () => {
    if (!cancellationReason.trim()) {
      showError('Debe proporcionar un motivo para la cancelación');
      return;
    }

    const wordCount = cancellationReason.split(' ').filter(word => word.length > 0).length;
    if (wordCount > 100) {
      showError('El motivo no puede exceder las 100 palabras');
      return;
    }

    try {
      const response = await appointmentService.cancelAppointment(cancelAppointmentId, cancellationReason);
      if (response.success) {
        showSuccess('Cita cancelada exitosamente. El barbero ha sido notificado.');
        handleCloseCancelModal();
        await fetchAppointments();
      } else {
        showError(response.message || 'Error al cancelar la cita');
      }
    } catch (error) {
      console.error('Error canceling confirmed appointment:', error);
      showError('Error al cancelar la cita');
    }
  };

  // Reúne los datos de la cita elegida y abre el modal de información.
  const handleViewAppointmentInfo = (appointmentId) => {
    const appointment = appointments.find(apt => apt._id === appointmentId);
    if (appointment) {
      setViewInfoData({
        service: appointment.service?.name || 'Servicio',
        price: appointment.service?.price || 0,
        barber: appointment.barber?.user?.name || appointment.barber?.name || 'Barbero',
        date: appointment.date,
        time: format(new Date(appointment.date), "HH:mm"),
        status: appointment.status,
        totalPrice: appointment.service?.price || 0,
        cancellationReason: appointment.cancellationReason,
        cancelledBy: appointment.cancelledBy,
        createdAt: appointment.createdAt
      });
      setShowInfoModal(true);
    }
  };

  // Filtrar citas según la pestaña activa
  // Filtra según la pestaña: 'upcoming' muestra pendientes/confirmadas de hoy
  // en adelante; 'history' muestra completadas, canceladas o vencidas.
  const filteredAppointments = useMemo(() => {
    if (!appointments.length) return [];

    const now = new Date();
    
    if (activeTab === 'upcoming') {
      return appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return (apt.status === 'pending' || apt.status === 'confirmed') && 
               (isAfter(aptDate, now) || isSameDay(aptDate, now));
      });
    } else {
      return appointments.filter(apt => 
        apt.status === 'completed' || 
        apt.status === 'cancelled' ||
        (apt.status !== 'completed' && apt.status !== 'cancelled' && isBefore(new Date(apt.date), startOfDay(now)))
      );
    }
  }, [appointments, activeTab]);

  // Calcula la fecha mínima del selector usando la zona horaria de Colombia
  // para no permitir agendar en días ya pasados.
  // Obtener fecha mínima (hoy en zona horaria de Colombia)
  const today = new Date();
  // Crear fecha en zona horaria de Colombia correctamente
  const colombiaDate = new Date(today.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  const minDate = format(colombiaDate, 'yyyy-MM-dd');

  logger.debug('📅 Hora actual UTC:', today.toISOString());
  logger.debug('📅 Hora actual en Colombia (calculada):', colombiaDate.toLocaleString("es-ES", {timeZone: "America/Bogota"}));
  logger.debug('📅 MinDate para input:', minDate);

  // Objetos y nombre del servicio/barbero seleccionados para los resúmenes del formulario.
  const selectedServiceObj = services.find((item) => item._id === selectedService);
  const selectedBarberObj = barbers.find((item) => item._id === selectedBarber);
  const selectedBarberName = selectedBarberObj?.user?.name || selectedBarberObj?.name;

  // Vista principal: acordeón para agendar (servicio, barbero, fecha y horarios),
  // lista Mis Citas con pestañas Próximas/Historial y modales de cancelación,
  // eliminación de reportes e información detallada de la cita.
  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">

        {/* ── Acordeón: agendar nueva cita ── */}
        <div id="new-appointment" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setShowForm(prev => {
                const next = !prev;
                if (next) setOpenFormSection(selectedService ? 'barber' : 'service');
                return next;
              });
            }}
            aria-expanded={showForm}
            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
                <Calendar className="w-5 h-5 text-brand-300" />
              </span>
              <span className="min-w-0">
                <span className="block text-base sm:text-lg font-semibold text-white">Agendar nueva cita</span>
                <span className="block text-xs text-gray-400">Selecciona servicio, barbero, fecha y hora</span>
              </span>
            </span>
            <ChevronDown className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform duration-300 ${showForm ? 'rotate-180' : ''}`} />
          </button>

          {showForm && (
            <div className="border-t border-white/[0.06] p-3 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Service Selection (acordeón) */}
              <FormSection
                icon={Scissors}
                iconClass="text-brand-300"
                title="Servicio"
                summary={selectedServiceObj?.name}
                isOpen={openFormSection === 'service'}
                onToggle={() => setOpenFormSection(prev => (prev === 'service' ? null : 'service'))}
              >
                {services.length === 0 ? (
                  <p className="text-sm text-gray-500">Cargando servicios...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {services.map((service) => {
                      // Marca visualmente el servicio elegido y avanza el acordeón al paso del barbero.
                      const isSelected = selectedService === service._id;
                      return (
                        <button
                          type="button"
                          key={service._id}
                          onClick={() => {
                            setSelectedService(service._id);
                            setOpenFormSection('barber');
                          }}
                          aria-pressed={isSelected}
                          className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors duration-200 ${
                            isSelected
                              ? 'border-brand-400/50 bg-brand-400/10'
                              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className={`min-w-0 text-sm font-medium ${isSelected ? 'text-brand-200' : 'text-white'}`}>
                              {service.name}
                            </span>
                            <span className={`flex-shrink-0 text-sm font-semibold ${isSelected ? 'text-brand-300' : 'text-gray-300'}`}>
                              ${service.price}
                            </span>
                          </span>
                          {service.duration ? (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {service.duration} min
                            </span>
                          ) : null}
                          {service.description ? (
                            <span className="line-clamp-2 text-xs text-gray-500">{service.description}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </FormSection>

              {/* Barber Selection (acordeón) */}
              <FormSection
                icon={User}
                iconClass="text-blue-400"
                title="Barbero"
                summary={selectedBarberName}
                isOpen={openFormSection === 'barber'}
                onToggle={() => setOpenFormSection(prev => (prev === 'barber' ? null : 'barber'))}
              >
                {barbers.length === 0 ? (
                  <p className="text-sm text-gray-500">Cargando barberos...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {barbers.map((barber) => {
                      // Selecciona el barbero, cierra el acordeón y activa la carga de horarios.
                      const isSelected = selectedBarber === barber._id;
                      const name = barber.user?.name || barber.name || 'Barbero';
                      return (
                        <button
                          type="button"
                          key={barber._id}
                          onClick={() => {
                            setSelectedBarber(barber._id);
                            if (selectedDate) setLoadingTimes(true);
                            setOpenFormSection(null);
                          }}
                          aria-pressed={isSelected}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-200 ${
                            isSelected
                              ? 'border-blue-500/50 bg-blue-500/10'
                              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]'
                          }`}
                        >
                          {barber.user?.profilePicture ? (
                            <img
                              src={barber.user.profilePicture}
                              alt={name}
                              className="h-10 w-10 flex-shrink-0 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                              isSelected ? 'border-blue-500/30 bg-blue-500/15 text-blue-200' : 'border-white/[0.08] bg-white/[0.04] text-gray-300'
                            }`}>
                              {name[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-medium ${isSelected ? 'text-blue-200' : 'text-white'}`}>
                              {name}
                            </span>
                            {barber.specialty ? (
                              <span className="mt-0.5 block truncate text-xs text-gray-500">{barber.specialty}</span>
                            ) : null}
                            {barber.experience > 0 ? (
                              <span className="mt-0.5 block text-xs text-gray-500">{barber.experience} años de experiencia</span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </FormSection>

              {/* Fecha */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Fecha
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    logger.debug('Date selected:', e.target.value);
                    setSelectedDate(e.target.value);
                    if (selectedBarber) setLoadingTimes(true);
                  }}
                  min={minDate}
                  className="glassmorphism-input w-full"
                  required
                />
              </div>

              {/* Horarios */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Horarios disponibles
                </label>

                {!selectedDate || !selectedBarber ? (
                  <p className="flex items-center gap-2 text-sm text-gray-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                    Selecciona fecha y barbero para ver horarios disponibles
                  </p>
                ) : loadingTimes ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 rounded-lg" />
                    ))}
                  </div>
                ) : (!Array.isArray(availableTimes) || availableTimes.length === 0) ? (
                  <p className="flex items-center gap-2 text-sm text-red-300">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    {availabilityReason || 'Sin horarios disponibles para este día'}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {availableTimes.map((timeSlot, index) => (
                      <button
                        key={`${timeSlot.time}-${index}`}
                        type="button"
                        onClick={() => {
                          logger.debug('🕐 Time slot selected:', timeSlot);
                          setSelectedTime(timeSlot.datetime);
                        }}
                        className={`min-h-11 rounded-lg border text-sm font-medium transition-colors duration-200 ${
                          selectedTime === timeSlot.datetime
                            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                            : 'border-white/[0.08] bg-white/[0.02] text-gray-300 hover:border-amber-500/40 hover:bg-white/[0.05]'
                        }`}
                      >
                        {timeSlot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/5 p-3">
                  <XCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <p className="text-sm text-emerald-300">{success}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <GradientButton
                  type="submit"
                  disabled={submitting || !selectedService || !selectedBarber || !selectedDate || !selectedTime}
                  variant="primary"
                  size="lg"
                  className="w-full shadow-xl shadow-soft"
                  onClick={(e) => {
                    logger.debug('🔘 Button clicked!', e);
                  // El handleSubmit se ejecutará automáticamente por el type="submit"
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Calendar size={18} />
                    <span>{submitting ? 'Agendando...' : 'Agendar Cita'}</span>
                  </div>
                </GradientButton>
              </div>
            </form>
            </div>
          )}
        </div>

        {/* ── Mis citas ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-white">Mis Citas</h2>
                <p className="text-xs text-gray-400">
                  {filteredAppointments.length} cita{filteredAppointments.length !== 1 ? 's' : ''} en {activeTab === 'upcoming' ? 'próximas' : 'historial'}
                </p>
              </div>
            </div>

            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-full sm:w-fit">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 sm:flex-none min-h-10 px-3.5 py-2 rounded-lg border cursor-pointer transition-colors duration-200 flex items-center justify-center gap-1.5 ${
                  activeTab === 'upcoming'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-transparent hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <Calendar size={14} className={activeTab === 'upcoming' ? 'text-blue-300' : 'text-gray-400'} />
                <span className={`font-medium text-xs whitespace-nowrap ${activeTab === 'upcoming' ? 'text-blue-300' : 'text-gray-300'}`}>
                  Próximas
                </span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 sm:flex-none min-h-10 px-3.5 py-2 rounded-lg border cursor-pointer transition-colors duration-200 flex items-center justify-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-transparent hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <Clock size={14} className={activeTab === 'history' ? 'text-blue-300' : 'text-gray-400'} />
                <span className={`font-medium text-xs whitespace-nowrap ${activeTab === 'history' ? 'text-blue-300' : 'text-gray-300'}`}>
                  Historial
                </span>
              </button>
            </div>
          </div>

          {loading ? (
            <UserAppointmentsSkeleton cards={4} />
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-300 mb-1">
                {activeTab === 'upcoming' ? 'No tienes citas próximas' : 'No hay historial de citas'}
              </h3>
              <p className="text-sm text-gray-500">
                {activeTab === 'upcoming'
                  ? 'Agenda una nueva cita desde el botón "Nueva cita"'
                  : 'Tus citas completadas y canceladas aparecerán aquí'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAppointments.map((appointment) => {
                // Colores, textos y etiquetas que corresponden a cada estado de la cita.
                const statusClasses = {
                  pending: 'border-amber-500/30 bg-amber-500/5 shadow-sm shadow-soft',
                  confirmed: 'border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-soft',
                  completed: 'border-blue-500/30 bg-blue-500/5 shadow-sm shadow-soft',
                  cancelled: 'border-red-500/30 bg-red-500/5 shadow-sm shadow-soft',
                };
                const statusText = {
                  pending: 'text-amber-300',
                  confirmed: 'text-emerald-300',
                  completed: 'text-blue-300',
                  cancelled: 'text-red-300',
                };
                const statusLabel = {
                  pending: 'Pendiente',
                  confirmed: 'Confirmada',
                  completed: 'Completada',
                  cancelled: 'Cancelada',
                };

                return (
                  <div
                    key={appointment._id}
                    className={`flex flex-col gap-2 rounded-xl border backdrop-blur-sm p-3 transition-all duration-200 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-2 sm:py-2 sm:pl-3 sm:pr-1.5 ${statusClasses[appointment.status] || statusClasses.completed}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 sm:justify-start">
                        <span className="truncate text-sm font-medium text-white">
                          {appointment.service?.name || 'Servicio'}
                        </span>
                        <span className={`flex-shrink-0 text-[11px] font-medium ${statusText[appointment.status] || 'text-gray-400'}`}>
                          {statusLabel[appointment.status] || appointment.status}
                        </span>
                      </div>

                      {/* Móvil: info detallada en líneas separadas */}
                      <div className="mt-1.5 space-y-1 text-xs text-gray-400 sm:hidden">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <User className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                          <span className="truncate">
                            {appointment.barber?.user?.name || appointment.barber?.name || 'Barbero'}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                          <span className="capitalize">{format(new Date(appointment.date), "EEEE d 'de' MMMM", { locale: es })}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                          <span>{format(new Date(appointment.date), 'HH:mm')}</span>
                          {appointment.service?.price ? (
                            <span className="text-gray-500">· ${appointment.service.price}</span>
                          ) : null}
                        </span>
                      </div>

                      {/* Desktop: una línea compacta */}
                      <div className="mt-0.5 hidden min-w-0 items-center gap-1.5 text-xs text-gray-400 sm:flex">
                        <span className="truncate">
                          {appointment.barber?.user?.name || appointment.barber?.name || 'Barbero'}
                        </span>
                        <span className="flex-shrink-0 text-gray-600">•</span>
                        <span className="flex-shrink-0 capitalize">{format(new Date(appointment.date), "EEE d MMM", { locale: es })}</span>
                        <span className="flex-shrink-0 text-gray-600">•</span>
                        <span className="flex-shrink-0">{format(new Date(appointment.date), 'HH:mm')}</span>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1 border-t border-white/[0.06] pt-2 sm:border-0 sm:pt-0 sm:justify-end">
                      <button
                        onClick={() => handleViewAppointmentInfo(appointment._id)}
                        className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors sm:w-10 sm:flex-none hover:bg-white/[0.05] hover:text-blue-300"
                        title="Ver información"
                        aria-label="Ver información"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      {appointment.status === 'pending' && (
                        <button
                          onClick={() => setCancelId(appointment._id)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors sm:w-10 sm:flex-none hover:bg-white/[0.05] hover:text-red-300"
                          title="Cancelar cita"
                          aria-label="Cancelar cita"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {appointment.status === 'confirmed' && (
                        <button
                          onClick={() => handleOpenCancelModal(appointment._id)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors sm:w-10 sm:flex-none hover:bg-white/[0.05] hover:text-red-300"
                          title="Cancelar con motivo"
                          aria-label="Cancelar con motivo"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {appointment.status === 'completed' && (
                        <button
                          onClick={() => navigate(`/reviews/create/${appointment._id}`)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors sm:w-10 sm:flex-none hover:bg-white/[0.05] hover:text-amber-300"
                          title={appointment.hasReview ? 'Ver tu reseña' : 'Dejar reseña'}
                          aria-label={appointment.hasReview ? 'Ver tu reseña' : 'Dejar reseña'}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      {(appointment.status === 'completed' || appointment.status === 'cancelled') && (
                        <button
                          onClick={() => handleDeleteAppointment(appointment._id)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors sm:w-10 sm:flex-none hover:bg-white/[0.05] hover:text-red-300"
                          title="Eliminar"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cancel with Reason Modal */}
        <Modal
          isOpen={showCancelModal}
          onClose={handleCloseCancelModal}
          color="red"
          icon={AlertCircle}
          title="Cancelar Cita Confirmada"
          subtitle="El barbero será notificado"
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleCloseCancelModal}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleSubmitCancellation}
                disabled={!cancellationReason.trim()}
                className="px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Cancelación
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-blue-200/80 text-sm leading-relaxed">
                Para cancelar una cita confirmada, debe proporcionar un motivo. El barbero será notificado.
              </p>
            </div>

            <div className="space-y-2">
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Escriba el motivo de la cancelación (máximo 100 palabras)..."
                className="glassmorphism-textarea h-24 sm:h-28 text-xs sm:text-sm"
                maxLength={500}
              />
              <div className="text-right text-xs text-blue-200/60">
                {cancellationReason.split(' ').filter(word => word.length > 0).length}/100 palabras
              </div>
            </div>
          </div>
        </Modal>

        {/* Cancel Modal */}
        <Modal
          isOpen={!!cancelId}
          onClose={() => setCancelId(null)}
          color="red"
          icon={AlertCircle}
          title="Cancelar Cita"
          subtitle="Esta acción no se puede deshacer"
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setCancelId(null)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors"
              >
                Confirmar Cancelación
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
              <p className="text-blue-200/80 text-sm leading-relaxed">
                ¿Estás seguro de que deseas cancelar esta cita?
              </p>
              <p className="text-red-300 text-xs mt-2 font-medium">
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
        </Modal>

        {/* Delete Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={handleCloseDeleteModal}
          color="red"
          icon={Trash2}
          title="Eliminar Reporte"
          subtitle="Esta acción no se puede deshacer"
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors"
              >
                Confirmar Eliminación
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
              <p className="text-blue-200/80 text-sm leading-relaxed">
                ¿Estás seguro de que deseas eliminar el reporte de esta cita?
              </p>
              <p className="text-red-300 text-xs mt-2 font-medium">
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
        </Modal>

        {/* Modal de información de citas */}
        {(viewInfoData != null) && ((
        <Modal
          isOpen={showInfoModal}
          onClose={() => {
            setShowInfoModal(false);
            setViewInfoData(null);
          }}
          color="blue"
          icon={Info}
          title="Información de la cita"
          subtitle="Detalles completos de la cita"
          size="lg"
          footer={
            <div className="flex sm:justify-end">
              <GradientButton
                variant="primary"
                size="md"
                onClick={() => {
                  setShowInfoModal(false);
                  setViewInfoData(null);
                }}
                className="shadow-xl shadow-soft text-sm px-4 sm:px-6 py-2 w-full sm:w-auto"
              >
                Cerrar
              </GradientButton>
            </div>
          }
        >
          <div className="space-y-3 sm:space-y-4">
            {/* Estado */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/[0.08]">
              <span className="text-gray-300 text-xs sm:text-sm font-medium">Estado:</span>
              <div className={`px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium border ${
                viewInfoData.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                viewInfoData.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                viewInfoData.status === 'cancelled' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}>
                {viewInfoData.status === 'confirmed' ? 'Confirmada' :
                 viewInfoData.status === 'pending' ? 'Pendiente' :
                 viewInfoData.status === 'cancelled' ? 'Cancelada' : 'Completada'}
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="p-3 bg-white/5 rounded-lg border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                  <span className="text-gray-300 text-xs font-medium">Fecha:</span>
                </div>
                <p className="text-blue-200 text-xs sm:text-sm">{format(new Date(viewInfoData.date), "d 'de' MMM 'de' yyyy", { locale: es })}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                  <span className="text-gray-300 text-xs font-medium">Hora:</span>
                </div>
                <p className="text-blue-200 text-xs sm:text-sm">{viewInfoData.time}</p>
              </div>
            </div>

            {/* Barbero */}
            <div className="p-3 bg-white/5 rounded-lg border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                <span className="text-gray-300 text-xs font-medium">Barbero:</span>
              </div>
              <p className="text-blue-200 text-xs sm:text-sm">{viewInfoData.barber?.name || viewInfoData.barber || 'No asignado'}</p>
            </div>

            {/* Servicios */}
            <div className="p-3 bg-white/5 rounded-lg border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                <span className="text-gray-300 text-xs font-medium">Servicios:</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-blue-200 text-xs sm:text-sm min-w-0 truncate">{viewInfoData.service || 'Servicio no especificado'}</span>
                  <span className="text-blue-400 text-xs sm:text-sm font-medium shrink-0">
                    {viewInfoData.status === 'cancelled' ? '-' : `$${viewInfoData.price || 0}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex justify-between items-center">
                <span className="text-blue-300 text-xs sm:text-sm font-medium">Total:</span>
                <span className="text-blue-200 text-base sm:text-lg font-bold">
                  {viewInfoData.status === 'cancelled' ? '-' : `$${viewInfoData.totalPrice || 0}`}
                </span>
              </div>
            </div>

            {/* Motivo de cancelación según quien canceló */}
            {viewInfoData.status === 'cancelled' && (
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                  <span className="text-red-300 text-xs font-medium">
                    {viewInfoData.cancelledBy === 'user' ? 'Cancelada por ti' :
                     viewInfoData.cancelledBy === 'barber' ? 'Cancelada por el barbero' :
                     viewInfoData.cancelledBy === 'system' ? 'Cancelada por el sistema' : 'Motivo de cancelación'}:
                  </span>
                </div>
                <p className="text-blue-200 text-xs sm:text-sm">
                  {viewInfoData.cancelledBy === 'user' ? 'Cancelaste esta cita.' :
                   viewInfoData.cancelledBy === 'system' ? 'La cita expiró automáticamente.' :
                   viewInfoData.cancellationReason || 'Sin motivo especificado.'}
                </p>
              </div>
            )}
          </div>
        </Modal>
        ))}
      </div>
    </PageContainer>
  );
};

export default UserAppointment;

