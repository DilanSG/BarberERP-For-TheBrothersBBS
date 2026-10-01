import React, { useState, useEffect } from 'react';
import { PageContainer } from '@components/layout/PageContainer';
import { useAuth } from '@contexts/AuthContext';
import { api } from '@services/api';
import { barberService } from '@services/barberService';
import { appointmentService } from '@services/appointmentService';
import { useNotification } from '@contexts/NotificationContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, User, Scissors, CheckCircle, XCircle, AlertTriangle, Eye, Trash2, Check, X, Mail, BarChart3, ChevronRight } from 'lucide-react';
import CompleteAppointmentModal from '@components/modals/CompleteAppointmentModal';
import Modal from '@components/ui/Modal';

import { Skeleton, BarberAppointmentsSkeleton } from '@components/ui/Skeleton';

// Configuración visual de los filtros de estado
const TAB_CONFIG = {
  pending: {
    label: 'Pendientes',
    icon: Clock,
    active: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    iconActive: 'text-amber-400',
  },
  confirmed: {
    label: 'Confirmadas',
    icon: CheckCircle,
    active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    iconActive: 'text-emerald-400',
  },
  completed: {
    label: 'Completadas',
    icon: Check,
    active: 'border-blue-500/50 bg-blue-500/10 text-blue-300',
    iconActive: 'text-blue-400',
  },
  cancelled: {
    label: 'Canceladas',
    icon: X,
    active: 'border-red-500/50 bg-red-500/10 text-red-300',
    iconActive: 'text-red-400',
  },
  reports: {
    label: 'Reportes',
    icon: BarChart3,
    active: 'border-brand-400/50 bg-brand-400/10 text-brand-200',
    iconActive: 'text-brand-300',
  },
};

