// Hook de reportes financieros: combina ingresos (ventas/citas) y gastos
// (únicos + recurrentes prorrateados) para alimentar el dashboard y sus cards.
// Las peticiones se apoyan en la caché de api.js (TTL 5 min) y los cálculos
// derivados se memoizan en `calculations`.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { getCurrentDateColombia, getYesterdayDateColombia } from '../utils/dateUtils';
import { getExpenseTotals } from '../utils/expenseMath';

// Hook personalizado para gestionar reportes financieros con caché y agregaciones.
// Maneja ingresos de servicios, productos, citas, gastos y filtros de fecha.
//
// Características:
// - Seguimiento de ingresos y gastos con cálculos automáticos
// - Prorrateo de gastos recurrentes según filtros de fecha
// - Caché del lado del cliente con TTL de 5 minutos
// - Presets de rangos de fecha y filtrado personalizado
// - Métricas financieras y cálculos en tiempo real
//
// @returns {Object} Datos financieros, estado de carga, cálculos y funciones de control
export const useFinancialReports = () => {
  // Gestión de estado para datos financieros
  const [data, setData] = useState({
    summary: {
      totalRevenue: 0,
      totalServices: 0,
      totalProducts: 0,
      productSalesCount: 0,
      serviceSalesCount: 0,
      productRevenue: 0,
      serviceRevenue: 0,
      appointmentRevenue: 0,
      totalAppointments: 0,
      totalExpenses: 0,
      netProfit: 0,
      paymentMethods: {}
    },
    dailyData: [],
    serviceBreakdown: [],
    productBreakdown: [],
    paymentMethodBreakdown: [],
    availableDates: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estado inicial = "Último año" (General queda disponible pero no es el preset inicial)
  const [dateRange, setDateRange] = useState(() => {
    const yearAgoDate = new Date();
    yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
    return {
      startDate: yearAgoDate.toISOString().split('T')[0],
      endDate: getCurrentDateColombia(),
      preset: 'year'
    };
  });

  // Presets de rango de fechas usando zona horaria de Colombia
  const datePresets = useMemo(() => {
    const todayDate = new Date();
    const today = getCurrentDateColombia();
    const yesterday = getYesterdayDateColombia();
    
    // Calcular rangos de fechas comunes
    const weekAgoDate = new Date(todayDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgoDate = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgoDate = new Date(todayDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const weekAgo = weekAgoDate.toISOString().split('T')[0];
    const monthAgo = monthAgoDate.toISOString().split('T')[0];
    const threeMonthsAgo = threeMonthsAgoDate.toISOString().split('T')[0];
    const yearAgoDate = new Date();
    yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
    const yearAgo = yearAgoDate.toISOString().split('T')[0];

    return {
      year: {
        label: 'Último año',
        startDate: yearAgo,
        endDate: today
      },
      allData: {
        label: 'Todos los datos', 
        startDate: '2020-01-01',
        endDate: today
      },
      today: {
        label: 'Hoy',
        startDate: today,
        endDate: today
      },
      yesterday: {
        label: 'Ayer',
        startDate: yesterday,
        endDate: yesterday
      },
      last7days: {
        label: 'Últimos 7 días',
        startDate: weekAgo,
        endDate: today
      },
      last30days: {
        label: 'Últimos 30 días',
        startDate: monthAgo,
        endDate: today
      },
      last90days: {
        label: 'Últimos 90 días',
        startDate: threeMonthsAgo,
        endDate: today
      },
      thisMonth: {
        label: 'Este mes',
        startDate: new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().split('T')[0],
        endDate: today
      },
      lastMonth: {
        label: 'Mes pasado',
        startDate: new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1).toISOString().split('T')[0],
        endDate: new Date(todayDate.getFullYear(), todayDate.getMonth(), 0).toISOString().split('T')[0]
      },
      thisYear: {
        label: 'Este año',
        startDate: new Date(todayDate.getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: today
      },
      lastYear: {
        label: 'Año pasado',
        startDate: new Date(todayDate.getFullYear() - 1, 0, 1).toISOString().split('T')[0],
        endDate: new Date(todayDate.getFullYear() - 1, 11, 31).toISOString().split('T')[0]
      }
    };
  }, []);

  // Carga los 4 endpoints financieros en paralelo y construye `data`.
  // forceRefresh=true ignora la caché; por defecto cada GET cachea 5 min.
  // Los gastos se calculan con getExpenseTotals (lógica canónica compartida)
  // y netProfit = ingresos totales − gastos del período.
  const loadFinancialData = useCallback(async (startDate, endDate, forceRefresh = false) => {
    // La caché (TTL + stale-while-revalidate) vive en api.js; aquí no se duplica
    const cacheOpts = forceRefresh ? { useCache: false } : { cacheTTL: 5 * 60 * 1000 };

    try {
      setLoading(true);
      setError(null);

      // Peticiones API paralelas para rendimiento óptimo
      const [revenueResponse, expensesResponse, recurringExpensesResponse, expensesListResponse] = await Promise.all([
        api.get('/sales/financial-summary', { params: { startDate, endDate }, ...cacheOpts }),
        api.get('/expenses/summary', { params: { startDate, endDate }, ...cacheOpts }),
        api.get('/expenses/recurring', cacheOpts),
        api.get('/expenses', { params: { startDate, endDate }, ...cacheOpts })
      ]);

      // Normalizar estructura de respuesta de ingresos
      const revenueData = revenueResponse.data?.data || revenueResponse.data;
      
      // Normalizar respuesta de lista de gastos
      const rawExpensesList = expensesListResponse?.data;
      const expensesList = Array.isArray(rawExpensesList)
        ? rawExpensesList
        : (Array.isArray(rawExpensesList?.data) ? rawExpensesList.data : []);

      // Normalizar respuesta de resumen de gastos
      const rawExpensesPayload = expensesResponse.data;
      const expenseSummary = rawExpensesPayload?.data || rawExpensesPayload?.summary || rawExpensesPayload || {};
      const expensesData = { summary: expenseSummary };

      // Normalizar respuesta de gastos recurrentes
      const rawRecurring = recurringExpensesResponse.data;
      const recurringExpensesData = Array.isArray(rawRecurring)
        ? rawRecurring
        : (Array.isArray(rawRecurring?.data) ? rawRecurring.data : []);

      // Gastos: cálculo canónico compartido (misma lógica que las cards de Reports)
      const totalRevenue = revenueData?.totalRevenue || revenueData?.summary?.totalRevenue || 0;
      const daysWithData = revenueData?.daysWithData || revenueData.summary?.daysWithData || 0;
      const oldestDataDate = revenueData?.summary?.oldestDataDate || revenueData?.oldestDataDate || null;
      const expenseTotals = getExpenseTotals({
        expenses: expensesList,
        recurringExpenses: recurringExpensesData,
        dateRange,
        daysWithData,
        oldestDataDate,
      });

      // Construir estructura de datos procesada con valores calculados
      const processedData = {
        summary: {
          totalRevenue: revenueData?.totalRevenue || revenueData.summary?.totalRevenue || 0,
          totalServices: revenueData?.totalServices || revenueData.summary?.totalServices || 0,
          totalProducts: revenueData?.totalProducts || revenueData.summary?.totalProducts || 0,
          productSalesCount: revenueData?.totalProducts || revenueData.summary?.totalProducts || 0,
          serviceSalesCount: revenueData?.totalServices || revenueData.summary?.totalServices || 0,
          productRevenue: revenueData?.productRevenue || revenueData.summary?.productRevenue || 0,
          serviceRevenue: revenueData?.serviceRevenue || revenueData.summary?.serviceRevenue || 0,
          appointmentRevenue: revenueData?.appointmentRevenue || revenueData.summary?.appointmentRevenue || 0,
          totalAppointments: revenueData?.totalAppointments || revenueData.summary?.totalAppointments || 0,
          // Gastos calculados con la lógica canónica (fuente única)
          totalExpenses: expenseTotals.total.total,
          netProfit: totalRevenue - expenseTotals.total.total,
          oneTimeExpensesTotal: expenseTotals.oneTime.total,
          oneTimeExpensesCount: expenseTotals.oneTime.count,
          recurringExpensesTotal: expenseTotals.recurring.total,
          recurringExpensesMonthly: expenseTotals.recurring.monthlyTotal,
          recurringExpensesCount: expenseTotals.recurring.count,
          recurringCalculation: expenseTotals.recurring.calculation,
          // Datos temporales para cálculos proporcionales
          daysWithData,
          oldestDataDate: revenueData?.oldestDataDate || revenueData.summary?.oldestDataDate || null,
          paymentMethods: revenueData?.paymentMethods || revenueData.summary?.paymentMethods || {},
          suppliesCosts: revenueData.summary?.suppliesCosts || 0,
          // Campos legacy para retrocompatibilidad con componentes existentes
          recurringExpenses: 0,
          originalExpenses: expensesData.summary?.totalExpenses || 0
        },
        dailyData: revenueData.dailyData || [],
        serviceBreakdown: revenueData.serviceBreakdown || [],
        productBreakdown: revenueData.productBreakdown || [],
        paymentMethodBreakdown: revenueData.paymentMethodBreakdown || [],
        expenseBreakdown: expenseSummary?.categoryBreakdown || expensesData.breakdown || [],
        expenses: expensesList,
        recurringExpenses: recurringExpensesData,
        originalExpensesTotal: expensesData.summary?.totalExpenses || 0,
        availableDates: revenueData.dailyData ? 
          [...new Set(revenueData.dailyData.map(day => day.date))].sort() : 
          [],
        // Desglose de ingresos para modales
        revenueBreakdown: {
          totalRevenue,
          byType: {
            products: revenueData.summary?.productRevenue || 0,
            services: revenueData.summary?.serviceRevenue || 0,
            appointments: revenueData.summary?.appointmentRevenue || 0
          },
          byPaymentMethod: revenueData.summary?.paymentMethods || {},
          topProduct: revenueData.analytics?.topProduct || 'N/A',
          topService: revenueData.analytics?.topService || 'N/A',
          preferredPayment: revenueData.analytics?.preferredPayment || 'N/A',
          averagePerSale: revenueData.analytics?.averagePerSale || 0
        }
      };

      setData(processedData);
      return processedData;
    } catch (error) {
      console.error('Error loading financial data:', error);
      setError('Error al cargar los datos financieros');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Cambiar rango de fechas por preset (acepta el alias legacy 'all' → 'allData');
  // 'custom' se ignora porque lo gestiona setCustomDateRange.
  const setDateRangePreset = useCallback((preset) => {
    // Mapear alias legacy a nombres de preset actuales
    const aliasMap = {
      all: 'allData'
    };
    const effective = aliasMap[preset] || preset;

    if (effective === 'custom') {
      return;
    }

    if (datePresets[effective]) {
      const newRange = {
        ...datePresets[effective],
        preset: effective
      };
      setDateRange(newRange);
    }
  }, [datePresets]);

  // Establecer rango de fechas personalizado
  const setCustomDateRange = useCallback((startDate, endDate) => {
    setDateRange({
      startDate,
      endDate,
      preset: 'custom'
    });
  }, []);

  // Forzar recarga ignorando la caché (botón "Actualizar")
  const refreshData = useCallback(() => {
    return loadFinancialData(dateRange.startDate, dateRange.endDate, true);
  }, [dateRange.startDate, dateRange.endDate, loadFinancialData]);

  // Recarga automática cuando cambia el rango de fechas
  useEffect(() => {
    loadFinancialData(dateRange.startDate, dateRange.endDate);
  }, [dateRange.startDate, dateRange.endDate, loadFinancialData]);

  // Nota: la limpieza de caché la gestiona api.js (memoria + Cache API con TTL);
  // este hook ya no mantiene una caché propia.

  // Cálculos financieros derivados del resumen (memoizados por `data`).
  // Porcentajes → string con 1 decimal; ratios → string con 2 decimales, o '∞'
  // cuando hay ingresos pero aún no hay gastos registrados.
  const calculations = useMemo(() => {
    const { summary } = data;
    
    // Extraer valores de ingresos del resumen
    const serviceRevenue = summary.serviceRevenue || 0;
    const productRevenue = summary.productRevenue || 0;
    const appointmentRevenue = summary.appointmentRevenue || 0;
    
    return {
      // Porcentaje de margen de ganancia
      profitMargin: summary.totalRevenue > 0 ? 
        ((summary.netProfit / summary.totalRevenue) * 100).toFixed(1) : '0.0',
      
      // Valor promedio por cita
      averageServiceValue: summary.totalAppointments > 0 ? 
        (appointmentRevenue / summary.totalAppointments) : 0,
      
      // Porcentajes de distribución de ingresos
      servicesPercentage: summary.totalRevenue > 0 ?
        ((serviceRevenue / summary.totalRevenue) * 100).toFixed(1) : '0.0',
      productsPercentage: summary.totalRevenue > 0 ?
        ((productRevenue / summary.totalRevenue) * 100).toFixed(1) : '0.0',
      appointmentsPercentage: summary.totalRevenue > 0 ?
        ((appointmentRevenue / summary.totalRevenue) * 100).toFixed(1) : '0.0',
      
      // Valores absolutos de ingresos
      serviceRevenue,
      productRevenue,
      appointmentRevenue,
      totalExpenses: summary.totalExpenses || 0,
      
      // Contadores de transacciones
      serviceSalesCount: summary.serviceSalesCount || 0,
      productSalesCount: summary.productSalesCount || 0,
      
      // Margen bruto (ingresos - costos directos)
      grossMargin: (() => {
        const totalRevenue = summary.totalRevenue || 0;
        const directCosts = summary.suppliesCosts || 0;
        
        if (totalRevenue > 0) {
          const grossMarginAmount = totalRevenue - directCosts;
          return ((grossMarginAmount / totalRevenue) * 100).toFixed(1);
        }
        
        return '0.0';
      })(),
      
      grossMarginAmount: (() => {
        const totalRevenue = summary.totalRevenue || 0;
        const directCosts = summary.suppliesCosts || 0;
        return totalRevenue - directCosts;
      })(),
      
      // Eficiencia operacional (ingresos por cada peso gastado)
      operationalEfficiency: (() => {
        const totalRevenue = summary.totalRevenue || 0;
        const totalExpenses = summary.totalExpenses || 0;
        
        if (totalExpenses > 0) {
          return (totalRevenue / totalExpenses).toFixed(2);
        }
        
        return totalRevenue > 0 ? '∞' : '0.00';
      })(),
      
      // Retorno sobre inversión
      returnOnInvestment: (() => {
        const totalRevenue = summary.totalRevenue || 0;
        const totalExpenses = summary.totalExpenses || 0;
        
        if (totalExpenses > 0) {
          return (totalRevenue / totalExpenses).toFixed(2);
        }
        
        return totalRevenue > 0 ? '∞' : '0.00';
      })(),
      
      // Distribución por método de pago
      cashPercentage: (() => {
        const paymentMethods = summary.paymentMethods || {};
        const cashMethods = ['cash', 'efectivo', 'contado'];
        const totalCash = cashMethods.reduce((total, method) => total + (paymentMethods[method] || 0), 0);
        return summary.totalRevenue > 0 ? ((totalCash / summary.totalRevenue) * 100).toFixed(1) : '0.0';
      })(),
      
      digitalPercentage: (() => {
        const paymentMethods = summary.paymentMethods || {};
        const digitalMethods = ['nequi', 'daviplata', 'bancolombia', 'nu', 'debit', 'credit', 'tarjeta'];
        const totalDigital = digitalMethods.reduce((total, method) => total + (paymentMethods[method] || 0), 0);
        return summary.totalRevenue > 0 ? ((totalDigital / summary.totalRevenue) * 100).toFixed(1) : '0.0';
      })(),
      
      // Ratios de liquidez y eficiencia
      liquidityRatio: summary.totalExpenses > 0 ? 
        (summary.totalRevenue / summary.totalExpenses).toFixed(2) : '0.00',
      
      averageTransactionValue: (summary.serviceSalesCount + summary.productSalesCount + summary.totalAppointments) > 0 ?
        (summary.totalRevenue / (summary.serviceSalesCount + summary.productSalesCount + summary.totalAppointments)) : 0,
      
      // Eficiencia (compatibilidad legacy)
      revenuePerExpenseDollar: (() => {
        const totalRevenue = summary.totalRevenue || 0;
        const totalExpenses = summary.totalExpenses || 0;
        
        if (totalExpenses > 0) {
          return (totalRevenue / totalExpenses).toFixed(2);
        }
        
        return totalRevenue > 0 ? '∞' : '0.00';
      })(),
      
      // Ratio de gastos (gastos como porcentaje de ingresos)
      expenseRatio: (() => {
        const totalRevenue = summary.totalRevenue || 0;
        const totalExpenses = summary.totalExpenses || 0;
        return totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : '0.0';
      })(),
      
      // Concentración de riesgo (mayor uso de método de pago)
      riskConcentration: (() => {
        const paymentMethods = summary.paymentMethods || {};
        const totalRevenue = summary.totalRevenue || 0;
        if (totalRevenue === 0) return '0.0';
        
        // Encontrar el método de pago más usado
        let maxAmount = 0;
        Object.values(paymentMethods).forEach(amount => {
          if (amount > maxAmount) maxAmount = amount;
        });
        
        return ((maxAmount / totalRevenue) * 100).toFixed(1);
      })()
    };
  }, [data]);

  return {
    // Datos principales
    data,
    loading,
    error,
    
    // Filtrado de fechas
    dateRange,
    datePresets,
    setDateRangePreset,
    setCustomDateRange,
    
    // Acciones
    refreshData,
    loadFinancialData,
    
    // Cálculos
    calculations,
    
    // Funciones de utilidad
    formatCurrency: (amount) => new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0),
    
    formatDate: (date) => new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  };
};

export default useFinancialReports;