#!/usr/bin/env node

/**
 * Script para inicializar el socio fundador
 * Este es el único método permitido para crear un socio fundador
 * 
 * Uso: node scripts/inicializar-socio-fundador.js
 */

import mongoose from 'mongoose';
import readline from 'readline';
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

// Configurar colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class SocioFounderInitializer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Conectar a la base de datos
  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log(`${colors.green}Conectado a MongoDB${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Error conectando a MongoDB:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  // Verificar si ya existe un fundador
  async verificarFundadorExistente() {
    const fundadorExistente = await Socio.findOne({ 
      tipoSocio: 'fundador', 
      isActive: true 
    }).populate('userId', 'name email');

    if (fundadorExistente) {
      console.log(`${colors.yellow}Ya existe un socio fundador:${colors.reset}`);
      console.log(`   Nombre: ${colors.cyan}${fundadorExistente.nombre}${colors.reset}`);
      console.log(`   Email: ${colors.cyan}${fundadorExistente.email}${colors.reset}`);
      console.log(`   Porcentaje: ${colors.cyan}${fundadorExistente.porcentaje}%${colors.reset}`);
      
      console.log(`\n${colors.yellow}NOTA: El fundador actual será convertido a socio regular sin porcentaje.${colors.reset}`);
      const continuar = await this.pregunta(`\n¿Desea reemplazar el fundador existente? (${colors.red}s/N${colors.reset}): `);
      
      if (continuar.toLowerCase() !== 's' && continuar.toLowerCase() !== 'si') {
        console.log(`${colors.yellow}Operación cancelada.${colors.reset}`);
        return false;
      }

      // Convertir fundador existente a socio regular sin porcentaje
      fundadorExistente.tipoSocio = 'socio';
      fundadorExistente.porcentaje = 0;
      await fundadorExistente.save();
      console.log(`${colors.green}Fundador anterior convertido a socio regular sin porcentaje${colors.reset}`);
    }

    return true;
  }

  // Obtener todos los admins disponibles
  async obtenerAdminsDisponibles() {
    try {
      const admins = await User.find({
        role: 'admin',
        isActive: true
      }).select('name email createdAt').sort({ createdAt: 1 });

      if (admins.length === 0) {
        console.log(`${colors.red}No hay usuarios admin en la base de datos${colors.reset}`);
        console.log(`${colors.yellow}Primero debe crear al menos un usuario admin${colors.reset}`);
        return null;
      }

      return admins;
    } catch (error) {
      console.error(`${colors.red}Error obteniendo admins:${colors.reset}`, error.message);
      return null;
    }
  }

  // Mostrar lista de admins y permitir selección
  async seleccionarAdmin(admins) {
    console.log(`\n${colors.bright}ADMINISTRADORES DISPONIBLES:${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}`);

    admins.forEach((admin, index) => {
      const fechaCreacion = new Date(admin.createdAt).toLocaleDateString('es-CO');
      console.log(`${colors.cyan}[${index + 1}]${colors.reset} ${colors.bright}${admin.name}${colors.reset}`);
      console.log(`    ${admin.email}`);
      console.log(`    Creado: ${fechaCreacion}`);
      console.log('');
    });

    console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}`);

    while (true) {
      const seleccion = await this.pregunta(`\n${colors.yellow}Seleccione el admin que será socio fundador [1-${admins.length}] o 'q' para salir: ${colors.reset}`);
      
      if (seleccion.toLowerCase() === 'q') {
        return null;
      }

      const index = parseInt(seleccion) - 1;
      
      if (index >= 0 && index < admins.length) {
        const adminSeleccionado = admins[index];
        
        // Confirmar selección
        console.log(`\n${colors.green}ADMIN SELECCIONADO:${colors.reset}`);
        console.log(`   Nombre: ${colors.cyan}${adminSeleccionado.name}${colors.reset}`);
        console.log(`   Email: ${colors.cyan}${adminSeleccionado.email}${colors.reset}`);
        
        const confirmar = await this.pregunta(`\n${colors.yellow}¿Confirma la selección? (S/n): ${colors.reset}`);
        
        if (confirmar.toLowerCase() !== 'n' && confirmar.toLowerCase() !== 'no') {
          return adminSeleccionado;
        }
      } else {
        console.log(`${colors.red}Selección inválida. Ingrese un número entre 1 y ${admins.length}${colors.reset}`);
      }
    }
  }

  // Solicitar porcentaje de propiedad
  async solicitarPorcentaje() {
    while (true) {
      const porcentajeStr = await this.pregunta(`\n${colors.yellow}Ingrese el porcentaje de propiedad del fundador (1-100): ${colors.reset}`);
      const porcentaje = parseFloat(porcentajeStr);

      if (!isNaN(porcentaje) && porcentaje > 0 && porcentaje <= 100) {
        return porcentaje;
      }

      console.log(`${colors.red}Ingrese un porcentaje válido entre 1 y 100${colors.reset}`);
    }
  }

  // Solicitar datos adicionales opcionales
  async solicitarDatosAdicionales() {
    console.log(`\n${colors.blue}DATOS ADICIONALES (OPCIONAL):${colors.reset}`);
    
    const telefono = await this.pregunta(`Teléfono: ${colors.reset}`);
    const notas = await this.pregunta(`Notas: ${colors.reset}`);

    return {
      telefono: telefono.trim() || undefined,
      notas: notas.trim() || undefined
    };
  }

  // Crear el socio fundador
  async crearSocioFundador(admin, porcentaje, datosAdicionales) {
    try {
      console.log(`\n${colors.blue}Creando socio fundador...${colors.reset}`);

      const socio = await Socio.create({
        userId: admin._id,
        nombre: admin.name,
        email: admin.email,
        porcentaje: porcentaje,
        telefono: datosAdicionales.telefono,
        notas: datosAdicionales.notas,
        tipoSocio: 'fundador',
        creadoPor: admin._id, // Se auto-asigna como creador
        isActive: true
      });

      await socio.populate('userId', 'name email role');

      console.log(`\n${colors.green}¡SOCIO FUNDADOR CREADO EXITOSAMENTE!${colors.reset}`);
      console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
      console.log(`${colors.bright}Nombre:${colors.reset} ${socio.nombre}`);
      console.log(`${colors.bright}Email:${colors.reset} ${socio.email}`);
      console.log(`${colors.bright}Porcentaje:${colors.reset} ${socio.porcentaje}%`);
      console.log(`${colors.bright}Tipo:${colors.reset} ${colors.yellow}Socio Fundador${colors.reset}`);
      if (socio.telefono) console.log(`${colors.bright}Teléfono:${colors.reset} ${socio.telefono}`);
      if (socio.notas) console.log(`${colors.bright}Notas:${colors.reset} ${socio.notas}`);
      console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);

      return socio;

    } catch (error) {
      console.error(`${colors.red}Error creando socio fundador:${colors.reset}`, error.message);
      throw error;
    }
  }

  // Función auxiliar para preguntas
  pregunta(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  // Cerrar conexiones
  async cleanup() {
    this.rl.close();
    await mongoose.connection.close();
  }

  // Función principal
  async ejecutar() {
    try {
      console.log(`${colors.bright}${colors.magenta}INICIALIZADOR DE SOCIO FUNDADOR${colors.reset}`);
      console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}`);
      console.log(`${colors.yellow}Este script permite seleccionar un admin existente como socio fundador.${colors.reset}`);
      console.log(`${colors.yellow}Esta es la única forma autorizada de crear un socio fundador.${colors.reset}\n`);

      // Conectar a la base de datos
      await this.connectDB();

      // Verificar fundador existente
      const puedeCrear = await this.verificarFundadorExistente();
      if (!puedeCrear) {
        await this.cleanup();
        return;
      }

      // Obtener admins
      const admins = await this.obtenerAdminsDisponibles();
      if (!admins) {
        await this.cleanup();
        return;
      }

      // Seleccionar admin
      const adminSeleccionado = await this.seleccionarAdmin(admins);
      if (!adminSeleccionado) {
        console.log(`${colors.yellow}Operación cancelada.${colors.reset}`);
        await this.cleanup();
        return;
      }

      // Solicitar porcentaje
      const porcentaje = await this.solicitarPorcentaje();

      // Solicitar datos adicionales
      const datosAdicionales = await this.solicitarDatosAdicionales();

      // Mostrar resumen y confirmar
      console.log(`\n${colors.blue}RESUMEN DE LA OPERACIÓN:${colors.reset}`);
      console.log(`${colors.blue}${'='.repeat(40)}${colors.reset}`);
      console.log(`Admin: ${colors.cyan}${adminSeleccionado.name}${colors.reset}`);
      console.log(`Email: ${colors.cyan}${adminSeleccionado.email}${colors.reset}`);
      console.log(`Porcentaje: ${colors.cyan}${porcentaje}%${colors.reset}`);
      if (datosAdicionales.telefono) console.log(`Teléfono: ${colors.cyan}${datosAdicionales.telefono}${colors.reset}`);
      if (datosAdicionales.notas) console.log(`Notas: ${colors.cyan}${datosAdicionales.notas}${colors.reset}`);

      const confirmarCreacion = await this.pregunta(`\n${colors.yellow}¿Proceder con la creación del socio fundador? (S/n): ${colors.reset}`);
      
      if (confirmarCreacion.toLowerCase() === 'n' || confirmarCreacion.toLowerCase() === 'no') {
        console.log(`${colors.yellow}Operación cancelada.${colors.reset}`);
        await this.cleanup();
        return;
      }

      // Crear socio fundador
      await this.crearSocioFundador(adminSeleccionado, porcentaje, datosAdicionales);

      console.log(`\n${colors.green}El socio fundador puede ahora asignar subroles de socio a otros admins.${colors.reset}`);

    } catch (error) {
      console.error(`${colors.red}Error durante la ejecución:${colors.reset}`, error.message);
    } finally {
      await this.cleanup();
      console.log(`\n${colors.blue}¡Hasta luego!${colors.reset}`);
    }
  }
}

// Ejecutar script
const initializer = new SocioFounderInitializer();
initializer.ejecutar().catch(console.error);