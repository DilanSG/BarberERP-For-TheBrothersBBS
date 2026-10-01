import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  CreditCard,
  Receipt,
  Layers,
  PieChart,
  BarChart3,
  Settings,
  RefreshCw,
  Repeat,
  X
} from 'lucide-react';
import { PageContainer } from '@components/layout/PageContainer';
import GradientButton from '@components/ui/GradientButton';
import { Reveal, StaggerGrid } from '@components/motion/Reveal';
import { ReportsSkeleton } from '@components/ui/Skeleton';
import { FinancialDashboard } from '@components/financial/FinancialDashboard';
import CashBreakdownModal from '@components/modals/CashBreakdownModal';
import DigitalPaymentsBreakdownModal from '@components/modals/DigitalPaymentsBreakdownModal';
import ServicesBreakdownModal from '@components/modals/ServicesBreakdownModal';
import { SimpleDateFilter } from '@components/common/SimpleDateFilter';
import { ExpenseModal } from '@components/financial/ExpenseManagement';
import ExpenseTypeSelector from '@components/financial/ExpenseTypeSelector';
import OneTimeExpenseModal from '@components/financial/OneTimeExpenseModal';
import RecurringExpenseModal from '@components/financial/RecurringExpenseModal';
import OneTimeExpensesListModal from '@components/modals/OneTimeExpensesListModal';
import RecurringExpensesListModal from '@components/modals/RecurringExpensesListModal';
import DeleteExpenseModal from '@components/modals/DeleteExpenseModal';
import { PaymentMethodsModal } from '@components/modals/PaymentMethodsModal';
import { ExpensesBreakdownModal } from '@components/modals/ExpensesBreakdownModal';
import RevenueBreakdownModal from '@components/modals/RevenueBreakdownModal';
import RevenueTypesModal from '@components/modals/RevenueTypesModal';
import ProductsSoldModal from '@components/modals/ProductsSoldModal';
import AppointmentsBreakdownModal from '@components/modals/AppointmentsBreakdownModal';
import useFinancialReports from '@hooks/useFinancialReports';
import { useRecurringExpenses } from '../../features/expenses/hooks/useRecurringExpenses';
import { calculator as RecurringExpenseCalculator } from '@shared/recurring-expenses';
import { getCategoryLabel, getPaymentMethodLabel } from '@utils/categoryTranslations';

// Opciones de frecuencia para gastos recurrentes
const frequencies = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' }
];

// Calcula los gastos diarios correctos considerando gastos recurrentes y únicos.
// Devuelve { dailyRate, monthlyProjection }: el diario reparte los gastos únicos
// entre los días del período y suma la porción diaria de los recurrentes (/30).
const calculateCorrectDailyExpenses = (expenses, recurringExpenses, startDate, endDate) => {
  // Calcular total de gastos únicos del período
  const oneTimeExpenses = expenses || [];
  const oneTimeTotal = oneTimeExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  // USAR GASTOS RECURRENTES LOCALES SIEMPRE
  let recurringMonthlyTotal = 0;
  if (recurringExpenses && recurringExpenses.length > 0) {
    const activeRecurringExpenses = recurringExpenses.filter(exp => (exp._isActive !== undefined
      ? exp._isActive
      : (exp.recurrence?.isActive ?? exp.recurringConfig?.isActive ?? exp.isActive ?? true)));
    
    recurringMonthlyTotal = activeRecurringExpenses.reduce((sum, exp) => {
      try {
        const monthlyAmount = RecurringExpenseCalculator.calculateMonthlyAmount(exp);
        return sum + monthlyAmount;
      } catch (error) {
        console.warn('Error calculando gasto recurrente:', exp.description, error);
        return sum;
      }
    }, 0);
  }

  // Calcular días en el periodo
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // Proyección mensual de gastos recurrentes (ya está en formato mensual)
  const monthlyProjection = recurringMonthlyTotal;

  // Gasto diario = (gastos únicos / días) + (gastos recurrentes mensuales / 30)
  const dailyFromOneTime = oneTimeTotal / daysInPeriod;
  const dailyFromRecurring = recurringMonthlyTotal / 30;
  const dailyRate = dailyFromOneTime + dailyFromRecurring;

  return {
    dailyRate,
    monthlyProjection
  };
};

