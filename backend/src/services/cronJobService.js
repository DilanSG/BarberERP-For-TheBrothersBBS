import cron from 'node-cron';
import { Appointment, User, Barber, logger } from '../barrel.js';
import emailService from './emailService.js';
import AppointmentUseCases from '../core/application/usecases/appointmentService.js';

// Sistema de trabajos programados (Cron Jobs)
// Maneja recordatorios automáticos y resúmenes diarios
class CronJobService {
  constructor() {
    // Mapa nombre → tarea de node-cron para poder consultarlas/detenerlas
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Inicializar todos los trabajos programados
  // No hace nada si ya estaba inicializado o si el email no está configurado.
  initializeJobs() {
    if (this.isInitialized) {
      logger.warn('CronJobService ya está inicializado');
      return;
    }

    try {
      // Solo inicializar si el servicio de email está configurado
      if (!emailService.isConfigured && !emailService.getIsConfigured()) {
        logger.warn('Email no configurado - Cron jobs deshabilitados');
        return;
      }

      this.setupAppointmentReminders();
      this.setupDailyReports();
      this.setupWeeklyReports();
      this.setupExpiredAppointmentCleanup();

      this.isInitialized = true;
      logger.info('Cron jobs inicializados (recordatorios, reportes diarios/semanales, limpieza de citas)');
    } catch (error) {
      logger.error('Error inicializando cron jobs:', error);
    }
  }

  // Configurar recordatorios de citas (cada hora)
  setupAppointmentReminders() {
    // Expresión cron '0 * * * *': en el minuto 0 de cada hora
    const reminderJob = cron.schedule('0 * * * *', async () => {
      await this.sendAppointmentReminders();
    }, {
      scheduled: false,
      timezone: 'America/Bogota'
    });

    this.jobs.set('appointmentReminders', reminderJob);
    reminderJob.start();
  }

  // Enviar recordatorios de citas para el día siguiente
  async sendAppointmentReminders() {
    try {
      // Obtener fecha de mañana
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Rango [mañana 00:00, pasado mañana 00:00) para cubrir todo el día
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Buscar citas programadas para mañana
      const appointments = await Appointment.find({
        date: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: { $in: ['pending', 'confirmed'] }
      })
      .populate('user', 'name email')
      .populate({ path: 'barber', populate: { path: 'user', select: 'name' } })
      .populate('service', 'name price duration');

      logger.info(`Procesando ${appointments.length} recordatorios para ${tomorrow.toDateString()}`);

      let sentCount = 0;
      for (const appointment of appointments) {
        try {
          if (appointment.user && appointment.user.email) {
            // El recordatorio requiere el usuario destinatario (populado arriba)
            await emailService.sendAppointmentReminder(appointment, appointment.user);
            sentCount++;
            // Pequeña pausa entre envíos
            await this.sleep(500);
          }
        } catch (error) {
          logger.error(`Error enviando recordatorio para cita ${appointment._id}:`, error.message);
        }
      }

      logger.info(`Recordatorios enviados: ${sentCount}/${appointments.length}`);
    } catch (error) {
      logger.error('Error en sendAppointmentReminders:', error);
    }
  }

  // Configurar resúmenes diarios (8 PM todos los días)
  setupDailyReports() {
    // Expresión cron '0 20 * * *': todos los días a las 20:00 (America/Bogota)
    const dailyReportJob = cron.schedule('0 20 * * *', async () => {
      await this.sendDailyReports();
    }, {
      scheduled: false,
      timezone: 'America/Bogota'
    });

    this.jobs.set('dailyReports', dailyReportJob);
    dailyReportJob.start();
  }

  // Enviar resúmenes diarios a barberos
  async sendDailyReports() {
    try {
      // Rango del día actual: [hoy 00:00, mañana 00:00)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Obtener barberos activos
      const barbers = await Barber.find({ 
        isActive: true,
        'user.email': { $exists: true, $ne: null }
      }).populate('user', 'name email');

      logger.info(`Enviando resúmenes diarios a ${barbers.length} barberos`);

      for (const barber of barbers) {
        try {
          if (barber.user && barber.user.email) {
            // Obtener citas del día
            const appointments = await Appointment.find({
              barber: barber._id,
              date: { $gte: today, $lt: tomorrow },
              status: { $in: ['pending', 'confirmed', 'completed'] }
            })
            .populate('user', 'name')
            .populate('service', 'name price');

            // Enviar el resumen con el método real del servicio de email
            await emailService.sendDailySummary(barber.user || barber, appointments);
            await this.sleep(300);
          }
        } catch (error) {
          logger.error(`Error enviando resumen a barbero ${barber.user?.name}:`, error.message);
        }
      }

      logger.info('Resúmenes diarios enviados completamente');
    } catch (error) {
      logger.error('Error en sendDailyReports:', error);
    }
  }

  // Configurar limpieza de citas pendientes expiradas (cada 15 minutos)
  setupExpiredAppointmentCleanup() {
    // Expresión cron '*/15 * * * *': cada 15 minutos
    const cleanupJob = cron.schedule('*/15 * * * *', async () => {
      await this.cleanupExpiredPendingAppointments();
    }, {
      scheduled: false,
      timezone: 'America/Bogota'
    });

    this.jobs.set('expiredAppointmentCleanup', cleanupJob);
    cleanupJob.start();
  }

  // Limpiar citas pendientes expiradas
  // Delega en el caso de uso que cancela las citas cuya hora ya pasó.
  async cleanupExpiredPendingAppointments() {
    try {
      const result = await AppointmentUseCases.cleanupExpiredPendingAppointments();
      if (result.cleaned > 0) {
        logger.info(`Limpieza de citas expiradas: ${result.cleaned} citas canceladas`);
      }
    } catch (error) {
      logger.error('Error en limpieza de citas expiradas:', error);
    }
  }

  // Configurar resúmenes semanales (lunes 9 AM)
  setupWeeklyReports() {
    // Expresión cron '0 9 * * 1': lunes a las 09:00 (America/Bogota)
    const weeklyReportJob = cron.schedule('0 9 * * 1', async () => {
      await this.sendWeeklyReports();
    }, {
      scheduled: false,
      timezone: 'America/Bogota'
    });

    this.jobs.set('weeklyReports', weeklyReportJob);
    weeklyReportJob.start();
  }

  // Enviar resúmenes semanales a administradores
  // Toma como rango la semana pasada completa (lunes a domingo) y envía el mismo
  // resumen a cada admin activo.
  async sendWeeklyReports() {
    try {
      // Calcular rango de la semana pasada (lunes a domingo)
      const now = new Date();
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - now.getDay() - 6); // Lunes pasado
      lastMonday.setHours(0, 0, 0, 0);

      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);

      // Obtener administradores activos
      const admins = await User.find({ 
        role: 'admin', 
        isActive: true,
        email: { $exists: true, $ne: null }
      }).select('name email');

      logger.info(`Enviando resúmenes semanales a ${admins.length} administradores`);

      // Calcular estadísticas de la semana
      const stats = await this.getWeeklyStats(lastMonday, lastSunday);

      for (const admin of admins) {
        try {
          if (admin.email) {
            // El método de resumen semanal aún no está implementado; se omite sin romper el cron
            if (typeof emailService.sendWeeklySummaryToAdmin === 'function') {
              await emailService.sendWeeklySummaryToAdmin(admin, stats, lastMonday, lastSunday);
            } else {
              logger.warn('emailService.sendWeeklySummaryToAdmin no implementado; resumen semanal omitido');
            }
            await this.sleep(300);
          }
        } catch (error) {
          logger.error(`Error enviando resumen a admin ${admin.name}:`, error.message);
        }
      }

      logger.info('Resúmenes semanales enviados completamente');
    } catch (error) {
      logger.error('Error en sendWeeklyReports:', error);
    }
  }

  // Obtener estadísticas diarias para un barbero específico
  // Solo cuentan como ingreso las citas completadas; los demás estados se reportan igual.
  async getDailyStatsForBarber(barberId, startDate, endDate) {
    try {
      const appointments = await Appointment.find({
        barber: barberId,
        date: { $gte: startDate, $lt: endDate },
        isActive: true
      }).populate('services.service', 'name price');

      const completedAppointments = appointments.filter(apt => apt.status === 'completada');
      const totalRevenue = completedAppointments.reduce((sum, apt) => sum + (apt.totalAmount || 0), 0);
      
      return {
        totalAppointments: appointments.length,
        completedAppointments: completedAppointments.length,
        cancelledAppointments: appointments.filter(apt => apt.status === 'cancelada').length,
        totalRevenue: totalRevenue,
        averageRevenue: completedAppointments.length > 0 ? totalRevenue / completedAppointments.length : 0
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas diarias:', error);
      return {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        totalRevenue: 0,
        averageRevenue: 0
      };
    }
  }

  // Obtener estadísticas semanales generales
  // Calcula totales del rango y un desglose por barbero para el resumen semanal.
  async getWeeklyStats(startDate, endDate) {
    try {
      const appointments = await Appointment.find({
        date: { $gte: startDate, $lt: endDate },
        isActive: true
      }).populate('barber', 'name')
        .populate('services.service', 'name price');

      const completedAppointments = appointments.filter(apt => apt.status === 'completada');
      const totalRevenue = completedAppointments.reduce((sum, apt) => sum + (apt.totalAmount || 0), 0);

      // Estadísticas por barbero
      const barberStats = {};
      completedAppointments.forEach(apt => {
        const barberName = apt.barber?.name || 'Sin asignar';
        if (!barberStats[barberName]) {
          barberStats[barberName] = { count: 0, revenue: 0 };
        }
        barberStats[barberName].count++;
        barberStats[barberName].revenue += apt.totalAmount || 0;
      });

      return {
        totalAppointments: appointments.length,
        completedAppointments: completedAppointments.length,
        cancelledAppointments: appointments.filter(apt => apt.status === 'cancelada').length,
        totalRevenue: totalRevenue,
        averageRevenue: completedAppointments.length > 0 ? totalRevenue / completedAppointments.length : 0,
        barberStats: barberStats,
        dailyAverage: totalRevenue / 7
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas semanales:', error);
      return {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        totalRevenue: 0,
        averageRevenue: 0,
        barberStats: {},
        dailyAverage: 0
      };
    }
  }

  // Obtener el estado de todos los jobs
  getJobsStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }
    return status;
  }

  // Detener todos los trabajos programados
  stopAllJobs() {
    try {
      for (const [name, job] of this.jobs) {
        if (job && job.running) {
          job.stop();
          logger.info(`Job ${name} detenido`);
        }
      }
      logger.info('Todos los cron jobs han sido detenidos correctamente');
    } catch (error) {
      logger.error('Error deteniendo cron jobs:', error);
    }
  }

  // Utilidad para pausas entre operaciones
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar instancia singleton
// (los jobs se registran una sola vez por proceso)
const cronJobService = new CronJobService();
export default cronJobService;