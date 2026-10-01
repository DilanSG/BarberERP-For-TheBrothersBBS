import React, { useState, useEffect } from 'react';
import { CheckCircle, CreditCard } from 'lucide-react';
import { Skeleton } from '@components/ui/Skeleton';
import Modal from '../ui/Modal';
import { usePaymentMethodsContext } from '../../contexts/PaymentMethodsContext';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../services/api';

// Modal para completar una cita confirmada exigiendo el método de pago.
// Carga los métodos desde la API, con el contexto y una lista por defecto como respaldo.
const CompleteAppointmentModal = ({ isOpen, onClose, appointment, onComplete }) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethodsFromAPI, setPaymentMethodsFromAPI] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const { allPaymentMethods } = usePaymentMethodsContext();
  const { showError, showWarning } = useNotification();

  // Métodos de pago por defecto en caso de que el contexto y API fallen
  // Métodos de pago de respaldo por si fallan la API y el contexto.
  const defaultPaymentMethods = [
    { _id: 'cash', name: 'Efectivo', color: '#10b981' },
    { _id: 'nequi', name: 'Nequi', color: '#8b5cf6' },
    { _id: 'daviplata', name: 'Daviplata', color: '#ef4444' },
    { _id: 'bancolombia', name: 'Bancolombia', color: '#f59e0b' },
    { _id: 'tarjeta', name: 'Tarjeta', color: '#3b82f6' }
  ];

  // Función para obtener métodos de pago desde la API
  // Consulta los métodos de pago al backend; si falla, se mantienen los del contexto.
  const fetchPaymentMethodsFromAPI = async () => {
    try {
      setLoadingMethods(true);
      const response = await api.get('/payment-methods');
      if (response.data && response.data.success) {
        setPaymentMethodsFromAPI(response.data.data);
      }
    } catch (error) {
      console.error('Error al obtener métodos de pago desde API:', error);
    // En caso de error, mantener los métodos del contexto como fallback
    } finally {
      setLoadingMethods(false);
    }
  };

  // Cargar métodos de pago cuando se abre el modal
  // Recarga los métodos de pago cada vez que se abre el modal.
  useEffect(() => {
    if (isOpen) {
      fetchPaymentMethodsFromAPI();
    }
  }, [isOpen]);

  // Priorizar métodos de la API, luego del contexto, luego los por defecto
  // Normaliza los métodos del contexto al formato { _id, name, color }.
  const mappedContextMethods = allPaymentMethods?.map(method => ({
    _id: method.backendId || method._id,
    name: method.name,
    color: method.colorHex || method.color
  })) || [];

  // Usar métodos de API si están disponibles, sino del contexto, sino los por defecto
  // Prioridad de métodos: API, luego contexto y por último los de respaldo.
  const availableMethods = paymentMethodsFromAPI.length > 0 
    ? paymentMethodsFromAPI 
    : (mappedContextMethods.length > 0 ? mappedContextMethods : defaultPaymentMethods);

    
  // Exige un método seleccionado y llama a onComplete con la cita y el método.
  const handleComplete = async () => {
    if (!selectedPaymentMethod) {
      showWarning('Por favor selecciona un método de pago');
      return;
    }

    setLoading(true);
    try {
      await onComplete(appointment._id, selectedPaymentMethod);
      onClose();
    } catch (error) {
      console.error('Error al completar cita:', error);
      showError('Error al completar la cita');
    } finally {
      setLoading(false);
    }
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: resumen de la cita y grilla de métodos de pago seleccionables.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="emerald"
      title="Completar Cita"
      subtitle="Selecciona el método de pago"
      icon={CheckCircle}
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleComplete}
            disabled={loading || !selectedPaymentMethod || loadingMethods}
            className="flex-1 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <span>Completando...</span>
              </div>
            ) : (
              'Completar Cita'
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Información de la cita */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-emerald-300">Detalles de la cita</p>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          
          <div className="grid grid-cols-1 gap-1">
            <div className="flex justify-between">
              <span className="text-xs text-emerald-300">Cliente:</span>
              <span className="text-xs text-emerald-200 font-medium">{appointment.user?.name || 'Cliente no especificado'}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-xs text-emerald-300">Servicio:</span>
              <span className="text-xs text-emerald-200 font-medium">{appointment.service?.name || 'Servicio no especificado'}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-xs text-emerald-300">Precio:</span>
              <span className="text-xs text-emerald-200 font-bold">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(appointment.price || appointment.servicePrice || 0)}
              </span>
            </div>
            
            {appointment.date && (
              <div className="flex justify-between">
                <span className="text-xs text-emerald-300">Fecha:</span>
                <span className="text-xs text-emerald-200">{new Date(appointment.date).toLocaleDateString('es-CO')}</span>
              </div>
            )}
            
            {appointment.time && (
              <div className="flex justify-between">
                <span className="text-xs text-emerald-300">Hora:</span>
                <span className="text-xs text-emerald-200">{appointment.time}</span>
              </div>
            )}
          </div>
        </div>

        {/* Selección de método de pago */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <CreditCard className="inline w-4 h-4 mr-2" />
            Método de Pago * ({availableMethods.length} disponibles)
            {loadingMethods && <span className="text-xs text-amber-400 ml-2">(Cargando...)</span>}
          </label>
          
          {/* Grid para métodos de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableMethods.map((method) => (
              <button
                key={method._id}
                onClick={() => setSelectedPaymentMethod(method._id)}
                disabled={loading || loadingMethods}
                className={`p-3 rounded-lg border transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedPaymentMethod === method._id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-white/5 text-gray-300 border-white/20 hover:border-emerald-500/40 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: method.color }}
                  ></div>
                  <span className="text-sm font-medium">{method.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CompleteAppointmentModal;
