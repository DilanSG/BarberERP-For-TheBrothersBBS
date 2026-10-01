// Implementación Repository de Inventario
// Implementación concreta del repositorio de inventario usando Mongoose
// Gestiona stock (add/subtract validando negativos), estadísticas y valor del inventario.

import IInventoryRepository from '../../../core/domain/repositories/IInventoryRepository.js';
import { Inventory, logger, AppError } from '../../../barrel.js';

class InventoryRepositoryImpl extends IInventoryRepository {
  // Buscar producto por ID
  // @param {string} id - ID del producto
  // @returns {Promise<Inventory|null>}
  async findById(id) {
    try {
      logger.info(`Buscando producto por ID: ${id}`);
      const product = await Inventory.findById(id);
      
      if (product) {
        logger.info(`Producto encontrado: ${product.name}`);
      }
      
      return product;
    } catch (error) {
      logger.error(`Error al buscar producto por ID ${id}:`, error);
      throw new AppError(`Error al buscar producto: ${error.message}`, 500);
    }
  }

  // Buscar producto por nombre
  // @param {string} name - Nombre del producto
  // @returns {Promise<Inventory|null>}
  async findByName(name) {
    try {
      logger.info(`Buscando producto por nombre: ${name}`);
      const product = await Inventory.findOne({ name: new RegExp(name, 'i') });
      
      if (product) {
        logger.info(`Producto encontrado por nombre: ${name}`);
      }
      
      return product;
    } catch (error) {
      logger.error(`Error al buscar producto por nombre ${name}:`, error);
      throw new AppError(`Error al buscar producto por nombre: ${error.message}`, 500);
    }
  }

  // Crear nuevo producto
  // @param {Object} inventoryData - Datos del producto
  // @returns {Promise<Inventory>}
  async create(inventoryData) {
    try {
      logger.info(`Creando nuevo producto: ${inventoryData.name}`);
      const product = await Inventory.create(inventoryData);
      logger.info(`Producto creado exitosamente: ${product._id}`);
      
      return product;
    } catch (error) {
      logger.error('Error al crear producto:', error);
      
      if (error.code === 11000) {
        throw new AppError('Ya existe un producto con este nombre', 400);
      }
      
      throw new AppError(`Error al crear producto: ${error.message}`, 500);
    }
  }

  // Actualizar producto existente
  // @param {string} id - ID del producto
  // @param {Object} updateData - Datos a actualizar
  // @returns {Promise<Inventory>}
  async update(id, updateData) {
    try {
      logger.info(`Actualizando producto: ${id}`);
      
      const product = await Inventory.findByIdAndUpdate(
        id,
        updateData,
        { 
          new: true, 
          runValidators: true 
        }
      );

      if (!product) {
        throw new AppError('Producto no encontrado', 404);
      }

      logger.info(`Producto actualizado exitosamente: ${id}`);
      return product;
    } catch (error) {
      logger.error(`Error actualizando producto ${id}:`, error);
      
      if (error.code === 11000) {
        throw new AppError('Ya existe un producto con este nombre', 400);
      }
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(`Error al actualizar producto: ${error.message}`, 500);
    }
  }

