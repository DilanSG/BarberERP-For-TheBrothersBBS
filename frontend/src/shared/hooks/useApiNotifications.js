// Conecta el NotificationContext de React con el módulo api.js, de modo que los
// errores HTTP disparen notificaciones globales; lo desconecta al desmontar.
import { useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { setNotificationContext } from '../services/api';

export const useApiNotifications = () => {
  const notificationContext = useNotification();

  useEffect(() => {
    // Conectar el contexto de notificaciones con el servicio API
    setNotificationContext(notificationContext);

    // Cleanup function
    return () => {
      setNotificationContext(null);
    };
  }, [notificationContext]);

  return notificationContext;
};
