import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageContainer } from '@components/layout/PageContainer';
import { useAuth } from '@contexts/AuthContext';
import { appointmentService } from '@services/appointmentService';
import { serviceService } from '@services/serviceService';
import { barberService } from '@services/barberService';
import { useNotification } from '@contexts/NotificationContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import GradientButton from '@components/ui/GradientButton';
import GradientText from '@components/ui/GradientText';
import { Calendar, Clock, User, Scissors, ArrowLeft, Save, Info } from 'lucide-react';
import { AppointmentEditSkeleton, Skeleton } from '@components/ui/Skeleton';

// Componente para editar una cita existente (servicio, barbero, fecha y hora).
// Ruta: /appointment/edit/:id
// Formulario de edición de una cita: carga la cita, el catálogo de servicios,
// los barberos y los horarios disponibles para la fecha/barbero elegidos.
const AppointmentEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Estados del formulario
  const [appointment, setAppointment] = useState(null);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados del formulario de edición
  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Cargar datos iniciales
  // Carga inicial: cita, servicios y barberos cuando hay id y usuario.
  useEffect(() => {
    if (id && user) {
      loadAppointmentData();
      fetchServices();
      fetchBarbers();
    }
  }, [id, user]);

  // Cargar horarios cuando cambian fecha y barbero
  // Consulta los horarios disponibles cada vez que cambian fecha o barbero.
  useEffect(() => {
    if (selectedDate && selectedBarber && appointment) {
      fetchAvailableTimes();
    }
  }, [selectedDate, selectedBarber, appointment]);

  // Busca la cita por id, valida que el usuario sea el dueño o admin
  // y precarga el formulario con los valores actuales.
  const loadAppointmentData = async () => {
    try {
      setLoading(true);
      const response = await appointmentService.getAppointments();
      const appointmentData = response.data.find(app => app._id === id);
      
      if (!appointmentData) {
        showError('Cita no encontrada');
        navigate('/appointment');
        return;
      }

      // Solo el cliente dueño de la cita o un admin pueden editarla.
      if (appointmentData.user._id !== user._id && user.role !== 'admin') {
        showError('No tienes permisos para editar esta cita');
        navigate('/appointment');
        return;
      }

      setAppointment(appointmentData);
      
      // Valores iniciales del formulario tomados de la cita.
      setSelectedService(appointmentData.service._id);
      setSelectedBarber(appointmentData.barber._id);
      setSelectedDate(format(new Date(appointmentData.date), 'yyyy-MM-dd'));
      setSelectedTime(appointmentData.time);

    } catch (error) {
      console.error('Error loading appointment:', error);
      showError('Error al cargar los datos de la cita');
      navigate('/appointment');
    } finally {
      setLoading(false);
    }
  };

  // Obtiene el catálogo de servicios disponibles.
  const fetchServices = async () => {
    try {
      const response = await serviceService.getServices();
      setServices(response.data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      showError('Error al cargar los servicios');
    }
  };

  // Obtiene la lista de barberos disponibles.
  const fetchBarbers = async () => {
    try {
      const response = await barberService.getBarbers();
      setBarbers(response.data || []);
    } catch (error) {
      console.error('Error fetching barbers:', error);
      showError('Error al cargar los barberos');
    }
  };

  // Pide los horarios libres del barbero en la fecha y asegura que el horario
  // actual de la cita aparezca entre las opciones.
  const fetchAvailableTimes = async () => {
    try {
      const response = await appointmentService.getAvailableTimes(
        selectedBarber,
        selectedDate
      );
      
      // El horario ya reservado por esta cita debe seguir siendo seleccionable.
      const currentTime = appointment.time;
      const availableOptions = response.data || [];
      
      if (!availableOptions.includes(currentTime)) {
        availableOptions.push(currentTime);
        availableOptions.sort();
      }
      
      setAvailableTimes(availableOptions);
    } catch (error) {
      console.error('Error fetching available times:', error);
      setAvailableTimes([appointment.time]); // Ante un error se conserva al menos el horario actual.
    }
  };

  // Valida los campos, envía la actualización de la cita y vuelve al panel
  // de citas cuando el backend responde correctamente.
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) {
      showError('Por favor completa todos los campos');
      return;
    }

    try {
      setSubmitting(true);
      
      const updateData = {
        service: selectedService,
        barber: selectedBarber,
        date: selectedDate,
        time: selectedTime
      };

      await appointmentService.updateAppointment(id, updateData);
      showSuccess('Cita actualizada exitosamente');
      navigate('/appointment');
      
    } catch (error) {
      console.error('Error updating appointment:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar la cita';
      showError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancela la edición y regresa al panel de citas.
  const handleCancel = () => {
    navigate('/appointment');
  };

  // Fecha mínima permitida en el selector: hoy.
  // Obtener el mínimo de fecha (hoy)
  const today = format(new Date(), 'yyyy-MM-dd');

  // Esqueleto de carga del formulario.
  if (loading) {
    return (
      <PageContainer>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <AppointmentEditSkeleton />
        </div>
      </PageContainer>
    );
  }

  if (!appointment) {
    return (
      <PageContainer>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="text-center">
            <p className="text-gray-300">Cita no encontrada</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Formulario de edición: resumen de la cita actual, selección de servicio,
  // barbero, fecha y hora, y botones de cancelar/guardar.
  return (
    <PageContainer>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600/20 to-brand-500/20 rounded-xl border border-blue-500/20 shadow-xl shadow-soft">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
            </div>
            <GradientText className="text-xl sm:text-2xl lg:text-3xl font-bold">
              Editar Cita
            </GradientText>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-transparent border border-white/10 rounded-2xl backdrop-blur-sm shadow-2xl shadow-soft">
          <div className="p-6 lg:p-8">
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Información actual de la cita */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6">
                <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
                  <Info size={18} />
                  Información Actual
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Servicio:</span>
                    <p className="text-blue-200 font-medium">{appointment.service?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Barbero:</span>
                    <p className="text-blue-200 font-medium">{appointment.barber?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Fecha:</span>
                    <p className="text-blue-200 font-medium">
                      {format(new Date(appointment.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Hora:</span>
                    <p className="text-blue-200 font-medium">{appointment.time}</p>
                  </div>
                </div>
              </div>

              {/* Selección de servicio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Scissors className="inline w-4 h-4 mr-2" />
                  Servicio
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="glassmorphism-select"
                  required
                >
                  <option value="">Seleccionar servicio</option>
                  {services.map(service => (
                    <option key={service._id} value={service._id}>
                      {service.name} - ${service.price}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selección de barbero */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <User className="inline w-4 h-4 mr-2" />
                  Barbero
                </label>
                <select
                  value={selectedBarber}
                  onChange={(e) => setSelectedBarber(e.target.value)}
                  className="glassmorphism-select"
                  required
                >
                  <option value="">Seleccionar barbero</option>
                  {barbers.map(barber => (
                    <option key={barber._id} value={barber._id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selección de fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Calendar className="inline w-4 h-4 mr-2" />
                  Fecha
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={today}
                  className="glassmorphism-input"
                  required
                />
              </div>

              {/* Selección de hora */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Clock className="inline w-4 h-4 mr-2" />
                  Hora
                </label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="glassmorphism-select"
                  required
                  disabled={!selectedDate || !selectedBarber || availableTimes.length === 0}
                >
                  <option value="">Seleccionar hora</option>
                  {availableTimes.map(time => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                {selectedDate && selectedBarber && availableTimes.length === 0 && (
                  <p className="mt-2 text-sm text-amber-400">
                    Cargando horarios disponibles...
                  </p>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <GradientButton
                  type="button"
                  onClick={handleCancel}
                  variant="secondary"
                  size="md"
                  className="shadow-xl shadow-soft flex-1"
                >
                  <div className="flex items-center justify-center gap-2">
                    <ArrowLeft size={18} />
                    <span>Cancelar</span>
                  </div>
                </GradientButton>
                
                <GradientButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting || !selectedService || !selectedBarber || !selectedDate || !selectedTime}
                  className="shadow-xl shadow-soft flex-1"
                >
                  <div className="flex items-center justify-center gap-2">
                    {submitting ? (
                      <>
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <span>Actualizando...</span>
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </div>
                </GradientButton>
              </div>
              
            </form>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default AppointmentEdit;
