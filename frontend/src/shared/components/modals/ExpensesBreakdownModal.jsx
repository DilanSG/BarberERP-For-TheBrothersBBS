import React from 'react';
import { 
  TrendingDown, 
  Calendar, 
  DollarSign,
  Tag,
  CreditCard,
  ArrowDownRight,
  AlertTriangle,
  RotateCcw,
  Receipt
} from 'lucide-react';
import Modal from '../ui/Modal';
import { calculator as RecurringExpenseCalculator } from '../../recurring-expenses';
import { getCategoryLabel } from '../../utils/categoryTranslations';

// Modal de desglose de gastos por categoría, separando recurrentes y únicos.
// En modo general usa totales proyectados; en modo específico calcula localmente.
export const ExpensesBreakdownModal = ({ 
  isOpen, 
  onClose, 
  data, 
  expenses,
  recurringExpenses = [],
  formatCurrency, 
  dateRange,
  expenseCategories = [],
  paymentMethods = [],
  salesData = [] // Agregar datos de ventas
}) => {
  // Helper para identificar tipos recurrentes en el nuevo esquema
  // Considera recurrentes los tipos 'recurring', 'recurring-template' y 'recurring-instance'.
  const isRecurringType = (type) => ['recurring', 'recurring-template', 'recurring-instance'].includes(type);
  
  // Función auxiliar para calcular monto diario con ajustes usando el calculador
  // Monto diario de un template recurrente aplicando sus ajustes.
  const calculateDailyAmountWithAdjustments = (template, date) => {
    return RecurringExpenseCalculator.getDailyAdjustedAmount(template, date);
  };
  
  // Función para formatear la frecuencia de gastos recurrentes
  // Convierte la configuración de frecuencia a texto legible.
  const formatFrequency = (frequency) => {
    if (!frequency) return 'Recurrente';
    
    // Si frequency es un string, devolverlo directamente
    if (typeof frequency === 'string') return frequency;
    
    // Si frequency es un objeto {type, interval}
    if (typeof frequency === 'object' && frequency.type) {
      const { type, interval } = frequency;
      
      const frequencyMap = {
        'daily': interval > 1 ? `Cada ${interval} días` : 'Diario',
        'weekly': interval > 1 ? `Cada ${interval} semanas` : 'Semanal',
        'monthly': interval > 1 ? `Cada ${interval} meses` : 'Mensual',
        'yearly': interval > 1 ? `Cada ${interval} años` : 'Anual'
      };
      
      return frequencyMap[type] || 'Recurrente';
    }
    
    return 'Recurrente';
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Resumen financiero recibido desde el dashboard.
  const { summary } = data || {};
  
  // Determinar si es un filtro general o específico
  // Detecta el filtro general (rango por defecto desde 2020 hasta 2025 o más).
  const isGeneralFilter = dateRange?.startDate === '2020-01-01' && 
                         new Date(dateRange?.endDate).getFullYear() >= 2025;
  
  console.log('DEBUG Modal - Filter Type:', isGeneralFilter ? 'GENERAL' : 'SPECIFIC');
  console.log('Date Range:', dateRange);
  // Filter logic check
  console.log('  - startDate === "2020-01-01":', dateRange?.startDate === '2020-01-01');
  console.log('  - endDate year >= 2025:', new Date(dateRange?.endDate).getFullYear() >= 2025);
  console.log('  - isGeneralFilter result:', isGeneralFilter);
  console.log('Date Range:', dateRange);
  console.log('Summary data:', summary);
  console.log('Expenses array length:', expenses?.length || 0);
  console.log('Recurring expenses array length:', recurringExpenses?.length || 0);
  console.log('Financial data (complete):', data); // Ver todos los datos disponibles
  
  // DEBUG: Ver detalles de filtros específicos
  if (!isGeneralFilter) {
    console.log('FILTRO ESPECÍFICO DETECTADO:');
    console.log('  - Start Date:', dateRange?.startDate);
    console.log('  - End Date:', dateRange?.endDate);
    console.log('  - Preset:', dateRange?.preset);
    console.log('  - Summary Total:', summary?.totalExpenses);
  }
  
  // Acumuladores de totales y agrupación por categoría.
  let finalOneTimeTotal = 0;
  let finalRecurringTotal = 0;
  let expensesByCategory = {};
  let totalExpenses = summary?.totalExpenses || 0;
  
  // Modo GENERAL: usa los totales proyectados del backend y los templates.
  if (isGeneralFilter) {
    // ========================================
    // MODO GENERAL: Usar totales del backend directamente
    // ========================================
    // MODO GENERAL: Mostrando totales reales del backend
    
    // MODO GENERAL: Usar misma lógica que las tarjetas exitosas
    // Gastos únicos del período.
    const allOneTimeExpenses = (expenses || []).filter(expense => expense.type === 'one-time');
    
    // Para gastos recurrentes, usar templates y calcular mensual
    // Templates recurrentes, o lista vacía si no se reciben.
    const recurringTemplates = Array.isArray(recurringExpenses) && recurringExpenses.length > 0
      ? recurringExpenses
      : [];
      
    const activeRecurringExpenses = recurringTemplates.filter(exp => 
      exp._isActive !== undefined 
        ? exp._isActive 
        : (exp.recurrence?.isActive ?? exp.recurringConfig?.isActive ?? exp.isActive ?? true)
    );
    
    finalOneTimeTotal = allOneTimeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    // Suma el monto mensual de los recurrentes activos.
    finalRecurringTotal = activeRecurringExpenses.reduce((sum, exp) => {
      try {
        return sum + RecurringExpenseCalculator.calculateMonthlyAmount(exp);
      } catch (e) {
        console.warn('Error calculando recurrente en modo general', exp.description, e.message);
        return sum;
      }
    }, 0);
    
    // Totales calculados: One-time y Recurring
    
    // Procesar gastos one-time
    // Agrupa los gastos únicos por categoría.
    allOneTimeExpenses.forEach(expense => {
      const category = expense.category || 'sin-categoria';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = {
          total: 0,
          count: 0,
          expenses: [],
          oneTimeTotal: 0,
          recurringTotal: 0
        };
      }
      
      expensesByCategory[category].total += expense.amount || 0;
      expensesByCategory[category].oneTimeTotal += expense.amount || 0;
      expensesByCategory[category].count += 1;
      expensesByCategory[category].expenses.push({
        ...expense,
        displayType: 'one-time'
      });
    });
    
    // Procesar gastos recurrentes usando templates y cálculo mensual
    // Agrupa los recurrentes por categoría usando su monto mensual.
    activeRecurringExpenses.forEach(template => {
      const category = template.category || 'sin-categoria';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = {
          total: 0,
          count: 0,
          expenses: [],
          oneTimeTotal: 0,
          recurringTotal: 0
        };
      }
      
      const monthlyAmount = RecurringExpenseCalculator.calculateMonthlyAmount(template);
      expensesByCategory[category].total += monthlyAmount;
      expensesByCategory[category].recurringTotal += monthlyAmount;
      expensesByCategory[category].count += 1;
      expensesByCategory[category].expenses.push({
        ...template,
        displayType: 'recurring',
        projectedAmount: monthlyAmount,
        note: 'Valor mensual completo'
      });
    });
    
  // Modo ESPECÍFICO: calcula los totales localmente mes a mes.
  } else {
    // ========================================
    // MODO ESPECÍFICO: Usar total recurrente autorizado del summary (evitar sobre proyección)
    // ========================================
    console.log('MODO ESPECÍFICO: Usando total recurrente del summary para evitar inflación');

    const pureOneTimeExpenses = (expenses || []).filter(expense => expense.type === 'one-time');
    let recurringTemplates = Array.isArray(recurringExpenses) && recurringExpenses.length > 0
      ? recurringExpenses
      : (expenses || []).filter(e => isRecurringType(e.type));

    if (recurringTemplates.length === 0) {
    // No hay templates recurrentes explícitos
    }

    // CALCULAR GASTOS RECURRENTES CORRECTAMENTE
    // En lugar de usar summary del backend (que da valores diarios), calcular mensual local
    finalOneTimeTotal = pureOneTimeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // Calcular gastos recurrentes usando la misma lógica que las tarjetas exitosas
    const activeRecurringExpenses = recurringTemplates.filter(exp => 
      exp._isActive !== undefined 
        ? exp._isActive 
        : (exp.recurrence?.isActive ?? exp.recurringConfig?.isActive ?? exp.isActive ?? true)
    );
    
    finalRecurringTotal = activeRecurringExpenses.reduce((sum, exp) => {
      try {
        // USAR SIEMPRE CÁLCULO MENSUAL como en las tarjetas
        return sum + RecurringExpenseCalculator.calculateMonthlyAmount(exp);
      } catch (e) {
        console.warn('Error calculando recurrente en modal', exp.description, e.message);
        return sum;
      }
    }, 0);

    console.log('Totales calculados localmente:', {
      finalOneTimeTotal,
      finalRecurringTotal,
      message: 'Usando cálculo mensual local como las tarjetas'
    });

    // Construir categorías para gastos one-time reales
    // Agrupa los gastos únicos reales del rango por categoría.
    pureOneTimeExpenses.forEach(expense => {
      const category = expense.category || 'sin-categoria';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = {
          total: 0,
          count: 0,
          expenses: [],
          oneTimeTotal: 0,
          recurringTotal: 0
        };
      }
      expensesByCategory[category].total += expense.amount || 0;
      expensesByCategory[category].oneTimeTotal += expense.amount || 0;
      expensesByCategory[category].count += 1;
      expensesByCategory[category].expenses.push({
        ...expense,
        displayType: 'one-time'
      });
    });
    // Si hay templates recurrentes, usar los valores mensuales calculados directamente
    if (finalRecurringTotal > 0 && activeRecurringExpenses.length > 0) {
      console.log('Distribuyendo gastos recurrentes (valores mensuales):', { 
        activeCount: activeRecurringExpenses.length, 
        finalRecurringTotal 
      });
      // Distribuye los recurrentes activos por categoría con su valor mensual.
      activeRecurringExpenses.forEach(template => {
        const category = template.category || 'sin-categoria';
        if (!expensesByCategory[category]) {
          expensesByCategory[category] = {
            total: 0,
            count: 0,
            expenses: [],
            oneTimeTotal: 0,
            recurringTotal: 0
          };
        }
        
        // Usar el valor mensual calculado directamente
        const monthlyAmount = RecurringExpenseCalculator.calculateMonthlyAmount(template);
        expensesByCategory[category].total += monthlyAmount;
        expensesByCategory[category].recurringTotal += monthlyAmount;
        expensesByCategory[category].count += 1;
        expensesByCategory[category].expenses.push({
          ...template,
          displayType: 'recurring',
          projectedAmount: monthlyAmount,
          note: 'Valor mensual completo'
        });
      });
    // Sin templates disponibles: crea una categoría sintética con el total recurrente.
    } else if (finalRecurringTotal > 0 && activeRecurringExpenses.length === 0) {
      // No tenemos desglose por categoría, crear categoría sintética
      expensesByCategory['recurrentes'] = {
        total: finalRecurringTotal,
        count: 1,
        expenses: [
          {
            description: 'Gastos recurrentes (agregado)',
            amount: finalRecurringTotal,
            displayType: 'recurring',
            synthetic: true,
            note: 'Total recurrente agregado sin templates disponibles'
          }
        ],
        oneTimeTotal: 0,
        recurringTotal: finalRecurringTotal
      };
    }

  // Totales calculados: One-time y Recurring
  }

  // Calcular el total real basado en lo que calculó el modal
  // Total calculado del modal (único + recurrente).
  const calculatedTotal = finalOneTimeTotal + finalRecurringTotal;
  console.log(`RESUMEN FINAL:`);
  console.log(`  - One-time: $${finalOneTimeTotal.toLocaleString()}`);
  console.log(`  - Recurring: $${finalRecurringTotal.toLocaleString()}`);
  console.log(`  - Total calculado: $${calculatedTotal.toLocaleString()}`);
  console.log(`  - Total del backend: $${totalExpenses.toLocaleString()}`);

  // Convertir a array y ordenar por total
  // Desglose ordenado por categoría con su porcentaje sobre el total.
  const categoryBreakdown = Object.entries(expensesByCategory)
    .map(([category, data]) => ({
      category,
      ...data,
      percentage: calculatedTotal > 0 ? (data.total / calculatedTotal * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  // Usar función centralizada de traducción (eliminado getCategoryName local)
  // const getCategoryName = ... REMOVIDO - usar getCategoryLabel importado

  // Obtener icono de categoría
  // Icono asociado a cada categoría de gasto.
  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      'rent': ArrowDownRight,
      'utilities': TrendingDown,
      'supplies': Tag,
      'equipment': AlertTriangle,
      'salaries': DollarSign,
      'marketing': Tag,
      'maintenance': AlertTriangle,
      'insurance': CreditCard,
      'taxes': DollarSign,
      'transport': Tag,
      'food': Tag,
      'training': Tag,
      'software': Tag,
      'other': Tag,
      'sin-categoria': Tag
    };
    return iconMap[categoryId] || Tag;
  };

  // Vista: tarjetas resumen y desglose por categoría con sus gastos.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="amber"
      title={`Desglose de Gastos ${isGeneralFilter ? '(General)' : '(Específico)'}`}
      subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Período seleccionado'}
      icon={Receipt}
      size="3xl"
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
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="p-2 sm:p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-300 mb-1">Total gastos</p>
          <p className="text-xs sm:text-sm font-bold text-amber-400">{formatCurrency(calculatedTotal)}</p>
        </div>
        <div className="p-2 sm:p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <RotateCcw className="w-3 h-3 text-amber-300" />
            <p className="text-xs text-amber-300">Recurrentes</p>
          </div>
          <p className="text-xs sm:text-sm font-bold text-amber-400">{formatCurrency(finalRecurringTotal)}</p>
        </div>
        <div className="p-2 sm:p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300 mb-1">Una vez</p>
          <p className="text-xs sm:text-sm font-bold text-blue-400">{formatCurrency(finalOneTimeTotal)}</p>
        </div>
        <div className="p-2 sm:p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-xs text-gray-300 mb-1">Categorías</p>
          <p className="text-xs sm:text-sm font-bold text-amber-300">{categoryBreakdown.length}</p>
        </div>
      </div>

      {/* Contenido */}
      {categoryBreakdown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
            <TrendingDown className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-gray-400">No hay gastos registrados en este período</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categoryBreakdown.map((categoryData, index) => {
            // Icono y banderas de recurrencia y de gasto único de la categoría.
            const IconComponent = getCategoryIcon(categoryData.category);
            const hasRecurring = categoryData.recurringTotal > 0;
            const hasOneTime = categoryData.oneTimeTotal > 0;
            
            return (
              <div key={index} className="space-y-3">
                {/* Encabezado de categoría */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:scale-[1.02] transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                        <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-amber-200 text-sm sm:text-base">
                          {getCategoryLabel(categoryData.category)} {/* Usar función centralizada */}
                        </h4>
                        <p className="text-xs text-gray-400">
                          {categoryData.count} gasto{categoryData.count !== 1 ? 's' : ''}
                          {hasRecurring && hasOneTime && ' (mixtos)'}
                          {hasRecurring && !hasOneTime && ' (recurrentes)'}
                          {hasOneTime && !hasRecurring && ' (únicos)'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">
                        {formatCurrency(categoryData.total)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {categoryData.percentage.toFixed(1)}% del total
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-amber-400"
                      style={{ width: `${Math.min(categoryData.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Lista de gastos de la categoría */}
                <div className="ml-4 space-y-2">
                  {categoryData.expenses.slice(0, 3).map((expense, expenseIndex) => {
                    const isRecurring = expense.displayType === 'recurring';
                    // Monto a mostrar: proyectado mensual para recurrentes, directo para únicos.
                    const displayAmount = isRecurring ? 
                      (expense.projectedAmount || expense.instancesTotal || expense.amount) : 
                      expense.amount;
                    
                    return (
                      <div key={expenseIndex} className={`p-3 border rounded-lg hover:scale-[1.01] transition-all duration-300 ${
                        isRecurring 
                          ? 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10' 
                          : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04]'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              isRecurring ? 'bg-amber-400' : 'bg-red-400'
                            }`}></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-amber-200 font-medium">
                                  {expense.description || 'Sin descripción'}
                                </p>
                                {isRecurring && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-xs">
                                    <RotateCcw className="w-2.5 h-2.5 text-amber-300" />
                                    <span className="text-amber-300">
                                      {formatFrequency(expense.recurringConfig)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">
                                {new Date(expense.date).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                                {isRecurring && expense.workedDaysCount && (
                                  <span className="ml-2 text-amber-300">
                                    • {expense.workedDaysCount} días trabajados
                                  </span>
                                )}
                                {isRecurring && expense.instancesCount && (
                                  <span className="ml-2 text-amber-300">
                                    • {expense.instancesCount} instancia{expense.instancesCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${
                              isRecurring ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(displayAmount)}
                            </p>
                            {isRecurring && !isGeneralFilter && (
                              <p className="text-xs text-amber-300">
                                proyectado
                              </p>
                            )}
                            {isRecurring && isGeneralFilter && (
                              <p className="text-xs text-amber-300">
                                en período
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Mostrar enlace si hay más gastos */}
                  {categoryData.expenses.length > 3 && (
                    <div className="ml-4 px-3 py-2 text-xs text-gray-400 border-l border-gray-600">
                      +{categoryData.expenses.length - 3} gasto{categoryData.expenses.length - 3 !== 1 ? 's' : ''} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default ExpensesBreakdownModal;
