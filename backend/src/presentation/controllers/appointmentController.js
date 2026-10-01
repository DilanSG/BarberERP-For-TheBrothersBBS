import { asyncHandler } from '../middleware/index.js';
import AppointmentUseCases from '../../core/application/usecases/appointmentService.js';
import BarberUseCases from '../../core/application/usecases/BarberUseCases.js';
import { Appointment, Barber, User, AppError, logger } from '../../barrel.js';
import emailService from '../../services/emailService.js';
import { emitAppointmentCreated, emitAppointmentUpdated, emitAppointmentDeleted, emitAppointmentStatusChanged } from '../../services/websocketService.js';

const barberService = BarberUseCases.getInstance();

// @desc    Obtener horarios disponibles para un barbero en una fecha específica
// @route   POST /api/appointments/available-times
// @access  Privado
export const getAvailableTimes = asyncHandler(async (req, res) => {
  const { barberId, date } = req.body;
  
  const availableTimes = await AppointmentUseCases.getAvailableTimes(barberId, date);

  res.status(200).json({
    success: true,
    data: availableTimes
  });
});

// @desc    Crear una nueva cita
// @route   POST /api/appointments
// @access  Private
export const createAppointment = asyncHandler(async (req, res) => {
  const appointmentData = {
    ...req.body,
    user: req.user._id // Asignar el usuario actual
  };

  const appointment = await AppointmentUseCases.createAppointment(appointmentData);

  // 📧 ENVIAR NOTIFICACIONES POR EMAIL
  try {
    // Obtener datos completos de usuario y barbero para los emails
    const user = await User.findById(appointment.user).select('name email phone');
    const barber = appointment.barber ? await User.findById(appointment.barber).select('name email') : null;

    // Confirmar que tenemos los datos necesarios
    if (user?.email) {
      // 1. Confirmación al cliente
      await emailService.sendAppointmentConfirmation(appointment, user);
      logger.info(`Email de confirmación enviado a cliente: ${user.email}`);
    }

    if (barber?.email) {
      // 2. Notificación al barbero
      await emailService.sendNewAppointmentNotification(appointment, barber, user);
      logger.info(`Notificación de nueva cita enviada a barbero: ${barber.email}`);
    }

  } catch (emailError) {
    // No fallar la creación de la cita si hay error de email
    logger.warn('Error enviando notificaciones de email:', emailError);
  }

  emitAppointmentCreated(appointment);

  res.status(201).json({
    success: true,
    message: 'Cita creada exitosamente',
    data: appointment
  });
});

// @desc    Obtener todas las citas
// @route   GET /api/appointments
// @access  Private
export const getAppointments = asyncHandler(async (req, res) => {
  // Construir filtros basados en el rol y los parámetros
  let filters = {};
  
  if (req.user.role === 'barber') {
    // Los barberos solo ven sus propias citas (resolver perfil de barbero desde el usuario autenticado)
    const barber = await Barber.findOne({ user: req.user._id });
    if (!barber) {
      throw new AppError('Barbero no encontrado', 404);
    }
    filters.barber = barber._id;
    // No mostrar citas eliminadas por el barbero
    filters['deletedBy.barber'] = { $ne: true };
  } else if (req.user.role === 'user') {
    // Los usuarios normales solo ven sus propias citas
    filters.user = req.user._id;
    // No mostrar citas eliminadas por el usuario
    filters['deletedBy.user'] = { $ne: true };
  } else if (req.user.role === 'admin') {
    // Los admin ven todas las citas
    // No mostrar citas eliminadas por el admin
    filters['deletedBy.admin'] = { $ne: true };
  }

  // Aplicar filtros adicionales de la query
  if (req.query.status) {
    filters.status = req.query.status;
  }
  if (req.query.date) {
    filters.date = new Date(req.query.date);
  }
  
  // ✅ Agregar soporte para filtros de rango de fechas
  if (req.query.startDate || req.query.endDate) {
    filters.date = {};
    
    if (req.query.startDate) {
      filters.date.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      //Usar formato ISO string para evitar problemas de zona horaria
      const endDateStr = req.query.endDate.includes('T') 
        ? req.query.endDate 
        : req.query.endDate + 'T23:59:59.999Z';
      filters.date.$lte = new Date(endDateStr);
    }
  }

  const appointments = await AppointmentUseCases.getAppointments(filters);

  res.json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

// @desc    Obtener citas de un barbero específico
// @route   GET /api/appointments/barber/:barberId
// @access  Private
export const getBarberAppointments = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  
  // Construir filtros
  const filters = { 
    barber: barberId,
    // No mostrar citas eliminadas por el barbero
    'deletedBy.barber': { $ne: true }
  };
  
  // Aplicar filtros adicionales de la query
  if (req.query.status) {
    filters.status = req.query.status;
  }
  if (req.query.date) {
    filters.date = new Date(req.query.date);
  }

  const appointments = await AppointmentUseCases.getAppointments(filters);

  res.json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

// @desc    Obtener una cita específica
// @route   GET /api/appointments/:id
// @access  Private
export const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await AppointmentUseCases.getAppointmentById(req.params.id);

  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  // Verificar permisos
  if (req.user.role === 'user' && appointment.user.toString() !== req.user._id.toString()) {
    throw new AppError('No tienes permiso para ver esta cita', 403);
  }

  if (req.user.role === 'barber') {
    const barber = await Barber.findOne({ user: req.user._id });
    const appointmentBarberId = appointment.barber._id || appointment.barber;
    if (!barber || appointmentBarberId.toString() !== barber._id.toString()) {
      throw new AppError('No tienes permiso para ver esta cita', 403);
    }
  }

  res.json({
    success: true,
    data: appointment
  });
});

