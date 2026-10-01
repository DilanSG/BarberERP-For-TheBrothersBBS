import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Tag, 
  CreditCard, 
  Clock, 
  Repeat,
  AlertCircle,
  Save,
  FileText,
  Info,
  Zap
} from 'lucide-react';
import GradientButton from '../ui/GradientButton';
import Modal from '../ui/Modal';
import { calculator as RecurringExpenseCalculator } from '../../recurring-expenses';

// Modal para crear o editar gastos recurrentes (plantilla moderna 'recurring-template').
// Valida campos, normaliza la recurrencia con el calculador y el método de pago antes de guardar.
export const RecurringExpenseModal = ({
  isOpen,
  onClose,
  expense = null,
  expenseCategories,
  paymentMethods,
  frequencies,
  onSave,
  loading = false
}) => {
  // Fallbacks en caso de que aún no hayan cargado categorías o métodos
  // Categorías por defecto si el catálogo real aún no ha cargado.
  const DEFAULT_EXPENSE_CATEGORIES = [
    { value: 'rent', label: 'Arriendo' },
    { value: 'utilities', label: 'Servicios Públicos' },
    { value: 'supplies', label: 'Insumos' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'maintenance', label: 'Mantenimiento' },
    { value: 'other', label: 'Otros' }
  ];
  // Métodos de pago por defecto como respaldo.
  const DEFAULT_PAYMENT_METHODS = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'nequi', label: 'Nequi' },
    { value: 'daviplata', label: 'Daviplata' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'other', label: 'Otro' }
  ];

  // Categorías recibidas o las de respaldo.
  const safeExpenseCategories = Array.isArray(expenseCategories) && expenseCategories.length > 0
    ? expenseCategories
    : DEFAULT_EXPENSE_CATEGORIES;
  // Métodos de pago recibidos o los de respaldo.
  const safePaymentMethods = Array.isArray(paymentMethods) && paymentMethods.length > 0
    ? paymentMethods
    : DEFAULT_PAYMENT_METHODS;
  // Datos del formulario, incluida la configuración de recurrencia.
  const [formData, setFormData] = useState(() => ({
    description: expense?.description || '',
  // Mantener amount como string controlado para evitar NaN mientras el usuario escribe
  amount: (expense?.amount !== undefined && expense?.amount !== null) ? String(expense.amount) : '',
    category: expense?.category || '',
    paymentMethod: expense?.paymentMethod || '',
    notes: expense?.notes || '',
    recurringConfig: {
      frequency: expense?.recurringConfig?.frequency || 'monthly',
      interval: expense?.recurringConfig?.interval || 1,
      startDate: expense?.recurringConfig?.startDate || new Date().toISOString().split('T')[0],
      endDate: expense?.recurringConfig?.endDate || '',
      dayOfWeek: expense?.recurringConfig?.dayOfWeek || null,
      dayOfMonth: expense?.recurringConfig?.dayOfMonth || null
    }
  }));

  const [errors, setErrors] = useState({});

  // Actualizar formulario cuando cambia el expense
  // Precarga el formulario al editar (soportando estructura antigua y nueva) o lo limpia.
  useEffect(() => {
    if (expense) {
      // Manejar estructura mixta de datos (antigua y nueva)
      const frequencyData = expense.recurringConfig?.frequency || expense.frequency?.type || 'monthly';
      const intervalData = expense.recurringConfig?.interval || expense.frequency?.interval || 1;
      
      setFormData({
        description: expense.description || '',
  amount: (expense.amount !== undefined && expense.amount !== null) ? String(expense.amount) : '',
        category: expense.category || '',
        paymentMethod: expense.paymentMethod || '',
        notes: expense.notes || '',
        recurringConfig: {
          frequency: frequencyData,
          interval: intervalData,
          startDate: expense.recurringConfig?.startDate || expense.startDate || '',
          endDate: expense.recurringConfig?.endDate || expense.endDate || '',
          dayOfWeek: expense.recurringConfig?.dayOfWeek || expense.dayOfWeek || null,
          dayOfMonth: expense.recurringConfig?.dayOfMonth || expense.dayOfMonth || null
        }
      });
    } else {
      // Si no hay expense, resetear el formulario
      setFormData({
        description: '',
  amount: '',
        category: '',
        paymentMethod: '',
        notes: '',
        recurringConfig: {
          frequency: 'monthly',
          interval: 1,
          startDate: new Date().toISOString().split('T')[0], // Fecha actual como default
          endDate: '',
          dayOfWeek: null,
          dayOfMonth: null
        }
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

  // Actualiza un campo de la configuración de recurrencia.
  const updateRecurringConfig = (field, value) => {
    setFormData(prev => {
      const newRecurringConfig = { ...prev.recurringConfig, [field]: value };
      
      return {
        ...prev,
        recurringConfig: newRecurringConfig
      };
    });
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Valida campos obligatorios, intervalo y coherencia entre fechas de inicio y fin.
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

    if (!formData.recurringConfig.frequency) {
      newErrors.frequency = 'La frecuencia es requerida';
    }

    if (!formData.recurringConfig.interval || formData.recurringConfig.interval < 1) {
      newErrors.interval = 'El intervalo debe ser mayor a 0';
    }

    // Validar fecha de inicio (requerida para todas las frecuencias)
    if (!formData.recurringConfig.startDate) {
      newErrors.startDate = 'La fecha de inicio es requerida';
    }

    // Validar que la fecha de fin sea posterior a la fecha de inicio
    if (formData.recurringConfig.startDate && formData.recurringConfig.endDate) {
      const startDate = new Date(formData.recurringConfig.startDate);
      const endDate = new Date(formData.recurringConfig.endDate);
      if (endDate <= startDate) {
        newErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Convierte monto e intervalo a número, normaliza recurrencia y método de pago
  // y guarda el gasto como plantilla recurrente.
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      // Parsear numéricos de forma segura justo antes de enviar
      // Parseo numérico seguro justo antes de enviar.
      const parsedAmount = parseFloat(formData.amount);
      const parsedInterval = parseInt(formData.recurringConfig.interval, 10);

      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setErrors(prev => ({ ...prev, amount: 'El monto debe ser mayor a 0' }));
        return;
      }
      if (Number.isNaN(parsedInterval) || parsedInterval < 1) {
        setErrors(prev => ({ ...prev, interval: 'El intervalo debe ser mayor a 0' }));
        return;
      }
      // Normaliza la configuración de recurrencia con el calculador compartido.
      // Normalizar la configuración usando el calculador antes de guardar
      const normalizedConfig = RecurringExpenseCalculator.normalizeRecurringConfig({
        frequency: formData.recurringConfig.frequency,
        interval: formData.recurringConfig.interval,
        startDate: formData.recurringConfig.startDate,
        endDate: formData.recurringConfig.endDate,
        dayOfWeek: formData.recurringConfig.dayOfWeek,
        dayOfMonth: formData.recurringConfig.dayOfMonth
      });

      // Traduce alias del UI (card, efectivo) al backendId esperado.
      // Normalizar método de pago a backendId esperado cuando vengan alias comunes del UI
      const pmLower = (formData.paymentMethod || '').toString().toLowerCase();
      const paymentMethodMap = {
        card: 'tarjeta',
        efectivo: 'cash',
      // transfer lo normaliza el backend a 'bancolombia', aquí lo dejamos igual
      };
      const normalizedPaymentMethod = paymentMethodMap[pmLower] || formData.paymentMethod;

      console.log('Guardando gasto recurrente normalizado:', {
        original: formData.recurringConfig,
        normalized: normalizedConfig,
        completeData: {
          ...formData,
            amount: parsedAmount,
          paymentMethod: normalizedPaymentMethod,
          type: 'recurring-template',
          isRecurring: true,
          recurringConfig: {
            ...normalizedConfig,
            interval: parsedInterval
          }
        }
      });

      await onSave({
        ...formData,
        amount: parsedAmount,
        paymentMethod: normalizedPaymentMethod,
        type: 'recurring-template', // Usar directamente la plantilla moderna
        isRecurring: true,
        recurringConfig: {
          ...normalizedConfig,
          interval: parsedInterval
        }
      });
      onClose();
    } catch (error) {
      console.error('Error saving recurring expense:', error);
    }
  };

  // Texto de ayuda que explica cuándo se ejecutará la recurrencia.
  const getFrequencyHelp = () => {
    const { frequency, interval } = formData.recurringConfig;
    
    switch (frequency) {
      case 'daily':
        return `Se ejecutará cada ${interval} día${interval > 1 ? 's' : ''} a partir de la fecha de inicio`;
      case 'weekly':
        return `Se ejecutará cada ${interval} semana${interval > 1 ? 's' : ''} en el día seleccionado`;
      case 'monthly':
        return `Se ejecutará cada ${interval} mes${interval > 1 ? 'es' : ''} en el día seleccionado`;
      case 'yearly':
        return `Se ejecutará cada ${interval} año${interval > 1 ? 's' : ''} en la fecha de inicio`;
      default:
        return '';
    }
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: información básica, configuración de recurrencia, notas y aviso de automatización.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="amber"
      title={expense ? 'Editar Gasto Recurrente' : 'Nuevo Gasto Recurrente'}
      subtitle="Gasto que se repite automáticamente según una programación"
      icon={Repeat}
      size="3xl"
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
            form="recurring-expense-form"
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
              <span>{expense ? 'Actualizar' : 'Crear'} Gasto Recurrente</span>
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
            Editando gasto recurrente - Modifica solo los campos que necesites cambiar
          </p>
        </div>
      )}

      <form id="recurring-expense-form" onSubmit={handleSubmit} className="space-y-6">
        
        {/* Información Básica */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h4 className="text-amber-200 font-medium mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Información Básica
          </h4>
          
          <div className="space-y-4">
            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descripción del Gasto
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Ej: Arriendo mensual del local"
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

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Monto
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.amount === null ? '' : formData.amount}
                onChange={(e) => {
                  // Acepta solo números con hasta dos decimales, o vacío mientras se escribe.
                  const v = e.target.value;
                  // Permitir string vacío temporalmente
                  if (v === '') {
                    updateField('amount', '');
                  } else {
                    // Sólo aceptar dígitos
                    if (/^\d*(\.\d{0,2})?$/.test(v)) {
                      updateField('amount', v);
                    }
                  }
                  if (errors.amount) setErrors(prev => ({ ...prev, amount: null }));
                }}
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
                      {category.icon ? `${category.icon} ` : ''}{category.label}
                    </option>
                  ))}
                  <option value="custom">Crear nueva categoría...</option>
                </select>
                
                {formData.category === 'custom' && (
                  <input
                    type="text"
                    placeholder="Nombre de la nueva categoría"
                    className="glassmorphism-select w-full shadow-xl shadow-soft mt-2"
                    onChange={(e) => {
                      // Normaliza la categoría personalizada a slug (minúsculas y guiones).
                      const customValue = e.target.value.toLowerCase().replace(/\s+/g, '-');
                      updateField('category', customValue);
                    }}
                    autoFocus
                  />
                )}
                
                {errors.category && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.category}
                  </p>
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
          </div>
        </div>

        {/* Configuración de Recurrencia */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <h4 className="text-amber-200 font-medium mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Configuración de Recurrencia
          </h4>

          <div className="space-y-4">
            {/* Frecuencia e Intervalo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Frecuencia
                </label>
                <select
                  value={formData.recurringConfig.frequency}
                  onChange={(e) => updateRecurringConfig('frequency', e.target.value)}
                  className="glassmorphism-select w-full shadow-xl shadow-soft"
                >
                  {frequencies.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cada
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.recurringConfig.interval === null ? '' : formData.recurringConfig.interval}
                  onChange={(e) => {
                    // Solo acepta enteros positivos y permite vaciar el campo temporalmente.
                    const raw = e.target.value;
                    if (raw === '') {
                      updateRecurringConfig('interval', '');
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n) && n > 0) {
                      updateRecurringConfig('interval', n);
                    }
                  }}
                  className={`glassmorphism-input w-full shadow-xl shadow-soft ${
                    errors.interval ? 'border-red-500/50' : ''
                  }`}
                />
                {errors.interval && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.interval}
                  </p>
                )}
              </div>
            </div>

            {/* Información de frecuencia */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <Info className="w-4 h-4" />
                <span>{getFrequencyHelp()}</span>
              </div>
            </div>

            {/* Configuración específica por frecuencia */}
            
            {/* Fecha de inicio (requerida) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha de Inicio *
              </label>
              <input
                type="date"
                value={formData.recurringConfig.startDate}
                onChange={(e) => updateRecurringConfig('startDate', e.target.value)}
                className={`glassmorphism-input w-full shadow-xl shadow-soft ${
                  errors.startDate ? 'border-red-500/50' : ''
                }`}
              />
              {errors.startDate && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.startDate}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {formData.recurringConfig.frequency === 'weekly' && 
                  'El día de la semana se determinará automáticamente basado en esta fecha'}
                {formData.recurringConfig.frequency === 'monthly' && 
                  'El día del mes se determinará automáticamente basado en esta fecha'}
                {(formData.recurringConfig.frequency === 'daily' || formData.recurringConfig.frequency === 'yearly') && 
                  'Fecha a partir de la cual comenzará la recurrencia'}
              </p>
            </div>

            {/* Fecha de fin (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha de Fin (opcional)
              </label>
              <input
                type="date"
                value={formData.recurringConfig.endDate}
                onChange={(e) => updateRecurringConfig('endDate', e.target.value)}
                className={`glassmorphism-input w-full shadow-xl shadow-soft ${
                  errors.endDate ? 'border-red-500/50' : ''
                }`}
              />
              {errors.endDate && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.endDate}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Si no especificas una fecha, el gasto se repetirá indefinidamente
              </p>
            </div>
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
            placeholder="Información adicional sobre el gasto recurrente..."
            rows={3}
            className="glassmorphism-input w-full shadow-xl shadow-soft resize-none"
          />
        </div>

        {/* Información adicional */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium mb-1">Procesamiento Automático</p>
              <p className="text-amber-300/80">
                Una vez creado, este gasto se procesará automáticamente según la configuración establecida. 
                Puedes activar/desactivar la recurrencia en cualquier momento desde la vista de gastos.
              </p>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default RecurringExpenseModal;
