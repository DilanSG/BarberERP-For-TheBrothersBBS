import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// Conecta a MongoDB con pool de conexiones y timeouts acotados.
// En caso de fallo inicial termina el proceso para evitar arrancar sin base de datos.
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      // family 4 evita demoras cuando IPv6 no está disponible en la red
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    const { host, name } = mongoose.connection;
    logger.info(`MongoDB conectado (${host}/${name})`, { host, database: name });
  } catch (error) {
    logger.error('Error conectando a MongoDB', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};


// Manejar eventos de conexión (solo para debugging detallado)
mongoose.connection.on('error', (err) => {
  logger.error('Error de conexión de Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose desconectado de MongoDB');
});

// Cerramos la conexión adecuadamente cuando la app termina
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('Conexión a MongoDB cerrada por terminación de la app');
  process.exit(0);
});

export default connectDB;