// @desc    Actualizar una cita
// @route   PUT /api/appointments/:id
// @access  Private
export const updateAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Validar permisos
  const appointment = await AppointmentUseCases.getAppointmentById(id);
  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  // Solo el usuario dueño de la cita o un admin pueden actualizarla
  if (req.user.role !== 'admin' && appointment.user.toString() !== req.user._id.toString()) {
    throw new AppError('No tienes permiso para actualizar esta cita', 403);
  }

  const updatedAppointment = await AppointmentUseCases.updateAppointment(id, updateData);

  emitAppointmentUpdated(updatedAppointment);

  res.json({
    success: true,
    data: updatedAppointment
  });
});

// @desc    Cancelar una cita
// @route   PUT /api/appointments/:id/cancel
// @access  Private
export const cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appointment = await AppointmentUseCases.getAppointmentById(id);
  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  // Debug logging para entender el problema
  logger.info(`=== DEBUG CANCELAR CITA ===`);
  logger.info(`Usuario que cancela: ${req.user._id} (${req.user.role})`);
  logger.info(`Cita ID: ${id}`);
  logger.info(`Usuario de la cita: ${appointment.user?._id || appointment.user}`);
  logger.info(`Barbero de la cita: ${appointment.barber?._id || appointment.barber}`);
  logger.info(`Estado de la cita: ${appointment.status}`);

  // Verificar permisos
  if (req.user.role === 'user') {
    const appointmentUserId = appointment.user?._id?.toString() || appointment.user?.toString();
    const requestUserId = req.user._id.toString();
    
    logger.info(`Comparando usuarios: ${appointmentUserId} vs ${requestUserId}`);
    
    if (appointmentUserId !== requestUserId) {
      throw new AppError('No tienes permiso para cancelar esta cita', 403);
    }
  }

  if (req.user.role === 'barber') {
    // Buscar el barbero asociado al usuario actual
    const barber = await Barber.findOne({ user: req.user._id });
    
    if (!barber) {
      logger.error(`No se encontró barbero para usuario: ${req.user._id}`);
      throw new AppError('No se encontró el perfil de barbero asociado', 404);
    }

    // Debug logging
    logger.info(`Barbero encontrado: ${barber._id}`);
    logger.info(`Barbero de la cita: ${appointment.barber?._id || appointment.barber}`);
    
    const appointmentBarberId = appointment.barber?._id?.toString() || appointment.barber?.toString();
    const currentBarberId = barber._id.toString();
    
    logger.info(`Comparando barberos: ${appointmentBarberId} vs ${currentBarberId}`);
    
    if (appointmentBarberId !== currentBarberId) {
      throw new AppError('No tienes permiso para cancelar esta cita', 403);
    }
  }
  
  const cancelledAppointment = await AppointmentUseCases.cancelAppointment(id, reason, req.user);

  emitAppointmentStatusChanged(cancelledAppointment);

  // 📧 ENVIAR NOTIFICACIÓN DE CANCELACIÓN
  try {
    // Obtener datos del usuario para el email
    const user = await User.findById(appointment.user).select('name email');
    
    if (user?.email) {
      await emailService.sendAppointmentCancellation(appointment, user, reason);
      logger.info(`Email de cancelación enviado a: ${user.email}`);
    }
  } catch (emailError) {
    logger.warn('Error enviando notificación de cancelación:', emailError);
  }

  res.json({
    success: true,
    message: 'Cita cancelada exitosamente',
    data: cancelledAppointment
  });
});