  // Eliminar producto
  // @param {string} id - ID del producto
  // @returns {Promise<boolean>}
  async delete(id) {
    try {
      logger.info(`Eliminando producto: ${id}`);
      const result = await Inventory.findByIdAndDelete(id);
      
      if (!result) {
        throw new AppError('Producto no encontrado', 404);
      }

      logger.info(`Producto eliminado exitosamente: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error eliminando producto ${id}:`, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(`Error al eliminar producto: ${error.message}`, 500);
    }
  }

  // Actualizar stock del producto
  // @param {string} id - ID del producto
  // @param {number} quantity - Cantidad a agregar/reducir
  // @param {string} operation - 'add' o 'subtract'
  // @returns {Promise<Inventory>}
  async updateStock(id, quantity, operation) {
    try {
      logger.info(`Actualizando stock del producto ${id}: ${operation} ${quantity}`);
      
      const product = await this.findById(id);
      if (!product) {
        throw new AppError('Producto no encontrado', 404);
      }

      let newStock = product.stock;
      
      if (operation === 'add') {
        newStock += quantity;
      } else if (operation === 'subtract') {
        newStock -= quantity;
        if (newStock < 0) {
          throw new AppError('Stock insuficiente para la operación', 400);
        }
      } else {
        throw new AppError('Operación no válida. Use "add" o "subtract"', 400);
      }

      const updatedProduct = await Inventory.findByIdAndUpdate(
        id,
        { 
          stock: newStock,
          lastStockUpdate: new Date()
        },
        { new: true, runValidators: true }
      );

      logger.info(`Stock actualizado: ${product.stock} → ${newStock}`);
      return updatedProduct;
    } catch (error) {
      logger.error(`Error actualizando stock del producto ${id}:`, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(`Error al actualizar stock: ${error.message}`, 500);
    }
  }

  // Buscar productos con stock bajo
  // @param {number} threshold - Umbral mínimo de stock
  // @returns {Promise<Inventory[]>}
  async findLowStock(threshold = 10) {
    try {
      logger.info(`Buscando productos con stock bajo (umbral: ${threshold})`);
      
      const products = await Inventory.find({
        stock: { $lte: threshold },
        isActive: true
      }).sort({ stock: 1, name: 1 }).lean();
      
      logger.info(`Encontrados ${products.length} productos con stock bajo`);
      return products;
    } catch (error) {
      logger.error('Error buscando productos con stock bajo:', error);
      throw new AppError(`Error al buscar productos con stock bajo: ${error.message}`, 500);
    }
  }

  // Buscar productos por categoría
  // @param {string} category - Categoría del producto
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<Inventory[]>}
  async findByCategory(category, options = {}) {
    try {
      const { sort = { name: 1 }, limit } = options;
      
      logger.info(`Buscando productos por categoría: ${category}`);
      
      let query = Inventory.find({ category })
        .sort(sort);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const products = await query.lean();
      logger.info(`Encontrados ${products.length} productos en categoría ${category}`);
      
      return products;
    } catch (error) {
      logger.error(`Error buscando productos por categoría ${category}:`, error);
      throw new AppError(`Error al buscar productos por categoría: ${error.message}`, 500);
    }
  }

  // Buscar productos activos/inactivos
  // @param {boolean} isActive - Estado activo/inactivo
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<Inventory[]>}
  async findByStatus(isActive, options = {}) {
    try {
      const { sort = { name: 1 }, limit } = options;
      
      logger.info(`Buscando productos por estado: ${isActive ? 'activo' : 'inactivo'}`);
      
      let query = Inventory.find({ isActive })
        .sort(sort);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const products = await query.lean();
      logger.info(`Encontrados ${products.length} productos ${isActive ? 'activos' : 'inactivos'}`);
      
      return products;
    } catch (error) {
      logger.error(`Error buscando productos por estado:`, error);
      throw new AppError(`Error al buscar productos por estado: ${error.message}`, 500);
    }
  }

  // Obtener valor total del inventario
  // @returns {Promise<number>}
  async getTotalValue() {
    try {
      logger.info('Calculando valor total del inventario');
      
      const result = await Inventory.aggregate([
        // Solo productos activos
        {
          $match: { isActive: true }
        },
        // Valor total = precio * stock, además de conteos
        {
          $group: {
            _id: null,
            totalValue: {
              $sum: {
                $multiply: ['$price', '$stock']
              }
            },
            totalProducts: { $sum: 1 },
            totalStock: { $sum: '$stock' }
          }
        }
      ]);
      
      const stats = result[0] || { totalValue: 0, totalProducts: 0, totalStock: 0 };
      logger.info(`Valor total del inventario calculado: ${stats.totalValue}`);
      
      return stats.totalValue;
    } catch (error) {
      logger.error('Error calculando valor total del inventario:', error);
      throw new AppError(`Error al calcular valor total del inventario: ${error.message}`, 500);
    }
  }

