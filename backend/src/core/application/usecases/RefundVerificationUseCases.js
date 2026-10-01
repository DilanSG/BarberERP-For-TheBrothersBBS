import crypto from 'crypto';
import { logger } from '../../../barrel.js';

// Casos de uso para generar y validar códigos de verificación para reembolsos
// Los códigos se regeneran cada hora automáticamente
class RefundVerificationUseCases {
  // Inicializa el estado, genera el primer código y agenda su regeneración
  // cada hora. El interval se marca unref() para no impedir el cierre del proceso.
  constructor() {
    this.currentCode = null;
    this.codeGeneratedAt = null;
    this.generateNewCode(); // Sin log en constructor
    
    // Generar nuevo código cada hora
    this.intervalId = setInterval(() => {
      try {
        this.generateNewCode(true); // Con log en intervalos
      } catch (error) {
        // Un fallo en la regeneración no debe tumbar el proceso
        logger.error('Error regenerando código de verificación de reembolsos:', error);
      }
    }, 60 * 60 * 1000); // 1 hora

    // No bloquear el cierre del proceso por este interval
    if (typeof this.intervalId.unref === 'function') {
      this.intervalId.unref();
    }
  }

  // Inicializar logging del sistema de seguridad
  // Registra en el arranque que el servicio de códigos está activo.
  initializeLogging() {
    logger.info('Sistema de códigos de verificación de reembolsos inicializado (válido por 1 hora)');
  }

  // Generar un nuevo código de verificación
  // El código NUNCA se registra en logs por seguridad
  // Usa crypto.randomInt para obtener 6 dígitos criptográficamente seguros.
  generateNewCode(showLog = false) {
    // Generar código de 6 dígitos criptográficamente seguro
    this.currentCode = crypto.randomInt(100000, 1000000).toString();
    this.codeGeneratedAt = new Date();
    
    if (showLog) {
      logger.info('Código de verificación de reembolsos regenerado (válido por 1 hora)');
    }
  }

  // Obtener el código actual
  // Retorna el código vigente junto con su fecha de generación y expiración.
  getCurrentCode() {
    return {
      code: this.currentCode,
      generatedAt: this.codeGeneratedAt,
      expiresAt: new Date(this.codeGeneratedAt.getTime() + 60 * 60 * 1000)
    };
  }

  // Validar un código
  // Compara el código recibido contra el vigente; retorna false si falta alguno.
  validateCode(inputCode) {
    if (!inputCode || !this.currentCode) {
      return false;
    }
    
    return inputCode.toString() === this.currentCode;
  }

  // Tiempo restante hasta el próximo código (milisegundos, mínimo 0)
  getTimeUntilNextCode() {
    if (!this.codeGeneratedAt) return 0;
    
    const nextCodeTime = new Date(this.codeGeneratedAt.getTime() + 60 * 60 * 1000);
    const now = new Date();
    
    return Math.max(0, nextCodeTime.getTime() - now.getTime());
  }
}

// Instancia singleton compartida por toda la aplicación
export const refundVerificationService = new RefundVerificationUseCases();
export default RefundVerificationUseCases;