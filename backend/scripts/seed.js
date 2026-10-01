import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/core/domain/entities/User.js';
import Barber from '../src/core/domain/entities/Barber.js';
import Service from '../src/core/domain/entities/Service.js';
import { logger } from '../src/shared/utils/logger.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
logger.info('Conectado a MongoDB para seed principal');

async function seed() {
  try {
    // Limpiar coleccionexistente
    await User.deleteMany({});
    await Barber.deleteMany({});
    await Service.deleteMany({});
    logger.info('Colecciones limpiadas');

    // Crear admin
    const admin = await User.create({
      name: 'Admin Principal',
      email: 'admin@thebrothers.com',
      password: 'admin123',
      role: 'admin',
      phone: '3001234567'
    });
    logger.info(`Admin creado: ${admin.email}`);

    // Crear usuario regular
    const user = await User.create({
      name: 'Carlos Garcia',
      email: 'carlos@email.com',
      password: 'user123',
      role: 'user',
      phone: '3009876543'
    });
    logger.info(`Usuario creado: ${user.email}`);

    // Crear servicios
    const services = await Service.insertMany([
      {
        name: 'Corte de Cabello',
        description: 'Corte profesional con tijera y maquina, incluye lavado y peinado final',
        price: 25000,
        duration: 30,
        category: 'corte',
        showInHome: true
      },
      {
        name: 'Corte y Barba',
        description: 'Combo completo de corte de cabello y perfilado de barba con navaja',
        price: 40000,
        duration: 45,
        category: 'combo',
        showInHome: true
      },
      {
        name: 'Afeitado Clasico',
        description: 'Afeitado tradicional con navaja, toalla caliente y locion post-afeitado',
        price: 20000,
        duration: 25,
        category: 'afeitado',
        showInHome: true
      }
    ]);
    logger.info(`${services.length} servicios creados`);

    // Crear barberos (cada uno con su usuario role 'barber')
    const barbersData = [
      {
        name: 'Luis Martinez',
        email: 'luis@thebrothers.com',
        specialty: 'Cortes modernos y degradados',
        experience: 8,
        description: 'Especialista en fade y cortes urbanos. 8 anos de experiencia transformando estilos.',
        isMainBarber: true
      },
      {
        name: 'Andres Rodriguez',
        email: 'andres@thebrothers.com',
        specialty: 'Barbas y perfilados',
        experience: 5,
        description: 'Maestro del arte de la barba. Perfilados perfectos y diseños creativos.',
        isMainBarber: false
      },
      {
        name: 'Miguel Fernandez',
        email: 'miguel@thebrothers.com',
        specialty: 'Cortes clasicos y formales',
        experience: 6,
        description: 'Experto en cortes ejecutivos y estilos clasicos que nunca pasan de moda.',
        isMainBarber: false
      }
    ];

    const barberos = [];
    for (const data of barbersData) {
      // Crear usuario para el barbero
      const barberUser = await User.create({
        name: data.name,
        email: data.email,
        password: 'barber123',
        role: 'barber'
      });

      // Crear barbero vinculado al usuario
      const barber = await Barber.create({
        user: barberUser._id,
        specialty: data.specialty,
        experience: data.experience,
        description: data.description,
        isMainBarber: data.isMainBarber,
        services: services.map(s => s._id),
        schedule: {
          monday: { start: '09:00', end: '19:00', available: true },
          tuesday: { start: '09:00', end: '19:00', available: true },
          wednesday: { start: '09:00', end: '19:00', available: true },
          thursday: { start: '09:00', end: '19:00', available: true },
          friday: { start: '09:00', end: '19:00', available: true },
          saturday: { start: '09:00', end: '17:00', available: true },
          sunday: { start: '00:00', end: '00:00', available: false }
        }
      });

      barberos.push(barber);
      logger.info(`Barbero creado: ${data.name} (${data.email})`);
    }

    logger.info('='.repeat(50));
    logger.info('SEED COMPLETADO EXITOSAMENTE');
    logger.info('='.repeat(50));
    logger.info('CREDENCIALES:');
    logger.info(`Admin:    ${admin.email} / admin123`);
    logger.info(`Usuario:  ${user.email} / user123`);
    logger.info(`Barbero1: ${barbersData[0].email} / barber123`);
    logger.info(`Barbero2: ${barbersData[1].email} / barber123`);
    logger.info(`Barbero3: ${barbersData[2].email} / barber123`);
    logger.info('='.repeat(50));
    console.log('\n✅ Seed completado. Verifica los logs para credenciales.\n');

  } catch (error) {
    logger.error('Error en seed:', error);
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    logger.info('Desconectado de MongoDB');
  }
}

seed();