  // Listar todos los productos con paginación y filtros
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<{products: Inventory[], total: number, page: number, totalPages: number}>}
  async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { name: 1 },
        filters = {}
      } = options;

      logger.debug(`Listando productos - Página: ${page}, Límite: ${limit}`);

      const skip = (page - 1) * limit;
      
      // Ejecutar consultas en paralelo
      const [products, total] = await Promise.all([
        Inventory.find(filters)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Inventory.countDocuments(filters)
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.debug(`Encontrados ${products.length} productos de ${total} totales`);

      return {
        products,
        total,
        page: Number(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };
    } catch (error) {
      logger.error('Error listando productos:', error);
      throw new AppError(`Error al listar productos: ${error.message}`, 500);
    }
  }

  // Buscar productos por rango de precios
  // @param {number} minPrice - Precio mínimo
  // @param {number} maxPrice - Precio máximo
  // @param {Object} options - Opciones de consulta
  // @returns {Promise<Inventory[]>}
  async findByPriceRange(minPrice, maxPrice, options = {}) {
    try {
      const { sort = { price: 1 }, limit } = options;
      
      logger.info(`Buscando productos por rango de precios: ${minPrice} - ${maxPrice}`);
      
      let query = Inventory.find({
        price: {
          $gte: minPrice,
          $lte: maxPrice
        }
      }).sort(sort);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const products = await query.lean();
      logger.info(`Encontrados ${products.length} productos en el rango de precios`);
      
      return products;
    } catch (error) {
      logger.error(`Error buscando productos por rango de precios:`, error);
      throw new AppError(`Error al buscar productos por rango de precios: ${error.message}`, 500);
    }
  }

  // Obtener estadísticas completas del inventario
  // @returns {Promise<Object>}
  async getInventoryStats() {
    try {
      logger.info('Obteniendo estadísticas del inventario');
      
      const [generalStats, categoryStats, stockStats] = await Promise.all([
        // Estadísticas generales (totales, activos, valor, stock y precio promedio)
        Inventory.aggregate([
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              activeProducts: {
                $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
              },
              totalValue: {
                $sum: { $multiply: ['$price', '$stock'] }
              },
              totalStock: { $sum: '$stock' },
              avgPrice: { $avg: '$price' }
            }
          }
        ]),
        // Por categoría
        Inventory.aggregate([
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              totalStock: { $sum: '$stock' },
              totalValue: {
                $sum: { $multiply: ['$price', '$stock'] }
              }
            }
          },
          { $sort: { totalValue: -1 } }
        ]),
        // Stock crítico: clasifica en 'low' (<=10), 'medium' (<=50) y 'high' (>50)
        Inventory.aggregate([
          {
            $group: {
              _id: {
                $cond: [
                  { $lte: ['$stock', 10] },
                  'low',
                  { $cond: [
                    { $lte: ['$stock', 50] },
                    'medium',
                    'high'
                  ]}
                ]
              },
              count: { $sum: 1 }
            }
          }
        ])
      ]);
      
      const stats = {
        general: generalStats[0] || {
          totalProducts: 0,
          activeProducts: 0,
          totalValue: 0,
          totalStock: 0,
          avgPrice: 0
        },
        byCategory: categoryStats,
        stockLevels: {
          low: stockStats.find(s => s._id === 'low')?.count || 0,
          medium: stockStats.find(s => s._id === 'medium')?.count || 0,
          high: stockStats.find(s => s._id === 'high')?.count || 0
        }
      };
      
      logger.info('Estadísticas del inventario obtenidas exitosamente');
      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del inventario:', error);
      throw new AppError(`Error al obtener estadísticas del inventario: ${error.message}`, 500);
    }
  }
}

export default InventoryRepositoryImpl;

