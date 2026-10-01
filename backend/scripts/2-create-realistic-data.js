/**
 * Script 2: Creación de datos realistas para barbería
 * Genera citas, ventas y reseñas distribuidas naturalmente en 2 meses
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

class RealisticDataGenerator {
  constructor() {
    // Configuración del período (2 meses hacia atrás)
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setMonth(this.startDate.getMonth() - 2);
    
    // Horarios de trabajo de la barbería
    this.workingHours = {
      start: 8,  // 8:00 AM
      end: 19,   // 7:00 PM
      lunchBreak: { start: 12, end: 13 } // 12:00 PM - 1:00 PM
    };

    // Días de la semana (0 = domingo, 6 = sábado)
    this.workingDays = [1, 2, 3, 4, 5, 6]; // Lunes a sábado

    // Datos cargados
    this.users = [];
    this.barbers = [];
    this.services = [];
    this.products = [];
    
    // Datos generados
    this.appointments = [];
    this.sales = [];
    this.reviews = [];

    // Métodos de pago con sus pesos
    this.paymentMethods = [
      { method: 'cash', weight: 40 },
      { method: 'debit', weight: 25 },
      { method: 'credit', weight: 15 },
      { method: 'nequi', weight: 10 },
      { method: 'bancolombia', weight: 5 },
      { method: 'daviplata', weight: 5 }
    ];

    // Distribución de calificaciones
    this.ratingDistribution = [
      { rating: 5, weight: 40 },
      { rating: 4, weight: 35 },
      { rating: 3, weight: 20 },
      { rating: 2, weight: 4 },
      { rating: 1, weight: 1 }
    ];

    // Comentarios para reseñas por calificación
    this.reviewComments = {
      5: [
        "Excelente servicio, muy profesional y atento",
        "Quedé muy satisfecho con el corte, lo recomiendo 100%",
        "Ambiente agradable y corte perfecto, volveré pronto",
        "Gran barbero, sabe exactamente lo que necesito",
        "Servicio de calidad, precio justo y buen trato"
      ],
      4: [
        "Muy buen servicio, solo pequeños detalles por mejorar",
        "Corte bueno, tal vez un poco rápido pero bien hecho",
        "Recomendado, buen profesional y ambiente",
        "Satisfecho con el resultado, volveré",
        "Buena atención, corte como lo pedí"
      ],
      3: [
        "Servicio regular, cumple con lo básico",
        "Está bien, pero he tenido mejores experiencias",
        "Corte aceptable, precio justo",
        "Normal, sin grandes quejas ni elogios",
        "Puede mejorar en algunos aspectos"
      ],
      2: [
        "No quedé muy convencido con el resultado",
        "Servicio por debajo de las expectativas",
        "El corte no fue como lo pedí",
        "Falta más atención al detalle"
      ],
      1: [
        "Muy mala experiencia, no lo recomiendo",
        "Pésimo servicio, no volveré",
        "Terrible, perdí mi tiempo y dinero"
      ]
    };
  }

  async generate() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('Conectado a MongoDB para generación de datos', colors.green);

      await this.loadData();
      await this.generateAppointments();
      await this.generateSales();
      await this.generateReviews();
      await this.saveData();
      await this.displaySummary();

      await mongoose.disconnect();
      log('\nGeneración de datos completada exitosamente', colors.green);

    } catch (error) {
      log(`Error durante la generación: ${error.message}`, colors.red);
      console.error(error);
      process.exit(1);
    }
  }

  async loadData() {
    log('\nCargando datos base...', colors.cyan);
    
    this.users = await User.find({ role: 'user', isActive: true }).lean();
    this.barbers = await Barber.find({ isActive: true }).populate('user services').lean();
    this.services = await Service.find({ isActive: true }).lean();
    this.products = await Inventory.find({ stock: { $gt: 0 } }).lean();

    log(`   • ${this.users.length} usuarios disponibles`);
    log(`   • ${this.barbers.length} barberos activos`);
    log(`   • ${this.services.length} servicios activos`);
    log(`   • ${this.products.length} productos en stock`);

    if (this.users.length === 0 || this.barbers.length === 0 || this.services.length === 0) {
      throw new Error('No hay suficientes datos base para generar población');
    }
  }

  // Utility functions
  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item;
      }
    }
    return items[items.length - 1];
  }

  isWorkingDay(date) {
    return this.workingDays.includes(date.getDay());
  }

  generateWorkingDateTime(date) {
    const workingDate = new Date(date);
    
    // Horas de trabajo evitando el almuerzo
    let hour;
    if (Math.random() < 0.6) { // 60% en la mañana
      hour = this.random(this.workingHours.start, this.workingHours.lunchBreak.start - 1);
    } else { // 40% en la tarde
      hour = this.random(this.workingHours.lunchBreak.end, this.workingHours.end - 1);
    }
    
    const minute = this.random(0, 3) * 15; // Intervalos de 15 minutos
    
    workingDate.setHours(hour, minute, 0, 0);
    return workingDate;
  }

  async generateAppointments() {
    log('\nGenerando citas realistas...', colors.cyan);
    
    const appointmentsPerDay = Math.ceil(this.barbers.length * 4); // 4 citas por barbero por día
    const totalDays = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
    
    let appointmentCount = 0;
    
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = new Date(this.startDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      
      if (!this.isWorkingDay(currentDate)) continue;
      
      // Variar número de citas por día (80% a 120% del promedio)
      const dailyAppointments = Math.floor(appointmentsPerDay * (0.8 + Math.random() * 0.4));
      
      for (let i = 0; i < dailyAppointments; i++) {
        const appointmentDate = this.generateWorkingDateTime(currentDate);
        
        // Seleccionar barbero y servicio
        const barber = this.randomElement(this.barbers);
        const service = this.randomElement(this.services);
        const user = this.randomElement(this.users);
        
        // Determinar estado de la cita basado en la fecha
        let status;
        const isInPast = appointmentDate < new Date();
        
        if (isInPast) {
          const rand = Math.random();
          if (rand < 0.85) status = 'completed';
          else if (rand < 0.95) status = 'cancelled';
          else status = 'no_show';
        } else {
          const rand = Math.random();
          if (rand < 0.7) status = 'confirmed';
          else status = 'pending';
        }

        // Campos adicionales para citas completadas
        let totalRevenue = null;
        let paymentMethod = null;
        
        if (status === 'completed') {
          totalRevenue = service.price;
          paymentMethod = this.weightedRandom(this.paymentMethods).method;
        }

        const appointment = {
          user: user._id,
          barber: barber._id,
          service: service._id,
          date: appointmentDate,
          duration: service.duration,
          price: service.price,
          status,
          totalRevenue,
          paymentMethod,
          notes: Math.random() < 0.3 ? 'Cita generada automáticamente' : '',
          createdAt: new Date(appointmentDate.getTime() - this.random(1, 7) * 24 * 60 * 60 * 1000)
        };

        this.appointments.push(appointment);
        appointmentCount++;
      }
    }
    
    log(`   • ${appointmentCount} citas generadas`);
    log(`   • Completadas: ${this.appointments.filter(a => a.status === 'completed').length}`);
    log(`   • Canceladas: ${this.appointments.filter(a => a.status === 'cancelled').length}`);
    log(`   • No show: ${this.appointments.filter(a => a.status === 'no_show').length}`);
  }

  async generateSales() {
    log('\nGenerando ventas de productos...', colors.cyan);
    
    const salesPerDay = Math.ceil(this.barbers.length * 2); // 2 ventas por barbero por día
    const totalDays = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
    
    let salesCount = 0;
    
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = new Date(this.startDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      
      if (!this.isWorkingDay(currentDate)) continue;
      
      // Variar número de ventas por día
      const dailySales = Math.floor(salesPerDay * (0.7 + Math.random() * 0.6));
      
      for (let i = 0; i < dailySales; i++) {
        const saleDate = this.generateWorkingDateTime(currentDate);
        
        // Seleccionar producto según distribución de precios
        let product;
        const priceRand = Math.random();
        
        if (priceRand < 0.6) {
          // 60% productos económicos (< $15,000)
          product = this.randomElement(this.products.filter(p => p.price < 15000));
        } else if (priceRand < 0.9) {
          // 30% productos precio medio ($15,000 - $50,000)
          product = this.randomElement(this.products.filter(p => p.price >= 15000 && p.price <= 50000));
        } else {
          // 10% productos caros (> $50,000)
          product = this.randomElement(this.products.filter(p => p.price > 50000));
        }
        
        // Si no hay productos en esa categoría, tomar cualquiera
        if (!product) {
          product = this.randomElement(this.products);
        }
        
        const barber = this.randomElement(this.barbers);
        const quantity = this.random(1, 3); // 1-3 productos por venta
        const totalAmount = product.price * quantity;
        
        // Determinar si es venta de producto o walk-in service
        const isWalkIn = Math.random() < 0.3; // 30% son servicios walk-in
        
        const sale = {
          type: isWalkIn ? 'walkIn' : 'product',
          quantity,
          unitPrice: isWalkIn ? this.randomElement(this.services).price : product.price,
          totalAmount: isWalkIn ? this.randomElement(this.services).price : totalAmount,
          barberId: barber._id,
          barberName: barber.user?.name || 'Barbero',
          paymentMethod: this.weightedRandom(this.paymentMethods).method,
          customerName: this.randomElement([
            'Cliente Walk-in',
            'Juan Pérez',
            'María García',
            'Carlos López',
            'Ana Rodríguez',
            'Luis González'
          ]),
          saleDate,
          status: 'completed',
          createdAt: saleDate
        };

        // Campos específicos según el tipo
        if (isWalkIn) {
          const service = this.randomElement(this.services);
          sale.serviceId = service._id;
          sale.serviceName = service.name;
          sale.quantity = 1;
          sale.unitPrice = service.price;
          sale.totalAmount = service.price;
        } else {
          sale.productId = product._id;
          sale.productName = product.name;
        }

        this.sales.push(sale);
        salesCount++;
      }
    }
    
    log(`   • ${salesCount} ventas generadas`);
    log(`   • Productos: ${this.sales.filter(s => s.type === 'product').length}`);
    log(`   • Servicios walk-in: ${this.sales.filter(s => s.type === 'walkIn').length}`);
  }

  async generateReviews() {
    log('\nGenerando reseñas realistas...', colors.cyan);
    
    // Solo generar reseñas para citas completadas (30% de probabilidad)
    const completedAppointments = this.appointments.filter(a => a.status === 'completed');
    const reviewsToGenerate = Math.floor(completedAppointments.length * 0.3);
    
    const selectedAppointments = [];
    for (let i = 0; i < reviewsToGenerate; i++) {
      const appointment = this.randomElement(completedAppointments.filter(a => 
        !selectedAppointments.find(sa => sa.user.toString() === a.user.toString() && sa.barber.toString() === a.barber.toString())
      ));
      
      if (appointment) {
        selectedAppointments.push(appointment);
      }
    }

    for (const appointment of selectedAppointments) {
      const ratingData = this.weightedRandom(this.ratingDistribution);
      const rating = ratingData.rating;
      
      // Fecha de reseña: 1-7 días después de la cita
      const reviewDate = new Date(appointment.date);
      reviewDate.setDate(reviewDate.getDate() + this.random(1, 7));
      
      const comment = Math.random() < 0.8 ? // 80% tienen comentario
        this.randomElement(this.reviewComments[rating]) : '';

      const review = {
        user: appointment.user,
        barber: appointment.barber,
        appointment: appointment._id || new mongoose.Types.ObjectId(), // Temporal para saves
        rating,
        comment,
        createdAt: reviewDate
      };

      this.reviews.push(review);
    }
    
    log(`   • ${this.reviews.length} reseñas generadas`);
    log(`   • Rating promedio: ${(this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length).toFixed(1)}`);
    
    // Mostrar distribución de ratings
    const ratingCounts = {};
    this.reviews.forEach(r => {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
    });
    
    Object.entries(ratingCounts).forEach(([rating, count]) => {
      log(`   • ${rating} estrellas: ${count} reseñas`);
    });
  }

  async saveData() {
    log('\nGuardando datos en la base de datos...', colors.cyan);
    
    try {
      // Guardar citas
      log('   Guardando citas...');
      const savedAppointments = await Appointment.insertMany(this.appointments);
      log(`   ${savedAppointments.length} citas guardadas`);
      
      // Guardar ventas
      log('   Guardando ventas...');
      const savedSales = await Sale.insertMany(this.sales);
      log(`   ${savedSales.length} ventas guardadas`);
      
      // Actualizar IDs de citas en reseñas antes de guardar
      for (let i = 0; i < this.reviews.length; i++) {
        const review = this.reviews[i];
        const correspondingAppointment = savedAppointments.find(a => 
          a.user.toString() === review.user.toString() && 
          a.barber.toString() === review.barber.toString()
        );
        if (correspondingAppointment) {
          review.appointment = correspondingAppointment._id;
        }
      }
      
      // Guardar reseñas
      log('   Guardando reseñas...');
      const savedReviews = await Review.insertMany(this.reviews);
      log(`   ${savedReviews.length} reseñas guardadas`);
      
    } catch (error) {
      log(`Error guardando datos: ${error.message}`, colors.red);
      throw error;
    }
  }

  async displaySummary() {
    log('\nRESUMEN DE DATOS GENERADOS', colors.magenta);
    log('═'.repeat(50), colors.magenta);
    
    const totalRevenue = this.appointments
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.totalRevenue || 0), 0) +
      this.sales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    log(`Período: ${this.startDate.toLocaleDateString()} - ${this.endDate.toLocaleDateString()}`, colors.blue);
    log(`Citas totales: ${this.appointments.length}`, colors.green);
    log(`Ventas totales: ${this.sales.length}`, colors.green);
    log(`Reseñas totales: ${this.reviews.length}`, colors.green);
    log(`Ingresos totales: $${totalRevenue.toLocaleString()}`, colors.yellow);
    
    log('\nDISTRIBUCIÓN POR BARBERO:', colors.cyan);
    this.barbers.forEach(barber => {
      const barberAppointments = this.appointments.filter(a => a.barber.toString() === barber._id.toString());
      const barberSales = this.sales.filter(s => s.barberId.toString() === barber._id.toString());
      const barberReviews = this.reviews.filter(r => r.barber.toString() === barber._id.toString());
      
      const barberRevenue = barberAppointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.totalRevenue || 0), 0) +
        barberSales.reduce((sum, s) => sum + s.totalAmount, 0);
      
      log(`   ${barber.user?.name || 'Sin nombre'}:`);
      log(`     • Citas: ${barberAppointments.length} | Ventas: ${barberSales.length} | Reseñas: ${barberReviews.length}`);
      log(`     • Ingresos: $${barberRevenue.toLocaleString()}`);
    });
    
    log('\nLos datos están listos para análisis de reportes', colors.green);
    log('Ejecuta el siguiente script: node scripts/3-validate-reports.js', colors.cyan);
  }
}

// Ejecutar generación
const generator = new RealisticDataGenerator();
generator.generate();