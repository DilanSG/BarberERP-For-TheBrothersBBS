import { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Edit3, 
  Save, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Repeat
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useRecurringExpenses } from '../../../features/expenses/hooks/useRecurringExpenses';
import { calculator as RecurringExpenseCalculator } from '../../recurring-expenses';

// Modal para editar día a día el monto de un gasto recurrente en un mes concreto.
// Carga los ajustes del mes, permite editar/resetear días y guardar los cambios.
export const DailyRecurringExpenseModal = ({ 
  isOpen, 
  onClose, 
  expense,
  formatCurrency,
  onSave
}) => {
  // Acciones del hook de gastos recurrentes para leer y guardar ajustes diarios.
  const { updateDailyAdjustments, getDailyAdjustments, loading: apiLoading } = useRecurringExpenses();
  
  // Validación temprana - si no hay expense válido, no renderizar
  // Validación temprana: sin gasto válido no se renderiza nada.
  if (isOpen && !expense) {
    console.error('🚨 DailyRecurringExpenseModal: expense es requerido pero está vacío');
    return null;
  }
  
  // Mes visible, ajustes por día y estado de edición de una celda.
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dailyAdjustments, setDailyAdjustments] = useState({});
  const [editingDay, setEditingDay] = useState(null);
  const [tempAmount, setTempAmount] = useState('');
  const [loading, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // Nuevo flag

  // Cargar ajustes existentes cuando se abre el modal o cambia el mes
  // Al abrir el modal o cambiar de mes carga los ajustes guardados del mes.
  useEffect(() => {
    const loadDailyAdjustments = async () => {
      if (!isOpen || !expense?._id) return;
      
      try {
        const monthStr = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0');
        
        // No recargar si acabamos de guardar cambios para el mismo mes
        if (justSaved && expense.recurringConfig?.adjustmentsMonth === monthStr && 
            expense.recurringConfig?.dailyAdjustments) {
          console.log('📥 DailyModal: Usando ajustes del estado local (recién guardados)');
          setDailyAdjustments(expense.recurringConfig.dailyAdjustments);
          setJustSaved(false); // Reset del flag
          return;
        }
        
        console.log('📥 DailyModal: Cargando ajustes desde backend para mes:', monthStr);
        const result = await getDailyAdjustments(expense._id, monthStr);
        
        if (result?.adjustments) {
          console.log('📥 DailyModal: Cargando ajustes desde backend:', {
            result,
            adjustments: result.adjustments,
            adjustmentsKeys: Object.keys(result.adjustments)
          });
          setDailyAdjustments(result.adjustments);
        } else {
          console.log('📥 DailyModal: No hay ajustes para cargar');
          setDailyAdjustments({});
        }
      } catch (error) {
        console.error('Error loading daily adjustments:', error);
        setDailyAdjustments({});
      }
    };

    loadDailyAdjustments();
  }, [isOpen, expense?._id, expense?.recurringConfig?.adjustmentsMonth, currentMonth, getDailyAdjustments]);

  // Resetear al cerrar el modal
  // Al cerrar el modal limpia ajustes, edición y vuelve al mes actual.
  useEffect(() => {
    if (!isOpen) {
      setDailyAdjustments({});
      setEditingDay(null);
      setCurrentMonth(new Date());
      setJustSaved(false); // Reset del flag
    }
  }, [isOpen]);

  // Calcular el monto diario base del gasto recurrente usando el calculador
  // Monto diario base del gasto según su frecuencia.
  const calculateBaseDailyAmount = () => {
    if (!expense?.amount) return 0;
    return RecurringExpenseCalculator.calculateBaseDailyAmount(expense);
  };

  const baseDailyAmount = calculateBaseDailyAmount();

  // Obtener el monto para un día específico (base + ajuste)
  // Monto de un día concreto aplicando sus ajustes.
  const getDayAmount = (dateStr) => {
    // Validación defensiva - asegurar que expense existe
    if (!expense || !expense.amount) {
      return 0;
    }
    
    // Usar el calculador para obtener el monto diario con ajustes
    return RecurringExpenseCalculator.getDailyAdjustedAmount(expense, dateStr);
  };

  // Generar días del mes actual
  // Construye los días del mes visible con su monto, si es hoy o pasado y si tiene ajuste.
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      
      // Calcular isToday usando fecha local para evitar problemas de zona horaria
      const today = new Date();
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = date.getTime() === todayLocal.getTime();
      const isPast = date < new Date().setHours(0, 0, 0, 0);
      
      days.push({
        day,
        date,
        dateStr,
        isToday,
        isPast,
        amount: getDayAmount(dateStr),
        hasAdjustment: (() => {
          const dayOfMonth = day.toString().padStart(2, '0');
          const hasAdjust = dailyAdjustments[dayOfMonth] !== undefined;
          // Solo debug para días con ajuste real (no spam del día actual)
          if (hasAdjust) {
            console.log(`📅 Día ${day} (${dayOfMonth}): hasAdjustment=${hasAdjust}, adjustment=`, dailyAdjustments[dayOfMonth]);
          }
          return hasAdjust;
        })()
      });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  // Manejar cambio de mes
  // Avanza o retrocede un mes en el calendario.
  const changeMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  // Iniciar edición de un día
  // Activa la edición de un día con su monto actual.
  const startEditing = (dayData) => {
    setEditingDay(dayData.dateStr);
    setTempAmount(dayData.amount.toString());
  };

  // Guardar cambio de un día
  // Guarda el ajuste de un día como diferencia respecto al monto base.
  const saveDayChange = () => {
    if (editingDay && tempAmount !== '') {
      const newAmount = parseFloat(tempAmount);
      const adjustment = newAmount - baseDailyAmount;
      
      // CORREGIR: Extraer día directamente del dateStr para evitar problemas de zona horaria
      // editingDay formato: '2025-09-05' -> día = '05'
      const dayOfMonth = editingDay.split('-')[2]; // Extraer directamente el día
      
      console.log('💾 saveDayChange: Guardando cambio:', {
        editingDay,
        dayOfMonth,
        tempAmount,
        newAmount,
        baseDailyAmount,
        adjustment
      });
      
      setDailyAdjustments(prev => ({
        ...prev,
        [dayOfMonth]: { amount: adjustment }
      }));
    }
    
    setEditingDay(null);
    setTempAmount('');
  };

  // Cancelar edición
  // Cancela la edición del día sin aplicar cambios.
  const cancelEditing = () => {
    setEditingDay(null);
    setTempAmount('');
  };

  // Resetear un día a su valor base
  // Elimina el ajuste de un día para volver a su valor base.
  const resetDay = (dateStr) => {
    // CORREGIR: Extraer día directamente del dateStr
    const dayOfMonth = dateStr.split('-')[2];
    setDailyAdjustments(prev => {
      const newAdjustments = { ...prev };
      delete newAdjustments[dayOfMonth];
      return newAdjustments;
    });
  };

  // Guardar todos los cambios
  // Persiste los ajustes del mes y notifica al padre con onSave.
  const handleSave = async () => {
    setSaving(true);
    try {
      const monthStr = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0');
      
      console.log('💾 DailyModal: Guardando ajustes:', {
        expenseId: expense._id,
        monthStr,
        dailyAdjustments,
        adjustmentsCount: Object.keys(dailyAdjustments).length,
        dailyAdjustmentsType: typeof dailyAdjustments,
        adjustmentsKeys: Object.keys(dailyAdjustments),
        adjustmentsValues: Object.values(dailyAdjustments)
      });
      
      await updateDailyAdjustments(expense._id, dailyAdjustments, monthStr);
      
      console.log('✅ DailyModal: Ajustes guardados exitosamente');
      setJustSaved(true); // Marcar que acabamos de guardar
      
      // Llamar callback opcional con datos actualizados
      if (onSave) {
        console.log('🔄 DailyModal: Ejecutando callback onSave con datos actualizados');
        await onSave(expense._id, dailyAdjustments, monthStr);
      // El callback del padre se encargará de cerrar el modal
      } else {
        // DailyModal: No hay callback onSave
        // Solo cerrar si no hay callback
        onClose();
      }
    } catch (error) {
      console.error('❌ DailyModal: Error saving daily adjustments:', error);
    // Aquí podrías mostrar una notificación de error
    } finally {
      setSaving(false);
    }
  };

  // Calcular totales del mes
  // Totales del mes: monto calculado, base y ajuste acumulado.
  const monthlyTotal = calendarDays.reduce((sum, day) => sum + day.amount, 0);
  const baseMonthlyTotal = baseDailyAmount * calendarDays.length;
  const totalAdjustment = monthlyTotal - baseMonthlyTotal;

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: navegación de mes, totales y calendario con edición por día.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="amber"
      title={`Edición Diaria - ${expense?.description}`}
      subtitle={`Ajustar gastos día por día para ${currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`}
      icon={Repeat}
      size="5xl"
      zIndex="top"
      footer={
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-400">
            Los cambios se aplicarán solo al mes actual y se resetearán automáticamente el próximo mes
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      }
    >
      {/* Controles de mes y resumen */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h4 className="text-amber-200 font-medium text-sm sm:text-base">
            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h4>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="text-center sm:text-right">
            <p className="text-xs text-gray-400">Monto base diario</p>
            <p className="text-xs sm:text-sm font-medium text-amber-200">{formatCurrency(baseDailyAmount)}</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xs text-gray-400">Total del mes</p>
            <p className="text-xs sm:text-sm font-medium text-amber-200">{formatCurrency(monthlyTotal)}</p>
          </div>
          {totalAdjustment !== 0 && (
            <div className="text-center sm:text-right col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-400">Ajuste total</p>
              <p className={`text-xs sm:text-sm font-medium ${totalAdjustment > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalAdjustment > 0 ? '+' : ''}{formatCurrency(totalAdjustment)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Calendario */}
      <div>
        {/* Encabezados de días */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-400 p-1 sm:p-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Días del calendario */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((dayData) => (
            <div
              key={dayData.day}
              className={`relative p-2 sm:p-3 border rounded-lg transition-all duration-200 ${
                dayData.isToday 
                  ? 'border-amber-300 bg-amber-500/20' 
                  : dayData.hasAdjustment 
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className={`text-xs sm:text-sm font-medium ${
                  dayData.isToday ? 'text-amber-300' : 'text-amber-200'
                }`}>
                  {dayData.day}
                </span>
                {dayData.hasAdjustment && (
                  <button
                    onClick={() => resetDay(dayData.dateStr)}
                    className="p-0.5 sm:p-1 text-amber-400 hover:text-amber-300 transition-colors"
                    title="Resetear a valor base"
                  >
                    <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </button>
                )}
              </div>
              
              {editingDay === dayData.dateStr ? (
                <div className="space-y-1 sm:space-y-2">
                  <input
                    type="number"
                    value={tempAmount}
                    onChange={(e) => setTempAmount(e.target.value)}
                    className="w-full px-1 sm:px-2 py-0.5 sm:py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:border-amber-400 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-0.5 sm:gap-1">
                    <button
                      onClick={saveDayChange}
                      className="flex-1 p-0.5 sm:p-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 text-xs transition-colors hover:bg-emerald-500/30"
                    >
                      <Save className="w-2.5 h-2.5 sm:w-3 sm:h-3 mx-auto" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 p-0.5 sm:p-1 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs transition-colors hover:bg-red-500/30"
                    >
                      <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-xs font-medium text-amber-200 text-center">
                    {formatCurrency(dayData.amount)}
                  </p>
                  <button
                    onClick={() => startEditing(dayData)}
                    className="w-full p-0.5 sm:p-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded text-amber-300 text-xs transition-colors"
                  >
                    <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mx-auto" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default DailyRecurringExpenseModal;