// @desc    Completar una cita
// @route   PUT /api/appointments/:id/complete
// @access  Private (Solo barberos)
export const completeAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod } = req.body;
  
  // Validar que se proporcione método de pago
  if (!paymentMethod) {
    throw new AppError('El método de pago es requerido para completar la cita', 400);
  }
  
  const appointment = await AppointmentUseCases.getAppointmentById(id);

  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  // Solo el barbero asignado puede marcar como completada
  const barber = await Barber.findOne({ user: req.user._id });
  
  // Obtener el ID del barbero de la cita (puede estar poblado o no)
  const appointmentBarberId = appointment.barber._id || appointment.barber;
  
  logger.info(`Verificando permisos para completar cita:`, {
    userId: req.user._id,
    userRole: req.user.role,
    barberId: barber?._id,
    appointmentId: id,
    appointmentBarberId: appointmentBarberId,
    appointmentBarberType: typeof appointmentBarberId,
    barberIdType: typeof barber?._id,
    idsMatch: appointmentBarberId.toString() === barber?._id.toString()
  });
  
  if (!barber) {
    logger.error('❌ Perfil de barbero no encontrado para usuario:', req.user._id);
    throw new AppError('Perfil de barbero no encontrado', 404);
  }
  
  if (appointmentBarberId.toString() !== barber._id.toString()) {
    logger.error('❌ IDs no coinciden:', {
      appointmentBarber: appointmentBarberId.toString(),
      barberProfile: barber._id.toString(),
      match: appointmentBarberId.toString() === barber._id.toString()
    });
    throw new AppError('Solo el barbero asignado puede completar la cita', 403);
  }
  
  logger.info('✅ Permisos verificados correctamente para completar cita');

  const completedAppointment = await AppointmentUseCases.completeAppointment(id, req.user._id, req.user.role, paymentMethod);

  emitAppointmentStatusChanged(completedAppointment);

  // 🌟 NUEVA FUNCIONALIDAD: Enviar email de solicitud de reseña
  try {
    // Poblar datos necesarios para el email
    await completedAppointment.populate([
      { path: 'user', select: 'name email' },
      { path: 'barber', populate: { path: 'user', select: 'name' } }
    ]);

    // Enviar email asíncrono (no bloquear la respuesta)
    emailService.sendReviewRequest(
      completedAppointment,
      completedAppointment.user,
      completedAppointment.barber
    ).catch(error => {
      logger.error('Error enviando email de solicitud de reseña:', error);
      // No lanzar error para no afectar el flujo principal
    });

    logger.info(`✅ Email de solicitud de reseña programado para ${completedAppointment.user.email}`);
  } catch (emailError) {
    logger.error('Error preparando email de reseña:', emailError);
    // Continuar aunque falle el email
  }

  res.json({
    success: true,
    message: 'Cita completada exitosamente',
    data: completedAppointment
  });
});

// @desc    Aprobar/Confirmar una cita
// @route   PUT /api/appointments/:id/approve
// @access  Private (Solo barberos)
export const approveAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const approvedAppointment = await AppointmentUseCases.approveAppointment(
    id, 
    req.user._id, 
    req.user.role
  );

  emitAppointmentStatusChanged(approvedAppointment);

  res.json({
    success: true,
    message: 'Cita aprobada/confirmada exitosamente',
    data: approvedAppointment
  });
});

