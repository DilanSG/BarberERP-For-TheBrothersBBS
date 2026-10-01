/**
 * Script 3: Validación de reportes y análisis de datos generados
 * Verifica que todos los reportes funcionen correctamente con los datos poblados
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Importar modelos
import User from '../src/core/domain/entities/User.js';
import Barber from '../src/core/domain/entities/Barber.js';
import Service from '../src/core/domain/entities/Service.js';
import Inventory from '../src/core/domain/entities/Inventory.js';
import Appointment from '../src/core/domain/entities/Appointment.js';
import Sale from '../src/core/domain/entities/Sale.js';
import Review from '../src/core/domain/entities/Review.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

class ReportValidator {
  constructor() {
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setMonth(this.startDate.getMonth() - 2);
    
    this.reports = {};
    this.errors = [];
    this.warnings = [];
  }

  async validate() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('Conectado a MongoDB para validación de reportes', colors.green);

      await this.validateDataIntegrity();
      await this.generateBasicReports();
      await this.generateAdvancedReports();
      await this.validateBusinessLogic();
      await this.displayValidationResults();

      await mongoose.disconnect();
      
      if (this.errors.length === 0) {
        log('\n¡Todos los reportes funcionan correctamente!', colors.green);
      } else {
        log(`\nSe encontraron ${this.errors.length} errores en los reportes`, colors.red);
      }

    } catch (error) {
      log(`Error durante la validación: ${error.message}`, colors.red);
      console.error(error);
      process.exit(1);
    }
  }

  async validateDataIntegrity() {
    log('\nValidando integridad de datos...', colors.cyan);
    
    try {
      // Contar registros totales
      const counts = {
        users: await User.countDocuments({ role: 'user', isActive: true }),
        barbers: await Barber.countDocuments({ isActive: true }),
        services: await Service.countDocuments({ isActive: true }),
        products: await Inventory.countDocuments({ stock: { $gt: 0 } }),
        appointments: await Appointment.countDocuments(),
        sales: await Sale.countDocuments(),
        reviews: await Review.countDocuments()
      };

      log(`   Registros encontrados:`);
      Object.entries(counts).forEach(([key, count]) => {
        log(`      • ${key}: ${count}`);
      });

      // Validar que hay datos suficientes
      if (counts.appointments < 50) {
        this.warnings.push(`Pocas citas generadas: ${counts.appointments} (mínimo recomendado: 50)`);
      }
      
      if (counts.sales < 30) {
        this.warnings.push(`Pocas ventas generadas: ${counts.sales} (mínimo recomendado: 30)`);
      }

      // Validar relaciones
      const appointmentsWithInvalidRefs = await Appointment.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userRef'
          }
        },
        {
          $lookup: {
            from: 'barbers',
            localField: 'barber',
            foreignField: '_id',
            as: 'barberRef'
          }
        },
        {
          $lookup: {
            from: 'services',
            localField: 'service',
            foreignField: '_id',
            as: 'serviceRef'
          }
        },
        {
          $match: {
            $or: [
              { userRef: { $size: 0 } },
              { barberRef: { $size: 0 } },
              { serviceRef: { $size: 0 } }
            ]
          }
        }
      ]);

      if (appointmentsWithInvalidRefs.length > 0) {
        this.errors.push(`${appointmentsWithInvalidRefs.length} citas con referencias inválidas`);
      }

      log(`   Integridad de datos validada`);
      
    } catch (error) {
      this.errors.push(`Error validando integridad: ${error.message}`);
    }
  }

  async generateBasicReports() {
    log('\nGenerando reportes básicos...', colors.cyan);
    
    try {
      // 1. Reporte de citas por estado
      const appointmentsByStatus = await Appointment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ['$totalRevenue', 0] } }
          }
        }
      ]);

      this.reports.appointmentsByStatus = appointmentsByStatus;
      log(`   Citas por estado:`);
      appointmentsByStatus.forEach(item => {
        log(`      • ${item._id}: ${item.count} citas ($${item.totalRevenue.toLocaleString()})`);
      });

      // 2. Reporte de ventas por barbero
      const salesByBarber = await Sale.aggregate([
        {
          $group: {
            _id: '$barberId',
            barberName: { $first: '$barberName' },
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            productSales: {
              $sum: { $cond: [{ $eq: ['$type', 'product'] }, 1, 0] }
            },
            walkInSales: {
              $sum: { $cond: [{ $eq: ['$type', 'walkIn'] }, 1, 0] }
            }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      this.reports.salesByBarber = salesByBarber;
      log(`   Ventas por barbero:`);
      salesByBarber.forEach(item => {
        log(`      • ${item.barberName}: ${item.totalSales} ventas ($${item.totalRevenue.toLocaleString()})`);
      });

      // 3. Reporte de métodos de pago
      const paymentMethods = await Promise.all([
        // Citas completadas
        Appointment.aggregate([
          { $match: { status: 'completed', paymentMethod: { $exists: true } } },
          {
            $group: {
              _id: '$paymentMethod',
              count: { $sum: 1 },
              revenue: { $sum: { $ifNull: ['$totalRevenue', 0] } }
            }
          }
        ]),
        // Ventas
        Sale.aggregate([
          {
            $group: {
              _id: '$paymentMethod',
              count: { $sum: 1 },
              revenue: { $sum: '$totalAmount' }
            }
          }
        ])
      ]);

      // Combinar métodos de pago
      const combinedPayments = {};
      [...paymentMethods[0], ...paymentMethods[1]].forEach(item => {
        if (!combinedPayments[item._id]) {
          combinedPayments[item._id] = { count: 0, revenue: 0 };
        }
        combinedPayments[item._id].count += item.count;
        combinedPayments[item._id].revenue += item.revenue;
      });

      this.reports.paymentMethods = combinedPayments;
      log(`   Métodos de pago:`);
      Object.entries(combinedPayments).forEach(([method, data]) => {
        log(`      • ${method}: ${data.count} transacciones ($${data.revenue.toLocaleString()})`);
      });

    } catch (error) {
      this.errors.push(`Error en reportes básicos: ${error.message}`);
    }
  }

  async generateAdvancedReports() {
    log('\nGenerando reportes avanzados...', colors.cyan);
    
    try {
      // 1. Reporte temporal (por mes)
      const monthlyReport = await Appointment.aggregate([
        {
          $match: {
            date: { $gte: this.startDate, $lte: this.endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            appointments: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            revenue: {
              $sum: { $ifNull: ['$totalRevenue', 0] }
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      this.reports.monthlyReport = monthlyReport;
      log(`   Reporte mensual:`);
      monthlyReport.forEach(item => {
        const monthName = new Date(item._id.year, item._id.month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        log(`      • ${monthName}: ${item.appointments} citas (${item.completed} completadas) - $${item.revenue.toLocaleString()}`);
      });

      // 2. Performance de barberos
      const barberPerformance = await Appointment.aggregate([
        {
          $lookup: {
            from: 'barbers',
            localField: 'barber',
            foreignField: '_id',
            as: 'barberInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'barberInfo.user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $lookup: {
            from: 'reviews',
            localField: 'barber',
            foreignField: 'barber',
            as: 'reviews'
          }
        },
        {
          $group: {
            _id: '$barber',
            barberName: { $first: { $arrayElemAt: ['$userInfo.name', 0] } },
            totalAppointments: { $sum: 1 },
            completedAppointments: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledAppointments: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            revenue: { $sum: { $ifNull: ['$totalRevenue', 0] } },
            averageRating: { $avg: '$reviews.rating' },
            totalReviews: { $sum: { $size: '$reviews' } }
          }
        },
        {
          $addFields: {
            completionRate: {
              $multiply: [
                { $divide: ['$completedAppointments', '$totalAppointments'] },
                100
              ]
            }
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      this.reports.barberPerformance = barberPerformance;
      log(`   Performance de barberos:`);
      barberPerformance.forEach(barber => {
        log(`      • ${barber.barberName}:`);
        log(`        - Citas: ${barber.totalAppointments} (${barber.completedAppointments} completadas)`);
        log(`        - Tasa completar: ${barber.completionRate.toFixed(1)}%`);
        log(`        - Ingresos: $${barber.revenue.toLocaleString()}`);
        log(`        - Rating: ${(barber.averageRating || 0).toFixed(1)} (${barber.totalReviews} reseñas)`);
      });

      // 3. Servicios más populares
      const popularServices = await Appointment.aggregate([
        {
          $lookup: {
            from: 'services',
            localField: 'service',
            foreignField: '_id',
            as: 'serviceInfo'
          }
        },
        {
          $group: {
            _id: '$service',
            serviceName: { $first: { $arrayElemAt: ['$serviceInfo.name', 0] } },
            price: { $first: { $arrayElemAt: ['$serviceInfo.price', 0] } },
            bookings: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            revenue: { $sum: { $ifNull: ['$totalRevenue', 0] } }
          }
        },
        { $sort: { bookings: -1 } }
      ]);

      this.reports.popularServices = popularServices;
      log(`   Servicios más populares:`);
      popularServices.forEach(service => {
        log(`      • ${service.serviceName}: ${service.bookings} reservas (${service.completed} completadas) - $${service.revenue.toLocaleString()}`);
      });

    } catch (error) {
      this.errors.push(`Error en reportes avanzados: ${error.message}`);
    }
  }

  async validateBusinessLogic() {
    log('\nValidando lógica de negocio...', colors.cyan);
    
    try {
      // 1. Validar que no hay citas duplicadas en mismo horario para mismo barbero
      const duplicateAppointments = await Appointment.aggregate([
        {
          $group: {
            _id: {
              barber: '$barber',
              date: '$date'
            },
            count: { $sum: 1 },
            appointments: { $push: '$_id' }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ]);

      if (duplicateAppointments.length > 0) {
        this.warnings.push(`${duplicateAppointments.length} posibles conflictos de horario encontrados`);
      }

      // 2. Validar fechas lógicas
      const invalidDates = await Appointment.aggregate([
        {
          $match: {
            $or: [
              { 
                $and: [
                  { date: { $gt: new Date() } }, 
                  { status: 'completed' }
                ]
              },
              {
                $expr: {
                  $gt: ['$createdAt', '$date']
                }
              }
            ]
          }
        }
      ]);

      if (invalidDates.length > 0) {
        this.errors.push(`${invalidDates.length} citas con fechas ilógicas`);
      }

      // 3. Validar precios coherentes
      const priceInconsistencies = await Appointment.aggregate([
        {
          $lookup: {
            from: 'services',
            localField: 'service',
            foreignField: '_id',
            as: 'serviceInfo'
          }
        },
        {
          $match: {
            $expr: {
              $ne: ['$price', { $arrayElemAt: ['$serviceInfo.price', 0] }]
            }
          }
        }
      ]);

      if (priceInconsistencies.length > 0) {
        this.warnings.push(`${priceInconsistencies.length} citas con precios inconsistentes`);
      }

      // 4. Validar que reseñas corresponden a citas completadas
      const invalidReviews = await Review.aggregate([
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointment',
            foreignField: '_id',
            as: 'appointmentInfo'
          }
        },
        {
          $match: {
            $or: [
              { appointmentInfo: { $size: 0 } },
              { 'appointmentInfo.status': { $ne: 'completed' } }
            ]
          }
        }
      ]);

      if (invalidReviews.length > 0) {
        this.errors.push(`${invalidReviews.length} reseñas asociadas a citas no completadas`);
      }

      log(`   Validación de lógica de negocio completada`);

    } catch (error) {
      this.errors.push(`Error validando lógica de negocio: ${error.message}`);
    }
  }

  async displayValidationResults() {
    log('\nRESULTADOS DE VALIDACIÓN', colors.magenta);
    log('═'.repeat(60), colors.magenta);
    
    // Resumen general
    const summary = {
      totalAppointments: await Appointment.countDocuments(),
      totalSales: await Sale.countDocuments(),
      totalReviews: await Review.countDocuments(),
      totalRevenue: 0
    };

    // Calcular ingresos totales
    const revenueResults = await Promise.all([
      Appointment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalRevenue', 0] } } } }
      ]),
      Sale.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    summary.totalRevenue = (revenueResults[0][0]?.total || 0) + (revenueResults[1][0]?.total || 0);

    log(`RESUMEN GENERAL:`, colors.blue);
    log(`   • Total citas: ${summary.totalAppointments}`);
    log(`   • Total ventas: ${summary.totalSales}`);
    log(`   • Total reseñas: ${summary.totalReviews}`);
    log(`   • Ingresos totales: $${summary.totalRevenue.toLocaleString()}`);

    // Estado de validación
    log(`\nESTADO DE VALIDACIÓN:`, colors.yellow);
    log(`   • Errores encontrados: ${this.errors.length}`, this.errors.length > 0 ? colors.red : colors.green);
    log(`   • Advertencias: ${this.warnings.length}`, this.warnings.length > 0 ? colors.yellow : colors.green);

    if (this.errors.length > 0) {
      log(`\nERRORES:`, colors.red);
      this.errors.forEach(error => log(`   • ${error}`, colors.red));
    }

    if (this.warnings.length > 0) {
      log(`\nADVERTENCIAS:`, colors.yellow);
      this.warnings.forEach(warning => log(`   • ${warning}`, colors.yellow));
    }

    // Reportes de muestra
    log(`\nDATOS DE MUESTRA PARA FRONTEND:`, colors.cyan);
    
    if (this.reports.barberPerformance && this.reports.barberPerformance.length > 0) {
      const topBarber = this.reports.barberPerformance[0];
      const barberName = topBarber.barberName || 'Sin nombre';
      log(`   TOP Barbero: ${barberName}`);
      log(`      - Ingresos: $${topBarber.revenue.toLocaleString()}`);
      log(`      - Tasa completar: ${topBarber.completionRate.toFixed(1)}%`);
      log(`      - Rating: ${(topBarber.averageRating || 0).toFixed(1)}/5`);
    }

    if (this.reports.popularServices && this.reports.popularServices.length > 0) {
      const topService = this.reports.popularServices[0];
      log(`   Servicio más popular: ${topService.serviceName}`);
      log(`      - Reservas: ${topService.bookings}`);
      log(`      - Ingresos: $${topService.revenue.toLocaleString()}`);
    }

    if (this.reports.monthlyReport && this.reports.monthlyReport.length > 0) {
      log(`   Datos mensuales disponibles: ${this.reports.monthlyReport.length} meses`);
      const totalMonthlyRevenue = this.reports.monthlyReport.reduce((sum, month) => sum + month.revenue, 0);
      log(`      - Promedio mensual: $${(totalMonthlyRevenue / this.reports.monthlyReport.length).toLocaleString()}`);
    }

    // Recomendaciones finales
    log(`\nRECOMENDACIONES:`, colors.green);
    
    if (this.errors.length === 0) {
      log(`   Los datos están listos para producción`);
      log(`   Todos los reportes funcionan correctamente`);
      log(`   La integridad de datos es válida`);
    } else {
      log(`   Corregir errores antes de usar en producción`);
    }

    log(`   Datos disponibles para:`);
    log(`      - Dashboard administrativo`);
    log(`      - Reportes de barberos`);
    log(`      - Análisis de ventas`);
    log(`      - Métricas de rendimiento`);
    log(`      - Reportes financieros`);

    log(`\n¡Sistema listo para demostración completa!`, colors.green);
  }
}

// Ejecutar validación
const validator = new ReportValidator();
validator.validate();