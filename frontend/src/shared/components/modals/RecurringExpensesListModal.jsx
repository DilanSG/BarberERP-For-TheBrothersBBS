import { useState, useCallback } from 'react';
import { Repeat, Calendar } from 'lucide-react';
import Modal from '../ui/Modal';
import DailyRecurringExpenseModal from './DailyRecurringExpenseModal';
import { calculator as RecurringExpenseCalculator } from '../../recurring-expenses';

// Modal que lista y gestiona los gastos recurrentes agrupados en activos e inactivos.
// Permite pausar/activar, editar, eliminar y abrir la edición diaria de cada gasto.
const RecurringExpensesListModal = ({ 
  isOpen, 
  onClose, 
  recurringExpenses,
  inferredRecurringTotal = 0,
  formatCurrency, 
  dateRange,
  onEdit,
  onDelete,
  onToggle,
  onRefresh // Nuevo prop para refrescar datos
}) => {
  // Contador que fuerza el recálculo de los montos tras editar ajustes diarios.
  // Estado para forzar actualización de cálculos
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Estado para el modal de edición diaria
  // Estado del modal de edición diaria y del gasto seleccionado.
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  
  // Manejar clic en card para abrir edición diaria
  // Abre la edición día a día del gasto seleccionado.
  const handleCardClick = (expense) => {
    setSelectedExpense(expense);
    setShowDailyModal(true);
  };
  
  // Manejar cierre del modal diario
  // Cierra el modal diario y refresca los datos del padre.
  const handleCloseDailyModal = async () => {
    setShowDailyModal(false);
    setSelectedExpense(null);
    
    // Refrescar datos después de editar ajustes diarios
    if (onRefresh) {
      await onRefresh();
    }
  };

  // Callback para cuando se guarden ajustes diarios
  // Tras guardar ajustes diarios refresca los datos y fuerza el recálculo.
  const handleDailySave = async (expenseId, adjustments, month) => {
    console.log('🔄 RecurringExpensesListModal: Datos actualizados, refrescando...', {
      expenseId,
      adjustments,
      month
    });
    
    // Refrescar los datos inmediatamente
    if (onRefresh) {
      await onRefresh();
    }
    
    // Forzar re-cálculo de los montos
    setRefreshTrigger(prev => prev + 1);
    
    // Cerrar el modal después de actualizar
    setShowDailyModal(false);
    setSelectedExpense(null);
  };

  // Calcular monto mensual con ajustes diarios usando el calculador normalizado
  // Monto mensual del gasto incluyendo ajustes diarios (calculador normalizado).
  const calculateMonthlyAmount = useCallback((expense) => {
    return RecurringExpenseCalculator.calculateMonthlyAmount(expense);
  }, [refreshTrigger]);

  // Calcular el monto mensual base sin ajustes (para mostrar como referencia)
  // Monto mensual base sin ajustes, usado como referencia comparativa.
  const calculateBaseMonthlyAmount = useCallback((expense) => {
    return RecurringExpenseCalculator.calculateBaseMonthlyAmount(expense);
  }, []);

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // 🚨 Defensive Guard: Filter out invalid or nullish expense entries
  // Descarta entradas nulas o inválidas antes de listar.
  const validExpenses = Array.isArray(recurringExpenses)
    ? recurringExpenses.filter(e => e && typeof e === 'object')
    : [];

  // Separar gastos activos e inactivos
  // Gastos activos según recurrence, _isActive o recurringConfig.
  const activeExpenses = validExpenses.filter(expense => {
    const flag = (expense.recurrence?.isActive !== undefined)
      ? expense.recurrence.isActive
      : (expense._isActive !== undefined
          ? expense._isActive
          : (expense.recurringConfig?.isActive ?? expense.isActive ?? true));
    return !!flag;
  });
  // Gastos inactivos (misma lógica invertida).
  const inactiveExpenses = validExpenses.filter(expense => {
    const flag = (expense.recurrence?.isActive !== undefined)
      ? expense.recurrence.isActive
      : (expense._isActive !== undefined
          ? expense._isActive
          : (expense.recurringConfig?.isActive ?? expense.isActive ?? true));
    return !flag;
  });

  // Helpers
  // Traduce la categoría del gasto a un nombre corto.
  const getCategoryName = (category) => {
    const categoryMap = {
      'rent': 'Arriendo',
      'utilities': 'Servicios',
      'supplies': 'Insumos',
      'equipment': 'Equipos',
      'salaries': 'Salarios',
      'marketing': 'Marketing',
      'maintenance': 'Mantenimiento',
      'insurance': 'Seguros',
      'taxes': 'Impuestos',
      'transport': 'Transporte',
      'food': 'Alimentación',
      'training': 'Capacitación',
      'software': 'Software',
      'other': 'Otros'
    };
    return categoryMap[category] || category;
  };

  // Traduce el método de pago a su nombre legible.
  const getPaymentMethodName = (method) => {
    const methodMap = {
      'cash': 'Efectivo',
      'debit': 'Débito',
      'credit': 'Crédito',
      'transfer': 'Transferencia',
      'check': 'Cheque',
      'digital': 'Digital',
      'bancolombia': 'Bancolombia'
    };
    return methodMap[method] || method;
  };

  // Descripción de la frecuencia usando el calculador normalizado.
  const getFrequencyText = (expense) => {
    if (!expense) return 'No definida';
    
    // Usar el calculador normalizado para obtener la descripción correcta
    return RecurringExpenseCalculator.getFrequencyDescription(expense);
  };

  // Componente para renderizar cada tarjeta de gasto
  // Tarjeta de un gasto recurrente con montos y acciones rápidas.
  const ExpenseCard = ({ expense, isActive }) => {
    // Montos original, base y mensual, y detección de ajustes diarios.
    const monthlyAmount = calculateMonthlyAmount(expense);
    // El monto original está directamente en expense.amount
    const originalAmount = parseFloat(expense.amount) || 0;
    const baseMonthlyAmount = calculateBaseMonthlyAmount(expense);
    // Marca si el gasto tiene ajustes diarios que cambian su monto mensual.
    const hasAdjustments = Math.abs(monthlyAmount - baseMonthlyAmount) > 0.01;
    
    // DEBUG: Log del ExpenseCard
    // console.log(`💳 ExpenseCard para ${expense.description}:`, {
    //   monthlyAmount,
    //   baseMonthlyAmount,
    //   hasAdjustments,
    //   difference: monthlyAmount - baseMonthlyAmount
    // });
    
    return (
      <div
        onClick={() => handleCardClick(expense)}
        className={`group relative cursor-pointer ${isActive 
          ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/15' 
          : 'bg-gray-500/5 border-gray-500/20 hover:bg-gray-500/15'
        } border rounded-xl p-4 transition-all duration-300`}
        title="Haz clic para editar día a día"
      >
        {/* Indicador de ajustes diarios */}
        {hasAdjustments && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-pulse" 
               title="Tiene ajustes diarios personalizados" />
        )}
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${isActive 
                ? 'bg-amber-500/20 border-amber-500/30' 
                : 'bg-gray-500/20 border-gray-500/30'
              } border`}>
                <Repeat className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-amber-200 text-sm sm:text-base">
                    {expense.description}
                  </h4>
                  <Calendar className="w-3 h-3 text-blue-400 opacity-60" title="Editable día a día" />
                </div>
                <p className={`text-xs ${isActive ? 'text-amber-300' : 'text-gray-400'}`}>
                  {getCategoryName(expense.category)}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                isActive 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                {isActive ? 'Activo' : 'Inactivo'}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-400">Frecuencia:</span>
                <p className="text-amber-200 font-medium">
                  {getFrequencyText(expense)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Método de pago:</span>
                <p className="text-amber-200 font-medium">
                  {getPaymentMethodName(expense.paymentMethod)}
                </p>
              </div>
              {(expense.nextDate || expense.recurringConfig?.nextDate) && (
                <div>
                  <span className="text-gray-400">Próxima fecha:</span>
                  <p className="text-amber-200 font-medium">
                    {new Date(expense.nextDate || expense.recurringConfig?.nextDate).toLocaleDateString('es-ES')}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 ml-4">
            <div className="text-right">
              <p className={`text-lg font-bold ${isActive ? 'text-amber-300' : 'text-gray-400'}`}>
                {formatCurrency(originalAmount)}
              </p>
              <p className="text-xs text-gray-500">
                Base: {formatCurrency(originalAmount)}
              </p>
              <p className={`text-xs mt-1 ${isActive ? 'text-amber-300' : 'text-gray-400'}`}>
                Mensual: {formatCurrency(monthlyAmount)}
              </p>
              <p className="text-xs text-gray-400">
                Por día: {formatCurrency(RecurringExpenseCalculator.calculateBaseDailyAmount(expense))}
              </p>
            </div>
            
            <div className="flex gap-1">
              {onToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que se abra el modal de edición
                    const currentActive = (expense.recurrence?.isActive !== undefined)
                      ? expense.recurrence.isActive
                      : (expense._isActive !== undefined
                          ? expense._isActive
                          : (expense.recurringConfig?.isActive ?? expense.isActive ?? true));
                    onToggle(expense._id, !currentActive);
                  }}
                  className={`p-1.5 ${isActive 
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30 text-amber-400' 
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-400'
                  } border rounded transition-colors text-xs`}
                  title={isActive ? 'Desactivar' : 'Activar'}
                >
                  {isActive ? 'Pausar' : 'Activar'}
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que se abra el modal de edición
                    onEdit(expense);
                  }}
                  className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-400 transition-colors text-xs"
                >
                  Editar
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que se abra el modal de edición
                    onDelete(expense._id);
                  }}
                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-red-400 transition-colors text-xs"
                  title="Eliminar gasto"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Vista: tarjetas de resumen (total, activos, inactivos y valor mensual),
  // lista de gastos activos e inactivos (o estado vacío con el monto inferido)
  // y modal de edición diaria.
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        color="amber"
        title="Gastos Recurrentes"
        subtitle="Gestiona tus gastos automáticos - Haz clic en cualquier card para editar día a día"
        icon={Repeat}
        size="5xl"
        zIndex="high"
      >
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 sm:p-3">
            <p className="text-xs text-gray-400 flex items-center gap-1">Total {recurringExpenses.length === 0 && inferredRecurringTotal > 0 && (<span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] text-amber-200" title="Conteo sintético mientras solo existe monto inferido">inferido</span>)}</p>
            <p className="text-sm sm:text-lg font-bold text-amber-300">
              {recurringExpenses.length || (inferredRecurringTotal > 0 ? 1 : 0)}
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 sm:p-3">
            <p className="text-xs text-gray-400">Activos</p>
            <p className="text-sm sm:text-lg font-bold text-emerald-400">
              {activeExpenses.length || (recurringExpenses.length === 0 && inferredRecurringTotal > 0 ? 1 : 0)}
            </p>
          </div>
          <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-2 sm:p-3">
            <p className="text-xs text-gray-400">Inactivos</p>
            <p className="text-sm sm:text-lg font-bold text-gray-400">
              {inactiveExpenses.length}
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 sm:p-3 col-span-2">
            <p className="text-xs text-gray-400">Valor Total {recurringExpenses.length === 0 && inferredRecurringTotal > 0 && (<span className="ml-1 px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] text-blue-300" title="Monto inferido (diferencia entre total de gastos y gastos únicos)">inferido</span>)}</p>
            <p className="text-sm sm:text-lg font-bold text-blue-400">
              {recurringExpenses.length > 0 ? (
                formatCurrency(
                  activeExpenses.reduce((sum, expense) => sum + calculateMonthlyAmount(expense), 0)
                )
              ) : (
                formatCurrency(inferredRecurringTotal)
              )}
            </p>
          </div>
        </div>

        {/* Contenido */}
        {recurringExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Repeat className="w-8 h-8 text-amber-300" />
            </div>
            <p className="text-gray-400">No hay gastos recurrentes configurados</p>
            <p className="text-xs text-gray-500 max-w-sm mb-4">
              Si el tablero muestra gastos totales mayores a los únicos, el sistema infirió un componente recurrente a partir de la diferencia. Registra o migra tus plantillas para ver el detalle aquí.
            </p>
            {inferredRecurringTotal > 0 && (
              <div className="mt-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl w-full max-w-sm text-left">
                <p className="text-xs text-gray-400 mb-1">Total recurrente inferido</p>
                <p className="text-lg font-bold text-amber-200">{formatCurrency(inferredRecurringTotal)}</p>
                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                  Este monto proviene de la diferencia entre el total de gastos y la suma de los gastos únicos registrados en el período. Una vez registres plantillas recurrentes reales, sustituiremos esta cifra por el desglose exacto por plantilla.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Gastos Activos */}
            {activeExpenses.length > 0 && (
              <div>
                <h4 className="text-amber-200 font-medium mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  Gastos Activos ({activeExpenses.length})
                </h4>
                <div className="space-y-3">
                  {activeExpenses.map((expense) => (
                    <ExpenseCard key={expense._id} expense={expense} isActive={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Gastos Inactivos */}
            {inactiveExpenses.length > 0 && (
              <div>
                <h4 className="text-amber-200 font-medium mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Gastos Inactivos ({inactiveExpenses.length})
                </h4>
                <div className="space-y-3">
                  {inactiveExpenses.map((expense) => (
                    <ExpenseCard key={expense._id} expense={expense} isActive={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de edición diaria */}
      <DailyRecurringExpenseModal
        isOpen={showDailyModal}
        onClose={handleCloseDailyModal}
        expense={selectedExpense}
        formatCurrency={formatCurrency}
        onSave={handleDailySave}
      />
    </>
  );
};

export default RecurringExpensesListModal;