// @desc    Marcar cita como no show
// @route   PUT /api/appointments/:id/no-show
// @access  Private (Solo barberos)
export const markNoShow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await AppointmentUseCases.getAppointmentById(id);

  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  // Solo el barbero asignado puede marcar no show
  const barber = await Barber.findOne({ user: req.user._id });
  const appointmentBarberId = appointment.barber._id || appointment.barber;
  
  if (!barber || appointmentBarberId.toString() !== barber._id.toString()) {
    throw new AppError('Solo el barbero asignado puede marcar no show', 403);
  }

  const noShowAppointment = await AppointmentUseCases.markNoShow(id);

  emitAppointmentStatusChanged(noShowAppointment);

  res.json({
    success: true,
    message: 'Cita marcada como no show',
    data: noShowAppointment
  });
});

// @desc    Obtener estadísticas de citas
// @route   GET /api/appointments/stats
// @access  Private (Admin y Barberos)
export const getAppointmentStats = asyncHandler(async (req, res) => {
  let filters = {};

  // Si es barbero, solo ver sus estadísticas
  if (req.user.role === 'barber') {
    const barber = await Barber.findOne({ user: req.user._id });
    if (!barber) {
      throw new AppError('Barbero no encontrado', 404);
    }
    filters.barber = barber._id;
  }

  // Aplicar filtros de fecha si se proporcionan
  if (req.query.startDate) {
    filters.startDate = req.query.startDate; // Pasar como string para que el service maneje la zona horaria
  }
  if (req.query.endDate) {
    filters.endDate = req.query.endDate; // Pasar como string para que el service maneje la zona horaria
  }

  const stats = await AppointmentUseCases.getAppointmentStats(filters);

  res.json({
    success: true,
    data: stats
  });
});

// Eliminar una cita (eliminación suave por rol)
export const deleteAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await Appointment.findById(id);

  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  // Verificar permisos y determinar el rol del usuario
  let userRole = req.user.role;
  
  if (req.user.role === 'user' && appointment.user.toString() !== req.user._id.toString()) {
    throw new AppError('No tienes permisos para eliminar esta cita', 403);
  }

  if (req.user.role === 'barber') {
    const barber = await Barber.findOne({ user: req.user._id });
    const appointmentBarberId = appointment.barber._id || appointment.barber;
    if (!barber || appointmentBarberId.toString() !== barber._id.toString()) {
      throw new AppError('No tienes permisos para eliminar esta cita', 403);
    }
  }

  // Marcar como eliminada para el rol correspondiente
  const updateField = `deletedBy.${userRole}`;
  await Appointment.findByIdAndUpdate(id, {
    [updateField]: true,
    markedForDeletion: appointment.markedForDeletion || new Date()
  });

  // Obtener la cita actualizada para verificar si debe eliminarse completamente
  const updatedAppointment = await Appointment.findById(id);
  
  // Si todos los roles han marcado la cita para eliminar, eliminarla completamente
  if (updatedAppointment.deletedBy.user && 
      updatedAppointment.deletedBy.barber && 
      updatedAppointment.deletedBy.admin) {
    await Appointment.findByIdAndDelete(id);
  }

  emitAppointmentDeleted(req.params.id, appointment?.barber?._id || appointment?.barber);

  res.json({
    success: true,
    message: 'Reporte de cita eliminado exitosamente'
  });
});

// Obtener disponibilidad de un barbero
export const getBarberAvailability = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  const { date } = req.query;



  if (!date) {
    throw new AppError('La fecha es requerida', 400);
  }

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('Formato de fecha inválido. Use YYYY-MM-DD', 400);
  }

  // Usar el servicio corregido que maneja zona horaria
  const availableTimes = await AppointmentUseCases.getAvailableTimes(barberId, date);

  // Desactivar caché para esta respuesta (para debug)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.status(200).json({
    success: true,
    data: availableTimes
  });
});

// @desc    Limpiar citas que han sido marcadas para eliminación por todos los roles
// @route   POST /api/appointments/cleanup
// @access  Private/Admin
export const cleanupDeletedAppointments = asyncHandler(async (req, res) => {
  // Solo admin puede ejecutar esta función
  if (req.user.role !== 'admin') {
    throw new AppError('No tienes permisos para ejecutar esta función', 403);
  }

  // Buscar citas que han sido marcadas para eliminar por todos los roles
  const toDelete = await Appointment.find({
    'deletedBy.user': true,
    'deletedBy.barber': true,
    'deletedBy.admin': true
  });

  // Eliminar las citas definitivamente
  const result = await Appointment.deleteMany({
    'deletedBy.user': true,
    'deletedBy.barber': true,
    'deletedBy.admin': true
  });

  res.json({
    success: true,
    message: `${result.deletedCount} citas eliminadas definitivamente de la base de datos`,
    deletedCount: result.deletedCount
  });
});

