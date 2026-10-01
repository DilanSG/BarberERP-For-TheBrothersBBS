import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Crear transporter para enviar emails
// @returns {Object} Transporter de Nodemailer configurado por variables de entorno
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Plantillas de email
export const emailTemplates = {
  welcome: (name) => ({
    subject: '¡Bienvenido a The Brothers Barber Shop!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">¡Hola ${name}!</h2>
        <p>Te damos la bienvenida a The Brothers Barber Shop. Estamos emocionados de tenerte como parte de nuestra comunidad.</p>
        <p>Ahora puedes agendar citas, ver nuestros servicios y mucho más.</p>
        <br>
        <p>Saludos cordiales,</p>
        <p><strong>El equipo de The Brothers Barber Shop</strong></p>
      </div>
    `,
  }),
  appointmentConfirmation: (name, appointmentDate, barberName, serviceName) => ({
    subject: 'Confirmación de tu cita en The Brothers Barber Shop',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">¡Hola ${name}!</h2>
        <p>Tu cita ha sido confirmada con éxito.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Servicio:</strong> ${serviceName}</p>
          <p><strong>Barbero:</strong> ${barberName}</p>
          <p><strong>Fecha y hora:</strong> ${new Date(appointmentDate).toLocaleString('es-ES')}</p>
        </div>
        <p>Te esperamos 10 minutos antes de tu cita. Si necesitas cancelar o reagendar, por favor hazlo con al menos 2 horas de anticipación.</p>
        <br>
        <p>Saludos cordiales,</p>
        <p><strong>El equipo de The Brothers Barber Shop</strong></p>
      </div>
    `,
  }),
  appointmentReminder: (name, appointmentDate, barberName, serviceName) => ({
    subject: 'Recordatorio de tu cita en The Brothers Barber Shop',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">¡Hola ${name}!</h2>
        <p>Este es un recordatorio de tu próxima cita.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Servicio:</strong> ${serviceName}</p>
          <p><strong>Barbero:</strong> ${barberName}</p>
          <p><strong>Fecha y hora:</strong> ${new Date(appointmentDate).toLocaleString('es-ES')}</p>
        </div>
        <p>Te esperamos 10 minutos antes de tu cita. Si necesitas cancelar o reagendar, por favor hazlo con al menos 2 horas de anticipación.</p>
        <br>
        <p>Saludos cordiales,</p>
        <p><strong>El equipo de The Brothers Barber Shop</strong></p>
      </div>
    `,
  }),
  passwordReset: (name, resetToken) => ({
    subject: 'Restablecimiento de contraseña - The Brothers Barber Shop',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">¡Hola ${name}!</h2>
        <p>Has solicitado restablecer tu contraseña. Usa el siguiente código para continuar:</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <h3 style="color: #333; letter-spacing: 3px;">${resetToken}</h3>
        </div>
        <p>Este código expirará en 1 hora. Si no solicitaste este restablecimiento, ignora este email.</p>
        <br>
        <p>Saludos cordiales,</p>
        <p><strong>El equipo de The Brothers Barber Shop</strong></p>
      </div>
    `,
  }),
};

// Función para enviar email
// @param {string} to - Destinatario
// @param {string} templateName - Clave de emailTemplates
// @param {Array} templateData - Argumentos que recibe la plantilla
// @returns {Promise<Object>} Resultado del envío de Nodemailer
export const sendEmail = async (to, templateName, templateData) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates[templateName](...templateData);

    const mailOptions = {
      from: `"The Brothers Barber Shop" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: template.subject,
      html: template.html,
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email enviado a: ${to}`);
    return result;
  } catch (error) {
    logger.error('Error enviando email:', error);
    throw error;
  }
};