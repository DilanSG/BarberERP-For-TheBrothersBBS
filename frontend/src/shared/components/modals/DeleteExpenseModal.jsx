import React from 'react';
import { AlertTriangle, Trash2, Calendar, Repeat, DollarSign } from 'lucide-react';
import Modal from '../ui/Modal';

// Modal de confirmación para eliminar un gasto único o recurrente.
// Adapta las advertencias y la ficha según el tipo de gasto.
const DeleteExpenseModal = ({ 
  isOpen, 
  onClose, 
  expense, 
  onDelete,
  isLoading = false 
}) => {
  // Ejecuta la eliminación del gasto seleccionado mediante onDelete.
  const handleDelete = async () => {
    if (expense) {
      await onDelete(expense._id);
    }
  };

  // No renderiza si está cerrado o no hay gasto.
  if (!isOpen || !expense) return null;

  // Considera recurrente si tiene tipo 'recurring' o frecuencia definida.
  // Determinar si es gasto recurrente o único
  const isRecurring = expense.type === 'recurring' || expense.frequency;
  const expenseType = isRecurring ? 'recurrente' : 'único';

  // Formatear fecha
  // Da formato largo en español a una fecha, con respaldo si no existe.
  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Formatear categoría
  // Traduce el id de categoría a un nombre legible.
  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'Sin categoría';
    
    const categoryMap = {
      'rent': 'Arriendo/Alquiler',
      'utilities': 'Servicios Públicos',
      'supplies': 'Insumos/Materiales',
      'maintenance': 'Mantenimiento',
      'marketing': 'Marketing/Publicidad',
      'insurance': 'Seguros',
      'taxes': 'Impuestos',
      'salaries': 'Salarios/Pagos',
      'equipment': 'Equipamiento',
      'other': 'Otros'
    };
    
    // Asegurar que categoryId es una string
    const categoryStr = typeof categoryId === 'string' ? categoryId : String(categoryId);
    return categoryMap[categoryStr] || categoryStr || 'Sin categoría';
  };

  // Formatear frecuencia (copiado de RecurringExpensesListModal para consistencia)
  // Describe la frecuencia en texto ('Cada 2 semanas', 'Mensual', etc.).
  const getFrequencyName = (frequency) => {
    if (!frequency) return 'No definida';
    
    // Si frequency es un objeto con type e interval
    if (frequency && typeof frequency === 'object' && frequency.type) {
      const { type, interval = 1 } = frequency;
      const intervalText = interval > 1 ? ` ${interval}` : '';
      
      switch (type) {
        case 'daily':
          return `Cada${intervalText} día${interval > 1 ? 's' : ''}`;
        case 'weekly':
          return `Cada${intervalText} semana${interval > 1 ? 's' : ''}`;
        case 'monthly':
          return `Cada${intervalText} mes${interval > 1 ? 'es' : ''}`;
        case 'yearly':
          return `Cada${intervalText} año${interval > 1 ? 's' : ''}`;
        default:
          return 'Frecuencia personalizada';
      }
    }
    
    // Si frequency es un string simple (fallback)
    if (typeof frequency === 'string') {
      const frequencyMap = {
        'daily': 'Diario',
        'weekly': 'Semanal',
        'monthly': 'Mensual',
        'quarterly': 'Trimestral',
        'yearly': 'Anual'
      };
      return frequencyMap[frequency] || frequency;
    }
    
    return 'No especificada';
  };

  // Vista: advertencias, resumen del gasto y confirmación de borrado.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="red"
      title={`Eliminar Gasto ${expenseType}`}
      subtitle="Esta acción no se puede deshacer"
      icon={AlertTriangle}
      size="md"
      zIndex="alert"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Eliminar {expenseType}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="mb-6">
        <p className="text-gray-300 mb-4">
          ¿Estás seguro de que deseas eliminar el gasto{' '}
          <span className="font-semibold text-red-200">"{expense.description}"</span>?
        </p>
        
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-200">
              <p className="font-medium mb-2">Advertencia importante:</p>
              <ul className="list-disc list-inside space-y-1 text-red-300">
                <li>Se eliminará permanentemente de la base de datos</li>
                <li>Los reportes financieros se actualizarán automáticamente</li>
                {isRecurring && (
                  <>
                    <li>Se cancelarán todas las futuras ocurrencias programadas</li>
                    <li>El historial de pagos pasados se mantendrá intacto</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Expense Info */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h4 className="text-red-200 font-medium mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Información del gasto:
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Descripción:</span>
              <span className="text-red-200 font-medium">{expense.description || 'Sin descripción'}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Monto:</span>
              <span className="text-emerald-400 font-bold">
                ${(expense.amount || 0).toLocaleString('es-ES')}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tipo:</span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                isRecurring 
                  ? 'bg-brand-400/20 text-brand-200 border border-brand-400/30' 
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {isRecurring ? (
                  <>
                    <Repeat className="w-3 h-3" />
                    Recurrente
                  </>
                ) : (
                  <>
                    <Calendar className="w-3 h-3" />
                    Único
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Categoría:</span>
              <span className="text-red-200">{getCategoryName(expense.category)}</span>
            </div>

            {isRecurring && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Frecuencia:</span>
                  <span className="text-brand-200">{getFrequencyName(expense.frequency)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Estado:</span>
                  <span className={`${expense.isActive !== false ? 'text-emerald-400' : 'text-red-400'}`}>
                    {expense.isActive !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {expense.nextDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Próximo pago:</span>
                    <span className="text-blue-300">{formatDate(expense.nextDate)}</span>
                  </div>
                )}
              </>
            )}

            {!isRecurring && expense.date && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Fecha:</span>
                <span className="text-blue-300">{formatDate(expense.date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteExpenseModal;