// @desc    Obtener motivo de cancelación de una cita
// @route   GET /api/appointments/:id/cancellation-reason
// @access  Private
export const getCancellationReason = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await Appointment.findById(id)
    .select('cancellationReason cancelledBy cancelledAt status')
    .lean();

  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  if (appointment.status !== 'cancelled') {
    throw new AppError('Esta cita no ha sido cancelada', 400);
  }

  if (!appointment.cancellationReason) {
    throw new AppError('Esta cita no tiene motivo de cancelación registrado', 404);
  }

  res.json({
    success: true,
    data: {
      reason: appointment.cancellationReason,
      cancelledBy: appointment.cancelledBy,
      cancelledAt: appointment.cancelledAt
    }
  });
});

// @desc    Limpiar citas pendientes expiradas
// @route   POST /api/appointments/cleanup-expired
// @access  Private/Admin
export const cleanupExpiredAppointments = asyncHandler(async (req, res) => {
  const result = await AppointmentUseCases.cleanupExpiredPendingAppointments();

  res.json({
    success: true,
    message: `Limpieza completada: ${result.cleaned} citas pendientes expiradas fueron canceladas`,
    data: result
  });
});

// @desc    Obtener estadísticas de citas por barbero
// @route   GET /api/v1/appointments/barber/:barberId/stats
// @access  Privado/Admin
export const getBarberAppointmentStats = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  const { date, startDate, endDate } = req.query;
  
  const stats = await AppointmentUseCases.getBarberAppointmentStats(barberId, {
    date,
    startDate,
    endDate
  });
  
  res.json({
    success: true,
    data: stats
  });
});

// @desc    Obtener estadísticas de citas para varios barberos (batch)
// @route   GET /api/v1/appointments/barbers/stats?ids=a,b,c
// @access  Privado/Admin
export const getBarbersAppointmentStats = asyncHandler(async (req, res) => {
  const { ids, date, startDate, endDate } = req.query;

  const barberIds = String(ids || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (barberIds.length === 0) {
    throw new AppError('Se requiere al menos un id de barbero', 400);
  }

  const stats = await AppointmentUseCases.getBarbersAppointmentStats(barberIds, {
    date,
    startDate,
    endDate
  });

  res.json({
    success: true,
    data: stats
  });
});

// @desc    Obtener reporte diario de citas
// @route   GET /api/v1/appointments/daily-report
// @access  Privado/Admin
export const getDailyAppointmentReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const report = await AppointmentUseCases.getDailyReport(date);
  
  res.json({
    success: true,
    data: report
  });
});

// @desc    Obtener fechas disponibles con datos de citas para un barbero
// @route   GET /api/v1/appointments/barber/:barberId/available-dates
// @access  Privado/Admin
export const getAvailableDates = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  
  const dates = await AppointmentUseCases.getAvailableDates(barberId);
  
  res.status(200).json({
    success: true,
    message: 'Fechas disponibles obtenidas correctamente',
    data: dates
  });
});

// @desc    Obtener detalles de citas completadas por barbero y rango de fechas
// @route   GET /api/v1/appointments/completed-details
// @access  Privado/Admin
export const getCompletedDetails = asyncHandler(async (req, res) => {
  const { barberId, startDate, endDate } = req.query;
  
  if (!barberId) {
    throw new AppError('barberId es requerido', 400);
  }

  const completedDetails = await AppointmentUseCases.getCompletedDetails(barberId, startDate, endDate);
  
  res.status(200).json({
    success: true,
    message: 'Detalles de citas completadas obtenidas correctamente',
    data: completedDetails
  });
});

// @desc    Obtener todas las citas completadas para modal de breakdown
// @route   GET /api/v1/appointments/completed
// @access  Privado/Admin
export const getCompletedAppointments = asyncHandler(async (req, res) => {
  const completedAppointments = await AppointmentUseCases.getCompletedAppointments();
  
  res.status(200).json({
    success: true,
    message: 'Citas completadas obtenidas correctamente',
    data: completedAppointments
  });
});