import logger from '@utils/logger';
// Panel de citas del barbero: carga su perfil y sus citas asignadas.
// Permite confirmar, completar con método de pago, cancelar con motivo (obligatorio),
// ver el detalle, marcar inasistencia y eliminar reportes de citas cerradas.
const BarberAppointment = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [barberProfile, setBarberProfile] = useState(null);
  const [barberId, setBarberId] = useState(null);
  const [processingAppointments, setProcessingAppointments] = useState(new Set());
  
  // Estados para cancelación con motivo
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAppointmentId, setCancelAppointmentId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Estados para modal de información
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  // Estados para modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState(null);

  // Estados para modal de completar cita
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [appointmentToComplete, setAppointmentToComplete] = useState(null);
  
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Al iniciar sesión carga el perfil del barbero para obtener su id.
  useEffect(() => {
    if (user && user.role === 'barber') {
      fetchBarberProfile();
    }
  }, [user]);

  // Obtiene el perfil del barbero y con él dispara la carga de sus citas.
  const fetchBarberProfile = async () => {
    try {
      const data = await barberService.getBarberProfile();
      if (data.success) {
        setBarberProfile(data.data);
        setBarberId(data.data._id);
        fetchBarberAppointments(data.data._id);
      }
    } catch (error) {
      console.error('Error fetching barber profile:', error);
    }
  };

  // Consulta las citas asignadas al barbero y las guarda en el estado.
  const fetchBarberAppointments = async (barberId) => {
    try {
      setLoading(true);
      const data = await api.get(`/appointments/barber/${barberId}`);
      if (data.success) {
        setAppointments(data.data);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error al cargar las citas');
    } finally {
      setLoading(false);
    }
  };

  // Gestiona el cambio de estado de una cita: cancelar y completar abren modal
  // (motivo o método de pago) y el resto se aprueba o marca como no asistida.
  const handleStatusChange = async (appointmentId, newStatus) => {
    if (processingAppointments.has(appointmentId)) return;

    if (newStatus === 'cancelled') {
      handleOpenCancelModal(appointmentId);
      return;
    }

    if (newStatus === 'completed') {
      // Abrir modal para seleccionar método de pago
      const appointment = appointments.find(app => app._id === appointmentId);
      setAppointmentToComplete(appointment);
      setShowCompleteModal(true);
      return;
    }

    try {
      setProcessingAppointments(prev => new Set(prev).add(appointmentId));
      
      logger.debug(`🔄 Changing appointment ${appointmentId} status to ${newStatus}`);
      
      let response;
      switch (newStatus) {
        case 'confirmed':
          response = await appointmentService.approveAppointment(appointmentId);
          break;
        case 'no-show':
          response = await appointmentService.markNoShow(appointmentId);
          break;
        default:
          throw new Error(`Estado no válido: ${newStatus}`);
      }
      
      if (response.success) {
        showSuccess(`Cita ${newStatus === 'confirmed' ? 'confirmada' : 'actualizada'} exitosamente`);
        fetchBarberAppointments(barberId);
      }
    } catch (error) {
      console.error('Error:', error);
      showError(error.message || 'Error al actualizar la cita');
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Elimina el reporte de una cita cerrada y recarga la lista.
  const handleDeleteAppointment = async (appointmentId) => {
    try {
      const data = await appointmentService.deleteAppointment(appointmentId);
      if (data.success) {
        showSuccess('Reporte de cita eliminado exitosamente');
        fetchBarberAppointments(barberId);
        setShowDeleteModal(false);
        setDeleteAppointmentId(null);
      }
    } catch (error) {
      console.error('Error:', error);
      showError(error.message || 'Error al eliminar el reporte de cita');
    }
  };

  // Funciones para modal de información
  const handleOpenInfoModal = (appointment) => {
    setSelectedAppointment(appointment);
    setShowInfoModal(true);
  };

  const handleCloseInfoModal = () => {
    setShowInfoModal(false);
    setSelectedAppointment(null);
  };

  // Función para completar cita con método de pago
  // Completa la cita registrando el método de pago elegido en el modal.
  // Refresca la lista y cierra el modal al terminar.
  const handleCompleteWithPayment = async (appointmentId, paymentMethod) => {
    try {
      setProcessingAppointments(prev => new Set(prev).add(appointmentId));
      
      logger.debug(`🔄 Completing appointment ${appointmentId} with payment method ${paymentMethod}`);
      
      const response = await appointmentService.completeAppointment(appointmentId, paymentMethod);
      
      if (response.success) {
        showSuccess('Cita completada exitosamente');
        fetchBarberAppointments(barberId);
        setShowCompleteModal(false);
        setAppointmentToComplete(null);
      }
    } catch (error) {
      logger.error('❌ Error completing appointment:', error);
      showError(error.message || 'Error al completar la cita');
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Funciones para modal de eliminación
  // Abre el modal de confirmación para eliminar el reporte.
  const handleOpenDeleteModal = (appointmentId) => {
    setDeleteAppointmentId(appointmentId);
    setShowDeleteModal(true);
  };

  // Cierra el modal de eliminación y limpia la cita pendiente.
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteAppointmentId(null);
  };

  // Abre el modal de cancelación exigiendo un motivo (se limpia al abrir).
  const handleOpenCancelModal = (appointmentId) => {
    setCancelAppointmentId(appointmentId);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  // Cierra el modal de cancelación y descarta el motivo escrito.
  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancelAppointmentId(null);
    setCancellationReason('');
  };

  // Envía la cancelación con motivo: valida que exista y no supere 100 palabras
  // antes de llamar al endpoint de cancelación.
  const handleSubmitCancellation = async () => {
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      showError('Debe proporcionar un motivo para cancelar la cita');
      return;
    }

    if (cancellationReason.split(' ').length > 100) {
      showError('El motivo no puede exceder las 100 palabras');
      return;
    }

    try {
      const data = await api.put(`/appointments/${cancelAppointmentId}/cancel`, {
        reason: cancellationReason.trim()
      });
      
      if (data.success) {
        showSuccess('Cita cancelada exitosamente. El cliente ha sido notificado.');
        handleCloseCancelModal();
        fetchBarberAppointments(barberId);
      }
    } catch (error) {
      console.error('Error:', error);
      showError(error.message || 'Error al cancelar la cita');
    }
  };

  // Componente para tarjeta de cita compacta
  // Tarjeta compacta de cita con las acciones disponibles según su estado.
  const AppointmentCard = ({ appointment }) => {
    const statusClasses = {
      pending: 'border-amber-500/30 bg-amber-500/5 shadow-sm shadow-soft',
      confirmed: 'border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-soft',
      completed: 'border-blue-500/30 bg-blue-500/5 shadow-sm shadow-soft',
      cancelled: 'border-red-500/30 bg-red-500/5 shadow-sm shadow-soft',
    };

    return (
      <div className={`flex items-center gap-2 rounded-xl border backdrop-blur-sm py-2 pl-3 pr-1.5 transition-all duration-200 hover:-translate-y-0.5 ${statusClasses[appointment.status] || 'border-gray-500/30 bg-gray-500/5 shadow-sm shadow-soft'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white">
              {appointment.service?.name || 'Servicio no especificado'}
            </span>
            <StatusBadge status={appointment.status} />
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
            <span className="truncate">{appointment.user?.name || 'Usuario no disponible'}</span>
            <span className="flex-shrink-0 text-gray-600">•</span>
            <span className="flex-shrink-0 capitalize">{format(new Date(appointment.date), "EEE d MMM", { locale: es })}</span>
            <span className="flex-shrink-0 text-gray-600">•</span>
            <span className="flex-shrink-0">{format(new Date(appointment.date), 'HH:mm')}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={() => handleOpenInfoModal(appointment)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-blue-300"
            title="Ver información"
            aria-label="Ver información"
          >
            <Eye className="w-4 h-4" />
          </button>
          {appointment.status === 'pending' && (
            <>
              <button
                onClick={() => handleStatusChange(appointment._id, 'confirmed')}
                disabled={processingAppointments.has(appointment._id)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  processingAppointments.has(appointment._id)
                    ? 'cursor-not-allowed text-gray-600'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-emerald-300'
                }`}
                title="Confirmar cita"
                aria-label="Confirmar cita"
              >
                {processingAppointments.has(appointment._id) ? (
                  <Skeleton className="h-3 w-3 rounded-full" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => handleOpenCancelModal(appointment._id)}
                disabled={processingAppointments.has(appointment._id)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  processingAppointments.has(appointment._id)
                    ? 'cursor-not-allowed text-gray-600'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-red-300'
                }`}
                title="Cancelar cita"
                aria-label="Cancelar cita"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {appointment.status === 'confirmed' && (
            <>
              <button
                onClick={() => handleStatusChange(appointment._id, 'completed')}
                disabled={processingAppointments.has(appointment._id)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  processingAppointments.has(appointment._id)
                    ? 'cursor-not-allowed text-gray-600'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-blue-300'
                }`}
                title="Completar cita"
                aria-label="Completar cita"
              >
                {processingAppointments.has(appointment._id) ? (
                  <Skeleton className="h-3 w-3 rounded-full" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => handleOpenCancelModal(appointment._id)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-amber-300"
                title="Cancelar con motivo"
                aria-label="Cancelar con motivo"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {(appointment.status === 'completed' || appointment.status === 'cancelled') && (
            <button
              onClick={() => handleOpenDeleteModal(appointment._id)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-red-300"
              title="Eliminar reporte"
              aria-label="Eliminar reporte"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Etiqueta de estado con color y texto según la situación de la cita.
  const StatusBadge = ({ status }) => {
    const styles = {
      pending: 'text-amber-300',
      confirmed: 'text-emerald-300',
      completed: 'text-blue-300',
      cancelled: 'text-red-300',
    };

    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };

    return (
      <span className={`flex-shrink-0 text-[11px] font-medium ${styles[status] || 'text-gray-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Botón de pestaña que filtra la lista y muestra el conteo de citas.
  const TabButton = ({ status, count, className = '' }) => {
    const isSelected = selectedTab === status;
    const config = TAB_CONFIG[status] || TAB_CONFIG.pending;
    const Icon = config.icon;

    return (
      <button
        onClick={() => setSelectedTab(status)}
        aria-pressed={isSelected}
        className={`flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
          isSelected
            ? config.active
            : 'border-white/[0.08] bg-white/[0.03] text-gray-300 hover:border-white/[0.16] hover:bg-white/[0.05]'
        } ${className}`}
      >
        <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? config.iconActive : 'text-gray-400'}`} />
        <span className="flex-1 text-left xl:flex-none">{config.label}</span>
        {count > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold xl:ml-auto ${
            isSelected ? 'bg-white/15' : 'bg-white/[0.06] text-gray-400'
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  // La pestaña 'reports' agrupa completadas y canceladas; el resto filtra
  // por estado exacto. 'counts' alimenta los contadores de cada pestaña.
  const filteredAppointments = selectedTab === 'reports' 
    ? appointments.filter(app => app.status === 'completed' || app.status === 'cancelled')
    : appointments.filter(app => app.status === selectedTab);
  const counts = {
    pending: appointments.filter(app => app.status === 'pending').length,
    confirmed: appointments.filter(app => app.status === 'confirmed').length,
    completed: appointments.filter(app => app.status === 'completed').length,
    cancelled: appointments.filter(app => app.status === 'cancelled').length,
    reports: appointments.filter(app => app.status === 'completed' || app.status === 'cancelled').length
  };

  // Esqueleto de carga mientras llegan el perfil y las citas.
  if (loading) {
    return (
      <PageContainer>
        <div className="relative z-10 w-full pb-6">
          <BarberAppointmentsSkeleton cards={4} />
        </div>
      </PageContainer>
    );
  }

  // Vista principal: pestañas de estado (móvil y escritorio), panel de reportes
  // con totales y listado de citas, más los modales de cancelar, informar,
  // eliminar y completar cita.
  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">
        
        {/* ── Top bar ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Gestión de Citas</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                Administra y gestiona las citas de tus clientes
              </p>
            </div>
          </div>
        </div>

        {/* ── Filtros de estado (móvil/tablet) ── */}
        <div className="space-y-2 xl:hidden">
          <div className="grid grid-cols-2 gap-2">
            <TabButton status="pending" count={counts.pending} />
            <TabButton status="confirmed" count={counts.confirmed} />
            <TabButton status="completed" count={counts.completed} />
            <TabButton status="cancelled" count={counts.cancelled} />
          </div>

          {/* Reportes: acción aparte (no es un estado) */}
          <button
            onClick={() => setSelectedTab('reports')}
            aria-pressed={selectedTab === 'reports'}
            className={`flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
              selectedTab === 'reports'
                ? 'border-brand-400/50 bg-brand-400/10 text-brand-200'
                : 'border-brand-400/20 bg-brand-400/[0.04] text-gray-300 hover:border-brand-400/40 hover:bg-brand-400/10'
            }`}
          >
            <BarChart3 className={`h-4 w-4 flex-shrink-0 ${selectedTab === 'reports' ? 'text-brand-300' : 'text-brand-300/70'}`} />
            <span className="flex-1 text-left">Ver reportes</span>
            {counts.reports > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                selectedTab === 'reports' ? 'bg-white/15' : 'bg-white/[0.06] text-gray-400'
              }`}>
                {counts.reports}
              </span>
            )}
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-brand-300/70" />
          </button>
        </div>

        {/* Grid de 2 columnas responsivo */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Columna Izquierda - Tabs y Estadísticas */}
            <div className="hidden xl:block relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                    <CheckCircle className="w-5 h-5 text-brand-300" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-white">Estados de Citas</h2>
                    <p className="text-xs text-gray-400">Filtra la lista por estado</p>
                  </div>
                </div>
                
                {/* Tabs Compactos — scroll horizontal en móvil */}
                <div className="flex flex-col space-y-2">
                  <TabButton status="pending" count={counts.pending} />
                  <TabButton status="confirmed" count={counts.confirmed} />
                  <TabButton status="completed" count={counts.completed} />
                  <TabButton status="cancelled" count={counts.cancelled} />
                  <TabButton status="reports" count={counts.reports} />
                </div>
              </div>
            </div>
            
            {/* Columna Derecha - Lista de Citas */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
              {/* Efecto de brillo */}
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <Scissors className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                      {selectedTab === 'pending' ? 'Citas Pendientes' : 
                       selectedTab === 'confirmed' ? 'Citas Confirmadas' : 
                       selectedTab === 'completed' ? 'Citas Completadas' : 
                       selectedTab === 'cancelled' ? 'Citas Canceladas' :
                       selectedTab === 'reports' ? 'Reportes de Citas' : 
                       'Otras Citas'}
                    </h2>
                    <p className="text-xs text-gray-400">{filteredAppointments.length} cita{filteredAppointments.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                
                {/* Lista de Citas Compacta o Reportes */}
                {selectedTab === 'reports' ? (
                  /* Reportes - Solo 2 divs con totales */
                  <div className="space-y-4">
                    {/* Div de Completadas */}
                    <div className="group relative bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 backdrop-blur-sm shadow-xl shadow-soft hover:border-emerald-500/50 transition-all duration-300 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/40">
                            <CheckCircle className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-base lg:text-lg font-bold text-emerald-300">Citas Completadas</h3>
                            <p className="text-xs text-emerald-200/80">Total de servicios finalizados</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl lg:text-3xl font-bold text-emerald-400">{counts.completed}</div>
                          <div className="text-xs text-emerald-300/80">servicios</div>
                        </div>
                      </div>
                    </div>

                    {/* Div de Canceladas */}
                    <div className="group relative bg-red-500/5 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm shadow-xl shadow-soft hover:border-red-500/50 transition-all duration-300 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/40">
                            <XCircle className="w-6 h-6 text-red-400" />
                          </div>
                          <div>
                            <h3 className="text-base lg:text-lg font-bold text-red-300">Citas Canceladas</h3>
                            <p className="text-xs text-red-200/80">Total de citas no realizadas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl lg:text-3xl font-bold text-red-400">{counts.cancelled}</div>
                          <div className="text-xs text-red-300/80">canceladas</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Lista normal de citas */
                  <div className="space-y-2 max-h-none xl:max-h-96 xl:overflow-y-auto custom-scrollbar pr-2 pt-2">
                    {filteredAppointments.length === 0 ? (
                      <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center backdrop-blur-sm shadow-xl shadow-soft">
                        <div className="inline-block p-4 bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-2xl mb-4">
                          <Calendar className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-white">
                          No hay citas {
                            selectedTab === 'pending' ? 'pendientes' : 
                            selectedTab === 'confirmed' ? 'confirmadas' : 
                            selectedTab === 'completed' ? 'completadas' : 
                            selectedTab === 'cancelled' ? 'canceladas' :
                            selectedTab === 'reports' ? 'en reportes' : 
                            'disponibles'
                          }
                        </h3>
                        <p className="text-sm text-gray-400">
                          Las citas aparecerán aquí cuando estén disponibles
                        </p>
                      </div>
                    ) : (
                      filteredAppointments.map((appointment, index) => (
                        <div 
                          key={appointment._id} 
                          style={{ zIndex: filteredAppointments.length - index }}
                        >
                          <AppointmentCard appointment={appointment} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Cancel with Reason Modal */}
        <Modal
          isOpen={showCancelModal}
          onClose={handleCloseCancelModal}
          color="red"
          icon={XCircle}
          title="Cancelar Cita"
          subtitle="El cliente será notificado"
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleCloseCancelModal}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
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
                Como barbero, debe proporcionar un motivo para cancelar la cita. El cliente será notificado.
              </p>
            </div>

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
        </Modal>

        {/* Modal de Información de Cita */}
        {(selectedAppointment != null) && ((
        <Modal
          isOpen={showInfoModal}
          onClose={handleCloseInfoModal}
          color="blue"
          icon={Calendar}
          title="Información de Cita"
          subtitle="Detalles completos de la cita"
          size="lg"
        >
          <div className="space-y-4">
            {/* Estado */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-blue-200">Estado</h4>
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  selectedAppointment.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                  selectedAppointment.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  selectedAppointment.status === 'cancelled' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                  'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}>
                  {selectedAppointment.status === 'pending' ? 'Pendiente' :
                   selectedAppointment.status === 'confirmed' ? 'Confirmada' :
                   selectedAppointment.status === 'cancelled' ? 'Cancelada' :
                   'Completada'}
                </div>
              </div>
              
              {/* Motivo de cancelación dentro del estado */}
              {selectedAppointment.status === 'cancelled' && selectedAppointment.cancellationReason && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-semibold text-red-300 mb-1">Motivo de Cancelación</h5>
                      <p className="text-xs text-red-200/80 leading-relaxed">{selectedAppointment.cancellationReason}</p>
                      <p className="text-xs text-red-300/60 mt-1">
                        Cancelada por: {selectedAppointment.cancelledBy === 'barber' ? 'Barbero' : 'Cliente'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cliente */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <h4 className="text-sm font-semibold text-blue-200 mb-2">Cliente</h4>
              <div className="space-y-1">
                <p className="text-sm text-gray-300">
                  <User className="w-4 h-4 inline mr-2" />
                  {selectedAppointment.user?.name || 'Usuario no disponible'}
                </p>
                {selectedAppointment.user?.email && (
                  <p className="text-sm text-gray-300">
                    <Mail className="w-4 h-4 inline mr-2" />{selectedAppointment.user.email}
                  </p>
                )}
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <h4 className="text-sm font-semibold text-blue-200 mb-2">Fecha y Hora</h4>
              <div className="space-y-1">
                <p className="text-sm text-gray-300">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  {format(new Date(selectedAppointment.date), 'EEEE, d MMMM yyyy', { locale: es })}
                </p>
                <p className="text-sm text-gray-300">
                  <Clock className="w-4 h-4 inline mr-2" />
                  {format(new Date(selectedAppointment.date), "HH:mm")}
                </p>
              </div>
            </div>

            {/* Servicio */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <h4 className="text-sm font-semibold text-blue-200 mb-2">Servicio</h4>
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  <Scissors className="w-4 h-4 inline mr-2" />
                  {selectedAppointment.service?.name || 'Servicio no especificado'}
                </p>
                {selectedAppointment.service?.duration && (
                  <p className="text-xs text-gray-400">
                    Duración: {selectedAppointment.service.duration} minutos
                  </p>
                )}
                <p className="text-sm font-medium text-emerald-400">
                  ${selectedAppointment.status === 'cancelled' ? '0' : (selectedAppointment.service?.price?.toLocaleString() || '0')}
                </p>
              </div>
            </div>

            {/* Notas adicionales */}
            {selectedAppointment.notes && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <h4 className="text-sm font-semibold text-blue-200 mb-2">Notas</h4>
                <p className="text-sm text-gray-300">{selectedAppointment.notes}</p>
              </div>
            )}
          </div>
        </Modal>
        ))}

        {/* Modal de Confirmación de Eliminación */}
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
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAppointment(deleteAppointmentId)}
                className="px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-red-300 mb-1">Acción Irreversible</h4>
                  <p className="text-sm text-red-200/80">Esta acción no se puede deshacer.</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-2">
              ¿Estás seguro de que deseas eliminar este reporte de cita?
            </p>
            <p className="text-xs text-gray-400">
              Se eliminará permanentemente del historial y no podrá ser recuperado.
            </p>
          </div>
        </Modal>

        {/* Modal de completar cita */}
        <CompleteAppointmentModal
          isOpen={showCompleteModal}
          onClose={() => {
            setShowCompleteModal(false);
            setAppointmentToComplete(null);
          }}
          appointment={appointmentToComplete}
          onComplete={handleCompleteWithPayment}
        />
      </div>
    </PageContainer>
  );
};

export default BarberAppointment;

