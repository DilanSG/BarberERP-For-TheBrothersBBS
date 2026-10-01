// Barrel exports para backend - Índice central de utilidades compartidas
//
// Centraliza las exportaciones más utilizadas para simplificar imports
// y reducir la complejidad de rutas relativas profundas.

// Utilidades compartidas más utilizadas
export { AppError, CommonErrors, asyncHandler } from './shared/utils/errors.js';
export { logger } from './shared/utils/logger.js';

// Configuraciones centralizadas
export { default as config } from './shared/config/index.js';
export { corsOptions } from './shared/config/cors.js';

// Middleware de validación
export { handleValidationErrors, validateMongoId, validateId, validateBarberId, validateUserUpdate, commonValidations } from './presentation/middleware/validation.js';

// Middleware de cache
export { cacheMiddleware, invalidateCacheMiddleware, conditionalCache, partialCache } from './presentation/middleware/cache.js';

// Entidades del dominio
export { default as User } from './core/domain/entities/User.js';
export { default as Appointment } from './core/domain/entities/Appointment.js';
export { default as Barber } from './core/domain/entities/Barber.js';
export { default as Service } from './core/domain/entities/Service.js';
export { default as Inventory } from './core/domain/entities/Inventory.js';
export { default as InventoryLog } from './core/domain/entities/InventoryLog.js';
export { default as InventorySnapshot } from './core/domain/entities/InventorySnapshot.js';
export { default as Sale } from './core/domain/entities/Sale.js';
export { default as Expense } from './core/domain/entities/Expense.js';
export { default as PaymentMethod } from './core/domain/entities/PaymentMethod.js';
export { default as Socio } from './core/domain/entities/Socio.js';
export { default as Review } from './core/domain/entities/Review.js';

// Servicios de aplicación más utilizados
export { default as AuthService } from './core/application/usecases/AuthUseCases.js';
export { default as UserService } from './core/application/usecases/UserUseCases.js';
export { default as AppointmentService } from './core/application/usecases/appointmentService.js';
export { default as BarberService } from './core/application/usecases/BarberUseCases.js';
export { default as InventoryService } from './core/application/usecases/InventoryUseCases.js';
export { default as SaleService } from './core/application/usecases/SaleUseCases.js';
export { default as ServiceOfferedService } from './core/application/usecases/ServiceOfferedUseCases.js';

// Middleware más utilizado
export { protect, adminAuth, barberAuth, sameUserOrAdmin } from './presentation/middleware/auth.js';
export { errorHandler } from './presentation/middleware/errorHandler.js';

// Helpers y utilidades específicas
export { default as RecurrenceCalculator } from './core/application/services/RecurrenceCalculatorAdapter.js';

// Constantes de ventas
export { SALE_TYPES, SALE_STATUS, getValidSaleTypes, isValidSaleType, getSaleTypeDisplayName, VALIDATION_MESSAGES } from './shared/constants/salesConstants.js';

// Re-exportar módulo de gastos recurrentes desde shared
export * from './shared/recurring-expenses/index.js';