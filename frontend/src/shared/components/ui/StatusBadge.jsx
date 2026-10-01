import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Check } from 'lucide-react';

// Badge de estado de cita: combina icono, texto traducido y color según `status`.
// Valores soportados: pending, confirmed, completed, cancelled (default: desconocido).
export const StatusBadge = ({ status }) => {
  // Icono representativo de cada estado.
  const getStatusIcon = () => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'completed': return <Check className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Colores (fondo/borde/texto) por estado.
  const getStatusClasses = () => {
    switch (status) {
      case 'pending': 
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'confirmed': 
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'completed': 
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'cancelled': 
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      default: 
        return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    }
  };

  // Etiqueta en español por estado.
  const getStatusText = () => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return 'Desconocido';
    }
  };

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusClasses()}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
};

export default StatusBadge;
