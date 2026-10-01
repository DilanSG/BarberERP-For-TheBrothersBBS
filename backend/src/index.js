import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno PRIMERO antes de cualquier otro import
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import app from './app.js';
import config from './shared/config/index.js';
import { connectDB } from './shared/config/database.js';
import { logger } from './shared/utils/logger.js';
import cronJobService from './services/cronJobService.js';
import emailService from './services/emailService.js';
import { initWebSocket } from './services/websocketService.js';
import mongoose from 'mongoose';
import monitoringService from './core/application/usecases/MonitoringUseCases.js';

// Iniciar el servidor
const startServer = async () => {
  try {
    logger.info(`Iniciando servidor [${config.app.nodeEnv}] en puerto ${config.app.port}...`);

    // 1) Conectar a la base de datos
    logger.info('Paso 1/5 · Conectando a MongoDB...');
    await connectDB();

    // 2) Verificar configuración de email (no bloquear el startup)
    logger.info('Paso 2/5 · Verificando servicio de email...');
    emailService.verifyConnection()
      .then(() => {
        logger.info('Servicio de email verificado y listo');
      })
      .catch((error) => {
        logger.warn(`Email no configurado: ${error.message}`);
      });

    // 3) Inicializar trabajos programados (cron jobs)
    logger.info('Paso 3/5 · Inicializando cron jobs...');
    cronJobService.initializeJobs();

    // 4) Iniciar servidor HTTP + WebSocket
    logger.info('Paso 4/5 · Iniciando servidor HTTP y WebSocket...');
    const server = app.listen(config.app.port, '0.0.0.0');
    initWebSocket(server);

    // 5) Servicios finales + resumen de arranque
    server.on('listening', () => {
      logger.info('Paso 5/5 · Activando monitoreo de recursos...');
      monitoringService.startResourceMonitoring();

      const dbLabel = mongoose.connection.name
        ? `${mongoose.connection.host}/${mongoose.connection.name}`
        : 'conectada';

      logger.logStartup({
        nodeEnv: config.app.nodeEnv,
        port: config.app.port,
        host: '0.0.0.0',
        apiBase: `http://localhost:${config.app.port}/api/${config.app.apiVersion}`,
        docsUrl: `http://localhost:${config.app.port}/api/docs`,
        database: dbLabel,
        email: process.env.EMAIL_ENABLED === 'true' ? 'activo' : 'deshabilitado',
        websocket: 'activo',
        cronJobs: cronJobService.isInitialized ? `${cronJobService.jobs.size} activos` : 'deshabilitados',
        monitoring: 'activo'
      });
    });

    // Manejar señales de terminación
    const shutdown = async (signal) => {
      logger.info(`${signal} recibido. Iniciando apagado elegante...`);

      server.close(async () => {
        logger.info('Servidor HTTP cerrado');

        // Detener monitoreo de recursos
        monitoringService.stopResourceMonitoring();

        // Detener trabajos programados
        cronJobService.stopAllJobs();
        logger.info('Cron jobs detenidos');

        try {
          await mongoose.connection.close();
          logger.info('Conexión a MongoDB cerrada');
          process.exit(0);
        } catch (err) {
          logger.error('Error cerrando conexión a MongoDB', { error: err.message, stack: err.stack });
          process.exit(1);
        }
      });

      // Si el servidor no se cierra en 10 segundos, forzar el cierre
      setTimeout(() => {
        logger.error('No se pudo cerrar el servidor elegantemente, forzando cierre');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Error iniciando el servidor', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Iniciar el servidor
startServer();