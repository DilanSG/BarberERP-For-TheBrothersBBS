import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../shared/utils/logger.js';
import config from '../shared/config/index.js';
import User from '../core/domain/entities/User.js';

const JWT_ISSUER = 'the-brothers-barbershop-api';
const JWT_AUDIENCE = 'the-brothers-barbershop-users';

// Salas accesibles para cualquier usuario autenticado
const PUBLIC_ROOMS = new Set(['appointments', 'sales', 'inventory']);

let io = null;

// Inicializar WebSocket server
// Configura CORS, valida el JWT en el handshake y define las salas por rol.
// @param {http.Server} server - HTTP server de Express
// @returns {SocketIO.Server} instancia de Socket.IO
export function initWebSocket(server) {
  const allowedOrigins = [
    config.app.frontendUrl,
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Autenticación: validar el token JWT antes de aceptar la conexión
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Autenticación requerida'));
      }

      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });

      const user = await User.findById(decoded.id).select('role isActive tokenVersion');
      if (!user || !user.isActive) {
        return next(new Error('Usuario no válido o desactivado'));
      }
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
        return next(new Error('Token invalidado'));
      }

      socket.user = {
        id: String(user._id),
        role: user.role
      };
      // Usuario autenticado disponible en todos los handlers de este socket
      next();
    } catch (error) {
      logger.warn(`WebSocket auth fallida: ${error.message}`);
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug(`WebSocket client connected: ${socket.id} (${socket.user?.role})`);

    // Unirse a salas con autorización según el rol
    socket.on('join:room', (room) => {
      if (typeof room !== 'string') return;

      const isAllowed =
        PUBLIC_ROOMS.has(room) ||
        (room === 'admin' && socket.user?.role === 'admin') ||
        (room.startsWith('barber:') &&
          (socket.user?.role === 'admin' || room === `barber:${socket.user?.id}`));

      if (!isAllowed) {
        logger.warn(`Socket ${socket.id} intentó unirse a sala no autorizada: ${room}`);
        return;
      }

      socket.join(room);
      logger.debug(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave:room', (room) => {
      if (typeof room === 'string') {
        socket.leave(room);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`WebSocket client disconnected: ${socket.id} (${reason})`);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

// Obtener la instancia de Socket.IO
// @returns {SocketIO.Server} Instancia activa
// @throws {Error} Si initWebSocket() no se ha llamado antes
export function getIO() {
  if (!io) {
    throw new Error('WebSocket no está inicializado. Llama a initWebSocket() primero.');
  }
  return io;
}

// ═══════════════════════════════════════════════════
// EMIT HELPERS - Funciones para emitir eventos
// desde controllers/services sin dependeer de Socket.IO directamente
// ═══════════════════════════════════════════════════

// Emitir evento de nueva cita
// Notifica a todos los suscritos, al barbero asignado y a los admins.
export function emitAppointmentCreated(appointment) {
  if (!io) return;
  io.to('appointments').emit('appointment:created', appointment);
  io.to(`barber:${appointment.barber?._id || appointment.barber}`).emit('appointment:created', appointment);
  io.to('admin').emit('appointment:created', appointment);
}

// Emitir actualización de cita
export function emitAppointmentUpdated(appointment) {
  if (!io) return;
  // Notifica a la sala general, a la del barbero y a los admins
  io.to('appointments').emit('appointment:updated', appointment);
  io.to(`barber:${appointment.barber?._id || appointment.barber}`).emit('appointment:updated', appointment);
  io.to('admin').emit('appointment:updated', appointment);
}

// Emitir eliminación de cita
export function emitAppointmentDeleted(appointmentId, barberId) {
  if (!io) return;
  io.to('appointments').emit('appointment:deleted', { _id: appointmentId });
  if (barberId) io.to(`barber:${barberId}`).emit('appointment:deleted', { _id: appointmentId });
  io.to('admin').emit('appointment:deleted', { _id: appointmentId });
}

// Emitir nueva venta
export function emitSaleCreated(sale) {
  if (!io) return;
  io.to('sales').emit('sale:created', sale);
  io.to(`barber:${sale.barberId?._id || sale.barberId}`).emit('sale:created', sale);
  io.to('admin').emit('sale:created', sale);
}

// Emitir actualización de inventario
export function emitInventoryUpdated(item) {
  if (!io) return;
  io.to('inventory').emit('inventory:updated', item);
  io.to('admin').emit('inventory:updated', item);
}

// Emitir cambio de estado de cita (para listas en tiempo real)
export function emitAppointmentStatusChanged(appointment) {
  if (!io) return;
  io.to('appointments').emit('appointment:status-changed', appointment);
  io.to(`barber:${appointment.barber?._id || appointment.barber}`).emit('appointment:status-changed', appointment);
  io.to('admin').emit('appointment:status-changed', appointment);
}