// Página de reportes financieros completa.
// Sistema integral de análisis financiero y gestión de gastos: dashboard,
// listado/gestión de gastos y análisis con gráficos, todo filtrable por período.
const Reports = () => {
  // Estados principales
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Estados para nuevos modales de gastos
  const [showExpenseTypeSelector, setShowExpenseTypeSelector] = useState(false);
  const [showOneTimeExpenseModal, setShowOneTimeExpenseModal] = useState(false);
  const [showRecurringExpenseModal, setShowRecurringExpenseModal] = useState(false);
  
  // Estados para modales de desglose de gastos por tipo
  const [showOneTimeExpensesModal, setShowOneTimeExpensesModal] = useState(false);
  const [showRecurringExpensesModal, setShowRecurringExpensesModal] = useState(false);
  
  // Estados para modales de reportes
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [showExpensesBreakdownModal, setShowExpensesBreakdownModal] = useState(false);
  const [showRevenueBreakdownModal, setShowRevenueBreakdownModal] = useState(false);
  const [showRevenueTypesModal, setShowRevenueTypesModal] = useState(false);
  const [showCashBreakdownModal, setShowCashBreakdownModal] = useState(false);
  const [showDigitalPaymentsModal, setShowDigitalPaymentsModal] = useState(false);
  const [showProductsSoldModal, setShowProductsSoldModal] = useState(false);
  const [showServicesBreakdownModal, setShowServicesBreakdownModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);

  
  // Estados para modal de eliminación
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Hooks principales
  // useFinancialReports centraliza datos, rango de fechas, cálculos y formatCurrency
  const {
    data: financialData,
    loading: isLoading,
    error,
    dateRange,
    datePresets,
    setDateRangePreset,
    setCustomDateRange,
    refreshData,
    calculations,
    formatCurrency
  } = useFinancialReports();

  // Compatibilidad: adaptadores que reciben la forma antigua (objeto range)
  const handleLegacyPreset = (preset) => {
    if (preset === 'all') {
      // Mapear preset legacy 'all' al nuevo 'allData'
      setDateRangePreset('allData');
      return;
    }
    if (preset === 'custom') {
      // No forzamos preset aquí; se establecerá cuando el usuario elija rango personalizado
      return;
    }
    setDateRangePreset(preset);
  };

  const handleLegacyCustomRange = (range) => {
    if (!range) return;
    const { startDate, endDate } = range;
    setCustomDateRange(startDate, endDate);
  };

  // Adaptar preset a claves legacy para el componente visual del filtro
  const uiDateRange = useMemo(() => ({
    ...dateRange,
    preset: dateRange?.preset === 'allData' ? 'all' : dateRange?.preset
  }), [dateRange]);

  // Loading unificado para tablero financiero y gastos recurrentes (se reubica más abajo tras obtener expensesLoading)

  // Datos del Financial Dashboard disponibles
  useEffect(() => {
    if (financialData?.summary) {
      // Dashboard data ready
    }
  }, [financialData, formatCurrency, dateRange]);

  // Usar el nuevo hook para gastos recurrentes
  const {
    recurringExpenses,
    inferredRecurringTotal,
    loading: expensesLoading,
    error: expensesError,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    toggleRecurringStatus
  } = useRecurringExpenses();

  // Sanitization: Crear una versión saneada de los gastos recurrentes para evitar crashes.
  const sanitizedRecurringExpenses = useMemo(() => {
    if (!Array.isArray(recurringExpenses)) return [];
    
    const originalCount = recurringExpenses.length;
    const sanitized = recurringExpenses.filter(e => {
      if (!e || typeof e !== 'object') {
        console.warn('Reports.jsx: Filtrado un elemento no-objeto de recurringExpenses.', e);
        return false;
      }
      // Puedes añadir más validaciones si es necesario
      return true;
    });

    if (sanitized.length < originalCount) {
      console.log(`Reports.jsx: Se filtraron ${originalCount - sanitized.length} elementos inválidos de 'recurringExpenses'.`);
    }
    
    return sanitized;
  }, [recurringExpenses]);

  // Fallback: si el hook no pudo inferir (porque /expenses/summary devolvió 400) usar summary ya cargado en financialData
  const effectiveInferredRecurringTotal = useMemo(() => {
    return (
      inferredRecurringTotal
      || financialData?.summary?.recurringExpensesTotal
      || financialData?.summary?.recurringExpensesInferred
      || financialData?.summary?.recurringExpensesRecalculated
      || 0
    );
  }, [inferredRecurringTotal, financialData]);

  // Loading unificado (dashboard + gastos recurrentes)  
  const financialLoading = Boolean(isLoading || expensesLoading);
  const financialError = error ? (typeof error === 'string' ? error : error.message || 'Error financiero') : null;

  // Las categorías y métodos de pago se obtienen del hook useFinancialReports (ya desestructurados arriba)
  // Si por alguna razón vienen undefined, garantizamos arrays vacíos para evitar errores aguas abajo
  // Derivar categorías de gastos de los datos ya cargados (financialData.expenseBreakdown) para evitar dependencia a variable eliminada
  const safeExpenseCategories = useMemo(() => {
    const breakdown = financialData?.expenseBreakdown || financialData?.expenseCategories || [];
    if (!Array.isArray(breakdown)) return [];
    // Normalizar estructura: { value, label, total } con traducciones
    return breakdown.map(item => {
      const value = item.value || item.category || item.key || item._id || 'unknown';
      return {
        value,
        label: getCategoryLabel(value), // Usar función de traducción
        total: item.total || item.totalAmount || item.amount || 0
      };
    });
  }, [financialData]);
  
  // Normalizar métodos de pago a partir del summary (fuente primaria) o lista previa
  const safePaymentMethods = useMemo(() => {
    const pmObj = financialData?.summary?.paymentMethods || {};
    // Si tenemos un objeto con montos, convertirlo a array con value/label traducidos
    const fromSummary = Object.keys(pmObj).map(k => ({ 
      value: k, 
      label: getPaymentMethodLabel(k), // Usar función de traducción
      amount: pmObj[k] 
    }));
    return fromSummary;
  }, [financialData]);

  // Función para refrescar todos los datos
  const refreshAllData = useCallback(() => {
    refreshData();
  }, [refreshData]);

  // Handler para clicks en cards del dashboard
  // Mapea cada card con su modal de desglose correspondiente
  const handleCardClick = (cardId, cardData) => {
    switch (cardId) {
      case 'ingresos':
        setShowRevenueBreakdownModal(true);
        break;
      case 'gastos':
        setShowExpensesBreakdownModal(true);
        break;
      case 'efectivo':
        setShowCashBreakdownModal(true);
        break;
      case 'digitales':
        setShowDigitalPaymentsModal(true);
        break;
      case 'porcentaje':
      case 'ganancia':
        setShowRevenueTypesModal(true);
        break;
      case 'tipos':
        setShowRevenueTypesModal(true);
        break;
      case 'citas':
        setShowAppointmentsModal(true);
        break;
      case 'servicios':
        setShowServicesBreakdownModal(true);
        break;
      case 'productos':
        setShowProductsSoldModal(true);
        break;
      case 'one-time':
        setShowOneTimeExpensesModal(true);
        break;
      case 'recurring':
        setShowRecurringExpensesModal(true);
        break;
      default:
        break;
    }
  };

  // ── Métricas de gastos: leen el cálculo canónico del hook (fuente única) ──
  // Así las cards de Gastos siempre reconcilian: únicos + recurrentes = total.
  const getOneTimeExpensesStats = () => ({
    count: financialData?.summary?.oneTimeExpensesCount ?? 0,
    total: financialData?.summary?.oneTimeExpensesTotal ?? 0,
  });

  const getRecurringExpensesStats = () => ({
    count: financialData?.summary?.recurringExpensesCount ?? 0,
    total: financialData?.summary?.recurringExpensesTotal ?? 0,
    monthlyTotal: financialData?.summary?.recurringExpensesMonthly ?? 0,
    calculation: financialData?.summary?.recurringCalculation || 'none',
    inferred: false,
  });

  const getRecurringExpensesMonthlyStats = () => ({
    count: financialData?.summary?.recurringExpensesCount ?? 0,
    total: financialData?.summary?.recurringExpensesMonthly ?? 0,
    inferred: false,
  });

  const getTotalExpensesStats = () => {
    const oneTime = getOneTimeExpensesStats();
    const recurring = getRecurringExpensesStats();
    return {
      count: oneTime.count + recurring.count,
      total: financialData?.summary?.totalExpenses ?? (oneTime.total + recurring.total),
      breakdown: {
        oneTime: oneTime.total,
        recurring: recurring.total,
        recurringMonthly: recurring.monthlyTotal,
        hasRevenue: (financialData?.summary?.totalRevenue || 0) > 0,
        message: 'Gastos normales + recurrentes del período',
      },
    };
  };

  // Definir safeBasicMetrics después de las funciones para evitar errores de inicialización
  const safeBasicMetrics = {
    totalRevenue: financialData?.summary?.totalRevenue || 0,
    totalExpenses: getTotalExpensesStats().total, // Usar mismo cálculo que las tarjetas exitosas
    netProfit: (financialData?.summary?.totalRevenue || 0) - getTotalExpensesStats().total // Recalcular netProfit con gastos correctos
  };

  // ===== Nuevos datos para gráficos de barras (Análisis) =====
  const categoryChartData = useMemo(() => {
    const expenses = financialData?.expenses || [];
    
    // INCLUIR GASTOS RECURRENTES: Combinar gastos únicos + recurrentes
    const totals = expenses.reduce((acc, e) => {
      const key = e.category || 'other';
      acc[key] = (acc[key] || 0) + (e.amount || 0);
      return acc;
    }, {});
    
    // AGREGAR GASTOS RECURRENTES SI EXISTEN
    if (sanitizedRecurringExpenses && sanitizedRecurringExpenses.length > 0) {
      const activeRecurringExpenses = sanitizedRecurringExpenses.filter(exp => (exp._isActive !== undefined
        ? exp._isActive
        : (exp.recurrence?.isActive ?? exp.recurringConfig?.isActive ?? exp.isActive ?? true)));
      
      activeRecurringExpenses.forEach(exp => {
        try {
          // Calcular monto para el período filtrado
          const monthlyAmount = RecurringExpenseCalculator.calculateMonthlyAmount(exp);
          
          // Para filtros específicos, calcular porción del período
          const isGeneralFilter = dateRange?.preset === 'all' || dateRange?.preset === 'allData' || !dateRange?.preset;
          let amountForPeriod = monthlyAmount;
          
          if (!isGeneralFilter && dateRange?.startDate && dateRange?.endDate) {
            const start = new Date(dateRange.startDate);
            const end = new Date(dateRange.endDate);
            const daysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const dailyPortion = monthlyAmount / 30; // 30 días promedio por mes
            amountForPeriod = dailyPortion * daysInPeriod;
          }
          
          const category = exp.category || 'other';
          totals[category] = (totals[category] || 0) + amountForPeriod;
        } catch (error) {
          console.warn('Error calculando gasto recurrente para gráfico:', exp.description, error);
        }
      });
    }
    
    // Si no hay datos, retornar array vacío
    if (Object.keys(totals).length === 0) return [];
    
    return Object.entries(totals)
      .map(([key, value]) => ({
        key,
        label: getCategoryLabel(key), // Usar función de traducción
        value
      }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);
  }, [financialData?.expenses, sanitizedRecurringExpenses, dateRange]);

  const paymentMethodChartData = useMemo(() => {
    // Usar ingresos (summary.paymentMethods) si están disponibles; fallback a conteo en gastos
    const pmSummary = financialData?.summary?.paymentMethods || {};
    const entries = Object.entries(pmSummary).filter(([, v]) => v > 0);
    if (entries.length > 0) {
      return entries.map(([method, amount]) => ({
          key: method,
          label: getPaymentMethodLabel(method), // Usar función de traducción
          value: amount
        })).sort((a,b) => b.value - a.value);
    }
    const expenses = financialData?.expenses || [];
    if (expenses.length === 0) return [];
    const counts = expenses.reduce((acc, e) => {
      const m = e.paymentMethod || 'other';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([key, value]) => ({
      key,
      label: getPaymentMethodLabel(key), // Usar función de traducción
      value
    })).sort((a,b) => b.value - a.value);
  }, [financialData]); // Removida dependencia de safePaymentMethods

  // Datos para el gráfico de ingresos por tipo (cortes, productos y citas)
  const revenueTypeChartData = useMemo(() => {
    const summary = financialData?.summary || {};
    const data = [
      { key: 'services', label: 'Cortes', value: summary.serviceRevenue || 0 },
      { key: 'products', label: 'Productos', value: summary.productRevenue || 0 },
      { key: 'appointments', label: 'Citas', value: summary.appointmentRevenue || 0 }
    ];
    return data.filter(d => d.value > 0);
  }, [financialData]);

  // Semana actual (Lunes-Domingo) usando dailyData del hook
  const weeklyRevenueData = useMemo(() => {
    const daily = financialData?.dailyData || [];
    const today = new Date();
    // Obtener lunes de la semana actual (considerando lunes = 1)
    const day = today.getDay(); // 0 Domingo ... 6 Sábado
    const diffToMonday = (day === 0 ? -6 : 1 - day); // mover al lunes
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0,0,0,0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const mapDaily = daily.reduce((acc, item) => {
      if (!item?.date) return acc;
      const key = item.date; // YYYY-MM-DD
      // Posibles nombres de campo de ingreso diario
      const val = item.revenue ?? item.totalRevenue ?? item.total ?? item.amount ?? 0;
      acc[key] = (acc[key] || 0) + val;
      return acc;
    }, {});
    const formatter = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
    return days.map(d => {
      const iso = d.toISOString().split('T')[0];
      return {
        key: iso,
        label: formatter.format(d).replace('.', ''),
        value: mapDaily[iso] || 0
      };
    });
  }, [financialData]);

  // Totales de la semana actual (total y promedio diario) para la cabecera del gráfico
  const weeklyTotals = useMemo(() => {
    const total = weeklyRevenueData.reduce((s, d) => s + d.value, 0);
    const avg = weeklyRevenueData.length > 0 ? total / weeklyRevenueData.length : 0;
    return { total, avg };
  }, [weeklyRevenueData]);

  // Componente interno simple para gráfico de barras vertical
  // Calcula la altura proporcional de cada barra y habilita scroll si hay muchas
  const VerticalBarChart = ({ data, currency = false, height = 180, barColorClass = 'from-blue-500 to-blue-500' }) => {
    if (!data || data.length === 0) {
      return <div className="text-center text-gray-500 text-sm py-8">Sin datos</div>;
    }
    const max = Math.max(...data.map(d => d.value), 1);
    
    // Determinar si necesita scroll o distribución completa
    const needsScroll = data.length > 6; // Reducido de 8 a 6 para mejor espaciado
    const containerClass = needsScroll 
      ? "flex items-end justify-start gap-6 px-3" // Aumenté gap y padding
      : "flex items-end justify-between px-4";
    const itemWidth = needsScroll ? "64px" : "auto";
    const itemClass = needsScroll 
      ? "flex flex-col items-center group" 
      : "flex flex-col items-center group flex-1";
    
    return (
      <div className="w-full overflow-x-auto custom-scrollbar">
        <div 
          className={containerClass}
          style={{ 
            height: `${height}px`, 
            minWidth: needsScroll ? `${data.length * 64}px` : '100%'
          }}
        >
          {data.map(d => {
            const pct = Math.max((d.value / max) * 100, 2); // Mínimo 2% para visibilidad
            return (
              <div 
                key={d.key} 
                className={itemClass}
                style={needsScroll ? { width: itemWidth } : { minWidth: '60px' }} // Ancho mínimo en distribución completa
              >
                <div className="w-full relative flex items-end justify-center" style={{ height: `${height - 60}px` }}> {/* Más espacio para texto */}
                  <div 
                    className={`bg-gradient-to-t ${barColorClass} transition-all duration-500 rounded-t-sm border border-white/20 relative group-hover:scale-105 shadow-lg`} 
                    style={{ 
                      width: needsScroll ? '32px' : '50%',
                      height: `${pct}%`,
                      minHeight: '4px'
                    }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 flex items-center justify-center text-[10px] text-white font-medium text-center p-1 rounded-sm">
                      {currency ? formatCurrency(d.value) : d.value.toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center px-1" style={{ width: needsScroll ? '64px' : 'auto', minHeight: '42px' }}> {/* Altura mínima fija para texto */}
                  <div style={{ minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span 
                      className="block text-[10px] sm:text-xs text-gray-300 font-medium leading-tight break-words hyphens-auto" 
                      title={d.label}
                      style={{ 
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        lineHeight: '1.2'
                      }}
                    >
                      {d.label}
                    </span>
                  </div>
                  <span className="block text-[10px] sm:text-xs text-gray-500 mt-1">
                    {currency ? formatCurrency(d.value) : d.value.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Variante pequeña para múltiple uso
  const MiniVerticalBarChart = ({ data, barColorClass, currency = true }) => (
    <VerticalBarChart data={data} barColorClass={barColorClass} height={120} currency={currency} />
  );

  // Tabs de navegación
  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Resumen', 
      icon: BarChart3
    },
    { 
      id: 'expenses', 
      label: 'Gastos', 
      icon: DollarSign
    },
    { 
      id: 'analysis', 
      label: 'Análisis', 
      icon: PieChart
    }
  ];

  // Handlers para gastos
  // Guarda (crea o actualiza) un gasto; hoy solo maneja gastos recurrentes
  const handleSaveExpense = async (expenseData) => {
    try {
      if (editingExpense) {
        // Solo maneja gastos recurrentes por ahora
        if (
          editingExpense.type === 'recurring-template' ||
          editingExpense.type === 'recurring' ||
          expenseData.type === 'recurring-template' ||
          expenseData.type === 'recurring'
        ) {
          await updateRecurringExpense(editingExpense._id, expenseData);
        }
      } else {
        // Crear gasto recurrente
        if (expenseData.type === 'recurring' || expenseData.type === 'recurring-template') {
          await createRecurringExpense(expenseData);
        }
      }
      closeExpenseModals();
      setEditingExpense(null);
      refreshAllData();
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  // Abre el modal de edición adecuado según el tipo de gasto
  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    // Determinar qué modal abrir basado en el tipo de gasto
    if (expense.type === 'recurring' || expense.type === 'recurring-template') {
      setShowRecurringExpenseModal(true);
    } else {
      setShowOneTimeExpenseModal(true);
    }
  };

  // Inicia la creación de un gasto abriendo el selector de tipo
  const handleCreateExpense = () => {
    setEditingExpense(null);
    setShowExpenseTypeSelector(true);
  };

  // Abre el modal correspondiente según el tipo elegido (recurrente o único)
  const handleExpenseTypeSelect = (type) => {
    setShowExpenseTypeSelector(false);
    if (type === 'recurring') {
      setShowRecurringExpenseModal(true);
    } else {
      setShowOneTimeExpenseModal(true);
    }
  };

  // Función para cerrar todos los modales de gastos
  // Cierra selector y formularios, y limpia el gasto en edición
  const closeExpenseModals = () => {
    setShowExpenseTypeSelector(false);
    setShowOneTimeExpenseModal(false);
    setShowRecurringExpenseModal(false);
    setEditingExpense(null);
  };

  // Busca el gasto (único o recurrente) y abre el modal de confirmación de borrado
  const handleDeleteExpense = async (expenseId) => {
    // Buscar el gasto en ambas listas para poder mostrarlo en el modal
    const oneTimeExpenses = financialData?.expenses || [];
    const expense = oneTimeExpenses.find(exp => exp._id === expenseId) || 
                   recurringExpenses.find(exp => exp._id === expenseId);
    
    if (expense) {
      setExpenseToDelete(expense);
      setShowDeleteExpenseModal(true);
    }
  };

  // Confirma la eliminación del gasto y refresca los datos financieros
  const handleConfirmDeleteExpense = async (expenseId) => {
    setDeleteLoading(true);
    try {
      await deleteRecurringExpense(expenseId);
      setShowDeleteExpenseModal(false);
      setExpenseToDelete(null);
      refreshAllData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Cierra el modal de eliminación y limpia el estado asociado
  const handleCloseDeleteModal = () => {
    setShowDeleteExpenseModal(false);
    setExpenseToDelete(null);
    setDeleteLoading(false);
  };

  // Activa/desactiva un gasto recurrente (sin borrar su configuración)
  const handleToggleRecurring = async (expenseId, isActive) => {
    try {
      await toggleRecurringStatus(expenseId, isActive);
    } catch (error) {
      console.error('Error toggling recurring expense:', error);
    }
  };

  // Refresca a la vez los reportes financieros y los gastos automáticos
  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        refreshAllData(),
        processAutomaticExpenses()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // Renderizar contenido por tab
  // dashboard = resumen financiero; expenses = gestión de gastos; analysis = gráficos y KPIs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            {/* Dashboard de reportes financieros */}
            <FinancialDashboard
              data={{
                ...financialData,
                summary: {
                  ...financialData?.summary,
                  totalExpenses: getTotalExpensesStats().total, // Usar cálculo correcto
                  netProfit: (financialData?.summary?.totalRevenue || 0) - getTotalExpensesStats().total // Recalcular netProfit
                }
              }}
              calculations={calculations}
              loading={financialLoading}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onCardClick={handleCardClick}
            />

            {/* Métricas rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
                onClick={() => setShowRevenueBreakdownModal(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-lg border border-emerald-500/20">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Desglose de Ingresos</h3>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                    {formatCurrency(safeBasicMetrics?.totalRevenue || 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Click para ver detalles</p>
                </div>
              </div>

              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden cursor-pointer hover:scale-[1.02] hover:border-white/20 transition-all duration-300"
                onClick={() => handleCardClick('gastos')}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-red-600/20 to-amber-600/20 rounded-lg border border-red-500/20">
                      <TrendingUp className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Gastos del Período</h3>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-red-400">
                    {formatCurrency(getTotalExpensesStats().total)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(() => {
                      const stats = getTotalExpensesStats();
                      const hasRevenue = (financialData?.summary?.totalRevenue || 0) > 0;
                      return hasRevenue 
                        ? `${stats.count} gasto${stats.count !== 1 ? 's' : ''} · Normales + Recurrentes`
                        : `${stats.count} gasto${stats.count !== 1 ? 's' : ''} · Solo Normales (sin ventas)`;
                    })()}
                  </p>
                </div>
              </div>

              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden cursor-pointer hover:scale-[1.02] hover:border-white/20 transition-all duration-300"
                onClick={() => handleCardClick('tipos')}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-brand-500/20 to-blue-600/20 rounded-lg border border-brand-400/20">
                      <TrendingUp className="w-5 h-5 text-brand-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Tipos de Ingresos</h3>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-brand-300">
                    {formatCurrency(safeBasicMetrics?.totalRevenue || 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Ver desglose por fuente</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'expenses':
        return (
          <div className="space-y-8">
            {/* Métricas principales de gastos - estilo dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Total de Gastos del Período */}
              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
                onClick={() => setShowExpensesBreakdownModal(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-red-600/20 to-amber-600/20 rounded-lg border border-red-500/20">
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Total Gastos</h3>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-red-400">
                    {formatCurrency(getTotalExpensesStats().total)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(() => {
                      const stats = getTotalExpensesStats();
                      if (stats.breakdown) {
                        return `Normal: ${formatCurrency(stats.breakdown.oneTime)} + Recurrent: ${formatCurrency(stats.breakdown.recurring)}`;
                      }
                      return `${stats.count} gasto${stats.count !== 1 ? 's' : ''} total${stats.count !== 1 ? 'es' : ''}`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Gastos Únicos */}
              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-xl shadow-soft overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
                onClick={() => setShowOneTimeExpensesModal(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-lg border border-emerald-500/20">
                      <Calendar className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Gastos Únicos</h3>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                    {formatCurrency(getOneTimeExpensesStats().total)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getOneTimeExpensesStats().count} gasto{getOneTimeExpensesStats().count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Gastos Recurrentes */}
              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-xl shadow-soft overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
                onClick={() => setShowRecurringExpensesModal(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-brand-500/20 to-red-600/20 rounded-lg border border-brand-400/20">
                      <Repeat className="w-5 h-5 text-brand-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Gastos Recurrentes</h3>
                  </div>
                  {(() => { const stats = getRecurringExpensesStats(); return (
                    <>
                      <p className="text-2xl sm:text-3xl font-bold text-brand-300">
                        {formatCurrency(stats.total)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-brand-400/20 border border-brand-400/30 text-[10px] text-brand-200">
                          {formatCurrency(stats.monthlyTotal)}/mes
                        </span>
                        <span>{stats.count} activo{stats.count !== 1 ? 's' : ''}</span>
                        {String(stats.calculation || '').startsWith('general') && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] text-blue-300">
                            prorrateado del período
                          </span>
                        )}
                      </p>
                    </>
                  ); })()}
                </div>
              </div>

              {/* Nuevo Gasto */}
              <div 
                className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-xl shadow-amber-500/20 overflow-hidden cursor-pointer hover:scale-[1.02] hover:border-white/20 transition-all duration-300"
                onClick={() => {
                  handleCreateExpense();
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-r from-amber-600/20 to-amber-700/20 rounded-lg border border-amber-500/20">
                      <Plus className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">Nuevo Gasto</h3>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-400">
                    Crear
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Click para agregar</p>
                </div>
              </div>
            </div>

            {/* Lista de gastos recientes - estilo simplificado */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white">Gastos Recientes</h3>
                    <p className="text-[11px] sm:text-xs text-gray-500">Últimos movimientos del período</p>
                  </div>
                </div>
                {(financialData?.expenses?.length || 0) > 0 && (
                  <span className="text-xs sm:text-sm text-gray-400">
                    {financialData?.expenses?.length || 0} gasto{(financialData?.expenses?.length || 0) !== 1 ? 's' : ''} registrado{(financialData?.expenses?.length || 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {expensesLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-white/5 border border-white/10 rounded-xl p-4 h-16"></div>
                  ))
                ) : (financialData?.expenses?.length || 0) === 0 ? (
                  <div className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden text-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                    
                    <div className="relative">
                      <TrendingDown className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-2">No hay gastos en este período</p>
                      <p className="text-sm text-gray-500">Los gastos aparecerán aquí una vez registrados</p>
                    </div>
                  </div>
                ) : (
                  (financialData?.expenses || []).slice(0, 10).map((expense) => (
                    <div
                      key={expense._id}
                      className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 overflow-hidden"
                    >
                      <div className="relative flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <h4 className="font-medium text-white text-sm truncate">{expense.description}</h4>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-gray-300 border border-white/[0.08] flex-shrink-0">
                              {getCategoryLabel(expense.category)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(expense.date)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5" />
                              {getPaymentMethodLabel(expense.paymentMethod)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-semibold text-red-400 text-sm sm:text-base tabular-nums">
                            {formatCurrency(expense.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {(financialData?.expenses?.length || 0) > 10 && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Mostrando los 10 gastos más recientes de {financialData?.expenses?.length || 0} total
                  </p>
                </div>
              )}
            </div>


          </div>
        );

      case 'analysis':
        return (
          <div className="space-y-8">
            {/* KPIs Principales Simplificados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/[0.03] border border-white/[0.12] rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">Margen Bruto</span>
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /></span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                  {safeBasicMetrics.totalRevenue > 0 ? (((safeBasicMetrics.totalRevenue - safeBasicMetrics.totalExpenses) / safeBasicMetrics.totalRevenue) * 100).toFixed(1) + '%' : '0%'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">{safeBasicMetrics.totalRevenue > safeBasicMetrics.totalExpenses ? 'Rentable' : 'En pérdidas'}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.12] rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">Ratio Gastos</span>
                  <span className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20"><BarChart3 className="w-3.5 h-3.5 text-brand-300" /></span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-brand-300">{safeBasicMetrics.totalRevenue > 0 ? ((safeBasicMetrics.totalExpenses / safeBasicMetrics.totalRevenue) * 100).toFixed(1) + '%' : '0%'}</p>
                <p className="text-[10px] text-gray-500 mt-1">% sobre ingresos</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.12] rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">Gasto Diario</span>
                  <span className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20"><Calendar className="w-3.5 h-3.5 text-red-400" /></span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-400">
                  {(() => {
                    // CÁLCULO CORRECTO: Considerar gastos recurrentes por su frecuencia real
                    const calculation = calculateCorrectDailyExpenses(
                      financialData?.expenses || [], 
                      sanitizedRecurringExpenses || [], 
                      dateRange.startDate, 
                      dateRange.endDate
                    );
                    return formatCurrency(calculation.dailyRate);
                  })()}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Promedio periodo</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.12] rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">Gasto Top</span>
                  <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"><PieChart className="w-3.5 h-3.5 text-amber-400" /></span>
                </div>
                <p className="text-base sm:text-lg font-bold text-amber-400 truncate" title={categoryChartData[0]?.label || 'N/A'}>{categoryChartData[0]?.label || 'N/A'}</p>
                <p className="text-[10px] text-gray-500 mt-1">Principal categoría</p>
              </div>
            </div>

            {/* Gráficos de Barras */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Categorías de gastos (vertical) */}
              <div className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20"><PieChart className="w-3.5 h-3.5 text-red-400" /></span>
                      <h3 className="text-sm font-semibold text-white">Gastos por Categoría</h3>
                    </div>
                    <span className="text-[10px] text-gray-500">Top 10</span>
                  </div>
                  <VerticalBarChart data={categoryChartData} currency barColorClass="from-red-500 to-amber-500" />
                </div>
              </div>
              
              {/* Métodos de pago (ingresos) */}
              <div className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20"><CreditCard className="w-3.5 h-3.5 text-blue-400" /></span>
                      <h3 className="text-sm font-semibold text-white">Ingresos por Método de Pago</h3>
                    </div>
                    <span className="text-[10px] text-gray-500">Total</span>
                  </div>
                  <VerticalBarChart data={paymentMethodChartData} currency barColorClass="from-blue-500 to-blue-500" />
                </div>
              </div>
            </div>

            {/* Semana actual y tipos de ingreso */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0"><Calendar className="w-3.5 h-3.5 text-emerald-400" /></span>
                      <h3 className="text-sm font-semibold text-white">Ventas Semana Actual (Lun-Dom)</h3>
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500">Total {formatCurrency(weeklyTotals.total)} | Prom {formatCurrency(weeklyTotals.avg)}</div>
                  </div>
                  <VerticalBarChart data={weeklyRevenueData} currency barColorClass="from-emerald-500 to-emerald-500" />
                </div>
              </div>
              
              <div className="group relative bg-white/[0.03] border border-white/[0.12] rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-soft overflow-hidden flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20"><Layers className="w-3.5 h-3.5 text-brand-300" /></span>
                    <h3 className="text-sm font-semibold text-white">Ingresos por Tipo</h3>
                  </div>
                  <MiniVerticalBarChart data={revenueTypeChartData} barColorClass="from-brand-400 to-red-500" />
                  <div className="mt-4 space-y-1 text-[11px] text-gray-400">
                    {revenueTypeChartData.map(r => (
                      <div key={r.key} className="flex justify-between">
                        <span className="text-gray-300">{r.label}</span>
                        <span className="text-gray-400">{formatCurrency(r.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recomendaciones rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-xs">
                <p className="text-emerald-300 font-medium mb-1">Margen</p>
                <p className="text-gray-300">{safeBasicMetrics.totalRevenue > 0 ? (((safeBasicMetrics.totalRevenue - safeBasicMetrics.totalExpenses) / safeBasicMetrics.totalRevenue) * 100).toFixed(1) : '0'}% actual. {safeBasicMetrics.totalRevenue > safeBasicMetrics.totalExpenses ? 'Mantén control de gastos.' : 'Ajustar gastos o aumentar ingresos.'}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-xs">
                <p className="text-blue-300 font-medium mb-1">Concentración</p>
                <p className="text-gray-300">Top método pago: {paymentMethodChartData[0]?.label || 'N/A'} ({paymentMethodChartData[0]?.value ? ((paymentMethodChartData[0].value / (financialData?.summary?.totalRevenue || 1)) * 100).toFixed(1) : 0}%)</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-xs">
                <p className="text-amber-300 font-medium mb-1">Proyección</p>
                <p className="text-gray-300">Gasto mensual estimado: {(() => {
                  // CÁLCULO CORRECTO: Proyección mensual basada en frecuencias reales
                  const calculation = calculateCorrectDailyExpenses(
                    financialData?.expenses || [], 
                    sanitizedRecurringExpenses || [], 
                    dateRange.startDate, 
                    dateRange.endDate
                  );
                  return formatCurrency(calculation.monthlyProjection);
                })()}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Etiqueta legible del período activo para el subtítulo de la página
  const periodLabel = (() => {
    const r = dateRange;
    const fmt = (d) => new Date(d).toLocaleDateString('es-CO');
    if (!r?.startDate) return 'Todos los registros';
    if (r.preset === 'all' || r.preset === 'allData') {
      return `Todos los registros · ${fmt(r.startDate)} - ${fmt(r.endDate || r.startDate)}`;
    }
    if (r.preset === 'year') {
      return `Último año · ${fmt(r.startDate)} - ${fmt(r.endDate || r.startDate)}`;
    }
    return `${fmt(r.startDate)} - ${fmt(r.endDate || r.startDate)}`;
  })();

  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-8">
        {/* ── Top bar: título + filtros ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Título */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Control Financiero</h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                {periodLabel} · Resumen, gastos y análisis
              </p>
            </div>
          </div>

          {/* Filtros de fecha (a la derecha, fluidos) */}
          <div className="flex-1 min-w-0">
            <SimpleDateFilter
              className="w-full lg:max-w-3xl lg:ml-auto"
              fluid
              dateRange={uiDateRange}
              onPresetChange={handleLegacyPreset}
              onCustomDateChange={(start, end) => handleLegacyCustomRange({ startDate: start, endDate: end })}
              loading={financialLoading}
            />
          </div>
        </div>

        {/* Tabs alineados a la izquierda */}
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-soft w-full sm:w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`group relative px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all duration-300 overflow-hidden flex items-center justify-center gap-1.5 ${
                activeTab === id
                  ? 'border-blue-500/50 bg-blue-500/10 shadow-soft'
                  : 'border-transparent hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <Icon size={14} className={`transition-all duration-300 ${
                activeTab === id ? 'text-blue-300' : 'text-gray-300'
              }`} />
              <span className={`font-medium text-xs whitespace-nowrap ${
                activeTab === id ? 'text-blue-300' : 'text-gray-200'
              }`}>{label}</span>
            </button>
          ))}
        </div>

        {/* Errores */}
        {/* Muestra el primer error disponible (reportes financieros o gastos) */}
        {(financialError || expensesError) && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm">
            {financialError || expensesError}
          </div>
        )}

        {/* Contenido de la tab activa */}
        {/* Skeleton en la primera carga; después renderiza el tab seleccionado */}
        {financialLoading && !financialData?.summary ? <ReportsSkeleton /> : renderTabContent()}

        {/* Modales de gastos */}
        <ExpenseTypeSelector
          isOpen={showExpenseTypeSelector}
          onClose={closeExpenseModals}
          onSelectType={handleExpenseTypeSelect}
        />

        <OneTimeExpenseModal
          isOpen={showOneTimeExpenseModal}
          onClose={closeExpenseModals}
          expense={editingExpense}
          expenseCategories={safeExpenseCategories}
          paymentMethods={safePaymentMethods}
          onSave={handleSaveExpense}
          loading={expensesLoading}
        />

        <RecurringExpenseModal
          isOpen={showRecurringExpenseModal}
          onClose={closeExpenseModals}
          expense={editingExpense}
          // Pasamos categorías/métodos tal cual; el modal ya tiene fallback internos
          expenseCategories={safeExpenseCategories}
          paymentMethods={safePaymentMethods}
          frequencies={frequencies}
          onSave={handleSaveExpense}
          loading={expensesLoading}
        />

        {/* Modal de gastos (mantener por compatibilidad) */}
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          expense={editingExpense}
          expenseCategories={safeExpenseCategories}
          paymentMethods={safePaymentMethods}
          frequencies={frequencies}
          onSave={handleSaveExpense}
          loading={expensesLoading}
        />

        {/* Modal de desglose por medios de pago */}
        <PaymentMethodsModal
          isOpen={showPaymentMethodsModal}
          onClose={() => setShowPaymentMethodsModal(false)}
          data={financialData}
          formatCurrency={formatCurrency}
          dateRange={dateRange}
        />

        {/* Modal de desglose de gastos */}
        <ExpensesBreakdownModal
          isOpen={showExpensesBreakdownModal}
          onClose={() => setShowExpensesBreakdownModal(false)}
          data={financialData}
          expenses={financialData?.expenses || []}
          recurringExpenses={recurringExpenses}
          formatCurrency={formatCurrency}
          dateRange={dateRange}
          expenseCategories={safeExpenseCategories}
          paymentMethods={safePaymentMethods}
        />

        {/* Modal de desglose de ingresos */}
        <RevenueBreakdownModal
          isOpen={showRevenueBreakdownModal}
          onClose={() => setShowRevenueBreakdownModal(false)}
          revenueData={financialData}
          dateRange={dateRange}
          formatCurrency={formatCurrency}
        />

        {/* Modal de tipos de ingresos */}
        <RevenueTypesModal
          isOpen={showRevenueTypesModal}
          onClose={() => setShowRevenueTypesModal(false)}
          revenueData={financialData?.revenueBreakdown}
          dateRange={dateRange}
          formatCurrency={formatCurrency}
        />

        {/* Modal de desglose de efectivo */}
        <CashBreakdownModal
          isOpen={showCashBreakdownModal}
          onClose={() => setShowCashBreakdownModal(false)}
          revenueData={financialData}
          dashboardData={financialData}
          dateRange={dateRange}
          formatCurrency={formatCurrency}
        />

        {/* Modal de desglose de pagos digitales */}
        <DigitalPaymentsBreakdownModal
          isOpen={showDigitalPaymentsModal}
          onClose={() => setShowDigitalPaymentsModal(false)}
          revenueData={financialData}
          dashboardData={financialData}
          dateRange={dateRange}
          formatCurrency={formatCurrency}
        />

        {/* Modal de productos vendidos */}
        <ProductsSoldModal
          isOpen={showProductsSoldModal}
          onClose={() => setShowProductsSoldModal(false)}
          dateRange={dateRange}
          dashboardData={financialData}
          formatCurrency={formatCurrency}
        />

        {/* Modal de servicios vendidos */}
        <ServicesBreakdownModal
          isOpen={showServicesBreakdownModal}
          onClose={() => setShowServicesBreakdownModal(false)}
          revenueData={financialData}
          dashboardData={financialData}
          dateRange={dateRange}
          formatCurrency={formatCurrency}
        />

        {/* Modal de citas completadas */}
        <AppointmentsBreakdownModal
          isOpen={showAppointmentsModal}
          onClose={() => setShowAppointmentsModal(false)}
          revenueData={financialData}
          dashboardData={financialData}
          dateRange={dateRange}
          formatCurrency={formatCurrency}
        />

        {/* Nuevos modales para listas de gastos por tipo */}
        <OneTimeExpensesListModal
          isOpen={showOneTimeExpensesModal}
          onClose={() => setShowOneTimeExpensesModal(false)}
          expenses={financialData?.expenses || []}
          formatCurrency={formatCurrency}
          dateRange={dateRange}
          onEdit={handleEditExpense}
          onDelete={handleDeleteExpense}
        />

        <RecurringExpensesListModal
          isOpen={showRecurringExpensesModal}
          onClose={() => setShowRecurringExpensesModal(false)}
          recurringExpenses={sanitizedRecurringExpenses}
          inferredRecurringTotal={effectiveInferredRecurringTotal}
          formatCurrency={formatCurrency}
          dateRange={dateRange}
          onEdit={handleEditExpense}
          onDelete={handleDeleteExpense}
          onToggle={handleToggleRecurring}
          onRefresh={refreshData}
        />

        {/* Modal de confirmación de eliminación */}
        <DeleteExpenseModal
          isOpen={showDeleteExpenseModal}
          onClose={handleCloseDeleteModal}
          expense={expenseToDelete}
          onDelete={handleConfirmDeleteExpense}
          isLoading={deleteLoading}
        />
      </div>
    </PageContainer>
  );
};

export default Reports;

// Utilidad local para formatear fechas si no viene de otro hook
// Devuelve la fecha en formato yyyy-MM-dd o cadena vacía si es inválida
const formatDate = (d) => {
  if (!d) return '';
  try {
    const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return '';
    return format(dateObj, 'yyyy-MM-dd');
  } catch (e) {
    return '';
  }
};
