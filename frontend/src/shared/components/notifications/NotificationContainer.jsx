import { useState } from 'react';
import { useNotification } from '../../contexts/NotificationContext';

// Contenedor de notificaciones tipo toast (arriba a la derecha; en móvil a lo ancho).
// Consume el NotificationContext y gestiona la animación de salida antes de
// remover cada toast, además del tamaño según la longitud del mensaje.
const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotification();
  // IDs de toasts en animación de salida (200ms antes de removerlos del contexto).
  const [animatingOut, setAnimatingOut] = useState(new Set());

  // Marca el toast como saliente, espera la animación y lo elimina.
  const handleClose = (id) => {
    setAnimatingOut(prev => new Set([...prev, id]));
    setTimeout(() => {
      removeNotification(id);
      setAnimatingOut(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 200); // Duración de la animación de salida
  };

  if (notifications.length === 0) return null;

  // Ajusta el ancho (min/max) según la longitud del mensaje y si hay título.
  const getNotificationSize = (message, title) => {
    const hasTitle = title && title.trim().length > 0;
    const messageLength = message.length;
    const isMultiline = message.includes('\n');
    
    // Para mensajes muy cortos sin título (como "Éxito", "Error")
    if (!hasTitle && messageLength <= 25 && !isMultiline) {
      return 'w-auto min-w-[200px] max-w-[280px]'; // Tamaño fijo pequeño
    }
    
    // Para mensajes cortos con o sin título
    if (messageLength <= 50 && !isMultiline) {
      return 'w-auto min-w-[250px] max-w-[320px]'; // Tamaño medio
    }
    
    // Para mensajes largos o multilinea
    if (isMultiline || messageLength > 50 || hasTitle) {
      return 'w-auto min-w-[280px] max-w-[400px]'; // Tamaño grande
    }
    
    // Fallback - tamaño medio
    return 'w-auto min-w-[250px] max-w-[320px]';
  };

  // Estilos base + color semántico según el tipo (success/error/warning/info).
  const getNotificationStyles = (type) => {
    const baseStyles = "relative overflow-hidden backdrop-blur-md border rounded-lg shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-emerald-500/10 border-emerald-500/30 text-emerald-100 shadow-soft`;
      case 'error':
        return `${baseStyles} bg-red-500/10 border-red-500/30 text-red-100 shadow-soft`;
      case 'warning':
        return `${baseStyles} bg-amber-500/10 border-amber-500/30 text-amber-100 shadow-soft`;
      case 'info':
      default:
        return `${baseStyles} bg-blue-500/10 border-blue-500/30 text-blue-100 shadow-soft`;
    }
  };

  // Icono SVG por tipo de notificación.
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Color de la barra de progreso del auto-cierre.
  const getProgressBarColor = (type) => {
    switch (type) {
      case 'success': return 'bg-emerald-400';
      case 'error': return 'bg-red-400';
      case 'warning': return 'bg-amber-400';
      case 'info':
      default: return 'bg-blue-400';
    }
  };

  return (
    <div className="fixed top-2 sm:top-4 right-2 sm:right-4 left-2 sm:left-auto z-50 space-y-2 sm:w-auto">
      {notifications.map((notification) => {
        const isAnimatingOut = animatingOut.has(notification.id);
        const sizeClass = getNotificationSize(notification.message, notification.title);
        return (
        <div
          key={notification.id}
          className={`${getNotificationStyles(notification.type)} ${sizeClass} ${
            isAnimatingOut ? 'animate-fade-out' : 'animate-slide-in-right'
          }`}
          role="alert"
        >
          {/* Barra de progreso para auto-close */}
          {notification.autoClose && (
            <div className="absolute bottom-0 left-0 h-1 bg-gray-600 w-full">
              <div 
                className={`h-full ${getProgressBarColor(notification.type)} transition-all ease-linear`}
                style={{
                  animation: `shrink ${notification.duration}ms linear forwards`
                }}
              />
            </div>
          )}

          <div className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(notification.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                {notification.title && notification.title.trim().length > 0 && (
                  <p className="text-sm font-medium text-white mb-1 line-clamp-1">
                    {notification.title}
                  </p>
                )}
                <div className={`text-sm leading-snug ${(!notification.title || notification.title.trim().length === 0) ? 'font-medium' : ''}`}>
                  {notification.message.split('\n').map((line, index) => (
                    <div key={index} className={index > 0 ? 'mt-1' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-shrink-0">
                <button
                  onClick={() => handleClose(notification.id)}
                  className="inline-flex p-1 text-gray-400 hover:text-gray-200 focus:outline-none focus:text-gray-200 transition-colors duration-200 rounded-md hover:bg-white/10"
                  aria-label="Cerrar notificación"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default NotificationContainer;
