// Implementación Repository de Barberos
// Implementación concreta del repositorio de barberos usando Mongoose
// Traduce los errores de Mongoose a AppError y expone averageRating/totalReviews como rating.

import IBarberRepository from '../../../core/domain/repositories/IBarberRepository.js';
import { Barber, logger, AppError } from '../../../barrel.js';

class BarberRepositoryImpl extends IBarberRepository {
  // Buscar barbero por ID
  // @param {string} id - ID del barbero
  // @returns {Promise<Barber|null>}
  async findById(id) {
    try {
      logger.info(`Buscando barbero por ID: ${id}`);
      const barber = await Barber.findById(id)
        .populate('user', 'name email phone profilePicture role')
        .lean();
      
      if (barber) {
        logger.info(`Barbero encontrado: ${barber.user?.name || barber._id}`);
        
        // Mapear averageRating y totalReviews a formato rating para el frontend
        barber.rating = {
          average: barber.averageRating || 0,
          count: barber.totalReviews || 0
        };
      }
      
      return barber;
    } catch (error) {
      logger.error(`Error al buscar barbero por ID ${id}:`, error);
      throw new AppError(`Error al buscar barbero: ${error.message}`, 500);
    }
  }

  // Buscar barbero por usuario
  // @param {string} userId - ID del usuario asociado
  // @returns {Promise<Barber|null>}
  async findByUserId(userId) {
    try {
      logger.info(`Buscando barbero por usuario ID: ${userId}`);
      const barber = await Barber.findOne({ user: userId })
        .populate('user', 'name email phone profilePicture role')
        .lean();
      
      if (barber) {
        logger.info(`Barbero encontrado por usuario: ${userId}`);
        
        // Mapear averageRating y totalReviews a formato rating para el frontend
        barber.rating = {
          average: barber.averageRating || 0,
          count: barber.totalReviews || 0
        };
      }
      
      return barber;
    } catch (error) {
      logger.error(`Error al buscar barbero por usuario ${userId}:`, error);
      throw new AppError(`Error al buscar barbero por usuario: ${error.message}`, 500);
    }
  }

  // Crear nuevo barbero
  // @param {Object} barberData - Datos del barbero
  // @returns {Promise<Barber>}
  async create(barberData) {
    try {
      logger.info('Creando nuevo barbero');
      const barber = await Barber.create(barberData);
      logger.info(`Barbero creado exitosamente: ${barber._id}`);
      
      // Retornar con populate
      return await this.findById(barber._id);
    } catch (error) {
      logger.error('Error al crear barbero:', error);
      
      if (error.code === 11000) {
        throw new AppError('Ya existe un barbero asociado a este usuario', 400);
      }
      
      throw new AppError(`Error al crear barbero: ${error.message}`, 500);
    }
  }

  // Actualizar barbero existente
  // @param {string} id - ID del barbero
  // @param {Object} updateData - Datos a actualizar
  // @returns {Promise<Barber>}
  async update(id, updateData) {
    try {
      logger.info(`Actualizando barbero: ${id}`);
      
      const barber = await Barber.findByIdAndUpdate(
        id,
        updateData,
        { 
          new: true, 
          runValidators: true 
        }
      )
        .populate('user', 'name email phone profilePicture role')
        .lean();

      if (!barber) {
        throw new AppError('Barbero no encontrado', 404);
      }

      // Mapear averageRating y totalReviews a formato rating para el frontend
      barber.rating = {
        average: barber.averageRating || 0,
        count: barber.totalReviews || 0
      };

      logger.info(`Barbero actualizado exitosamente: ${id}`);
      return barber;
    } catch (error) {
      logger.error(`Error actualizando barbero ${id}:`, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(`Error al actualizar barbero: ${error.message}`, 500);
    }
  }

  // Eliminar barbero
  // @param {string} id - ID del barbero
  // @returns {Promise<boolean>}
  async delete(id) {
    try {
      logger.info(`Eliminando barbero: ${id}`);
      const result = await Barber.findByIdAndDelete(id);
      
      if (!result) {
        throw new AppError('Barbero no encontrado', 404);
      }

      logger.info(`Barbero eliminado exitosamente: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error eliminando barbero ${id}:`, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(`Error al eliminar barbero: ${error.message}`, 500);
    }
  }

  // Buscar barberos activos
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<Barber[]>}
  async findActive(options = {}) {
    try {
      const { sort = { createdAt: 1 }, limit } = options;
      
      logger.info('Buscando barberos activos');
      
      let query = Barber.find({ isActive: true })
        .populate('user', 'name email phone profilePicture role')
        .sort(sort);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const barbers = await query.lean();
      
      // Mapear averageRating y totalReviews a formato rating para el frontend
      const barbersWithRating = barbers.map(barber => ({
        ...barber,
        rating: {
          average: barber.averageRating || 0,
          count: barber.totalReviews || 0
        }
      }));
      
      logger.info(`Encontrados ${barbers.length} barberos activos`);
      
      return barbersWithRating;
    } catch (error) {
      logger.error('Error buscando barberos activos:', error);
      throw new AppError(`Error al buscar barberos activos: ${error.message}`, 500);
    }
  }

  // Buscar barberos por disponibilidad
  // @param {Date} date - Fecha y hora
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<Barber[]>}
  async findAvailable(date, options = {}) {
    try {
      const { sort = { createdAt: 1 } } = options;
      
      logger.info(`Buscando barberos disponibles para: ${date}`);
      
      // Obtener día de la semana (0 = domingo, 1 = lunes, etc.)
      const dayOfWeek = date.getDay();
      const timeString = date.toTimeString().substring(0, 5); // HH:MM
      
      // Buscar barberos activos que trabajen en ese día y hora
      const barbers = await Barber.find({
        isActive: true,
        [`workingHours.${dayOfWeek}.isWorking`]: true,
        [`workingHours.${dayOfWeek}.startTime`]: { $lte: timeString },
        [`workingHours.${dayOfWeek}.endTime`]: { $gte: timeString }
      })
        .populate('user', 'name email phone profilePicture role')
        .sort(sort)
        .lean();
      
      // Mapear averageRating y totalReviews a formato rating para el frontend
      const barbersWithRating = barbers.map(barber => ({
        ...barber,
        rating: {
          average: barber.averageRating || 0,
          count: barber.totalReviews || 0
        }
      }));
      
      logger.info(`Encontrados ${barbers.length} barberos disponibles`);
      return barbersWithRating;
    } catch (error) {
      logger.error('Error buscando barberos disponibles:', error);
      throw new AppError(`Error al buscar barberos disponibles: ${error.message}`, 500);
    }
  }

