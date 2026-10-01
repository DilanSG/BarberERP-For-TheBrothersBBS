import { useState, useEffect } from 'react';
import { PageContainer } from '@components/layout/PageContainer';
import { StatusBadge } from '@components/ui/StatusBadge';
import { api } from '@services/api';
import { appointmentService } from '@services/appointmentService';
import { useNotification } from '@contexts/NotificationContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye, 
  Trash2, 
  Check, 
  X,
  Users,
  Activity,
  Info,
  AlertTriangle,
  DollarSign,
  MapPin
} from 'lucide-react';
import GradientButton from '@components/ui/GradientButton';
import Modal from '@components/ui/Modal';
import { AdminAppointmentsSkeleton } from '@components/ui/Skeleton';

// Componente principal del panel de citas para administradores.
// Carga todas las citas desde /appointments, calcula estadísticas por estado
// (pendiente, confirmada, completada y cancelada) y permite filtrarlas desde tarjetas.
// Gestiona la confirmación, cancelación con motivo, consulta del motivo y eliminación del reporte.
const AdminAppointment = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError, showInfo } = useNotification();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    date: 'all'
  });

  // Estados para cancelación con motivo
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAppointmentId, setCancelAppointmentId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Estados para modales de información
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Estados para modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState(null);

  // Carga inicial: obtiene todas las citas al montar el componente.
  useEffect(() => {
    fetchAllAppointments();
  }, []);

  // Solicita todas las citas al backend y refresca la lista y las estadísticas.
  const fetchAllAppointments = async () => {
    try {
      const data = await api.get('/appointments');
      if (data.success) {
        setAppointments(data.data);
        updateStats(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recalcula los contadores de cada estado a partir del arreglo de citas.
  const updateStats = (appointments) => {
    const newStats = appointments.reduce((acc, app) => {
      acc.total++;
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 });
    
    setStats(newStats);
  };

  // Cambia el estado de una cita según la acción solicitada: aprueba, completa
  // o deriva al modal de cancelación cuando el nuevo estado es 'cancelled'.
  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      let response;
      switch (newStatus) {
        case 'confirmed':
          response = await appointmentService.approveAppointment(appointmentId);
          break;
        case 'completed':
          response = await appointmentService.completeAppointment(appointmentId);
          break;
        case 'cancelled':
          handleOpenCancelModal(appointmentId);
          return;
        default:
          showError('Estado no válido');
          return;
      }

      if (response.success) {
        showSuccess(`Cita ${newStatus === 'confirmed' ? 'confirmada' : 'actualizada'} exitosamente`);
        fetchAllAppointments();
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error al actualizar la cita');
    }
  };

  // Abre el modal de confirmación para eliminar el reporte de una cita.
  const handleDeleteAppointment = async (appointmentId) => {
    setDeleteAppointmentId(appointmentId);
    setShowDeleteModal(true);
  };

  // Elimina permanentemente el reporte de la cita y recarga la lista.
  const confirmDeleteAppointment = async () => {
    try {
      const data = await appointmentService.deleteAppointment(deleteAppointmentId);
      if (data.success) {
        showSuccess('Reporte de cita eliminado exitosamente');
        fetchAllAppointments();
        setShowDeleteModal(false);
        setDeleteAppointmentId(null);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error al eliminar el reporte de cita');
    }
  };

  // Abre el modal con la información completa de la cita seleccionada.
  // Open info modal
  const handleOpenInfoModal = (appointment) => {
    setSelectedAppointment(appointment);
    setShowInfoModal(true);
  };

  // Cierra el modal de información y limpia la cita seleccionada.
  // Close info modal
  const handleCloseInfoModal = () => {
    setShowInfoModal(false);
    setSelectedAppointment(null);
  };

  // Abre el modal de cancelación para la cita indicada.
  // Open cancel modal
  const handleOpenCancelModal = (appointmentId) => {
    setCancelAppointmentId(appointmentId);
    setShowCancelModal(true);
  };

  // Cierra el modal de cancelación y limpia el id y el motivo pendientes.
  // Close cancel modal
  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancelAppointmentId(null);
    setCancellationReason('');
  };

  // Cancela la cita enviando el motivo opcional; recarga la lista al terminar.
  // Submit cancellation with optional reason
  const handleSubmitCancellation = async () => {
    try {
      const response = await appointmentService.cancelAppointment(
        cancelAppointmentId, 
        cancellationReason.trim() || undefined
      );

      if (response.success) {
        showSuccess('Cita cancelada exitosamente por administración.');
        fetchAllAppointments();
        handleCloseCancelModal();
      } else {
        showError(response.message || 'Error al cancelar la cita');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error al cancelar la cita');
    }
  };

  // Consulta y muestra quién canceló la cita (cliente, barbero o administración) y la fecha.
  // View cancellation reason
  const handleViewCancellationReason = async (appointmentId) => {
    try {
      const data = await api.get(`/appointments/${appointmentId}/cancellation-reason`);
      
      if (data.success) {
        const { reason, cancelledBy, cancelledAt } = data.data;
        const cancelledByText = cancelledBy === 'user' ? 'el cliente' : 
                               cancelledBy === 'barber' ? 'el barbero' : 'administración';
        
        showInfo(
          `${reason}\n\nCancelada el: ${new Date(cancelledAt).toLocaleString('es-ES')}`,
          `Motivo de cancelación por ${cancelledByText}`
        );
      } else {
        showError('No se pudo obtener el motivo de cancelación');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('No se pudo obtener el motivo de cancelación');
    }
  };

  // Función para obtener sombra por color del estado
  const getStatusShadowClass = (status) => {
    const shadows = {
      'pending': 'drop-shadow-[0_1px_2px_rgba(251,146,60,0.3)]',
      'confirmed': 'drop-shadow-[0_1px_2px_rgba(34,197,94,0.3)]', 
      'completed': 'drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]',
      'cancelled': 'drop-shadow-[0_1px_2px_rgba(239,68,68,0.3)]'
    };
    return shadows[status] || 'drop-shadow-sm';
  };

  // Función para ordenar citas por prioridad
  // Ordena por prioridad: pendientes, confirmadas, completadas y canceladas.
  const sortAppointmentsByPriority = (appointments) => {
    return appointments.sort((a, b) => {
      const priorityOrder = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
      return priorityOrder[a.status] - priorityOrder[b.status];
    });
  };

  // Tarjeta de estadística clicable que funciona como filtro por estado.
  const StatCard = ({ title, value, icon: Icon, gradient, borderColor, textColor, filterValue, isActive, onClick, className = '' }) => (
    <button
      onClick={() => onClick(filterValue)}
      className={`flex w-full items-center gap-3 p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 text-left hover:-translate-y-0.5 ${
        isActive ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:border-white/[0.2]'
      } ${className}`}
    >
      <div className={`p-2 rounded-lg border bg-gradient-to-r ${gradient} ${borderColor} flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${textColor}`} />
      </div>
      <div className="min-w-0">
        <p className={`text-lg sm:text-xl font-bold leading-tight ${isActive ? 'text-blue-300' : 'text-white'}`}>{value}</p>
        <p className="text-gray-400 text-xs truncate">{title}</p>
      </div>
    </button>
  );

  // Tarjeta de una cita: muestra servicio, cliente, barbero y fecha, y renderiza
  // las acciones disponibles según el estado (confirmar, completar, cancelar, ver motivo o eliminar).
  const AppointmentCard = ({ appointment, onStatusChange, onCancel, onViewReason, onDelete, onInfo }) => {
    const statusClasses = {
      pending: 'border-amber-500/30 bg-amber-500/5 shadow-sm shadow-soft',
      confirmed: 'border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-soft',
      completed: 'border-blue-500/30 bg-blue-500/5 shadow-sm shadow-soft',
      cancelled: 'border-red-500/30 bg-red-500/5 shadow-sm shadow-soft',
    };

    const statusTextColor = {
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

    // Resuelve los nombres del cliente y del barbero aunque vengan anidados.
    const clientName = appointment.user?.name || appointment.client?.name || 'Sin nombre';
    const barberName = appointment.barber?.user?.name || appointment.barber?.name || 'Sin asignar';

    return (
      <div className={`flex flex-col gap-2 rounded-xl border backdrop-blur-sm p-3 transition-colors duration-200 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-3 sm:py-2 sm:pl-3 sm:pr-1.5 ${statusClasses[appointment.status] || 'border-gray-500/30 bg-gray-500/5'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <span className="truncate text-sm font-medium text-white">
              {appointment.service?.name || 'Sin servicio'}
            </span>
            <span className={`flex-shrink-0 text-[11px] font-medium ${statusTextColor[appointment.status] || 'text-gray-400'}`}>
              {statusLabel[appointment.status] || 'Desconocido'}
            </span>
          </div>

          {/* Móvil: detalle por líneas */}
          <div className="mt-1.5 space-y-1 text-xs text-gray-400 sm:hidden">
            <span className="flex min-w-0 items-center gap-1.5">
              <User className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span className="truncate">{clientName}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span className="truncate">{barberName}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span className="capitalize">{format(new Date(appointment.date), "EEEE d 'de' MMMM", { locale: es })}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span>{format(new Date(appointment.date), 'HH:mm')}</span>
            </span>
          </div>

          {/* Desktop: una línea compacta */}
          <div className="mt-0.5 hidden min-w-0 items-center gap-1.5 text-xs text-gray-400 sm:flex">
            <span className="max-w-[180px] truncate">{clientName}</span>
            <span className="flex-shrink-0 text-gray-600">•</span>
            <span className="max-w-[160px] truncate">{barberName}</span>
            <span className="flex-shrink-0 text-gray-600">•</span>
            <span className="flex-shrink-0 capitalize">{format(new Date(appointment.date), 'EEE d MMM', { locale: es })}</span>
            <span className="flex-shrink-0 text-gray-600">•</span>
            <span className="flex-shrink-0">{format(new Date(appointment.date), 'HH:mm')}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-shrink-0 items-center gap-1 border-t border-white/[0.06] pt-2 sm:border-0 sm:pt-0 sm:justify-end">
          <button
            onClick={() => onInfo(appointment)}
            className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-blue-300 sm:w-10 sm:flex-none"
            title="Ver información completa"
            aria-label="Ver información completa"
          >
            <Info className="w-4 h-4" />
          </button>

          {appointment.status === 'pending' && (
            <>
              <button
                onClick={() => onStatusChange(appointment._id, 'confirmed')}
                className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-emerald-300 sm:w-10 sm:flex-none"
                title="Confirmar cita"
                aria-label="Confirmar cita"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => onCancel(appointment._id)}
                className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-red-300 sm:w-10 sm:flex-none"
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
                onClick={() => onStatusChange(appointment._id, 'completed')}
                className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-blue-300 sm:w-10 sm:flex-none"
                title="Marcar como completada"
                aria-label="Marcar como completada"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => onCancel(appointment._id)}
                className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-red-300 sm:w-10 sm:flex-none"
                title="Cancelar cita"
                aria-label="Cancelar cita"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {appointment.status === 'cancelled' && appointment.cancellationReason && (
            <button
              onClick={() => onViewReason(appointment._id)}
              className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-amber-300 sm:w-10 sm:flex-none"
              title="Ver motivo de cancelación"
              aria-label="Ver motivo de cancelación"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          {(appointment.status === 'completed' || appointment.status === 'cancelled') && (
            <button
              onClick={() => onDelete(appointment._id)}
              className="flex h-10 flex-1 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-red-300 sm:w-10 sm:flex-none"
              title="Eliminar reporte de cita"
              aria-label="Eliminar reporte de cita"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Aplica el filtro de estado y ordena por prioridad antes de renderizar.
  const filteredAppointments = sortAppointmentsByPriority(
    appointments.filter(app => {
      if (filters.status !== 'all' && app.status !== filters.status) return false;
      return true;
    })
  );

  // Mientras cargan las citas se muestra el esqueleto animado.
  if (loading) {
    return (
      <PageContainer>
        <div className="relative z-10 w-full pb-6">
          <AdminAppointmentsSkeleton rows={5} />
        </div>
      </PageContainer>
    );
  }

  // Vista principal: encabezado, tarjetas de filtros, listado de citas y los modales
  // de información, cancelación (con motivo opcional) y eliminación del reporte.
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
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Panel de Citas</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                Gestión completa de citas y estadísticas del sistema
              </p>
            </div>
          </div>
        </div>

        {/* Filtros de Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            className="col-span-2 sm:col-span-1"
            title="Todas"
            value={stats.total}
            icon={Activity}
            gradient="from-blue-500/20 to-blue-600/20"
            borderColor="border-blue-500/30"
            textColor="text-blue-300"
            filterValue="all"
            isActive={filters.status === 'all'}
            onClick={(value) => setFilters(prev => ({...prev, status: value}))}
          />
          <StatCard
            title="Pendientes"
            value={stats.pending}
            icon={AlertCircle}
            gradient="from-amber-500/20 to-amber-600/20"
            borderColor="border-amber-500/30"
            textColor="text-amber-300"
            filterValue="pending"
            isActive={filters.status === 'pending'}
            onClick={(value) => setFilters(prev => ({...prev, status: value}))}
          />
          <StatCard
            title="Confirmadas"
            value={stats.confirmed}
            icon={CheckCircle}
            gradient="from-emerald-500/20 to-emerald-600/20"
            borderColor="border-emerald-500/30"
            textColor="text-emerald-300"
            filterValue="confirmed"
            isActive={filters.status === 'confirmed'}
            onClick={(value) => setFilters(prev => ({...prev, status: value}))}
          />
          <StatCard
            title="Completadas"
            value={stats.completed}
            icon={Check}
            gradient="from-brand-400/20 to-brand-500/20"
            borderColor="border-brand-400/30"
            textColor="text-brand-200"
            filterValue="completed"
            isActive={filters.status === 'completed'}
            onClick={(value) => setFilters(prev => ({...prev, status: value}))}
          />
          <StatCard
            title="Canceladas"
            value={stats.cancelled}
            icon={XCircle}
            gradient="from-red-500/20 to-red-600/20"
            borderColor="border-red-500/30"
            textColor="text-red-300"
            filterValue="cancelled"
            isActive={filters.status === 'cancelled'}
            onClick={(value) => setFilters(prev => ({...prev, status: value}))}
          />
        </div>

        {/* Lista de Citas */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-6">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Calendar className="w-5 h-5 text-brand-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-white">Lista de Citas</h2>
                <p className="text-xs text-gray-400">
                  {filteredAppointments.length} resultado{filteredAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No hay citas que coincidan con los filtros</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-none xl:max-h-[560px] xl:overflow-y-auto custom-scrollbar pr-1">
                {filteredAppointments.map((appointment, index) => (
                  <div
                    key={appointment._id}
                    style={{ zIndex: filteredAppointments.length - index }}
                  >
                    <AppointmentCard
                      appointment={appointment}
                      onStatusChange={handleStatusChange}
                      onCancel={handleOpenCancelModal}
                      onViewReason={handleViewCancellationReason}
                      onDelete={handleDeleteAppointment}
                      onInfo={handleOpenInfoModal}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modales */}
        
        {/* Modal de Información */}
        {(selectedAppointment != null) && ((
        <Modal
          isOpen={showInfoModal}
          onClose={handleCloseInfoModal}
          color="blue"
          icon={Info}
          title="Información de la Cita"
          subtitle="Detalles completos de la cita"
          size="lg"
        >
          <div className="space-y-6">
            {/* Estado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-300">Estado de la Cita</h4>
                <StatusBadge status={selectedAppointment.status} />
              </div>
              
              {/* Motivo de cancelación dentro del estado */}
              {selectedAppointment.status === 'cancelled' && selectedAppointment.cancellationReason && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-semibold text-red-300 mb-1">Motivo de Cancelación</h5>
                      <p className="text-xs text-red-200/80 leading-relaxed">{selectedAppointment.cancellationReason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Información del Cliente */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                Información del Cliente
              </h4>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Nombre:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200 font-medium">{selectedAppointment.user?.name || selectedAppointment.client?.name || 'Sin nombre'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Email:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200">{selectedAppointment.user?.email || selectedAppointment.client?.email || 'Sin email'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Teléfono:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200">{selectedAppointment.user?.phone || selectedAppointment.client?.phone || 'Sin teléfono'}</span>
                </div>
              </div>
            </div>

            {/* Información del Barbero */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" />
                Información del Barbero
              </h4>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Nombre:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200 font-medium">{selectedAppointment.barber?.user?.name || selectedAppointment.barber?.name || 'Sin asignar'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Especialidad:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200">{selectedAppointment.barber?.specialty || 'Sin especialidad'}</span>
                </div>
              </div>
            </div>

            {/* Información del Servicio */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-300" />
                Información del Servicio
              </h4>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Servicio:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200 font-medium">{selectedAppointment.service?.name || 'Sin servicio'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Precio:</span>
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {selectedAppointment.status === 'cancelled' ? '0.00' : (selectedAppointment.service?.price || '0.00')}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Duración:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200">{selectedAppointment.service?.duration || 'Sin duración'} min</span>
                </div>
              </div>
            </div>

            {/* Información de Fecha y Hora */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Fecha y Hora
              </h4>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Fecha:</span>
                  <span className="min-w-0 break-all text-right text-xs text-blue-200 font-medium">{format(new Date(selectedAppointment.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">Hora:</span>
                  <span className="text-xs text-blue-200 font-medium flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(selectedAppointment.date), "HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
        ))}

        {/* Modal de Cancelación */}
        <Modal
          isOpen={showCancelModal}
          onClose={handleCloseCancelModal}
          color="red"
          icon={XCircle}
          title="Cancelar Cita"
          subtitle="Esta acción no se puede deshacer"
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleCloseCancelModal}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Mantener Cita
              </button>
              <GradientButton
                onClick={handleSubmitCancellation}
                variant="danger"
                className="px-5 py-2.5 text-sm font-medium"
              >
                Cancelar Cita
              </GradientButton>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              ¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-300">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ingresa el motivo de la cancelación..."
                rows={3}
                className="glassmorphism-textarea resize-none text-sm"
              />
            </div>
          </div>
        </Modal>

        {/* Modal de Eliminación */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          color="red"
          icon={Trash2}
          title="Eliminar Reporte"
          subtitle="Esta acción no se puede deshacer"
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <GradientButton
                onClick={confirmDeleteAppointment}
                variant="danger"
                className="px-5 py-2.5 text-sm font-medium"
              >
                Eliminar Reporte
              </GradientButton>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-blue-200 font-medium mb-2">¿Confirmar eliminación?</h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Esta acción eliminará permanentemente el reporte de esta cita del sistema. 
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
          </div>
        </Modal>

      </div>
    </PageContainer>
  );
};

export default AdminAppointment;
