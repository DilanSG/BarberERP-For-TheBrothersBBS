/**
 * Pruebas unitarias de InventoryUseCases.
 * Se inyecta un repositorio de inventario simulado para validar los casos de
 * uso sin conexión a MongoDB.
 */

import InventoryUseCases from '../../src/core/application/usecases/InventoryUseCases.js';
import { jest } from '@jest/globals';
import { Inventory } from '../../src/barrel.js';

const createUseCase = (repositoryOverrides = {}) => {
  const useCase = new InventoryUseCases();
  useCase.inventoryRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    ...repositoryOverrides
  };
  return useCase;
};

describe('InventoryUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInventory', () => {
    it('normaliza la respuesta del repositorio con paginación', async () => {
      const products = [{ _id: 'p1', name: 'Gel' }];
      const repository = {
        findAll: jest.fn().mockResolvedValue({
          products,
          total: 1,
          page: 1,
          totalPages: 1
        })
      };
      const useCase = createUseCase(repository);

      const result = await useCase.getInventory({}, { page: 1, limit: 50 });

      expect(repository.findAll).toHaveBeenCalledWith({
        filters: {},
        limit: 50,
        page: 1,
        sort: { name: 1 }
      });
      expect(result).toEqual({
        data: products,
        total: 1,
        pagination: { page: 1, limit: 50, totalPages: 1 }
      });
    });

    it('convierte errores del repositorio en un error de aplicación', async () => {
      const repository = {
        findAll: jest.fn().mockRejectedValue(new Error('fallo de conexión'))
      };
      const useCase = createUseCase(repository);

      await expect(useCase.getInventory()).rejects.toThrow('Error al obtener inventario');
    });
  });

  describe('getInventoryItemById', () => {
    it('devuelve el item solicitado', async () => {
      const item = { _id: 'p1', name: 'Gel', stock: 10 };
      const useCase = createUseCase({ findById: jest.fn().mockResolvedValue(item) });

      await expect(useCase.getInventoryItemById('p1')).resolves.toBe(item);
    });

    it('lanza 404 si el item no existe', async () => {
      const useCase = createUseCase({ findById: jest.fn().mockResolvedValue(null) });

      await expect(useCase.getInventoryItemById('no-existe'))
        .rejects.toThrow('Item de inventario no encontrado');
    });
  });

  describe('createInventoryItem', () => {
    it('registra el usuario que crea el item', async () => {
      const created = { _id: 'p1', name: 'Gel', createdBy: 'admin1' };
      const repository = { create: jest.fn().mockResolvedValue(created) };
      const useCase = createUseCase(repository);

      const result = await useCase.createInventoryItem({ name: 'Gel' }, { _id: 'admin1' });

      expect(repository.create).toHaveBeenCalledWith({ name: 'Gel', createdBy: 'admin1' });
      expect(result).toBe(created);
    });
  });

  describe('updateInventoryItem y deleteInventoryItem', () => {
    it('delega la actualización en el repositorio', async () => {
      const updated = { _id: 'p1', name: 'Gel Actualizado' };
      const repository = { update: jest.fn().mockResolvedValue(updated) };
      const useCase = createUseCase(repository);

      const result = await useCase.updateInventoryItem('p1', { name: 'Gel Actualizado' }, null);

      expect(repository.update).toHaveBeenCalledWith('p1', { name: 'Gel Actualizado' });
      expect(result).toBe(updated);
    });

    it('delega la eliminación en el repositorio', async () => {
      const repository = { delete: jest.fn().mockResolvedValue(true) };
      const useCase = createUseCase(repository);

      await expect(useCase.deleteInventoryItem('p1', null)).resolves.toBe(true);
      expect(repository.delete).toHaveBeenCalledWith('p1');
    });
  });

  describe('updateStock', () => {
    it('incrementa stock, contador de entradas y registra el movimiento', async () => {
      const item = { _id: 'p1', name: 'Gel', stock: 10 };
      const repository = { findById: jest.fn().mockResolvedValue(item) };
      const useCase = createUseCase(repository);
      const updated = { ...item, stock: 15 };
      Inventory.findByIdAndUpdate = jest.fn().mockResolvedValue(updated);

      const result = await useCase.updateStock('p1', 5, { _id: 'admin1' }, 'Reposición');

      expect(Inventory.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      const [id, update, options] = Inventory.findByIdAndUpdate.mock.calls[0];
      expect(id).toBe('p1');
      expect(update.$inc).toMatchObject({ stock: 5, entries: 5 });
      expect(update.$inc.exits).toBeUndefined();
      expect(update.$push.movements).toMatchObject({
        type: 'add',
        quantity: 5,
        previousStock: 10,
        newStock: 15,
        reason: 'Reposición'
      });
      expect(options).toEqual({ new: true, runValidators: true });
      expect(result).toBe(updated);
    });

    it('rechaza un ajuste que dejaría el stock en negativo', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue({ _id: 'p1', stock: 3 })
      };
      const useCase = createUseCase(repository);

      await expect(useCase.updateStock('p1', -5, null))
        .rejects.toThrow('El stock no puede ser negativo');
    });
  });

  describe('getLowStockItems', () => {
    it('consulta los items con stock menor o igual al mínimo', async () => {
      const products = [{ _id: 'p1', name: 'Gel', stock: 2, minStock: 5 }];
      const repository = {
        findAll: jest.fn().mockResolvedValue({ products, total: 1 })
      };
      const useCase = createUseCase(repository);

      const result = await useCase.getLowStockItems();

      expect(repository.findAll).toHaveBeenCalledWith({
        filters: { $expr: { $lte: ['$stock', '$minStock'] } },
        sort: { stock: 1 },
        limit: 1000,
        page: 1
      });
      expect(result).toEqual(products);
    });
  });

  describe('_buildInventoryQuery', () => {
    it('construye filtros permitidos, búsqueda y stock bajo', () => {
      const useCase = createUseCase();

      const query = useCase._buildInventoryQuery({
        category: 'styling',
        isActive: true,
        search: 'gel',
        lowStock: true,
        supplier: 'Proveedor'
      });

      expect(query.category).toBe('styling');
      expect(query.isActive).toBe(true);
      expect(query.supplier).toBe('Proveedor');
      expect(query.$or).toHaveLength(3);
      expect(query.$expr).toEqual({ $lte: ['$stock', '$minStock'] });
    });

    it('ignora filtros no permitidos', () => {
      const useCase = createUseCase();

      const query = useCase._buildInventoryQuery({ precio: 1000 });

      expect(query).toEqual({});
    });
  });
});
