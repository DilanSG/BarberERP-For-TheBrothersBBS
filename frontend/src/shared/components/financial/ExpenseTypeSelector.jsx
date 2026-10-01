import { Calendar, Repeat, Zap, Receipt } from 'lucide-react';
import Modal from '../ui/Modal';

// Selector previo que decide si el nuevo gasto será único o recurrente.
// Cada opción notifica el tipo elegido para abrir el formulario correspondiente.
export const ExpenseTypeSelector = ({ isOpen, onClose, onSelectType }) => {
  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: dos tarjetas explicativas, una para gasto único y otra para recurrente.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="amber"
      title="Nuevo Gasto"
      subtitle="Selecciona el tipo de gasto que deseas crear"
      icon={Receipt}
      size="md"
      footer={
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Los gastos recurrentes se procesan automáticamente según su configuración</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Gasto Único */}
        <button
          onClick={() => onSelectType('one-time')}
          className="w-full p-4 sm:p-6 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-xl hover:border-emerald-500/50 transition-all duration-300 group text-left"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-base sm:text-lg font-semibold text-amber-200 mb-2">
                Gasto Único
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 mb-3">
                Un gasto que ocurre una sola vez en una fecha específica
              </p>
              <div className="text-xs text-emerald-400 space-y-1">
                <p>• Compras de productos</p>
                <p>• Reparaciones puntuales</p>
                <p>• Gastos extraordinarios</p>
              </div>
            </div>
          </div>
        </button>

        {/* Gasto Recurrente */}
        <button
          onClick={() => onSelectType('recurring')}
          className="w-full p-4 sm:p-6 bg-gradient-to-r from-brand-400/10 to-red-500/10 border border-brand-400/30 rounded-xl hover:border-brand-400/50 transition-all duration-300 group text-left"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-lg bg-brand-400/20 border border-brand-400/30 group-hover:bg-brand-400/30 transition-colors">
              <Repeat className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div className="flex-1">
              <h4 className="text-base sm:text-lg font-semibold text-amber-200 mb-2">
                Gasto Recurrente
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 mb-3">
                Un gasto que se repite automáticamente según una frecuencia
              </p>
              <div className="text-xs text-brand-300 space-y-1">
                <p>• Arriendo mensual</p>
                <p>• Servicios públicos</p>
                <p>• Salarios y nómina</p>
              </div>
            </div>
          </div>
        </button>
      </div>
    </Modal>
  );
};

export default ExpenseTypeSelector;
