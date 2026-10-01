// Contexto global de notificaciones (toasts).
// Evita duplicados combinando notificaciones activas y un registro de recientes
// (15 s), y auto-cierra cada toast según su duración.
import React, { createContext, useContext, useState, useEffect } from 'react';
import { logger } from '../utils/logger.js';

const NotificationContext = createContext();

// Hook de consumo; lanza error si se usa fuera de NotificationProvider
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification debe ser usado dentro de NotificationProvider');
  }
  return context;
};

// Provider de notificaciones. Valor: notifications, addNotification,
// removeNotification, clearAllNotifications y los helpers show*.
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState(new Map());

  // Limpiar notificaciones recientes expiradas cada 30 segundos
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setRecentNotifications(prev => {
        const updated = new Map();
        prev.forEach((timestamp, key) => {
          // Mantener solo las notificaciones de los últimos 15 segundos
          if (now - timestamp < 15000) {
            updated.set(key, timestamp);
          }
        });
        return updated;
      });
    }, 30000); // Limpiar cada 30 segundos

    return () => clearInterval(cleanupInterval);
  }, []);

  // Crea y encola una notificación; devuelve su id.
  // Deduplica: ignora si ya hay una idéntica activa o mostrada en los últimos 15s;
  // se auto-elimina tras `duration` (5000ms por defecto) si autoClose es true.
  const addNotification = (notification) => {
    const id = Date.now() + Math.random(); // Agregar random para evitar duplicados
    const newNotification = {
      id,
      type: 'info', // 'success', 'error', 'warning', 'info'
      title: '',
      message: '',
      duration: 5000, // 5 segundos por defecto
      autoClose: true,
      ...notification
    };

    // Crear una clave única para la notificación basada en su contenido
    const notificationKey = `${newNotification.type}-${newNotification.message.trim()}-${(newNotification.title || '').trim()}`;
    
    // Verificar si hay una notificación idéntica activa
    const isDuplicateActive = notifications.some(existing => {
      const existingKey = `${existing.type}-${existing.message.trim()}-${(existing.title || '').trim()}`;
      return existingKey === notificationKey;
    });

    // Verificar si hay una notificación reciente (dentro del tiempo de vida)
    const now = Date.now();
    const isDuplicateRecent = recentNotifications.has(notificationKey);

    if (isDuplicateActive || isDuplicateRecent) {
      logger.debug('Notificación duplicada ignorada:', {
        message: newNotification.message,
        type: newNotification.type,
        title: newNotification.title,
        reason: isDuplicateActive ? 'notificación activa' : 'notificación reciente'
      });
      return id; // Retorna un ID pero no agrega la notificación
    }

    // Agregar a la lista de notificaciones recientes
    setRecentNotifications(prev => {
      const updated = new Map(prev);
      updated.set(notificationKey, now);
      return updated;
    });

    // Limpiar notificaciones recientes después del tiempo de vida + buffer
    setTimeout(() => {
      setRecentNotifications(prev => {
        const updated = new Map(prev);
        updated.delete(notificationKey);
        return updated;
      });
    }, newNotification.duration + 1000); // Buffer adicional de 1 segundo

    setNotifications(prev => [...prev, newNotification]);

    // Auto-eliminar después del tiempo especificado
    if (newNotification.autoClose) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Métodos de conveniencia para diferentes tipos.
  // El título se autogenera si el mensaje es largo y la duración crece con el
  // texto (errores duran más: 8-10s; éxito 4-6s).
  const showSuccess = (message, title = '') => {
    return addNotification({
      type: 'success',
      title: title || (message.length > 50 ? 'Éxito' : ''),
      message,
      duration: message.length > 100 ? 6000 : 4000
    });
  };

  const showError = (message, title = '') => {
    return addNotification({
      type: 'error',
      title: title || (message.length > 50 ? 'Error' : ''),
      message,
      duration: message.length > 100 ? 10000 : 8000 // Errores duran más tiempo
    });
  };

  const showWarning = (message, title = '') => {
    return addNotification({
      type: 'warning',
      title: title || (message.length > 50 ? 'Advertencia' : ''),
      message,
      duration: message.length > 100 ? 8000 : 6000
    });
  };

  const showInfo = (message, title = '') => {
    return addNotification({
      type: 'info',
      title: title || (message.length > 50 ? 'Información' : ''),
      message,
      duration: message.length > 100 ? 7000 : 5000
    });
  };

  // Método especial para errores de sesión
  const showSessionExpired = () => {
    return addNotification({
      type: 'warning',
      title: 'Sesión Expirada',
      message: 'Tu sesión ha expirado. Serás redirigido al login en unos segundos...',
      duration: 4000,
      autoClose: true
    });
  };

  // Método para errores de conexión
  const showConnectionError = () => {
    return addNotification({
      type: 'error',
      title: 'Error de Conexión',
      message: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      duration: 8000,
      autoClose: true
    });
  };

  // Método para cuando se requiere autenticación
  const showAuthRequired = () => {
    return addNotification({
      type: 'info',
      title: 'Autenticación Requerida',
      message: 'Necesitas iniciar sesión para acceder a esta función. Redirigiendo...',
      duration: 4000,
      autoClose: true
    });
  };

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showSessionExpired,
    showConnectionError,
    showAuthRequired
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

