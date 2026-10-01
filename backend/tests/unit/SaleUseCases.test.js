/**
 * Pruebas unitarias de SaleUseCases.
 * Cubren la resolución de barberos, los métodos de pago y la actualización de
 * estadísticas sin conexión a base de datos (se sustituyen métodos de modelo).
 */

import SaleUseCases from '../../src/core/application/usecases/SaleUseCases.js';
import { jest } from '@jest/globals';
import { Barber, PaymentMethod } from '../../src/barrel.js';

describe('SaleUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getValidPaymentMethods', () => {
    it('devuelve los identificadores de los métodos activos', async () => {
      PaymentMethod.find = jest.fn().mockResolvedValue([
        { backendId: 'efectivo' },
        { backendId: 'tarjeta' }
      ]);

      const result = await SaleUseCases.getValidPaymentMethods();

      expect(PaymentMethod.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual(['efectivo', 'tarjeta']);
    });

    it('usa los métodos por defecto si la consulta falla', async () => {
      PaymentMethod.find = jest.fn().mockRejectedValue(new Error('DB caída'));

      const result = await SaleUseCases.getValidPaymentMethods();

      expect(result).toEqual(['efectivo', 'tarjeta', 'transferencia']);
    });
  });

  describe('findBarberByIdOrUserId', () => {
    it('encuentra al barbero por su identificador directo', async () => {
      const barber = { _id: 'barber123', user: { _id: 'user456', name: 'Juan' } };
      Barber.findById = jest.fn().mockResolvedValue(barber);
      Barber.findOne = jest.fn();

      const result = await SaleUseCases.findBarberByIdOrUserId('barber123');

      expect(Barber.findById).toHaveBeenCalledWith('barber123');
      expect(Barber.findOne).not.toHaveBeenCalled();
      expect(result).toBe(barber);
    });

    it('encuentra al barbero por identificador de usuario', async () => {
      const barber = { _id: 'barber123', user: 'user456' };
      Barber.findById = jest.fn().mockResolvedValue(null);
      Barber.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(barber)
      });

      const result = await SaleUseCases.findBarberByIdOrUserId('user456');

      expect(Barber.findOne).toHaveBeenCalledWith({ user: 'user456' });
      expect(result).toBe(barber);
    });

    it('lanza error si el barbero no existe', async () => {
      Barber.findById = jest.fn().mockResolvedValue(null);
      Barber.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await expect(SaleUseCases.findBarberByIdOrUserId('no-existe'))
        .rejects.toThrow('Barbero no encontrado');
    });
  });

  describe('updateBarberStats', () => {
    it('incrementa ventas e ingresos del barbero', async () => {
      const barber = { _id: 'barber123', totalSales: 10, totalRevenue: 500000 };
      const updated = { ...barber, totalSales: 11, totalRevenue: 550000 };

      Barber.findById = jest.fn().mockResolvedValue(barber);
      Barber.findByIdAndUpdate = jest.fn().mockResolvedValue(updated);

      const result = await SaleUseCases.updateBarberStats('barber123', 50000);

      expect(Barber.findByIdAndUpdate).toHaveBeenCalledWith(
        'barber123',
        expect.objectContaining({
          $inc: { totalSales: 1, totalRevenue: 50000 }
        }),
        { new: true }
      );
      expect(result).toBe(updated);
    });

    it('devuelve null si el barbero no existe para no interrumpir la venta', async () => {
      Barber.findById = jest.fn().mockResolvedValue(null);
      Barber.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const result = await SaleUseCases.updateBarberStats('no-existe', 50000);

      expect(result).toBeNull();
    });
  });

  describe('getPeriodLabel', () => {
    const dailyDate = new Date('2025-06-15T12:00:00.000Z');

    it('etiqueta un período diario', () => {
      const label = SaleUseCases.getPeriodLabel('daily', dailyDate, dailyDate);

      expect(typeof label).toBe('string');
      expect(label).toContain('2025');
      expect(label).toContain('15');
    });

    it('etiqueta un período semanal', () => {
      const start = new Date('2025-06-09T12:00:00.000Z');
      const end = new Date('2025-06-15T12:00:00.000Z');

      const label = SaleUseCases.getPeriodLabel('weekly', start, end);

      expect(label.startsWith('Semana del ')).toBe(true);
      expect(label).toContain(' al ');
    });

    it('etiqueta un período mensual', () => {
      const label = SaleUseCases.getPeriodLabel('monthly', dailyDate, dailyDate);

      expect(label).toContain('2025');
      expect(label).not.toContain('Semana');
    });

    it('usa la etiqueta por defecto para un tipo desconocido', () => {
      expect(SaleUseCases.getPeriodLabel('anual', dailyDate, dailyDate)).toBe('Período');
    });
  });
});
