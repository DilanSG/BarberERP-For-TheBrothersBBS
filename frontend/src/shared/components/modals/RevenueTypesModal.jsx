import React from 'react';
import { Scissors, ShoppingBag, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../ui/Modal';
import { formatCurrency } from '@utils/formatters';

// Modal que desglosa los ingresos del período en productos, servicios y citas.

// Suma los montos por tipo, calcula porcentajes y permite usar un formateador externo.
const RevenueTypesModal = ({ isOpen, onClose, revenueData, dateRange, formatCurrency: externalFormatCurrency }) => {
  if (!isOpen || !revenueData) return null;

  // Debug temporal para verificar estructura de datos
  // Registros temporales de depuración de la estructura de datos recibida.
  console.log('🔍 [RevenueTypesModal] revenueData:', revenueData);
  console.log('🔍 [RevenueTypesModal] revenueData.byType:', revenueData.byType);

  // Usar la función de formateo externa si se proporciona, sino usar la local
  const formatCurrencyToUse = externalFormatCurrency || formatCurrency;

  // Tipos de ingresos con sus iconos y colores
  // Tipos de ingreso con su monto, icono, color y descripción.
  const revenueTypes = [
    { 
      id: 'products', 
      name: 'Ventas de Productos', 
      icon: ShoppingBag, 
      color: 'emerald',
      amount: revenueData.byType?.products || 0,
      description: 'Ingresos por venta de productos',
    },
    { 
      id: 'services', 
      name: 'Servicios de Barbería', 
      icon: Scissors, 
      color: 'blue',
      amount: revenueData.byType?.services || 0,
      description: 'Cortes y servicios directos',
    },
    { 
      id: 'appointments', 
      name: 'Citas Programadas', 
      icon: Calendar, 
      color: 'purple',
      amount: revenueData.byType?.appointments || 0,
      description: 'Servicios con cita previa',
    }
  ];

  // Total de ingresos: suma de productos, servicios y citas.
  const totalRevenue = revenueTypes.reduce((sum, type) => sum + type.amount, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="emerald"
      title="Tipos de Ingresos"
      subtitle="Análisis por fuente de ingresos"
      icon={TrendingUp}
      size="2xl"
    >
      <div className="space-y-4">
        {dateRange && (
          <p className="text-xs text-gray-400">
            {format(new Date(dateRange.startDate), 'dd/MM/yyyy')} - {format(new Date(dateRange.endDate), 'dd/MM/yyyy')}
          </p>
        )}

        {/* Resumen total */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Total de ingresos</p>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-emerald-400">{formatCurrencyToUse(totalRevenue)}</p>
        </div>

        {revenueTypes.map((type) => {
          // Porcentaje del tipo sobre el total y clases de color según su paleta.
          const percentage = totalRevenue > 0 ? (type.amount / totalRevenue * 100) : 0;
          const IconComponent = type.icon;
          
          const getColorClasses = (color) => {
            const colors = {
              emerald: 'bg-emerald-500/5 border-emerald-500/20',
              blue: 'bg-blue-500/5 border-blue-500/20',
              purple: 'bg-brand-400/5 border-brand-400/20'
            };
            return colors[color] || colors.blue;
          };

          const getIconColorClasses = (color) => {
            const colors = {
              emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
              blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
              purple: 'bg-brand-400/20 border-brand-400/30 text-brand-300'
            };
            return colors[color] || colors.blue;
          };

          const getTextColor = (color) => {
            const colors = {
              emerald: 'text-emerald-400',
              blue: 'text-blue-400',
              purple: 'text-brand-300'
            };
            return colors[color] || colors.blue;
          };

          const getProgressColor = (color) => {
            const colors = {
              emerald: 'bg-emerald-400',
              blue: 'bg-blue-400',
              purple: 'bg-brand-300'
            };
            return colors[color] || colors.blue;
          };
          
          return (
            <div key={type.id} className={`p-4 rounded-xl border transition-all duration-300 hover:scale-[1.02] ${getColorClasses(type.color)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${getIconColorClasses(type.color)}`}>
                    <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-emerald-200 text-sm sm:text-base">{type.name}</h4>
                    <p className="text-xs text-gray-400">{type.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${getTextColor(type.color)}`}>
                    {formatCurrencyToUse(type.amount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {percentage.toFixed(1)}% del total
                  </p>
                </div>
              </div>

              {/* Detalles adicionales */}
              <p className="text-xs text-gray-500 mb-3">{type.details}</p>

              {/* Barra de progreso */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getProgressColor(type.color)}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default RevenueTypesModal;
