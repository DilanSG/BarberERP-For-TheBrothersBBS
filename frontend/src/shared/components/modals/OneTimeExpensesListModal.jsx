import React from 'react';
import { Receipt } from 'lucide-react';
import Modal from '../ui/Modal';

// Modal que lista solo los gastos únicos (one-time) del período.
// Filtra los gastos por tipo 'one-time' y muestra total, número de registros y
// el detalle de cada uno con acciones opcionales de editar y eliminar.
export const OneTimeExpensesListModal = ({ 
  isOpen, 
  onClose, 
  expenses,
  formatCurrency, 
  dateRange,
  onEdit,
  onDelete
}) => {
  if (!isOpen) return null;

  // Filtrar solo gastos únicos
  // Gastos únicos del período y suma total de sus montos.
  const oneTimeExpenses = expenses.filter(expense => expense.type === 'one-time');
  const totalAmount = oneTimeExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  // Obtener nombre de categoría legible
  // Traduce el id de categoría a un nombre legible en español.
  const getCategoryName = (categoryId) => {
    const categoryMap = {
      'rent': 'Arriendo/Alquiler',
      'utilities': 'Servicios Públicos',
      'supplies': 'Insumos/Materiales',
      'equipment': 'Equipos/Herramientas',
      'salaries': 'Salarios/Nómina',
      'marketing': 'Marketing/Publicidad',
      'maintenance': 'Mantenimiento',
      'insurance': 'Seguros',
      'taxes': 'Impuestos/Tributos',
      'transport': 'Transporte',
      'food': 'Alimentación',
      'training': 'Capacitación',
      'software': 'Software/Licencias',
      'other': 'Otros'
    };
    return categoryMap[categoryId] || categoryId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Traduce el método de pago a su nombre legible.
  const getPaymentMethodName = (method) => {
    const methodMap = {
      'cash': 'Efectivo',
      'debit': 'Débito',
      'credit': 'Crédito',
      'transfer': 'Transferencia',
      'check': 'Cheque',
      'digital': 'Digital'
    };
    return methodMap[method] || method;
  };

  // Vista: tarjetas resumen, estado vacío o listado de gastos con sus acciones.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="amber"
      title="Gastos Únicos"
      subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Período seleccionado'}
      icon={Receipt}
      size="4xl"
    >
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs text-gray-400 mb-1">Total gastos únicos</p>
          <p className="text-sm sm:text-base font-bold text-amber-400">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs text-gray-400 mb-1">Número de gastos</p>
          <p className="text-sm sm:text-base font-bold text-amber-200">{oneTimeExpenses.length}</p>
        </div>
      </div>

      {oneTimeExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
            <Receipt className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-gray-400">No hay gastos únicos registrados en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {oneTimeExpenses.map((expense) => (
            <div
              key={expense._id}
              className="group relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                      <Receipt className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-200 text-sm sm:text-base">
                        {expense.description}
                      </h4>
                      <p className="text-xs text-amber-300">
                        {getCategoryName(expense.category)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-400">Fecha:</span>
                      <p className="text-amber-200 font-medium">
                        {new Date(expense.date).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Método de pago:</span>
                      <p className="text-amber-200 font-medium">
                        {getPaymentMethodName(expense.paymentMethod)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <p className="text-lg font-bold text-amber-400">
                    {formatCurrency(expense.amount)}
                  </p>
                  
                  {(onEdit || onDelete) && (
                    <div className="flex gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(expense)}
                          className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-400 transition-colors text-xs"
                        >
                          Editar
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(expense._id)}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-red-400 transition-colors text-xs"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default OneTimeExpensesListModal;
