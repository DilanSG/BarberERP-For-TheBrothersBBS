import { logger } from '../utils/logger.js';
import UserRepositoryImpl from '../../infrastructure/database/repositories/UserRepositoryImpl.js';
import InventoryRepositoryImpl from '../../infrastructure/database/repositories/InventoryRepositoryImpl.js';
import BarberRepositoryImpl from '../../infrastructure/database/repositories/BarberRepositoryImpl.js';

// Contenedor de inyección de dependencias (singleton)
// Registra los repositorios de infraestructura y los entrega por nombre.
class DIContainer {
  constructor() {
    this.dependencies = new Map();
    this._initialized = false;
  }
  
  // Registra los repositorios la primera vez que se solicita una dependencia.
  _ensureInitialized() {
    if (!this._initialized) {
      this._registerRepositories();
      this._initialized = true;
      logger.info('DI Container inicializado (3 repositorios)');
    }
  }

  // Instancia los repositorios concretos de Mongoose.
  _registerRepositories() {
    try {
      this.dependencies.set('UserRepository', new UserRepositoryImpl());
      this.dependencies.set('InventoryRepository', new InventoryRepositoryImpl());
      this.dependencies.set('BarberRepository', new BarberRepositoryImpl());
    } catch (error) {
      logger.error('Error registrando repositorios:', error);
      throw error;
    }
  }

  // Obtiene una dependencia por nombre; lanza error si no está registrada.
  get(name) {
    this._ensureInitialized();
    
    if (!this.dependencies.has(name)) {
      logger.warn(`Dependencia '${name}' no encontrada en el contenedor DI`);
      throw new Error(`Dependencia '${name}' no está registrada`);
    }
    
    const dependency = this.dependencies.get(name);
    return dependency;
  }

  // Registra/sobrescribe una dependencia manualmente.
  register(name, useCase) {
    this.dependencies.set(name, useCase);
  }

  // Devuelve los nombres de todas las dependencias registradas.
  list() {
    this._ensureInitialized();
    return Array.from(this.dependencies.keys());
  }

  // Indica si una dependencia existe en el contenedor.
  has(name) {
    this._ensureInitialized();
    return this.dependencies.has(name);
  }

  // Limpia el contenedor (útil en tests) y permite re-inicializarlo.
  clear() {
    this.dependencies.clear();
    this._initialized = false;
    logger.debug('Contenedor DI limpiado');
  }
}

const container = new DIContainer();
export default container;
