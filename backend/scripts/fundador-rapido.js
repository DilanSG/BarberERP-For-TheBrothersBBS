#!/usr/bin/env node

/**
 * Script simplificado para inicializar el socio fundador
 * Versión rápida con configuración predeterminada
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

// Importar modelos
import User from '../src/core/domain/entities/User.js';
import Socio from '../src/core/domain/entities/Socio.js';

async function inicializarFundadorRapido() {
  try {
    console.log('Inicializando socio fundador...');

    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Buscar primer admin
    const admin = await User.findOne({ role: 'admin', isActive: true }).sort({ createdAt: 1 });
    
    if (!admin) {
      console.log('No hay admins disponibles');
      return;
    }

    // Verificar si ya existe fundador
    const fundadorExistente = await Socio.findOne({ tipoSocio: 'fundador', isActive: true });
    if (fundadorExistente) {
      console.log(' Ya existe un socio fundador');
      return;
    }

    // Crear socio fundador con datos predeterminados
    const socio = await Socio.create({
      userId: admin._id,
      nombre: admin.name,
      email: admin.email,
      porcentaje: 100, // Fundador con 100%
      tipoSocio: 'fundador',
      creadoPor: admin._id,
      isActive: true
    });

    console.log('Socio fundador creado:');
    console.log(`   Nombre: ${socio.nombre}`);
    console.log(`   Email: ${socio.email}`);
    console.log(`   Porcentaje: ${socio.porcentaje}%`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
}

inicializarFundadorRapido();