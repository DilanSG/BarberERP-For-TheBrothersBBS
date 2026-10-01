import { useState } from 'react';
import { Scissors, ShoppingBag, Calendar, DollarSign, Edit3, Trash2, TrendingUp } from 'lucide-react';
import Modal from '../ui/Modal';
import { usePaymentMethodsContext } from '../../contexts/PaymentMethodsContext';
import { useNotification } from '../../contexts/NotificationContext';
import AddPaymentMethodModal from './AddPaymentMethodModal';
import { formatCurrency } from '@utils/formatters';

// Modal de desglose de ingresos por método de pago con gestión de métodos.

// Colores por método de pago - Estilo AdminBarbers actualizado
const getPaymentMethodColor = (methodId) => {
  const colors = {
    cash: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    nequi: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400' },
    nu: { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-200', dot: 'bg-brand-300' },
    daviplata: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400' },
    debit: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', dot: 'bg-blue-400' },
    bancolombia: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400' },
    digital: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', dot: 'bg-blue-400' }
  };
  
  // Si no existe el método, usar colores por defecto basados en un hash simple del ID
  if (!colors[methodId]) {
    const defaultColors = [
      { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', dot: 'bg-blue-400' },
      { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400' },
      { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
      { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400' },
      { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-200', dot: 'bg-brand-300' }
    ];
    
    // Generar un índice basado en el hash del methodId
    const hash = methodId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const colorIndex = hash % defaultColors.length;
    return defaultColors[colorIndex];
  }
  
  return colors[methodId];
};

// Muestra los ingresos por método y permite agregar, editar o eliminar métodos
// de pago personalizados (los predeterminados no se pueden modificar).
const RevenueBreakdownModal = ({ isOpen, onClose, revenueData, dateRange, formatCurrency: externalFormatCurrency }) => {
  // Estado para el modal de agregar método de pago
  // Controla la apertura del modal de agregar/editar método de pago.
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  
  // Estados para edición y eliminación
  // Estados para la edición y la confirmación de eliminación de un método.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState(null);
  const [editingMethod, setEditingMethod] = useState(null);
  
  // Usar el contexto global de métodos de pago
  // Métodos de pago y acciones del contexto global de métodos.
  const {
    allPaymentMethods,
    addPaymentMethod,
    updatePaymentMethod,
    removePaymentMethod,
    isStaticMethod
  } = usePaymentMethodsContext();

  // Usar el contexto de notificaciones
  const { showSuccess, showError, showWarning } = useNotification();
  
  // No renderiza sin modal abierto o sin datos de resumen.
  if (!isOpen || !revenueData?.summary) return null;

  // Usar el formatCurrency externo si está disponible
  // Usa el formateador externo si se recibe; si no, el compartido.
  const currencyFormatter = externalFormatCurrency || formatCurrency;

  // Función para manejar la adición/edición de un método de pago
  // Agrega un método nuevo o actualiza uno existente según isEditing.
  const handleAddPaymentMethod = (methodData) => {
    if (methodData.isEditing) {
      const success = updatePaymentMethod(methodData.originalBackendId, methodData);
      if (success) {
        showSuccess(`Método de pago "${methodData.name}" actualizado exitosamente`);
      } else {
        showWarning('No se pueden editar métodos de pago predeterminados');
      }
    } else {
      addPaymentMethod(methodData);
      showSuccess(`Método de pago "${methodData.name}" agregado exitosamente`);
    }
  };

  // Función para manejar la edición de un método de pago
  // Busca el método por backendId y abre el modal en modo edición.
  const handleEditPaymentMethod = (methodId) => {
    // Buscar en ambas listas: estática y dinámica
    const method = allPaymentMethods.find(m => m.backendId === methodId);
    setEditingMethod(method);
    setShowAddPaymentModal(true);
  };

  // Función para manejar la eliminación de un método de pago
  // Busca el método y abre la confirmación de eliminación.
  const handleDeletePaymentMethod = (methodId) => {
    // Buscar en ambas listas: estática y dinámica
    const method = allPaymentMethods.find(m => m.backendId === methodId);
    setMethodToDelete(method);
    setShowDeleteConfirm(true);
  };

  // Función para confirmar eliminación
  // Elimina el método seleccionado; avisa si es un método predeterminado.
  const confirmDeletePaymentMethod = () => {
    if (methodToDelete) {
      
      const success = removePaymentMethod(methodToDelete.backendId);
      if (success) {
        showSuccess(`Método de pago "${methodToDelete.name}" eliminado exitosamente`);
      } else {
        showWarning('No se pueden eliminar métodos de pago predeterminados');
      }
      
      setShowDeleteConfirm(false);
      setMethodToDelete(null);
    }
  };

  // Función para cancelar eliminación
  // Cancela la eliminación y limpia el método pendiente.
  const cancelDeletePaymentMethod = () => {
    setShowDeleteConfirm(false);
    setMethodToDelete(null);
  };

  // Tipos de ingresos con sus iconos - Usar datos del summary
  // Tipos de ingreso del resumen: productos, cortes y citas.
  const revenueTypes = [
    { 
      id: 'products', 
      name: 'Productos', 
      icon: ShoppingBag, 
      color: 'emerald',
      amount: revenueData.summary?.productRevenue || 0,
      description: 'Venta de productos'
    },
    { 
      id: 'services', 
      name: 'Cortes', 
      icon: Scissors, 
      color: 'blue',
      amount: revenueData.summary?.serviceRevenue || 0,
      description: 'Servicios de barbería'
    },
    { 
      id: 'appointments', 
      name: 'Citas', 
      icon: Calendar, 
      color: 'purple',
      amount: revenueData.summary?.appointmentRevenue || 0,
      description: 'Servicios agendados'
    }
  ];

  // Usar el totalRevenue que viene del backend directamente
  // Total de ingresos reportado directamente por el backend.
  const totalRevenue = revenueData.summary?.totalRevenue || 0;

  // Vista: total, tarjetas por método con acciones y modales de alta/eliminación.
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        color="emerald"
        title="Desglose de Ingresos"
        subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Ingresos por método de pago'}
        icon={TrendingUp}
        size="4xl"
        footer={
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        }
      >
        {/* Resumen total */}
        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-300">Total de ingresos</p>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-emerald-400">{currencyFormatter(totalRevenue)}</p>
        </div>

        <div className="space-y-4">
          {/* Grid responsivo para métodos de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {allPaymentMethods.map((method) => {
              // Buscar usando el backendId para mapear correctamente los datos del backend
              const amount = revenueData.summary?.paymentMethods?.[method.backendId] || 0;
              const percentage = totalRevenue > 0 ? (amount / totalRevenue * 100) : 0;
              const colors = getPaymentMethodColor(method.backendId);
              
              return (
                <div 
                  key={method.backendId}
                  className={`group ${colors.bg} ${colors.border} rounded-xl p-4 hover:scale-[1.02] transition-all duration-300 border relative`}
                >
                  {/* Iconos de editar y eliminar posicionados arriba a la derecha */}
                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <button
                      onClick={() => handleEditPaymentMethod(method.backendId)}
                      className="p-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors duration-200 border border-blue-500/30 backdrop-blur-sm"
                      title="Editar método de pago"
                    >
                      <Edit3 className="w-2.5 h-2.5 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDeletePaymentMethod(method.backendId)}
                      className="p-0.5 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors duration-200 border border-red-500/30 backdrop-blur-sm"
                      title="Eliminar método de pago"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-3 pr-12">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${colors.text} text-sm`}>{method.name}</h4>
                          {amount === 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded border border-gray-500/30">
                              Nuevo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{method.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${colors.text}`}>
                        {currencyFormatter(amount)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${colors.dot}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón para agregar nuevo método de pago */}
          <div className="mt-6 pt-4 border-t border-emerald-500/20">
            <button 
              onClick={() => setShowAddPaymentModal(true)}
              className="w-full p-4 border-2 border-dashed border-emerald-500/30 rounded-xl text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <div className="w-5 h-5 rounded-full border-2 border-emerald-400 flex items-center justify-center">
                <span className="text-emerald-400 text-xs font-bold">+</span>
              </div>
              <span className="text-sm font-medium">Agregar nuevo método de pago</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal para agregar nuevo método de pago */}
      <AddPaymentMethodModal
        isOpen={showAddPaymentModal}
        onClose={() => {
          setShowAddPaymentModal(false);
          setEditingMethod(null);
        }}
        onAdd={handleAddPaymentMethod}
        editingMethod={editingMethod}
      />

      {/* Modal de confirmación para eliminar método de pago */}
      {(methodToDelete != null) && ((
      <Modal
        isOpen={showDeleteConfirm}
        onClose={cancelDeletePaymentMethod}
        color="red"
        title="Eliminar Método de Pago"
        subtitle="Esta acción no se puede deshacer"
        icon={Trash2}
        size="md"
        zIndex="top"
        footer={
          <div className="flex gap-3">
            <button
              onClick={cancelDeletePaymentMethod}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeletePaymentMethod}
              className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
            >
              Eliminar
            </button>
          </div>
        }
      >
        {methodToDelete && (
          <div>
            <p className="text-emerald-200 mb-2">
              ¿Estás seguro de que quieres eliminar el método de pago:
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-300 font-medium">{methodToDelete.name}</p>
              <p className="text-xs text-gray-400">{methodToDelete.description}</p>
            </div>
          </div>
        )}
      </Modal>
      ))}
    </>
  );
};

export default RevenueBreakdownModal;
