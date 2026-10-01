// Contexto de WebSocket (socket.io): conecta solo con sesión activa, se une a
// las salas por defecto según el rol y expone helpers para suscribirse a eventos.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// Derivar la URL del WebSocket desde la API eliminando el sufijo /api/vN completo
// (un replace parcial de '/api' dejaba '/v1', que socket.io interpreta como namespace inexistente)
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_URL?.replace(/\/api(\/v\d+)?\/?$/, '') ||
  'http://localhost:5000';

// Provider de socket. Conecta/desconecta cuando cambian token o usuario.
// Valor: { socket, isConnected, joinRoom, leaveRoom, on }.
export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      // Auto-unirse a salas según rol
      socket.emit('join:room', 'appointments');
      socket.emit('join:room', 'sales');
      socket.emit('join:room', 'inventory');
      if (user.role === 'admin') {
        socket.emit('join:room', 'admin');
      }
      if (user.role === 'barber') {
        socket.emit('join:room', `barber:${user._id}`);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('WebSocket connection error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, user?._id, user?.role]);

  // Unirse manualmente a una sala (no-op si aún no hay socket)
  const joinRoom = useCallback((room) => {
    socketRef.current?.emit('join:room', room);
  }, []);

  // Salir de una sala
  const leaveRoom = useCallback((room) => {
    socketRef.current?.emit('leave:room', room);
  }, []);

  // Suscribirse a un evento; devuelve la función de desuscripción (cleanup)
  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom,
    on,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// Hook de acceso al socket; lanza error si se usa fuera de SocketProvider
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket debe ser usado dentro de un SocketProvider');
  }
  return context;
}

// Hook para escuchar un evento de WebSocket y obtener datos en tiempo real.
// Se re-suscribe cuando cambian event/handler y se desuscribe al desmontar.
export function useSocketEvent(event, handler) {
  const { on } = useSocket();

  useEffect(() => {
    if (!event || !handler) return;
    const cleanup = on(event, handler);
    return cleanup;
  }, [event, handler, on]);
}
