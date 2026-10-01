/**
 * Script Maestro: Gestión completa de población de datos
 * Permite ejecutar todo el proceso de población y validación
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Configurar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

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

class DataMaster {
  constructor() {
    this.scripts = [
      {
        name: 'Análisis de datos',
        file: '1-analyze-data.js',
        description: 'Analiza usuarios, barberos, servicios e inventario existentes'
      },
      {
        name: 'Generación de datos',
        file: '2-create-realistic-data.js',
        description: 'Crea citas, ventas y reseñas realistas para 2 meses'
      },
      {
        name: 'Validación de reportes',
        file: '3-validate-reports.js',
        description: 'Verifica que todos los reportes funcionen correctamente'
      }
    ];
  }

  async start() {
    log('🚀 MAESTRO DE POBLACIÓN DE DATOS - THE BROTHERS BARBER SHOP', colors.magenta);
    log('═'.repeat(70), colors.magenta);
    
    try {
      await this.checkConnection();
      await this.showMenu();
    } catch (error) {
      log(`❌ Error: ${error.message}`, colors.red);
      process.exit(1);
    }
  }

  async checkConnection() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('✅ Conexión a MongoDB establecida', colors.green);
      await mongoose.disconnect();
    } catch (error) {
      throw new Error(`No se pudo conectar a MongoDB: ${error.message}`);
    }
  }

  async showMenu() {
    log('\n📋 OPCIONES DISPONIBLES:', colors.cyan);
    log('1. 🔍 Ejecutar solo análisis de datos');
    log('2. 🏗️  Ejecutar solo generación de datos');
    log('3. ✅ Ejecutar solo validación de reportes');
    log('4. 🚀 Ejecutar proceso completo (análisis + generación + validación)');
    log('5. 🧹 Limpiar datos generados (mantener usuarios, barberos, servicios)');
    log('6. 💀 Limpiar TODO (incluyendo usuarios y barberos)');
    log('7. ❌ Salir');

    // Simular entrada de usuario - en un entorno real usarías readline
    const option = process.argv[2] || '4'; // Por defecto opción 4
    
    await this.executeOption(option);
  }

  async executeOption(option) {
    log(`\n🎯 Ejecutando opción ${option}...`, colors.blue);
    
    switch (option) {
      case '1':
        await this.runScript(0);
        break;
      case '2':
        await this.runScript(1);
        break;
      case '3':
        await this.runScript(2);
        break;
      case '4':
        await this.runCompleteProcess();
        break;
      case '5':
        await this.cleanGeneratedData();
        break;
      case '6':
        await this.cleanAllData();
        break;
      case '7':
        log('👋 ¡Hasta luego!', colors.cyan);
        return;
      default:
        log('❌ Opción no válida', colors.red);
        return;
    }
  }

  async runScript(index) {
    const script = this.scripts[index];
    log(`\n▶️ Ejecutando: ${script.name}`, colors.yellow);
    log(`📄 ${script.description}`, colors.blue);
    
    try {
      const startTime = Date.now();
      execSync(`node scripts/${script.file}`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      const endTime = Date.now();
      
      log(`✅ ${script.name} completado en ${((endTime - startTime) / 1000).toFixed(1)}s`, colors.green);
    } catch (error) {
      log(`❌ Error ejecutando ${script.name}: ${error.message}`, colors.red);
      throw error;
    }
  }

  async runCompleteProcess() {
    log('\n🎬 INICIANDO PROCESO COMPLETO DE POBLACIÓN', colors.magenta);
    log('═'.repeat(50), colors.magenta);
    
    const totalStartTime = Date.now();
    
    try {
      for (let i = 0; i < this.scripts.length; i++) {
        await this.runScript(i);
        
        if (i < this.scripts.length - 1) {
          log('\n⏳ Esperando 2 segundos antes del siguiente paso...', colors.cyan);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      const totalEndTime = Date.now();
      const totalTime = ((totalEndTime - totalStartTime) / 1000).toFixed(1);
      
      log('\n🎉 PROCESO COMPLETO FINALIZADO', colors.green);
      log(`⏱️  Tiempo total: ${totalTime} segundos`, colors.blue);
      log('✅ El sistema está listo para demostración completa', colors.green);
      
    } catch (error) {
      log('\n💥 El proceso se detuvo debido a un error', colors.red);
      log('🔧 Revisa los logs anteriores para más detalles', colors.yellow);
    }
  }

  async cleanGeneratedData() {
    log('\n🧹 Limpiando datos generados...', colors.yellow);
    
    try {
      execSync('node scripts/clean-transactions.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      log('✅ Datos generados limpiados exitosamente', colors.green);
      log('ℹ️  Usuarios, barberos, servicios e inventario se mantuvieron', colors.blue);
      
    } catch (error) {
      log(`❌ Error limpiando datos: ${error.message}`, colors.red);
    }
  }

  async cleanAllData() {
    log('\n💀 ADVERTENCIA: Esto eliminará TODOS los datos', colors.red);
    log('⚠️  Incluyendo usuarios, barberos, servicios e inventario', colors.yellow);
    log('❓ ¿Estás seguro? Esta acción no se puede deshacer', colors.red);
    
    // En un entorno real, aquí pedirías confirmación
    log('🚫 Cancelado por seguridad. Usa directamente el script si necesitas limpieza total', colors.cyan);
  }
}

// Verificar argumentos de línea de comandos
if (process.argv.length > 3) {
  log('📖 Uso: node scripts/master-population.js [opción]', colors.cyan);
  log('   Opciones: 1-7 (o sin parámetro para proceso completo)', colors.blue);
  process.exit(1);
}

// Ejecutar maestro
const master = new DataMaster();
master.start();