  // Obtener estadísticas del barbero
  // @param {string} barberId - ID del barbero
  // @param {Date} startDate - Fecha de inicio
  // @param {Date} endDate - Fecha de fin
  // @returns {Promise<Object>}
  async getBarberStats(barberId, startDate, endDate) {
    try {
      logger.info(`Obteniendo estadísticas del barbero ${barberId} de ${startDate} a ${endDate}`);
      
      // Import aquí para evitar dependencias circulares
      const Appointment = (await import('../../../core/domain/entities/Appointment.js')).default;
      const Sale = (await import('../../../core/domain/entities/Sale.js')).default;
      
      const [appointmentStats, salesStats] = await Promise.all([
        // Estadísticas de citas: agrupa por estado y suma ingresos en el rango
        Appointment.aggregate([
          {
            $match: {
              barber: barberId,
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalRevenue: { $sum: '$total' }
            }
          }
        ]),
        // Estadísticas de ventas: totales y promedio del periodo
        Sale.aggregate([
          {
            $match: {
              barber: barberId,
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: 1 },
              totalRevenue: { $sum: '$total' },
              avgSaleAmount: { $avg: '$total' }
            }
          }
        ])
      ]);
      
      const stats = {
        appointments: {
          total: appointmentStats.reduce((acc, stat) => acc + stat.count, 0),
          byStatus: appointmentStats,
          revenue: appointmentStats.reduce((acc, stat) => acc + (stat.totalRevenue || 0), 0)
        },
        sales: salesStats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          avgSaleAmount: 0
        }
      };
      
      logger.info('Estadísticas del barbero obtenidas exitosamente');
      return stats;
    } catch (error) {
      logger.error(`Error obteniendo estadísticas del barbero ${barberId}:`, error);
      throw new AppError(`Error al obtener estadísticas del barbero: ${error.message}`, 500);
    }
  }

  // Listar todos los barberos con paginación y filtros
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<{barbers: Barber[], total: number, page: number, totalPages: number}>}
  async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        filters = {}
      } = options;

      logger.debug(`Listando barberos - Página: ${page}, Límite: ${limit}`);

      const skip = (page - 1) * limit;
      
      // Ejecutar consultas en paralelo
      const [barbers, total] = await Promise.all([
        Barber.find(filters)
          .populate('user', 'name email phone profilePicture role')
          .populate('services', 'name price duration description category isActive')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Barber.countDocuments(filters)
      ]);

      // Mapear averageRating y totalReviews a formato rating para el frontend
      const barbersWithRating = barbers.map(barber => ({
        ...barber,
        rating: {
          average: barber.averageRating || 0,
          count: barber.totalReviews || 0
        }
      }));

      const totalPages = Math.ceil(total / limit);

      logger.info(`Encontrados ${barbers.length} barberos de ${total} totales`);

      return {
        barbers: barbersWithRating,
        total,
        page: Number(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };
    } catch (error) {
      logger.error('Error listando barberos:', error);
      throw new AppError(`Error al listar barberos: ${error.message}`, 500);
    }
  }

  // Verificar si un barbero existe
  // @param {string} id - ID del barbero
  // @returns {Promise<boolean>}
  async exists(id) {
    try {
      const count = await Barber.countDocuments({ _id: id });
      return count > 0;
    } catch (error) {
      logger.error(`Error verificando existencia del barbero ${id}:`, error);
      return false;
    }
  }

  // Contar barberos activos
  // @param {Object} filters - Filtros opcionales
  // @returns {Promise<number>}
  async count(filters = {}) {
    try {
      logger.info('Contando barberos con filtros:', filters);
      const count = await Barber.countDocuments(filters);
      logger.info(`Total barberos encontrados: ${count}`);
      return count;
    } catch (error) {
      logger.error('Error contando barberos:', error);
      throw new AppError(`Error al contar barberos: ${error.message}`, 500);
    }
  }

  // Actualizar horarios de trabajo del barbero
  // @param {string} id - ID del barbero
  // @param {Object} schedule - Horarios de trabajo
  // @returns {Promise<Barber>}
  async updateSchedule(id, schedule) {
    try {
      logger.info(`Actualizando horarios del barbero: ${id}`);
      
      const barber = await Barber.findByIdAndUpdate(
        id,
        { workingHours: schedule },
        { 
          new: true, 
          runValidators: true 
        }
      ).populate('user', 'name email phone profilePicture role');

      if (!barber) {
        throw new AppError('Barbero no encontrado', 404);
      }

      logger.info(`Horarios del barbero actualizados exitosamente: ${id}`);
      return barber;
    } catch (error) {
      logger.error(`Error actualizando horarios del barbero ${id}:`, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(`Error al actualizar horarios del barbero: ${error.message}`, 500);
    }
  }
}

export default BarberRepositoryImpl;


