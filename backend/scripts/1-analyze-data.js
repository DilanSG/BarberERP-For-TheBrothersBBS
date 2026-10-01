/**
 * Script 1: Análisis y preparación de datos para población realista
 * Analiza usuarios, barberos, servicios e inventario para crear datos base
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

class DataAnalyzer {
  constructor() {
    this.startDate = new Date();
    this.startDate.setMonth(this.startDate.getMonth() - 2); // 2 meses atrás
    this.endDate = new Date();
    
    this.users = [];
    this.barbers = [];
    this.services = [];
    this.products = [];
    
    this.analysisReport = {
      users: {},
      barbers: {},
      services: {},
      products: {},
      recommendations: {}
    };
  }

  async analyze() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('Conectado a MongoDB para análisis', colors.green);

      await this.loadData();
      await this.analyzeUsers();
      await this.analyzeBarbers();
      await this.analyzeServices();
      await this.analyzeProducts();
      await this.generateRecommendations();
      await this.displayReport();

      await mongoose.disconnect();
      log('\nAnálisis completado exitosamente', colors.green);

    } catch (error) {
      log(`Error durante el análisis: ${error.message}`, colors.red);
      process.exit(1);
    }
  }

  async loadData() {
    log('\nCargando datos existentes...', colors.cyan);
    
    this.users = await User.find({ 
      role: 'user', 
      isActive: true 
    }).lean();
    
    this.barbers = await Barber.find({ 
      isActive: true 
    }).populate('user services').lean();
    
    this.services = await Service.find({ 
      isActive: true 
    }).lean();
    
    this.products = await Inventory.find({ 
      stock: { $gt: 0 } 
    }).lean();

    log(`Usuarios encontrados: ${this.users.length}`, colors.blue);
    log(`Barberos encontrados: ${this.barbers.length}`, colors.blue);
    log(`Servicios encontrados: ${this.services.length}`, colors.blue);
    log(`Productos en stock: ${this.products.length}`, colors.blue);
  }

  async analyzeUsers() {
    log('\nAnalizando usuarios...', colors.cyan);
    
    this.analysisReport.users = {
      total: this.users.length,
      active: this.users.filter(u => u.isActive).length,
      withPhone: this.users.filter(u => u.phone).length,
      withBirthdate: this.users.filter(u => u.birthdate).length,
      list: this.users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || 'N/A',
        birthdate: u.birthdate || null,
        createdAt: u.createdAt
      }))
    };

    log(`   • Usuarios activos: ${this.analysisReport.users.active}/${this.analysisReport.users.total}`);
    log(`   • Con teléfono: ${this.analysisReport.users.withPhone}`);
    log(`   • Con fecha nacimiento: ${this.analysisReport.users.withBirthdate}`);
  }

  async analyzeBarbers() {
    log('\nAnalizando barberos...', colors.cyan);
    
    this.analysisReport.barbers = {
      total: this.barbers.length,
      specialties: {},
      experienceLevels: {},
      list: this.barbers.map(b => ({
        id: b._id,
        name: b.user?.name || 'Sin nombre',
        specialty: b.specialty,
        experience: b.experience,
        servicesCount: b.services?.length || 0,
        rating: b.rating || 0,
        completedAppointments: b.totalAppointments || 0
      }))
    };

    // Agrupar por especialidades
    this.barbers.forEach(b => {
      const specialty = b.specialty;
      this.analysisReport.barbers.specialties[specialty] = 
        (this.analysisReport.barbers.specialties[specialty] || 0) + 1;
    });

    // Agrupar por experiencia
    this.barbers.forEach(b => {
      const exp = b.experience;
      const level = exp === 0 ? 'Sin experiencia' : 
                   exp <= 2 ? 'Junior (0-2 años)' :
                   exp <= 5 ? 'Intermedio (3-5 años)' :
                   'Senior (5+ años)';
      this.analysisReport.barbers.experienceLevels[level] = 
        (this.analysisReport.barbers.experienceLevels[level] || 0) + 1;
    });

    log(`   • Total barberos: ${this.analysisReport.barbers.total}`);
    log(`   • Especialidades: ${Object.keys(this.analysisReport.barbers.specialties).join(', ')}`);
    log(`   • Niveles de experiencia: ${Object.keys(this.analysisReport.barbers.experienceLevels).join(', ')}`);
  }

  async analyzeServices() {
    log('\nAnalizando servicios...', colors.cyan);
    
    this.analysisReport.services = {
      total: this.services.length,
      categories: {},
      priceRanges: {
        low: [],      // < 15000
        medium: [],   // 15000 - 25000
        high: []      // > 25000
      },
      durations: {},
      list: this.services.map(s => ({
        id: s._id,
        name: s.name,
        category: s.category,
        price: s.price,
        duration: s.duration,
        isPopular: s.showInHome
      }))
    };

    // Categorizar servicios
    this.services.forEach(s => {
      // Por categoría
      this.analysisReport.services.categories[s.category] = 
        (this.analysisReport.services.categories[s.category] || 0) + 1;

      // Por precio
      if (s.price < 15000) {
        this.analysisReport.services.priceRanges.low.push(s);
      } else if (s.price <= 25000) {
        this.analysisReport.services.priceRanges.medium.push(s);
      } else {
        this.analysisReport.services.priceRanges.high.push(s);
      }

      // Por duración
      const duration = s.duration;
      const timeRange = duration <= 30 ? 'Corto (≤30min)' :
                       duration <= 60 ? 'Medio (31-60min)' :
                       'Largo (>60min)';
      this.analysisReport.services.durations[timeRange] = 
        (this.analysisReport.services.durations[timeRange] || 0) + 1;
    });

    log(`   • Total servicios: ${this.analysisReport.services.total}`);
    log(`   • Categorías: ${Object.keys(this.analysisReport.services.categories).join(', ')}`);
    log(`   • Rangos de precio: Bajo(${this.analysisReport.services.priceRanges.low.length}), Medio(${this.analysisReport.services.priceRanges.medium.length}), Alto(${this.analysisReport.services.priceRanges.high.length})`);
  }

  async analyzeProducts() {
    log('\nAnalizando productos...', colors.cyan);
    
    this.analysisReport.products = {
      total: this.products.length,
      categories: {},
      priceRanges: {
        low: [],      // < 10000
        medium: [],   // 10000 - 30000
        high: [],     // 30000 - 100000
        premium: []   // > 100000
      },
      stockLevels: {
        low: [],      // < 10
        medium: [],   // 10 - 25
        high: []      // > 25
      },
      topSellers: [],
      list: this.products.map(p => ({
        id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
        sales: p.sales || 0
      }))
    };

    // Categorizar productos
    this.products.forEach(p => {
      // Por categoría
      this.analysisReport.products.categories[p.category] = 
        (this.analysisReport.products.categories[p.category] || 0) + 1;

      // Por precio
      if (p.price < 10000) {
        this.analysisReport.products.priceRanges.low.push(p);
      } else if (p.price <= 30000) {
        this.analysisReport.products.priceRanges.medium.push(p);
      } else if (p.price <= 100000) {
        this.analysisReport.products.priceRanges.high.push(p);
      } else {
        this.analysisReport.products.priceRanges.premium.push(p);
      }

      // Por stock
      if (p.stock < 10) {
        this.analysisReport.products.stockLevels.low.push(p);
      } else if (p.stock <= 25) {
        this.analysisReport.products.stockLevels.medium.push(p);
      } else {
        this.analysisReport.products.stockLevels.high.push(p);
      }
    });

    // Productos más vendidos (simulado basado en stock vs stock inicial)
    this.analysisReport.products.topSellers = this.products
      .map(p => ({
        ...p,
        salesEstimate: Math.max(0, (p.initialStock || p.stock) - p.stock + (p.sales || 0))
      }))
      .sort((a, b) => b.salesEstimate - a.salesEstimate)
      .slice(0, 10);

    log(`   • Total productos: ${this.analysisReport.products.total}`);
    log(`   • Categorías: ${Object.keys(this.analysisReport.products.categories).join(', ')}`);
    log(`   • Stock bajo (<10): ${this.analysisReport.products.stockLevels.low.length} productos`);
    log(`   • Stock medio (10-25): ${this.analysisReport.products.stockLevels.medium.length} productos`);
    log(`   • Stock alto (>25): ${this.analysisReport.products.stockLevels.high.length} productos`);
  }

  async generateRecommendations() {
    log('\nGenerando recomendaciones de población...', colors.cyan);
    
    const period = 60; // 2 meses = 60 días
    const workingDays = 50; // Aproximadamente (excluyendo algunos domingos)
    
    // Calcular totales primero
    const appointmentsTotal = Math.floor(this.barbers.length * workingDays * 4); // 4 citas por barbero por día
    const productSalesTotal = Math.floor(this.barbers.length * workingDays * 2); // 2 ventas de productos por barbero por día
    const walkInServicesTotal = Math.floor(this.barbers.length * workingDays * 1); // 1 servicio walk-in por barbero por día
    const reviewsTotal = Math.floor(appointmentsTotal * 0.3); // 30% de citas completadas generan reseña
    
    this.analysisReport.recommendations = {
      appointments: {
        total: appointmentsTotal,
        perBarber: Math.floor(workingDays * 4),
        perDay: Math.floor(this.barbers.length * 4),
        distribution: {
          completed: 0.85, // 85% completadas
          cancelled: 0.10, // 10% canceladas
          no_show: 0.05    // 5% no show
        }
      },
      sales: {
        productSales: productSalesTotal,
        walkInServices: walkInServicesTotal,
        distribution: {
          lowPrice: 0.6,   // 60% productos económicos
          mediumPrice: 0.3, // 30% productos precio medio
          highPrice: 0.1   // 10% productos caros
        }
      },
      reviews: {
        total: reviewsTotal,
        distribution: {
          rating5: 0.4,    // 40% - 5 estrellas
          rating4: 0.35,   // 35% - 4 estrellas
          rating3: 0.20,   // 20% - 3 estrellas
          rating2: 0.04,   // 4% - 2 estrellas
          rating1: 0.01    // 1% - 1 estrella
        }
      },
      paymentMethods: {
        cash: 0.4,       // 40% efectivo
        debit: 0.25,     // 25% débito
        credit: 0.15,    // 15% crédito
        nequi: 0.10,     // 10% Nequi
        bancolombia: 0.05, // 5% Bancolombia
        daviplata: 0.05  // 5% Daviplata
      }
    };

    log(`   • Citas sugeridas: ${this.analysisReport.recommendations.appointments.total} total`);
    log(`   • Por barbero: ${this.analysisReport.recommendations.appointments.perBarber} citas`);
    log(`   • Por día: ${this.analysisReport.recommendations.appointments.perDay} citas`);
    log(`   • Ventas de productos: ${this.analysisReport.recommendations.sales.productSales}`);
    log(`   • Servicios walk-in: ${this.analysisReport.recommendations.sales.walkInServices}`);
    log(`   • Reseñas: ${this.analysisReport.recommendations.reviews.total}`);
  }

  async displayReport() {
    log('\nREPORTE COMPLETO DE ANÁLISIS', colors.magenta);
    log('═'.repeat(50), colors.magenta);
    
    log('\nUSUARIOS:', colors.yellow);
    this.analysisReport.users.list.forEach(u => {
      log(`   • ${u.name} (${u.email}) - Tel: ${u.phone}`);
    });

    log('\nBARBEROS:', colors.yellow);
    this.analysisReport.barbers.list.forEach(b => {
      log(`   • ${b.name} - ${b.specialty} (${b.experience} años exp.)`);
    });

    log('\nSERVICIOS:', colors.yellow);
    this.analysisReport.services.list.forEach(s => {
      log(`   • ${s.name} - $${s.price} (${s.duration}min) [${s.category}]`);
    });

    log('\nTOP 10 PRODUCTOS MÁS VENDIBLES:', colors.yellow);
    this.analysisReport.products.topSellers.slice(0, 10).forEach(p => {
      log(`   • ${p.name} - $${p.price} (Stock: ${p.stock})`);
    });

    log('\nPLAN DE POBLACIÓN RECOMENDADO:', colors.green);
    const rec = this.analysisReport.recommendations;
    log(`   Período: 2 meses (${this.startDate.toLocaleDateString()} - ${this.endDate.toLocaleDateString()})`);
    log(`   Citas totales: ${rec.appointments.total}`);
    log(`      - Completadas: ${Math.floor(rec.appointments.total * rec.appointments.distribution.completed)}`);
    log(`      - Canceladas: ${Math.floor(rec.appointments.total * rec.appointments.distribution.cancelled)}`);
    log(`      - No show: ${Math.floor(rec.appointments.total * rec.appointments.distribution.no_show)}`);
    log(`   Ventas productos: ${rec.sales.productSales}`);
    log(`   Servicios walk-in: ${rec.sales.walkInServices}`);
    log(`   Reseñas: ${rec.reviews.total}`);
    
    log('\nMÉTODOS DE PAGO SUGERIDOS:', colors.blue);
    Object.entries(rec.paymentMethods).forEach(([method, percentage]) => {
      log(`   • ${method}: ${(percentage * 100).toFixed(1)}%`);
    });

    log('\nLos datos están listos para la población automática', colors.green);
    log('Ejecuta el siguiente script: node scripts/2-create-realistic-data.js', colors.cyan);
  }
}

// Ejecutar análisis
const analyzer = new DataAnalyzer();
analyzer.analyze();