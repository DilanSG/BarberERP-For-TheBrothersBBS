import { usePaymentMethodsContext } from '@contexts/PaymentMethodsContext';
import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Tag, 
  CreditCard, 
  AlertCircle,
  Save,
  FileText,
  Info,
  Receipt
} from 'lucide-react';
import GradientButton from '../ui/GradientButton';
import Modal from '../ui/Modal';

// Modal para crear o editar un gasto único (no recurrente).
// Valida descripción, monto, categoría, método de pago y fecha antes de guardar.
export const OneTimeExpenseModal = ({
  isOpen,
  onClose,
  expense = null,
  expenseCategories,
  paymentMethods,
  onSave,
  loading = false
}) => {
  // Métodos de pago del contexto para usarlos como respaldo.
  const { allPaymentMethods } = usePaymentMethodsContext();

  // Fallbacks en caso de que aún no hayan cargado categorías o métodos
  const DEFAULT_EXPENSE_CATEGORIES = [
    { value: 'rent', label: 'Arriendo' },
    { value: 'utilities', label: 'Servicios Públicos' },
    { value: 'supplies', label: 'Insumos' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'maintenance', label: 'Mantenimiento' },
    { value: 'other', label: 'Otros' }
  ];
  // Categorías recibidas o el catálogo por defecto si aún no cargan.
  const safeExpenseCategories = Array.isArray(expenseCategories) && expenseCategories.length > 0
    ? expenseCategories
    : DEFAULT_EXPENSE_CATEGORIES;
  // Métodos de pago dinámicos del backend (fallback: solo Efectivo)
  // Métodos de pago del contexto normalizados a { value, label }.
  const contextMethods = (allPaymentMethods || []).map((m) => ({ value: m.backendId, label: m.name }));
  // Métodos recibidos, o los del contexto, o solo Efectivo como último respaldo.
  const safePaymentMethods = Array.isArray(paymentMethods) && paymentMethods.length > 0
    ? paymentMethods
    : (contextMethods.length > 0 ? contextMethods : [{ value: 'cash', label: 'Efectivo' }]);

  // Datos del formulario, precargados con el gasto si se está editando.
  const [formData, setFormData] = useState(() => ({
    description: expense?.description || '',
    amount: expense?.amount || '',
    category: expense?.category || '',
    paymentMethod: expense?.paymentMethod || '',
    date: expense?.date || new Date().toISOString().split('T')[0],
    notes: expense?.notes || ''
  }));

  const [errors, setErrors] = useState({});

  // Actualizar formulario cuando cambia el expense
  // Al cambiar el gasto (o al crear) precarga o resetea el formulario.
  useEffect(() => {
    if (expense) {
      setFormData({
        description: expense.description || '',
        amount: expense.amount || '',
        category: expense.category || '',
        paymentMethod: expense.paymentMethod || '',
        date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: expense.notes || ''
      });
    } else {
      // Si no hay expense, resetear el formulario
      setFormData({
        description: '',
        amount: '',
        category: '',
        paymentMethod: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setErrors({});
  }, [expense]);

  // Actualiza un campo y limpia su error al escribir.
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Valida todos los campos obligatorios del gasto.
  const validateForm = () => {
    const newErrors = {};

    if (!formData.description?.trim()) {
      newErrors.description = 'La descripción es requerida';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'El monto debe ser mayor a 0';
    }

    if (!formData.category) {
      newErrors.category = 'La categoría es requerida';
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'El método de pago es requerido';
    }

    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Envía el gasto marcado como 'one-time' y cierra el modal.
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSave({
        ...formData,
        type: 'one-time',
        isRecurring: false
      });
      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: formulario de gasto único con validaciones y aviso de edición.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="amber"
      title={expense ? 'Editar Gasto Único' : 'Nuevo Gasto Único'}
      subtitle="Gasto que ocurre una sola vez en la fecha especificada"
      icon={Receipt}
      size="2xl"
      zIndex="top"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <GradientButton
            type="submit"
            form="one-time-expense-form"
            variant="primary"
            size="md"
            disabled={loading}
            className="shadow-xl shadow-soft"
          >
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{expense ? 'Actualizar' : 'Crear'} Gasto</span>
            </div>
          </GradientButton>
        </div>
      }
    >
      {/* Aviso de edición */}
      {expense && (
        <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs text-blue-300 flex items-center gap-2">
            <Info className="w-3 h-3" />
            Editando gasto existente - Modifica solo los campos que necesites cambiar
          </p>
        </div>
      )}

      <form id="one-time-expense-form" onSubmit={handleSubmit} className="space-y-6">
        
        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Tag className="w-4 h-4 inline mr-2" />
            Descripción del Gasto
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Ej: Compra de productos para la barbería"
            className={`glassmorphism-input w-full shadow-xl shadow-soft ${
              errors.description ? 'border-red-500/50' : ''
            }`}
          />
          {errors.description && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.description}
            </p>
          )}
        </div>

        {/* Fecha y Monto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Fecha del Gasto
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => updateField('date', e.target.value)}
              className={`glassmorphism-input w-full shadow-xl shadow-soft ${
                errors.date ? 'border-red-500/50' : ''
              }`}
            />
            {errors.date && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.date}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Fecha en que se realizó o realizará el gasto
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-2" />
              Monto
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={formData.amount}
              onChange={(e) => updateField('amount', e.target.value)}
              placeholder="0"
              className={`glassmorphism-input w-full shadow-xl shadow-soft ${
                errors.amount ? 'border-red-500/50' : ''
              }`}
            />
            {errors.amount && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.amount}
              </p>
            )}
          </div>
        </div>

        {/* Categoría y Método de Pago */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Categoría
            </label>
            <select
              value={formData.category}
              onChange={(e) => updateField('category', e.target.value)}
              className={`glassmorphism-select w-full shadow-xl shadow-soft ${
                errors.category ? 'border-red-500/50' : ''
              }`}
            >
              <option value="">Seleccionar categoría</option>
              {safeExpenseCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
              <option value="custom">Crear nueva categoría...</option>
            </select>
            {errors.category && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.category}
              </p>
            )}
            
            {/* Campo para categoría personalizada */}
            {formData.category === 'custom' && (
              <input
                type="text"
                placeholder="Nombre de la nueva categoría"
                className="glassmorphism-input w-full shadow-xl shadow-soft mt-2"
                onChange={(e) => {
                  // Normaliza la categoría personalizada a slug (minúsculas y guiones).
                  const customValue = e.target.value.toLowerCase().replace(/\s+/g, '-');
                  updateField('category', customValue);
                }}
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <CreditCard className="w-4 h-4 inline mr-2" />
              Método de Pago
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => updateField('paymentMethod', e.target.value)}
              className={`glassmorphism-select w-full shadow-xl shadow-soft ${
                errors.paymentMethod ? 'border-red-500/50' : ''
              }`}
            >
              <option value="">Seleccionar método</option>
              {safePaymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.paymentMethod}
              </p>
            )}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Notas (opcional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Información adicional sobre el gasto..."
            rows={3}
            className="glassmorphism-input w-full shadow-xl shadow-soft resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};

export default OneTimeExpenseModal;
