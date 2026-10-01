import { Service, Barber, AppError, logger } from '../../../barrel.js';

// Casos de uso del catálogo de servicios ofrecidos.
// Cubre CRUD, asignación/remoción de servicios a barberos y estadísticas de uso.
class ServiceOfferedUseCases {
  // Lista servicios activos con filtros adicionales; ordena por categoría y nombre.
  static async getAllServices(filters = {}) {
    try {
      const services = await Service.find({ ...filters, isActive: true })
        .sort({ category: 1, name: 1 });
      
      logger.debug(`Recuperados ${services.length} servicios`);
      return services;
    } catch (error) {
      logger.error('Error obteniendo servicios:', error);
      throw new AppError('Error al obtener la lista de servicios', 500);
    }
  }

  // Obtiene un servicio por id; lanza 404 si no existe.
  static async getServiceById(serviceId) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new AppError('Servicio no encontrado', 404);
      }
      return service;
    } catch (error) {
      logger.error(`Error obteniendo servicio ${serviceId}:`, error);
      throw error;
    }
  }

  // Crea un servicio validando que el nombre no esté en uso.
  static async createService(serviceData) {
    try {
      // Verificar si ya existe un servicio con el mismo nombre
      const existingService = await Service.findOne({ name: serviceData.name });
      if (existingService) {
        throw new AppError('Ya existe un servicio con este nombre', 400);
      }

      const service = await Service.create(serviceData);
      
      logger.info(`Nuevo servicio creado: ${service.name}`);
      return service;
    } catch (error) {
      logger.error('Error creando servicio:', error);
      throw error;
    }
  }

  // Actualiza un servicio existente. Si cambia el nombre verifica que no lo
  // tenga otro servicio; corre validaciones del schema (runValidators).
  static async updateService(serviceId, updateData) {
    try {
      // Verificar que el servicio existe
      const service = await this.getServiceById(serviceId);

      // Si se está actualizando el nombre, verificar que no exista otro con ese nombre
      if (updateData.name && updateData.name !== service.name) {
        const existingService = await Service.findOne({ name: updateData.name });
        if (existingService) {
          throw new AppError(`Ya existe un servicio con este nombre`, 400);
        }
      }

      // Actualizar servicio
      const updatedService = await Service.findByIdAndUpdate(
        serviceId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      logger.info(`Servicio ${serviceId} actualizado`);
      return updatedService;
    } catch (error) {
      logger.error(`Error actualizando servicio ${serviceId}:`, error);
      throw error;
    }
  }

  // Baja lógica de un servicio.
  // Bloquea si hay citas futuras pending/confirmed; si no, lo marca isActive:false,
  // registra deactivatedAt y lo retira del arreglo services de todos los barberos.
  static async deleteService(serviceId) {
    try {
      // Verificar si el servicio está siendo usado en citas futuras
      const Appointment = (await import('../../domain/entities/Appointment.js')).default;
      const futureAppointments = await Appointment.countDocuments({
        service: serviceId,
        date: { $gt: new Date() },
        status: { $in: ['pending', 'confirmed'] }
      });

      if (futureAppointments > 0) {
        throw new AppError(
          'No se puede eliminar el servicio porque tiene citas programadas', 
          400
        );
      }

      // Desactivar el servicio en lugar de eliminarlo
      const service = await Service.findByIdAndUpdate(
        serviceId,
        { 
          $set: { 
            isActive: false,
            deactivatedAt: new Date()
          } 
        },
        { new: true }
      );

      if (!service) {
        throw new AppError('Servicio no encontrado', 404);
      }

      // Remover el servicio de los perfiles de barberos
      await Barber.updateMany(
        { services: serviceId },
        { $pull: { services: serviceId } }
      );

      logger.info(`Servicio ${serviceId} desactivado`);
      return { message: 'Servicio desactivado correctamente' };
    } catch (error) {
      logger.error(`Error eliminando servicio ${serviceId}:`, error);
      throw error;
    }
  }

  // Asigna un servicio activo a un barbero si aún no lo tiene.
  static async assignServiceToBarber(barberId, serviceId) {
    try {
      // Verificar que el servicio existe y está activo
      const service = await this.getServiceById(serviceId);
      if (!service.isActive) {
        throw new AppError('El servicio no está activo', 400);
      }

      // Verificar que el barbero existe
      const barber = await Barber.findById(barberId);
      if (!barber) {
        throw new AppError('Barbero no encontrado', 404);
      }

      // Verificar si el barbero ya tiene este servicio
      if (barber.services.includes(serviceId)) {
        throw new AppError(`El barbero ya tiene asignado este servicio`, 400);
      }

      // Agregar el servicio al barbero
      barber.services.push(serviceId);
      await barber.save();

      logger.info(`Servicio ${serviceId} asignado al barbero ${barberId}`);
      return barber;
    } catch (error) {
      logger.error(`Error asignando servicio ${serviceId} al barbero ${barberId}:`, error);
      throw error;
    }
  }

  // Quita un servicio de un barbero.
  // Bloquea si existen citas futuras de ese barbero para ese servicio; si no,
  // lo remueve del arreglo con $pull.
  static async removeServiceFromBarber(barberId, serviceId) {
    try {
      // Verificar citas futuras para este servicio y barbero
      const Appointment = (await import('../../domain/entities/Appointment.js')).default;
      const futureAppointments = await Appointment.countDocuments({
        barber: barberId,
        service: serviceId,
        date: { $gt: new Date() },
        status: { $in: ['pending', 'confirmed'] }
      });

      if (futureAppointments > 0) {
        throw new AppError(
          'No se puede remover el servicio porque hay citas programadas', 
          400
        );
      }

      // Remover el servicio del barbero
      const barber = await Barber.findByIdAndUpdate(
        barberId,
        { $pull: { services: serviceId } },
        { new: true }
      );

      if (!barber) {
        throw new AppError('Barbero no encontrado', 404);
      }

      logger.info(`Servicio ${serviceId} removido del barbero ${barberId}`);
      return barber;
    } catch (error) {
      logger.error(`Error removiendo servicio ${serviceId} del barbero ${barberId}:`, error);
      throw error;
    }
  }

  // Devuelve los servicios asignados a un barbero (documentos populados).
  static async getServicesByBarber(barberId) {
    try {
      const barber = await Barber.findById(barberId)
        .populate('services');

      if (!barber) {
        throw new AppError('Barbero no encontrado', 404);
      }

      return barber.services;
    } catch (error) {
      logger.error(`Error obteniendo servicios del barbero ${barberId}:`, error);
      throw error;
    }
  }

  // Estadísticas de uso por servicio.
  // Agregación: $lookup con appointments, cuenta citas y suma precios por
  // servicio, y agrupa por isActive para totales (conteo, precio promedio y
  // revenue total) por estado. Retorna { byStatus, total }.
  static async getServiceStats() {
    try {
      const stats = await Service.aggregate([
        {
          $lookup: {
            from: 'appointments',
            localField: '_id',
            foreignField: 'service',
            as: 'appointments'
          }
        },
        {
          $project: {
            name: 1,
            price: 1,
            isActive: 1,
            appointmentCount: { $size: '$appointments' },
            revenue: {
              $reduce: {
                input: '$appointments',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.price'] }
              }
            }
          }
        },
        {
          $group: {
            _id: '$isActive',
            services: { $push: '$$ROOT' },
            totalServices: { $sum: 1 },
            averagePrice: { $avg: '$price' },
            totalRevenue: { $sum: '$revenue' },
            totalAppointments: { $sum: '$appointmentCount' }
          }
        }
      ]);

      return {
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id ? 'active' : 'inactive'] = {
            count: stat.totalServices,
            averagePrice: stat.averagePrice,
            totalRevenue: stat.totalRevenue,
            totalAppointments: stat.totalAppointments,
            services: stat.services
          };
          return acc;
        }, {}),
        total: stats.reduce((acc, stat) => acc + stat.totalServices, 0)
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de servicios:', error);
      throw new AppError('Error al obtener estadísticas', 500);
    }
  }

  // Servicios activos marcados para mostrarse en la página principal
  // (showInHome), ordenados por fecha de creación descendente.
  static async getServicesForHome() {
    try {
      const services = await Service.find({ 
        isActive: true, 
        showInHome: true 
      }).sort({ createdAt: -1 });
      
      logger.debug(`Recuperados ${services.length} servicios para el Home`);
      return services;
    } catch (error) {
      logger.error('Error obteniendo servicios para Home:', error);
      throw new AppError('Error al obtener servicios para el Home', 500);
    }
  }
}

export default ServiceOfferedUseCases;
