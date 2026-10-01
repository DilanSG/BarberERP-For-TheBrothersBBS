import React from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Banknote,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import Modal from '../ui/Modal';
import { usePaymentMethodsContext } from '@contexts/PaymentMethodsContext';
import { getPaymentMethodPalette, getPaymentMethodDisplayName } from '@utils/formatters';

// Icono por defecto según la categoría del método de pago.
const ICON_BY_CATEGORY = {
  cash: Banknote,
  digital: Smartphone,
  card: CreditCard,
  transfer: Smartphone,
  other: CreditCard,
};

// Modal con el desglose de ingresos por medio de pago.
// Toma el resumen de medios de pago, lo cruza con los métodos vivos del contexto
// y muestra importe, porcentaje y barra de progreso por cada método.
export const PaymentMethodsModal = ({ 
  isOpen, 
  onClose, 
  data, 
  formatCurrency, 
  dateRange 
}) => {
  const { allPaymentMethods } = usePaymentMethodsContext();

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  const { summary } = data;
  const paymentMethods = summary?.paymentMethods || {};

  // Entradas dinámicas: cualquier método presente en el resumen, con su color real
  // Detalle por método: solo montos mayores a 0, ordenados de mayor a menor.
  const paymentDetails = Object.entries(paymentMethods)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([backendId, amount]) => {
      const live = allPaymentMethods?.find((m) => m.backendId === backendId);
      return {
        method: live?.name || getPaymentMethodDisplayName(backendId),
        amount: Number(amount) || 0,
        icon: live?.icon || ICON_BY_CATEGORY[live?.category] || CreditCard,
        color: live?.color || backendId,
        description: live?.description || '',
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Suma total de los ingresos por medios de pago.
  const totalAmount = paymentDetails.reduce((sum, method) => sum + method.amount, 0);

  // Clases de color del método usando la paleta compartida.
  const getColorClasses = (color) => {
    const p = getPaymentMethodPalette(color);
    return `bg-gradient-to-r ${p.bg} ${p.border} ${p.text}`;
  };

  // Porcentaje que representa un monto sobre el total.
  const getPercentage = (amount) => {
    return totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0;
  };

  // Vista: tarjeta de total general y desglose por método con barras de progreso.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Desglose por Medios de Pago"
      subtitle={dateRange?.start && dateRange?.end 
        ? `${new Date(dateRange.start).toLocaleDateString('es-CO')} - ${new Date(dateRange.end).toLocaleDateString('es-CO')}`
        : 'Período seleccionado'
      }
      icon={CreditCard}
      size="3xl"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            <div className="flex items-center gap-2">
              <X className="w-4 h-4" />
              <span>Cerrar</span>
            </div>
          </button>
        </div>
      }
    >
      <div className="relative z-10">
        {/* Total general */}
        <div className="group relative bg-white/5 border border-white/10 rounded-xl p-6 mb-6 backdrop-blur-sm shadow-xl shadow-soft overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-xl border border-emerald-500/20 shadow-xl shadow-soft">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-200">Total de Ingresos</h3>
                <p className="text-gray-400 text-sm">Suma de todos los medios de pago</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalAmount)}</p>
              <div className="flex items-center gap-1 text-emerald-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desglose por método */}
        <div className="space-y-4">
          {paymentDetails.map((method, index) => {
            // Resuelve el icono y el porcentaje del método dentro de la lista.
            const IconComponent = method.icon;
            const percentage = getPercentage(method.amount);
            
            return (
              <div
                key={index}
                className={`group relative bg-gradient-to-r ${getColorClasses(method.color)} rounded-xl p-4 backdrop-blur-sm shadow-xl shadow-soft overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 bg-gradient-to-r ${getColorClasses(method.color)} rounded-lg border shadow-lg`}>
                      <IconComponent className={`w-5 h-5 ${method.color === 'green' ? 'text-emerald-400' : method.color === 'blue' ? 'text-blue-400' : method.color === 'purple' ? 'text-brand-300' : 'text-amber-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-200">{method.method}</h4>
                      <p className="text-gray-300 text-sm">{method.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-xl font-bold ${method.color === 'green' ? 'text-emerald-400' : method.color === 'blue' ? 'text-blue-400' : method.color === 'purple' ? 'text-brand-300' : 'text-amber-400'}`}>
                      {formatCurrency(method.amount)}
                    </p>
                    <div className="flex items-center gap-1 text-gray-300 text-sm">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>{percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mt-3 bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${method.color === 'green' ? 'from-emerald-500 to-emerald-400' : method.color === 'blue' ? 'from-blue-500 to-blue-400' : method.color === 'purple' ? 'from-brand-400 to-brand-300' : 'from-amber-500 to-amber-400'} transition-all duration-1000 ease-out`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default PaymentMethodsModal;
