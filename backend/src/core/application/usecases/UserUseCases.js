import { User, Barber } from '../../domain/entities/index.js';
import { AppError, logger } from '../../../barrel.js';
import DIContainer from '../../../shared/container/index.js';

// UserUseCases - Casos de uso para gestión de usuarios
// CRUD de usuarios con Repository Pattern (DI), borrado lógico y permanente
// (transaccional, arrastrando el perfil de barbero) y estadísticas de roles.
class UserUseCases {
  // Resuelve los repositorios de usuarios y barberos desde el contenedor DI.
  constructor() {
    // Obtener repositorios del contenedor DI
    this.userRepository = DIContainer.get('UserRepository');
    this.barberRepository = DIContainer.get('BarberRepository');
  }

  // Método estático para obtener instancia con DI
  static getInstance() {
    return new UserUseCases();
  }

  // Obtener todos los usuarios
  // Usa Repository Pattern con filtros y paginación
  // Por defecto excluye usuarios con isActive:false y no devuelve password;
  // acepta limit/page dentro de filters (100 y 1 por defecto).
  
  async getAllUsers(filters = {}, select = '-password') {
    try {
      // Por defecto, solo mostrar usuarios activos (no desactivados)
      const query = { 
        isActive: { $ne: false }, // Incluye usuarios sin isActive definido y con isActive: true
        ...filters 
      };
      
      logger.debug('UserUseCases: Obteniendo lista de usuarios', { query });
      
      const result = await this.userRepository.findAll({ 
        filter: query,
        select: select,
        limit: filters.limit || 100, // Límite por defecto
        page: filters.page || 1
      });
      
      const users = result.data || result; // Compatibilidad con diferentes formatos de respuesta
      logger.debug(`UserUseCases: Recuperados ${users.length} usuarios activos`);
      return users;
    } catch (error) {
      logger.error('UserUseCases: Error al obtener usuarios:', error);
      throw new AppError('Error al obtener la lista de usuarios', 500);
    }
  }

