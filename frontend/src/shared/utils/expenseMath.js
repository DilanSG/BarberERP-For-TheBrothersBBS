import { differenceInCalendarMonths } from 'date-fns';
import { calculator as RecurringExpenseCalculator } from '../recurring-expenses';

// Cálculos financieros canónicos (fuente única de verdad).
// Usado por useFinancialReports (cards/dashboard) y Reports.jsx para que
// los totales de las cards y de los modales coincidan siempre.

// Un gasto recurrente está activo (soporta múltiples shapes del backend)
export const isRecurringActive = (exp) =>
  exp?._isActive !== undefined
    ? exp._isActive
    : (exp?.recurrence?.isActive ?? exp?.recurringConfig?.isActive ?? exp?.isActive ?? true);

// Suma de gastos únicos (type: 'one-time')
export const getOneTimeTotals = (expenses = []) => {
  const oneTime = expenses.filter((e) => e.type === 'one-time');
  return {
    count: oneTime.length,
    total: oneTime.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  };
};

// Suma mensual de gastos recurrentes activos (sin prorrateo)
export const getMonthlyRecurringTotal = (recurringExpenses = []) => {
  const active = recurringExpenses.filter(isRecurringActive);
  const total = active.reduce((sum, exp) => {
    try {
      return sum + RecurringExpenseCalculator.calculateMonthlyAmount(exp);
    } catch {
      return sum;
    }
  }, 0);
  return { count: active.length, monthlyTotal: total };
};

// Total de recurrentes para el período filtrado.
// Estrategia de prorrateo:
// a) Rango específico (día/semana/mes): (monto mensual / 30) × días del período.
// b) Filtro general con >30 días de datos: monto mensual × meses transcurridos
// desde el dato más antiguo; si no hay fecha, estima meses = ceil(días/15).
// c) Con pocos datos (<30 días): se cuenta un solo mes completo.
export const getRecurringTotalForPeriod = ({ monthlyTotal, dateRange, daysWithData = 0, oldestDataDate = null }) => {
  if (!monthlyTotal) return { total: 0, calculation: 'none' };

  const isGeneralFilter =
    !dateRange?.preset || dateRange.preset === 'all' || dateRange.preset === 'allData';

  if (!isGeneralFilter && dateRange?.startDate) {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate || dateRange.startDate);
    const daysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const dailyPortion = monthlyTotal / 30;
    return {
      total: dailyPortion * daysInPeriod,
      calculation: `period-${daysInPeriod}days`,
      daysInPeriod,
      dailyPortion,
    };
  }

  if (daysWithData > 30) {
    let monthsUsed = Math.max(1, Math.ceil(daysWithData / 15));
    if (oldestDataDate) {
      const diff = differenceInCalendarMonths(new Date(), new Date(oldestDataDate));
      monthsUsed = Math.max(1, diff);
    }
    return { total: monthlyTotal * monthsUsed, calculation: `general-${monthsUsed}months`, monthsUsed };
  }

  return { total: monthlyTotal, calculation: 'monthly-specific' };
};

// Totales de gastos unificados: únicos + recurrentes del período.
// Devuelve { oneTime: {count,total}, recurring: {count,total,monthlyTotal,calculation},
// total: {count,total} }. Esta es la fuente única para cards y modales.
export const getExpenseTotals = ({
  expenses = [],
  recurringExpenses = [],
  dateRange = null,
  daysWithData = 0,
  oldestDataDate = null,
}) => {
  const oneTime = getOneTimeTotals(expenses);
  const { count: recurringCount, monthlyTotal } = getMonthlyRecurringTotal(recurringExpenses);
  const recurringPeriod = getRecurringTotalForPeriod({ monthlyTotal, dateRange, daysWithData, oldestDataDate });

  return {
    oneTime,
    recurring: {
      count: recurringCount,
      total: recurringPeriod.total,
      monthlyTotal,
      calculation: recurringPeriod.calculation,
    },
    total: {
      count: oneTime.count + recurringCount,
      total: oneTime.total + recurringPeriod.total,
    },
  };
};
