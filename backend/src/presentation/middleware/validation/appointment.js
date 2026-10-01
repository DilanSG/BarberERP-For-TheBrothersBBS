import { body } from 'express-validator';
import { Barber, Service } from '../../../barrel.js';
import { handleValidationErrors } from './core.js';

// Validaciones para citas
// Verifica que barbero y servicio existan/estén activos, que la fecha sea futura
// y que esté dentro del horario del barbero según la zona horaria America/Bogota.
export const validateAppointment = [
  body('barberId')
    .isMongoId()
    .withMessage('ID de barbero inválido')
    .custom(async (barberId) => {
      const barber = await Barber.findById(barberId);
      if (!barber || !barber.isActive) {
        throw new Error('Barbero no disponible');
      }
      return true;
    }),
  body('serviceId')
    .isMongoId()
    .withMessage('ID de servicio inválido')
    .custom(async (serviceId) => {
      const service = await Service.findById(serviceId);
      if (!service || !service.isActive) {
        throw new Error('Servicio no disponible');
      }
      return true;
    }),
  body('date')
    .isISO8601()
    .withMessage('Fecha inválida')
    .custom(async (date, { req }) => {
      const appointmentDate = new Date(date);
      const now = new Date();
      
      if (appointmentDate <= now) {
        throw new Error('La cita debe ser en el futuro');
      }
      
      // Obtener el barbero para validar su horario
      const barberId = req.body.barberId;
      if (barberId) {
        const barber = await Barber.findById(barberId);
        if (barber && barber.schedule) {
          const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][appointmentDate.getDay()];
          const daySchedule = barber.schedule[dayOfWeek];
          
          if (!daySchedule || !daySchedule.available) {
            throw new Error('El barbero no está disponible este día');
          }
          
          // Validar horario del barbero
          // Convertir la fecha a la timezone de Colombia para validar correctamente
          const colombiaTime = new Date(appointmentDate.toLocaleString("en-US", {timeZone: "America/Bogota"}));
          const appointmentHour = colombiaTime.getHours();
          const appointmentMinute = colombiaTime.getMinutes();
          const appointmentTime = appointmentHour * 60 + appointmentMinute;
          
          const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
          const [endHour, endMinute] = daySchedule.end.split(':').map(Number);
          const startTime = startHour * 60 + startMinute;
          const endTime = endHour * 60 + endMinute;
          
          /*
          // Debug: console.log('DEBUG: Appointment validation (FIXED):', {
            originalDate: appointmentDate.toISOString(),
            colombiaTime: colombiaTime.toISOString(),
            appointmentHour,
            appointmentMinute,
            appointmentTime,
            daySchedule,
            startTime,
            endTime,
            isValid: appointmentTime >= startTime && appointmentTime < endTime
          });
          */
          
          if (appointmentTime < startTime || appointmentTime >= endTime) {
            throw new Error(`El horario debe estar entre ${daySchedule.start} y ${daySchedule.end}`);
          }
        }
      }
      
      return true;
    }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder los 500 caracteres')
    .escape(),
  handleValidationErrors
];

// Middleware para validación de creación de cita (puedes usar validateAppointment)
export const validateAppointmentCreation = validateAppointment;

// Middleware para validación de actualización de cita (puedes personalizar)
export const validateAppointmentUpdate = validateAppointment;