  // Obtener usuario por ID
  // Usa Repository Pattern con validación mejorada
  // Lanza 404 si no existe.
  async getUserById(userId, select = '-password') {
    try {
      logger.debug(`UserUseCases: Buscando usuario por ID: ${userId}`);
      
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError('Usuario no encontrado', 404);
      }
      
      logger.debug(`UserUseCases: Usuario encontrado: ${user._id}`);
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`UserUseCases: Error al obtener usuario ${userId}:`, error);
      throw new AppError('Error al obtener usuario', 500);
    }
  }

  // Actualizar usuario
  // Usa Repository Pattern con validación mejorada
  // Whitelist de campos: los comunes siempre; role/isActive solo si adminAction.
  // Si no queda ningún campo válido retorna el usuario sin cambios.
  async updateUser(userId, updateData, adminAction = false) {
    try {
      logger.debug(`UserUseCases: Iniciando actualización de usuario ${userId}`);
      
      // Verificar que el usuario existe usando repository
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // Lista de campos permitidos para actualización
      const allowedUpdates = ['name', 'email', 'phone', 'birthdate', 'profilePicture', 'preferences'];
      const adminAllowedUpdates = [...allowedUpdates, 'role', 'isActive'];

      // Filtrar actualizaciones permitidas
      const updates = {};
      Object.keys(updateData).forEach(key => {
        if ((adminAction && adminAllowedUpdates.includes(key)) || 
            (!adminAction && allowedUpdates.includes(key))) {
          updates[key] = updateData[key];
        }
      });

      logger.debug(`UserUseCases: Campos a actualizar: ${Object.keys(updates).join(', ')}`);

      // Validar que hay actualizaciones
      if (Object.keys(updates).length === 0) {
        logger.warn('UserUseCases: No hay campos válidos para actualizar');
        return existingUser;
      }

      // Usar repository para actualizar
      const startTime = Date.now();
      const updatedUser = await this.userRepository.update(userId, updates);
      const duration = Date.now() - startTime;
      
      logger.debug(`UserUseCases: Usuario actualizado exitosamente - ID: ${updatedUser._id}, Duración: ${duration}ms`);
      
      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`UserUseCases: Error actualizando usuario ${userId}:`, error);
      throw new AppError('Error al actualizar usuario', 500);
    }
  }

  // Eliminar usuario (soft delete - desactivación)
  // Usa Repository Pattern para desactivación
  // Marca isActive:false + deactivatedAt y, si el usuario es barbero, también
  // desactiva su perfil de barbero.
  async deleteUser(userId) {
    try {
      logger.debug(`UserUseCases: Desactivando usuario ${userId} (soft delete)`);
      
      // Verificar que el usuario existe
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // En lugar de eliminar, desactivamos usando repository
      const deactivatedUser = await this.userRepository.update(userId, {
        isActive: false,
        deactivatedAt: new Date()
      });

      // Si es barbero, desactivar su perfil
      if (existingUser.role === 'barber') {
        await this.deactivateBarberProfile(userId);
      }

      logger.debug(`UserUseCases: Usuario desactivado (soft delete): ${userId}`);
      return {
        message: 'Usuario desactivado correctamente',
        user: deactivatedUser
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`UserUseCases: Error desactivando usuario ${userId}:`, error);
      throw new AppError('Error al desactivar usuario', 500);
    }
  }

  // Eliminar usuario permanentemente (hard delete)
  // Elimina el usuario, su perfil de barbero y todos los datos relacionados
  // Esta acción es irreversible
  // Todo ocurre dentro de una transacción de Mongo: si algo falla se aborta y
  // el perfil de barbero propaga el error para forzar el rollback.
  async hardDeleteUser(userId) {
    const session = await User.startSession();
    session.startTransaction();

    try {
      logger.warn(`UserUseCases: ELIMINACIÓN PERMANENTE de usuario ${userId}`);
      
      // Verificar que el usuario existe
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // Si es barbero, eliminar completamente su perfil y datos relacionados
      if (existingUser.role === 'barber') {
        await this.hardDeleteBarberProfile(userId, session);
      }

      // Eliminar el usuario permanentemente
      await User.findByIdAndDelete(userId).session(session);

      await session.commitTransaction();
      logger.warn(`UserUseCases: Usuario ELIMINADO PERMANENTEMENTE: ${userId} (${existingUser.email})`);
      
      return {
        message: 'Usuario eliminado permanentemente',
        deletedUser: {
          id: userId,
          email: existingUser.email,
          name: existingUser.name
        }
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof AppError) throw error;
      logger.error(`UserUseCases: Error eliminando permanentemente usuario ${userId}:`, error);
      throw new AppError('Error al eliminar usuario permanentemente', 500);
    } finally {
      session.endSession();
    }
  }

  // Cambiar contraseña
  // Usa Repository Pattern para actualización, modelo para validación
  // Valida la contraseña actual con userRepository.validatePassword (400 si no
  // coincide) y persiste la nueva a través del repositorio.
  async changePassword(userId, currentPassword, newPassword) {
    try {
      logger.debug(`UserUseCases: Cambiando contraseña para usuario ${userId}`);
      
      // Verificar que el usuario existe usando repository
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // Validar contraseña usando repository
      const isCurrentPasswordValid = await this.userRepository.validatePassword(userId, currentPassword);
      if (!isCurrentPasswordValid) {
        throw new AppError('La contraseña actual es incorrecta', 400);
      }

      // Actualizar la contraseña usando repository
      await this.userRepository.update(userId, { password: newPassword });

      logger.debug(`UserUseCases: Contraseña actualizada para usuario ${userId}`);
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`UserUseCases: Error cambiando contraseña del usuario ${userId}:`, error);
      throw new AppError('Error al cambiar contraseña', 500);
    }
  }

  // Obtener estadísticas de usuarios
  // Usa Repository Pattern donde es posible, agregaciones directas donde es necesario
  // Calcula: total (no desactivados), activos en los últimos 30 días por
  // lastActivity, y el conteo agrupado por rol con una agregación directa.
  async getUserStats() {
    try {
      logger.debug('UserUseCases: Obteniendo estadísticas de usuarios');
      
      // Usar repository para conteos básicos
      const totalUsersResult = await this.userRepository.findAll({ 
        filter: { isActive: { $ne: false } }, 
        limit: 0 // Solo contar, no retornar datos
      });
      const totalUsers = totalUsersResult.total || 0;

      const activeUsersResult = await this.userRepository.findAll({ 
        filter: { 
          isActive: { $ne: false },
          lastActivity: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }, 
        limit: 0
      });
      const activeUsers = activeUsersResult.total || 0;
      
      // Para agregaciones complejas, usar modelo directamente (temporal)
      // TODO: Implementar método getStatsByRole en repository
      const usersByRole = await User.aggregate([
        { $match: { isActive: { $ne: false } } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      const stats = {
        total: totalUsers,
        active: activeUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };

      logger.debug('UserUseCases: Estadísticas obtenidas:', stats);
      return stats;
    } catch (error) {
      logger.error('UserUseCases: Error al obtener estadísticas:', error);
      throw new AppError('Error al obtener estadísticas', 500);
    }
  }

  // ========================================================================
  // ADAPTADORES DE COMPATIBILIDAD HACIA ATRÁS
  // Wrappers estáticos que delegan en una instancia creada con DI.
  // ========================================================================

  static async getAllUsers(filters = {}, select = '-password') {
    const instance = UserUseCases.getInstance();
    return await instance.getAllUsers(filters, select);
  }

  static async getUserById(userId, select = '-password') {
    const instance = UserUseCases.getInstance();
    return await instance.getUserById(userId, select);
  }

  static async updateUser(userId, updateData, adminAction = false) {
    const instance = UserUseCases.getInstance();
    return await instance.updateUser(userId, updateData, adminAction);
  }

  static async deleteUser(userId) {
    const instance = UserUseCases.getInstance();
    return await instance.deleteUser(userId);
  }

  static async hardDeleteUser(userId) {
    const instance = UserUseCases.getInstance();
    return await instance.hardDeleteUser(userId);
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const instance = UserUseCases.getInstance();
    return await instance.changePassword(userId, currentPassword, newPassword);
  }

  static async getUserStats() {
    const instance = UserUseCases.getInstance();
    return await instance.getUserStats();
  }

  // Desactivar perfil de barbero (soft delete)
  // Usa BarberRepository para desactivación
  // Busca el perfil por user y lo marca isActive:false; los errores se tragan
  // a propósito para no bloquear la desactivación del usuario.
  async deactivateBarberProfile(userId) {
    try {
      logger.debug(`UserUseCases: Desactivando perfil de barbero para usuario ${userId}`);
      
      // Buscar barbero por userId usando repository
      const barbers = await this.barberRepository.findAll({ 
        filter: { user: userId }, // Cambio: usar 'user' en lugar de 'userId'
        limit: 1
      });
      
      if (barbers.data && barbers.data.length > 0) {
        const barber = barbers.data[0];
        await this.barberRepository.update(barber._id, {
          isActive: false,
          deactivatedAt: new Date()
        });
        
        logger.debug(`UserUseCases: Perfil de barbero desactivado para usuario ${userId}`);
      }
    } catch (error) {
      logger.error(`UserUseCases: Error desactivando perfil de barbero para usuario ${userId}:`, error);
      // No lanzamos error aquí para no bloquear la desactivación del usuario
    }
  }

  // Eliminar permanentemente perfil de barbero (hard delete)
  // Elimina el perfil de barbero y actualiza/elimina datos relacionados
  // ADVERTENCIA: Esta acción es irreversible
  // Conserva ventas (las marca canceladas con nota), cancela citas, desvincula
  // reseñas (barber:null) y borra el perfil. Recibe una sesión de transacción y
  // relanza errores para provocar el rollback del borrado del usuario.
  async hardDeleteBarberProfile(userId, session = null) {
    try {
      logger.warn(`UserUseCases: ELIMINACIÓN PERMANENTE de perfil de barbero para usuario ${userId}`);
      
      // Buscar barbero por userId
      const barbers = await this.barberRepository.findAll({ 
        filter: { user: userId },
        limit: 1
      });
      
      if (barbers.data && barbers.data.length > 0) {
        const barber = barbers.data[0];
        const barberId = barber._id;
        
        logger.debug(`UserUseCases: Eliminando datos relacionados del barbero ${barberId}...`);
        
        // Importar modelos necesarios
        const Sale = (await import('../../domain/entities/Sale.js')).default;
        const Appointment = (await import('../../domain/entities/Appointment.js')).default;
        const Review = (await import('../../domain/entities/Review.js')).default;
        
        // Contar registros antes de eliminar
        const salesCount = await Sale.countDocuments({ barberId });
        const appointmentsCount = await Appointment.countDocuments({ barber: barberId });
        const reviewsCount = await Review.countDocuments({ barber: barberId });
        
        logger.warn(`UserUseCases: Barbero ${barberId} tiene:`);
        logger.warn(`  - ${salesCount} ventas`);
        logger.warn(`  - ${appointmentsCount} citas`);
        logger.warn(`  - ${reviewsCount} reseñas`);
        
        // OPCIÓN 1: Eliminar completamente (más agresivo)
        // await Sale.deleteMany({ barberId }).session(session);
        // await Appointment.deleteMany({ barber: barberId }).session(session);
        // await Review.deleteMany({ barber: barberId }).session(session);
        
        // OPCIÓN 2: Marcar como huérfanos o desactivar (más seguro para auditoría)
        // Las ventas se mantienen para registros contables
        await Sale.updateMany(
          { barberId },
          { 
            $set: { 
              notes: `[BARBERO ELIMINADO] ${barber.user?.name || 'Barbero'}`,
              status: 'cancelled' // Marcar como canceladas
            } 
          }
        ).session(session);
        
        // Las citas se cancelan
        await Appointment.updateMany(
          { barber: barberId },
          { 
            $set: { 
              status: 'cancelled',
              cancellationReason: 'Barbero eliminado del sistema',
              cancelledBy: 'admin',
              cancelledAt: new Date()
            } 
          }
        ).session(session);
        
        // Las reseñas se mantienen pero se marca el barbero como eliminado
        await Review.updateMany(
          { barber: barberId },
          { 
            $set: { 
              'barber': null // Desvincular del barbero
            } 
          }
        ).session(session);
        
        // Finalmente eliminar el perfil de barbero
        await Barber.findByIdAndDelete(barberId).session(session);
        
        logger.warn(`UserUseCases: Perfil de barbero ${barberId} ELIMINADO PERMANENTEMENTE`);
        logger.debug(`  - ${salesCount} ventas marcadas como canceladas`);
        logger.debug(`  - ${appointmentsCount} citas canceladas`);
        logger.debug(`  - ${reviewsCount} reseñas desvinculadas`);
      } else {
        logger.debug(`UserUseCases: No se encontró perfil de barbero para usuario ${userId}`);
      }
    } catch (error) {
      logger.error(`UserUseCases: Error eliminando permanentemente perfil de barbero para usuario ${userId}:`, error);
      throw error; // Lanzar error para hacer rollback de la transacción
    }
  }

  // Crear perfil de barbero
  // Crea un perfil de barbero para un usuario
  // Si ya existe un perfil lo reactiva (isActive:true, limpia deactivatedAt);
  // si no, crea uno con especialidad genérica y horario por defecto.
  async createBarberProfile(user) {
    try {
      logger.debug(`UserUseCases: Creando perfil de barbero para usuario ${user._id}`);
      
      // Verificar que el usuario existe
      const existingUser = await this.userRepository.findById(user._id);
      if (!existingUser) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // Verificar si ya existe un perfil de barbero
      const existingBarbers = await this.barberRepository.findAll({ 
        filter: { user: user._id },
        limit: 1
      });

      if (existingBarbers.data && existingBarbers.data.length > 0) {
        // Ya existe, solo reactivarlo
        const existingBarber = existingBarbers.data[0];
        const reactivatedBarber = await this.barberRepository.update(existingBarber._id, {
          isActive: true,
          deactivatedAt: null
        });
        logger.debug(`UserUseCases: Perfil de barbero reactivado para usuario ${user._id}`);
        return reactivatedBarber;
      }

      // Crear nuevo perfil de barbero
      const newBarber = await Barber.create({
        user: user._id,
        specialty: 'Barbero General',
        description: `Perfil de barbero para ${user.name}`,
        experience: 0,
        schedule: {
          monday: { start: '09:00', end: '18:00', available: true },
          tuesday: { start: '09:00', end: '18:00', available: true },
          wednesday: { start: '09:00', end: '18:00', available: true },
          thursday: { start: '09:00', end: '18:00', available: true },
          friday: { start: '09:00', end: '19:00', available: true },
          saturday: { start: '10:00', end: '16:00', available: true },
          sunday: { start: '10:00', end: '14:00', available: false }
        },
        rating: {
          average: 0,
          count: 0
        },
        isActive: true,
        isMainBarber: false,
        totalSales: 0,
        totalRevenue: 0
      });

      logger.debug(`UserUseCases: Perfil de barbero creado exitosamente - Barber ID: ${newBarber._id}, User ID: ${user._id}`);
      return newBarber;
    } catch (error) {
      logger.error(`UserUseCases: Error creando perfil de barbero para usuario ${user._id}:`, error);
      throw error;
    }
  }

  // Mantener versión estática por compatibilidad
  static async deactivateBarberProfile(userId) {
    const instance = UserUseCases.getInstance();
    return await instance.deactivateBarberProfile(userId);
  }

  static async createBarberProfile(user) {
    const instance = UserUseCases.getInstance();
    return await instance.createBarberProfile(user);
  }
}

export default UserUseCases;