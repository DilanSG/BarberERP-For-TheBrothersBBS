#!/usr/bin/env node
/**
 * Seed Inicial - The Brothers Barber Shop
 * Crea datos base para iniciar la app:
 *  - 1 Admin
 *  - 3 Barberos (con usuarios role barber)
 *  - 6 Servicios (3 visibles en home)
 *  - 7 Metodos de pago del sistema
 *  - 1 Socio fundador (vinculado al admin)
 *
 * Uso:
 *   npm run seed:init          # idempotente, no borra nada
 *   npm run seed:init:fresh    # borra y recrea (cuidado)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../src/core/domain/entities/User.js';
import Service from '../src/core/domain/entities/Service.js';
import PaymentMethod from '../src/core/domain/entities/PaymentMethod.js';
import Socio from '../src/core/domain/entities/Socio.js';
import Barber from '../src/core/domain/entities/Barber.js';

// Cargar logo como base64
const loadLogoBase64 = () => {
  const logoPath = path.join(__dirname, '../../frontend/public/images/logo 1.png');
  if (!fs.existsSync(logoPath)) {
    log('   Logo no encontrado, se omitira profilePicture', colors.yellow);
    return null;
  }
  const fileBuffer = fs.readFileSync(logoPath);
  const base64Data = fileBuffer.toString('base64');
  return `data:image/png;base64,${base64Data}`;
};

const isFresh = process.argv.includes('--fresh') || process.argv.includes('--force');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};
const log = (msg, c = colors.reset) => console.log(`${c}${msg}${colors.reset}`);

const ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'Admin Brothers',
  email: (process.env.SEED_ADMIN_EMAIL || 'admin@thebrothers.com').toLowerCase().trim(),
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  role: 'admin',
  phone: process.env.SEED_ADMIN_PHONE || '+57 300 000 0000',
};

const SERVICES = [
  {
    name: 'Corte Clasico',
    description: 'Corte de cabello clasico con acabado profesional y asesoramiento de estilo.',
    price: 15000,
    duration: 30,
    category: 'corte',
    isActive: true,
    showInHome: true,
  },
  {
    name: 'Corte + Barba',
    description: 'Combo completo: corte + arreglo de barba con toalla caliente.',
    price: 25000,
    duration: 45,
    category: 'combo',
    isActive: true,
    showInHome: true,
  },
  {
    name: 'Arreglo de Barba',
    description: 'Perfilado, recorte y delineado de barba premium.',
    price: 12000,
    duration: 20,
    category: 'afeitado',
    isActive: true,
    showInHome: true,
  },
  {
    name: 'Afeitado Clasico',
    description: 'Afeitado tradicional con navaja, espuma y aftershave.',
    price: 10000,
    duration: 20,
    category: 'afeitado',
    isActive: true,
    showInHome: false,
  },
  {
    name: 'Corte Nino',
    description: 'Corte especial para ninos, ambiente amigable y rapido.',
    price: 12000,
    duration: 25,
    category: 'corte',
    isActive: true,
    showInHome: false,
  },
  {
    name: 'Lavado + Corte',
    description: 'Lavado con shampoo premium + corte completo.',
    price: 20000,
    duration: 35,
    category: 'lavado',
    isActive: true,
    showInHome: false,
  },
];

const BARBERS_DATA = [
  {
    user: { name: 'Luis Martinez', email: 'luis@thebrothers.com', password: 'Barber123!' },
    specialty: 'Cortes modernos y degradados',
    experience: 8,
    description: 'Especialista en fade y cortes urbanos. 8 anhos de experiencia transformando estilos.',
    isMainBarber: true,
  },
  {
    user: { name: 'Andres Rodriguez', email: 'andres@thebrothers.com', password: 'Barber123!' },
    specialty: 'Barbas y perfilados',
    experience: 5,
    description: 'Maestro del arte de la barba. Perfilados perfectos y disenos creativos.',
    isMainBarber: true,
  },
  {
    user: { name: 'Miguel Fernandez', email: 'miguel@thebrothers.com', password: 'Barber123!' },
    specialty: 'Cortes clasicos y formales',
    experience: 6,
    description: 'Experto en cortes ejecutivos y estilos clasicos que nunca pasan de moda.',
    isMainBarber: true,
  },
];

const PAYMENT_METHODS = [
  { backendId: 'cash', name: 'Efectivo', description: 'Pago en efectivo', color: '#10b981', emoji: '', category: 'cash', isSystem: true, displayOrder: 1, aliases: ['efectivo'] },
  { backendId: 'tarjeta', name: 'Tarjeta', description: 'Tarjeta debito/credito', color: '#3b82f6', emoji: '', category: 'card', isSystem: true, displayOrder: 2, aliases: ['debit', 'credit', 'card'] },
  { backendId: 'nequi', name: 'Nequi', description: 'Pago por Nequi', color: '#8b5cf6', emoji: '', category: 'digital', isSystem: true, displayOrder: 3, aliases: [] },
  { backendId: 'daviplata', name: 'Daviplata', description: 'Pago por Daviplata', color: '#ef4444', emoji: '', category: 'digital', isSystem: true, displayOrder: 4, aliases: [] },
  { backendId: 'bancolombia', name: 'Bancolombia', description: 'Transferencia Bancolombia', color: '#f59e0b', emoji: '', category: 'transfer', isSystem: true, displayOrder: 5, aliases: ['transfer'] },
  { backendId: 'nu', name: 'Nu', description: 'Tarjeta Nu', color: '#8b5cf6', emoji: '', category: 'card', isSystem: true, displayOrder: 6, aliases: [] },
  { backendId: 'digital', name: 'Pago Digital', description: 'Otros metodos digitales', color: '#06b6d4', emoji: '', category: 'digital', isSystem: true, displayOrder: 7, aliases: [] },
];

async function ensurePaymentMethods() {
  log('\nMetodos de pago...', colors.cyan);
  let created = 0, existed = 0;
  for (const pm of PAYMENT_METHODS) {
    const res = await PaymentMethod.findOneAndUpdate(
      { backendId: pm.backendId },
      { $setOnInsert: pm },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // Heuristica simple: si fue creado, no existia antes
    // findOneAndUpdate no distingue, contamos via isNew check alternativo: buscar antes
    // Simplificamos logs
    const exists = await PaymentMethod.countDocuments({ backendId: pm.backendId });
    if (exists) {
      // ya existe, no incrementar created si ya estaba
    }
  }
  const count = await PaymentMethod.countDocuments({});
  log(`   ${count} metodos de pago (sistema: ${PAYMENT_METHODS.length})`, colors.green);
  return count;
}

async function ensureServices() {
  log('\n Servicios base...', colors.cyan);
  let created = 0, updated = 0;
  for (const s of SERVICES) {
    const existing = await Service.findOne({ name: s.name });
    if (existing) {
      // Actualiza precios/duracion si cambiaron, sin pisar isActive manual
      existing.price = s.price;
      existing.duration = s.duration;
      existing.description = s.description;
      existing.category = s.category;
      existing.showInHome = s.showInHome;
      await existing.save();
      updated++;
      log(`   ${s.name} ya existia - actualizado`, colors.gray);
    } else {
      await Service.create(s);
      created++;
      log(`   + ${s.name} creado ($${s.price.toLocaleString()} - ${s.duration}min)`, colors.green);
    }
  }
  const count = await Service.countDocuments({ isActive: true });
  log(`   ${created} creados, ${updated} actualizados. Total activos: ${count}`, colors.green);
  return count;
}

async function ensureAdmin() {
  log('\nAdmin...', colors.cyan);
  log(`   Email: ${ADMIN.email}`, colors.gray);

  // Cargar logo como profilePicture
  const logoBase64 = loadLogoBase64();

  let admin = await User.findOne({ email: ADMIN.email });
  
  if (admin) {
    // Si existe pero esta inactivo, reactivar y actualizar a admin
    let needsSave = false;
    if (!admin.isActive) { admin.isActive = true; needsSave = true; }
    if (admin.role !== 'admin') { admin.role = 'admin'; needsSave = true; }
    if (admin.name !== ADMIN.name) { admin.name = ADMIN.name; needsSave = true; }
    // Asignar logo como profilePicture si no tiene
    if (!admin.profilePicture && logoBase64) {
      admin.profilePicture = logoBase64;
      needsSave = true;
    }
    // Siempre resetea password al del seed para garantizar login conocido
    if (isFresh) {
      admin.password = ADMIN.password;
      needsSave = true;
      log(`   Password reseteado a: ${ADMIN.password}`, colors.yellow);
    }
    if (needsSave) {
      await admin.save();
      log(`   Admin existente actualizado: ${admin.email}`, colors.yellow);
    } else {
      log(`   Admin ya existia: ${admin.email} (password sin cambios)`, colors.gray);
      log(`    Si olvidaste el password usa: npm run seed:init:fresh`, colors.gray);
    }
    // Si no es fresh pero queremos garantizar que el password del seed funcione, verificar
    if (!isFresh) {
      const freshCheck = await User.findOne({ email: ADMIN.email }).select('+password');
      const ok = await freshCheck.comparePassword(ADMIN.password).catch(() => false);
      if (!ok) {
        log(`    El password actual NO es "${ADMIN.password}". Usa --fresh para resetear.`, colors.yellow);
      } else {
        log(`   Password verificado: ${ADMIN.password}`, colors.green);
      }
    }
    return admin;
  }

  admin = new User({
    name: ADMIN.name,
    email: ADMIN.email,
    password: ADMIN.password,
    role: 'admin',
    isActive: true,
    phone: ADMIN.phone,
    profilePicture: logoBase64,
  });
  await admin.save();
  log(`   Admin creado: ${admin.email}`, colors.green);
  log(`   Password: ${ADMIN.password}`, colors.green);
  return admin;
}

async function ensureBarbers() {
  log('\nBarberos...', colors.cyan);
  let created = 0, existed = 0;

  // Obtener servicios activos para vincular
  const activeServices = await Service.find({ isActive: true }).select('_id');
  const serviceIds = activeServices.map(s => s._id);

  // Cargar logo como profilePicture
  const logoBase64 = loadLogoBase64();

  for (const b of BARBERS_DATA) {
    // Crear o encontrar usuario barbero
    let barberUser = await User.findOne({ email: b.user.email });
    if (!barberUser) {
      barberUser = new User({
        name: b.user.name,
        email: b.user.email,
        password: b.user.password,
        role: 'barber',
        isActive: true,
        profilePicture: logoBase64,
      });
      await barberUser.save();
      log(`   + Usuario barbero creado: ${b.user.email}`, colors.green);
    } else {
      // Asegurar rol barber y profilePicture
      let needsSave = false;
      if (barberUser.role !== 'barber') {
        barberUser.role = 'barber';
        barberUser.isActive = true;
        needsSave = true;
      }
      // Asignar logo como profilePicture si no tiene
      if (!barberUser.profilePicture && logoBase64) {
        barberUser.profilePicture = logoBase64;
        needsSave = true;
      }
      if (needsSave) {
        await barberUser.save();
        log(`   ${b.user.email} actualizado`, colors.gray);
      }
      existed++;
    }

    // Crear o actualizar barbero
    let barber = await Barber.findOne({ user: barberUser._id });
    if (!barber) {
      barber = new Barber({
        user: barberUser._id,
        specialty: b.specialty,
        experience: b.experience,
        description: b.description,
        isMainBarber: b.isMainBarber,
        services: serviceIds,
        isActive: true,
        schedule: {
          monday:    { start: '09:00', end: '19:00', available: true },
          tuesday:   { start: '09:00', end: '19:00', available: true },
          wednesday: { start: '09:00', end: '19:00', available: true },
          thursday:  { start: '09:00', end: '19:00', available: true },
          friday:    { start: '09:00', end: '19:00', available: true },
          saturday:  { start: '09:00', end: '17:00', available: true },
          sunday:    { start: '00:00', end: '00:00', available: false },
        },
      });
      await barber.save();
      created++;
      log(`   + ${b.user.name} (${b.specialty}) - ${b.experience} anhos`, colors.green);
    } else {
      // Actualizar servicios y datos basicos
      barber.services = serviceIds;
      barber.specialty = b.specialty;
      barber.experience = b.experience;
      barber.description = b.description;
      barber.isMainBarber = b.isMainBarber;
      await barber.save();
      log(`   ${b.user.name} ya existia - servicios actualizados`, colors.gray);
    }
  }

  const count = await Barber.countDocuments({ isActive: true });
  log(`   ${created} creados, ${existed} existentes. Total activos: ${count}`, colors.green);
  return count;
}

async function ensureSocioFundador(admin) {
  log('\nSocio fundador...', colors.cyan);
  const existing = await Socio.findOne({ tipoSocio: 'fundador', isActive: true });
  if (existing) {
    log(`   Fundador ya existe: ${existing.nombre} (${existing.porcentaje}%) - ${existing.email}`, colors.gray);
    return existing;
  }
  // Verificar que no exceda 100% (deberia ser 0 si es primero)
  const total = await Socio.getTotalPorcentajeAsignado().catch(() => 0);
  if (total >= 100) {
    log(`    No se puede crear fundador: total asignado ${total}%`, colors.yellow);
    return null;
  }
  try {
    const socio = await Socio.create({
      userId: admin._id,
      nombre: admin.name,
      email: admin.email,
      porcentaje: 100,
      tipoSocio: 'fundador',
      creadoPor: admin._id,
      isActive: true,
    });
    log(`   Socio fundador creado: ${socio.nombre} - 100%`, colors.green);
    return socio;
  } catch (e) {
    log(`    No se pudo crear socio fundador: ${e.message}`, colors.yellow);
    return null;
  }
}

async function main() {
  const t0 = Date.now();
  log('SEED INICIAL - The Brothers Barber Shop', colors.magenta);
  log('═'.repeat(60), colors.magenta);
  if (isFresh) log(' Modo --fresh: se borrarán y recrearán datos base', colors.yellow);
  log(`MONGODB_URI: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':***@') : 'NO DEFINIDA'}`, colors.gray);

  if (!process.env.MONGODB_URI) {
    log('MONGODB_URI no definida en .env', colors.red);
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 10) {
    log(' JWT_SECRET muy corto o no definido - revisa .env', colors.yellow);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log('Conectado a MongoDB', colors.green);

    if (isFresh) {
      log('\nLimpiando colecciones base (--fresh)...', colors.yellow);
      await Promise.all([
        Service.deleteMany({}),
        PaymentMethod.deleteMany({}),
        Barber.deleteMany({}),
        User.deleteMany({ email: { $in: [ADMIN.email, ...BARBERS_DATA.map(b => b.user.email)] } }),
        Socio.deleteMany({ email: ADMIN.email }),
      ]);
      log('   Limpieza base completada', colors.green);
    }

    await ensurePaymentMethods();
    await ensureServices();
    const admin = await ensureAdmin();
    await ensureSocioFundador(admin);
    await ensureBarbers();

    // Resumen
    const [users, admins, barbersCount, services, pms, socios] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'admin', isActive: true }),
      Barber.countDocuments({ isActive: true }),
      Service.countDocuments({ isActive: true }),
      PaymentMethod.countDocuments({ isActive: true }),
      Socio.countDocuments({ isActive: true }),
    ]);

    log('\nRESUMEN', colors.magenta);
    log('─'.repeat(40), colors.magenta);
    log(`Usuarios totales: ${users} (admins: ${admins})`, colors.cyan);
    log(`Barberos activos: ${barbersCount}`, colors.cyan);
    log(` Servicios activos: ${services}`, colors.cyan);
    log(`Metodos de pago: ${pms}`, colors.cyan);
    log(`Socios: ${socios}`, colors.cyan);

    log('\nCREDENCIALES', colors.green);
    log('─'.repeat(40), colors.green);
    log(`   Admin:     ${ADMIN.email} / ${ADMIN.password}`, colors.green);
    log(`   Barbero 1: luis@thebrothers.com / Barber123!`, colors.green);
    log(`   Barbero 2: andres@thebrothers.com / Barber123!`, colors.green);
    log(`   Barbero 3: miguel@thebrothers.com / Barber123!`, colors.green);

    log('\nLogin:', colors.cyan);
    log(`   Frontend: http://localhost:5173/login`, colors.cyan);
    log(`   API:      http://localhost:5000/api/v1/auth/login`, colors.cyan);

    log('\nSiguiente pasos:', colors.yellow);
    log('   1. npm run dev  (levanta backend + frontend)', colors.yellow);
    log('   2. Login con el admin o un barbero', colors.yellow);
    log('   3. Opcional: npm run seed:inventory para cargar productos', colors.yellow);

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    log(`\nSeed completado en ${dt}s`, colors.green);
  } catch (e) {
    log(`\nError: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
    log('Desconectado', colors.gray);
  }
}

main();
