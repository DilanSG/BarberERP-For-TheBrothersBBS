import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { logger, AppError } from '../barrel.js';

// Servicio central de gestión de emails
// Soporta: SendGrid (recomendado para producción) y Nodemailer SMTP (dev/fallback)
// Se exporta como singleton e inicia deshabilitado si no hay credenciales.
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.provider = null; // 'sendgrid' o 'smtp'
    this.initializeProvider();
  }

  // Inicializar proveedor de email (SendGrid o SMTP)
  initializeProvider() {
    try {
      // Prioridad 1: SendGrid (recomendado para producción)
      if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.provider = 'sendgrid';
        this.isConfigured = true;
        logger.info('✅ Servicio de email configurado con SendGrid');
        return;
      }

      // Prioridad 2: SMTP tradicional (Gmail, Outlook, etc.)
      const emailConfig = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      // Verificar que las credenciales estén configuradas
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        logger.warn('Credenciales de email no configuradas. Funcionalidad de emails deshabilitada.');
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.provider = 'smtp';
      this.isConfigured = true;
      
      logger.info('✅ Servicio de email configurado con SMTP');
    } catch (error) {
      logger.error('Error configurando servicio de email:', error);
      this.isConfigured = false;
    }
  }

  // Método getter para verificar si el servicio está configurado
  // @returns {boolean}
  getIsConfigured() {
    return this.isConfigured;
  }

  // Verificar conexión del proveedor de email
  // @returns {Promise<boolean>} true si la conexión es válida
  async verifyConnection() {
    if (!this.isConfigured) {
      throw new AppError('Servicio de email no configurado', 500);
    }

    try {
      if (this.provider === 'sendgrid') {
        // SendGrid no requiere verificación de conexión
        logger.info('✅ SendGrid API Key configurada correctamente');
        return true;
      }

      if (this.provider === 'smtp') {
        await this.transporter.verify();
        logger.info('✅ Conexión SMTP verificada correctamente');
        return true;
      }
    } catch (error) {
      logger.error('Error verificando conexión:', error.message);
      throw new AppError('Error de conexión con servidor de email', 500);
    }
  }

  // Función base para enviar emails (soporta SendGrid y SMTP)
  // @param {Object} options - { to, subject, html, text?, attachments? }
  // @returns {Promise<Object>} resultado con success, messageId y message
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    if (!this.isConfigured) {
      logger.warn('Intento de envío de email con servicio deshabilitado');
      return { success: false, message: 'Servicio de email no configurado' };
    }

    try {
      const fromEmail = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'thebrobarbers20@gmail.com';
      const fromName = process.env.EMAIL_FROM_NAME || 'The Brothers Barber Shop';

      // SendGrid API
      if (this.provider === 'sendgrid') {
        const msg = {
          to,
          from: {
            email: fromEmail,
            name: fromName
          },
          subject,
          html,
          text: text || this.htmlToText(html),
        };

        // SendGrid maneja attachments de forma diferente
        if (attachments && attachments.length > 0) {
          msg.attachments = attachments.map(att => ({
            content: att.content,
            filename: att.filename,
            type: att.contentType || 'application/octet-stream',
            disposition: 'attachment'
          }));
        }

        const response = await sgMail.send(msg);
        
        logger.info(`✅ Email enviado via SendGrid a ${to}`, {
          subject,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          messageId: response[0].headers['x-message-id'],
          message: 'Email enviado correctamente'
        };
      }

      // SMTP (Nodemailer)
      if (this.provider === 'smtp') {
        const mailOptions = {
          from: {
            name: fromName,
            address: fromEmail
          },
          to,
          subject,
          html,
          text: text || this.htmlToText(html),
          attachments
        };

        const info = await this.transporter.sendMail(mailOptions);
        
        logger.info(`✅ Email enviado via SMTP a ${to}`, {
          messageId: info.messageId,
          subject,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          messageId: info.messageId,
          message: 'Email enviado correctamente'
        };
      }

    } catch (error) {
      logger.error(`Error enviando email a ${to}:`, error);
      throw new AppError(`Error enviando email: ${error.message}`, 500);
    }
  }

  // Convertir HTML básico a texto plano
  // @param {string} html - Contenido HTML
  // @returns {string} Texto sin etiquetas para el fallback de clientes sin HTML
  htmlToText(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // Template base para emails
  // @param {Object} options - { title, content, footerText? }
  // @returns {string} HTML completo con estilos inline y diseño responsive
  getBaseTemplate({ title, content, footerText = null }) {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background-color: #f4f4f4; 
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: #fff; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #1f2937, #374151); 
          color: #fff; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { 
          font-size: 24px; 
          margin-bottom: 5px; 
          font-weight: 600; 
        }
        .header p { 
          opacity: 0.9; 
          font-size: 14px; 
        }
        .content { 
          padding: 30px 20px; 
        }
        .footer { 
          background: #f8f9fa; 
          padding: 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #666; 
          border-top: 1px solid #e9ecef; 
        }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
          color: #fff; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          margin: 20px 0; 
          font-weight: 500; 
        }
        .button:hover { 
          background: linear-gradient(135deg, #1d4ed8, #1e40af); 
        }
        .appointment-card { 
          background: #f8f9fa; 
          border: 1px solid #e9ecef; 
          border-radius: 8px; 
          padding: 20px; 
          margin: 20px 0; 
        }
        .appointment-detail { 
          display: flex; 
          justify-content: space-between; 
          margin: 8px 0; 
          padding: 8px 0; 
          border-bottom: 1px solid #e9ecef; 
        }
        .appointment-detail:last-child { 
          border-bottom: none; 
        }
        .label { 
          font-weight: 600; 
          color: #374151; 
        }
        .value { 
          color: #6b7280; 
        }
        @media only screen and (max-width: 600px) {
          .container { margin: 10px; }
          .content { padding: 20px 15px; }
          .header { padding: 20px 15px; }
          .appointment-detail { flex-direction: column; }
          .appointment-detail .value { margin-top: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>The Brothers Barber Shop</h1>
          <p>Tu barbería de confianza</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          ${footerText || `
            <p><strong>The Brothers Barber Shop</strong></p>
            <p>Calle 38 Sur, Kennedy, Bogotá 110861</p>
            <p>Tel: 311 5882528 | Email: thebrobarbers20@gmail.com</p>
            <p style="margin-top: 10px; opacity: 0.8;">
              Este mensaje fue generado automáticamente. Por favor no responder a este correo.
            </p>
          `}
        </div>
      </div>
    </body>
    </html>`;
  }

  // CONFIRMACIÓN DE CITA - Para usuarios
  // @param {Object} appointment - Cita confirmada
  // @param {Object} user - Cliente destinatario
  async sendAppointmentConfirmation(appointment, user) {
    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Confirmación de Cita</h2>
      <p>Estimado/a <strong>${user.name}</strong>,</p>
      <p>Su cita ha sido confirmada. A continuación los detalles:</p>
      
      <div class="appointment-card">
        <div class="appointment-detail">
          <span class="label">Fecha:</span>
          <span class="value">${new Date(appointment.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Hora:</span>
          <span class="value">${appointment.time}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Servicio:</span>
          <span class="value">${appointment.service?.name || 'Servicio básico'}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Barbero:</span>
          <span class="value">${appointment.barber?.name || 'Por asignar'}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Precio:</span>
          <span class="value">$${appointment.service?.price?.toLocaleString() || 'A definir'}</span>
        </div>
        ${appointment.notes ? `
        <div class="appointment-detail">
          <span class="label">Notas:</span>
          <span class="value">${appointment.notes}</span>
        </div>
        ` : ''}
      </div>

      <p><strong>Información importante:</strong></p>
      <ul style="margin: 15px 0; padding-left: 20px;">
        <li>Le recomendamos llegar 5 minutos antes de su cita</li>
        <li>Para cancelaciones, solicitamos un aviso con al menos 2 horas de anticipación</li>
        <li>Si es su primera visita, por favor traiga identificación</li>
      </ul>

      <p>Esperamos atenderle pronto.</p>
      <p>Saludos cordiales,<br>The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Confirmación de Cita - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Confirmación de cita - The Brothers Barber Shop',
      html
    });
  }

  // RECORDATORIO DE CITA - Para usuarios (24h antes)
  // @param {Object} appointment - Cita programada
  // @param {Object} user - Cliente destinatario
  async sendAppointmentReminder(appointment, user) {
    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Recordatorio de Cita</h2>
      <p>Estimado/a <strong>${user.name}</strong>,</p>
      <p>Le recordamos que tiene una cita programada para mañana con los siguientes detalles:</p>
      
      <div class="appointment-card">
        <div class="appointment-detail">
          <span class="label">Fecha:</span>
          <span class="value">${new Date(appointment.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Hora:</span>
          <span class="value">${appointment.time}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Servicio:</span>
          <span class="value">${appointment.service?.name || 'Servicio básico'}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Barbero:</span>
          <span class="value">${appointment.barber?.name || 'Por asignar'}</span>
        </div>
      </div>

      <p><strong>¿Necesita reprogramar?</strong></p>
      <p>Si no puede asistir, le agradecemos nos informe con anticipación para poder ofrecer el horario a otros clientes.</p>
      
      <p>Nos vemos mañana.</p>
      <p>Saludos,<br>The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Recordatorio de Cita - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Recordatorio: Cita programada para mañana',
      html
    });
  }

  // NOTIFICACIÓN NUEVA CITA - Para barberos
  // @param {Object} appointment - Cita creada
  // @param {Object} barber - Barbero asignado (incluye email)
  // @param {Object} user - Cliente que agendó
  async sendNewAppointmentNotification(appointment, barber, user) {
    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Nueva Cita Asignada</h2>
      <p>Hola <strong>${barber.name}</strong>,</p>
      <p>Se ha programado una nueva cita en tu agenda:</p>
      
      <div class="appointment-card">
        <div class="appointment-detail">
          <span class="label">Cliente:</span>
          <span class="value">${user.name}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Fecha:</span>
          <span class="value">${new Date(appointment.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Hora:</span>
          <span class="value">${appointment.time}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Servicio:</span>
          <span class="value">${appointment.service?.name || 'Servicio básico'}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Teléfono:</span>
          <span class="value">${user.phone || 'No proporcionado'}</span>
        </div>
        ${appointment.notes ? `
        <div class="appointment-detail">
          <span class="label">Notas del cliente:</span>
          <span class="value">${appointment.notes}</span>
        </div>
        ` : ''}
      </div>

      <p>Revisa tu agenda para el día indicado.</p>
      <p>Saludos,<br>The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Nueva Cita Asignada - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: barber.email,
      subject: 'Nueva cita asignada - ' + new Date(appointment.date).toLocaleDateString('es-ES'),
      html
    });
  }

  // RESUMEN DIARIO - Para barberos
  // @param {Object} barber - Barbero destinatario
  // @param {Array} appointments - Citas del día a listar
  async sendDailySummary(barber, appointments) {
    const today = new Date();
    const appointmentCount = appointments.length;
    
    let appointmentsList = '';
    if (appointmentCount > 0) {
      appointmentsList = appointments.map(apt => `
        <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; border-radius: 0 8px 8px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: #1f2937;">${apt.time} - ${apt.user?.name || 'Cliente'}</strong>
            <span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${apt.service?.name || 'Servicio'}</span>
          </div>
          ${apt.notes ? `<p style="color: #6b7280; font-size: 14px; margin-top: 8px;"><em>Nota: ${apt.notes}</em></p>` : ''}
        </div>
      `).join('');
    }

    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Resumen Diario</h2>
      <p>Buenos días <strong>${barber.name}</strong>,</p>
      <p>A continuación el resumen de tus citas para hoy, ${today.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}:</p>
      
      <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <h3 style="margin: 0; font-size: 18px;">Citas del Día</h3>
        <p style="font-size: 32px; font-weight: bold; margin: 10px 0;">${appointmentCount}</p>
        <p style="margin: 0; opacity: 0.9;">${appointmentCount === 0 ? 'Sin citas programadas' : appointmentCount === 1 ? '1 cita programada' : `${appointmentCount} citas programadas`}</p>
      </div>

      ${appointmentCount > 0 ? `
        <h3 style="color: #1f2937; margin: 25px 0 15px 0;">Agenda del Día</h3>
        ${appointmentsList}
        
        <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af;"><strong>Recordatorio:</strong> Verifica que cuentes con los implementos necesarios para cada servicio.</p>
        </div>
      ` : `
        <div style="text-align: center; padding: 40px 0;">
          <h3 style="color: #1f2937; margin: 15px 0 5px 0;">Sin citas programadas</h3>
          <p style="color: #6b7280;">No tienes citas agendadas para el día de hoy.</p>
        </div>
      `}

      <p>Saludos,<br>The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Resumen Diario - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: barber.email,
      subject: `Resumen del día - ${appointmentCount} cita${appointmentCount !== 1 ? 's' : ''} programada${appointmentCount !== 1 ? 's' : ''}`,
      html
    });
  }

  // CANCELACIÓN DE CITA
  // @param {Object} appointment - Cita cancelada
  // @param {Object} user - Cliente destinatario
  // @param {string} reason - Motivo opcional de la cancelación
  async sendAppointmentCancellation(appointment, user, reason = '') {
    const content = `
      <h2 style="color: #dc2626; margin-bottom: 20px;">Cita Cancelada</h2>
      <p>Estimado/a <strong>${user.name}</strong>,</p>
      <p>Le informamos que su cita ha sido cancelada:</p>
      
      <div class="appointment-card">
        <div class="appointment-detail">
          <span class="label">Fecha:</span>
          <span class="value">${new Date(appointment.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Hora:</span>
          <span class="value">${appointment.time}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Servicio:</span>
          <span class="value">${appointment.service?.name || 'Servicio básico'}</span>
        </div>
        ${reason ? `
        <div class="appointment-detail">
          <span class="label">Motivo:</span>
          <span class="value">${reason}</span>
        </div>
        ` : ''}
      </div>

      <p>Puede agendar una nueva cita cuando lo desee a través de nuestra plataforma.</p>
      <p>Saludos,<br>The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Cita Cancelada - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Cita cancelada - The Brothers Barber Shop',
      html
    });
  }

  // BIENVENIDA - Nuevo usuario registrado
  // @param {Object} user - Usuario recién creado
  async sendWelcomeEmail(user) {
    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Bienvenido a The Brothers Barber Shop</h2>
      
      <p>Hola <strong>${user.name}</strong>,</p>
      <p>Tu cuenta ha sido creada exitosamente. A continuación encontrarás los detalles de tu registro:</p>

      <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
        <h3 style="color: #1e40af; margin: 0 0 10px 0;">Información de la cuenta</h3>
        <div class="appointment-detail">
          <span class="label">Email:</span>
          <span class="value">${user.email}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Nombre:</span>
          <span class="value">${user.name}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Teléfono:</span>
          <span class="value">${user.phone || 'No proporcionado'}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Tipo de cuenta:</span>
          <span class="value">${user.role === 'user' ? 'Cliente' : user.role === 'barber' ? 'Barbero' : 'Administrador'}</span>
        </div>
      </div>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0;">Servicios disponibles</h3>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin: 8px 0;">Agendar citas con nuestros barberos profesionales</li>
          <li style="margin: 8px 0;">Consultar horarios disponibles</li>
          <li style="margin: 8px 0;">Ver catálogo de servicios y tarifas</li>
          <li style="margin: 8px 0;">Gestionar tu perfil</li>
          <li style="margin: 8px 0;">Acceder a tu historial de servicios</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://the-bro-barbers.vercel.app'}/appointments/new" class="button">
          Agendar una Cita
        </a>
      </div>

      <p>Para cualquier consulta, estamos a tu disposición a través de nuestros canales de contacto.</p>
      <p>Saludos cordiales,<br>Equipo The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Bienvenido - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Bienvenido a The Brothers Barber Shop',
      html
    });
  }

  // CONFIRMACIÓN DE LOGIN - Seguridad adicional
  // @param {Object} user - Usuario que inició sesión
  // @param {Object} loginInfo - { ip, device, location, timestamp } opcional
  async sendLoginNotification(user, loginInfo = {}) {
    const { ip, device, location, timestamp } = loginInfo;
    const loginTime = timestamp ? new Date(timestamp).toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleString('es-ES');

    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Notificación de Acceso a tu Cuenta</h2>
      <p>Hola <strong>${user.name}</strong>,</p>
      <p>Se ha registrado un nuevo inicio de sesión en tu cuenta. Si reconoces esta actividad, no es necesario que tomes ninguna acción.</p>

      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
        <h3 style="color: #1e40af; margin: 0 0 15px 0;">Detalles del acceso</h3>
        <div class="appointment-detail">
          <span class="label">Fecha y hora:</span>
          <span class="value">${loginTime}</span>
        </div>
        ${ip ? `
        <div class="appointment-detail">
          <span class="label">Dirección IP:</span>
          <span class="value">${ip}</span>
        </div>
        ` : ''}
        ${device ? `
        <div class="appointment-detail">
          <span class="label">Dispositivo:</span>
          <span class="value">${device}</span>
        </div>
        ` : ''}
        ${location ? `
        <div class="appointment-detail">
          <span class="label">Ubicación:</span>
          <span class="value">${location}</span>
        </div>
        ` : ''}
      </div>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #991b1b;"><strong>¿No reconoces esta actividad?</strong></p>
        <p style="margin: 0; color: #991b1b;">Si no fuiste tú quien inició sesión, te recomendamos cambiar tu contraseña inmediatamente y contactar a nuestro equipo de soporte.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://the-bro-barbers.vercel.app'}/profile/security" class="button" style="background: linear-gradient(135deg, #dc2626, #991b1b);">
          Cambiar Contraseña
        </a>
      </div>

      <p>Este es un mensaje automático de seguridad.</p>
      <p>Saludos,<br>Equipo The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Notificación de Acceso - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Notificación de acceso a tu cuenta',
      html
    });
  }

  // RESET DE CONTRASEÑA - Enviar token
  // @param {Object} user - Usuario que solicita el reset
  // @param {string} resetToken - Token temporal incluido en el enlace
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://the-bro-barbers.vercel.app'}/auth/reset-password/${resetToken}`;
    const expiresIn = '1 hora';

    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Restablecimiento de Contraseña</h2>
      <p>Hola <strong>${user.name}</strong>,</p>
      <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>

      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
        <p style="margin: 0 0 10px 0; color: #92400e;"><strong>Importante:</strong> Este enlace es válido únicamente por <strong>${expiresIn}</strong>.</p>
        <p style="margin: 0; color: #92400e;">Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña permanecerá sin cambios.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="button">
          Restablecer Contraseña
        </a>
      </div>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;"><strong>¿Problemas con el botón?</strong></p>
        <p style="margin: 0; color: #6b7280; font-size: 13px; word-break: break-all;">Copia y pega este enlace en tu navegador:</p>
        <p style="margin: 10px 0 0 0; color: #3b82f6; font-size: 12px; word-break: break-all;">${resetUrl}</p>
      </div>

      <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #1e40af;"><strong>Nota de seguridad:</strong> Nunca compartas este enlace. Nuestro equipo nunca solicitará tu contraseña por email o teléfono.</p>
      </div>

      <p>Saludos,<br>Equipo The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Restablecer Contraseña - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Solicitud de restablecimiento de contraseña',
      html
    });
  }

  // CONFIRMACIÓN DE CAMBIO DE CONTRASEÑA
  // @param {Object} user - Usuario cuyo password cambió
  async sendPasswordChangedConfirmation(user) {
    const changeTime = new Date().toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const content = `
      <h2 style="color: #059669; margin-bottom: 20px;">Contraseña Actualizada</h2>
      
      <p>Hola <strong>${user.name}</strong>,</p>
      <p>Te confirmamos que la contraseña de tu cuenta ha sido modificada exitosamente.</p>

      <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
        <div class="appointment-detail">
          <span class="label">Fecha del cambio:</span>
          <span class="value">${changeTime}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Cuenta:</span>
          <span class="value">${user.email}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Estado:</span>
          <span class="value">Contraseña actualizada y activa</span>
        </div>
      </div>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #991b1b;"><strong>¿No realizaste este cambio?</strong></p>
        <p style="margin: 0; color: #991b1b;">Si no fuiste tú quien modificó la contraseña, contacta inmediatamente a nuestro equipo de soporte para proteger tu cuenta.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://the-bro-barbers.vercel.app'}/profile" class="button">
          Ir a Mi Perfil
        </a>
      </div>

      <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #1e40af;"><strong>Recomendación:</strong> Utiliza una contraseña única y segura. Considera el uso de un gestor de contraseñas.</p>
      </div>

      <p>Saludos,<br>Equipo The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Contraseña Actualizada - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: 'Confirmación de cambio de contraseña',
      html
    });
  }

  // NOTIFICACIÓN DE VENTA - Para clientes
  // @param {Object} sale - Venta con items, total y método de pago
  // @param {Object} user - Cliente destinatario
  async sendSaleConfirmation(sale, user) {
    const saleDate = new Date(sale.createdAt).toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsList = '';
    if (sale.items && sale.items.length > 0) {
      itemsList = sale.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 12px; background: #f8f9fa; border-radius: 6px; margin: 8px 0;">
          <div>
            <strong style="color: #1f2937;">${item.productName || item.product?.name || 'Producto'}</strong>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Cantidad: ${item.quantity}</p>
          </div>
          <div style="text-align: right;">
            <strong style="color: #1f2937;">$${(item.price * item.quantity).toLocaleString()}</strong>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">$${item.price.toLocaleString()} c/u</p>
          </div>
        </div>
      `).join('');
    }

    const content = `
      <h2 style="color: #1f2937; margin-bottom: 20px;">Comprobante de Compra</h2>
      
      <p>Estimado/a <strong>${user.name}</strong>,</p>
      <p>Gracias por su compra. A continuación el detalle de su transacción:</p>

      <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <p style="margin: 0; opacity: 0.9; font-size: 14px;">Total</p>
        <h3 style="margin: 10px 0 5px 0; font-size: 36px;">${sale.total.toLocaleString('es-ES', { style: 'currency', currency: 'COP' })}</h3>
        <p style="margin: 0; opacity: 0.8; font-size: 12px;">Recibo #${sale._id?.toString().slice(-8).toUpperCase() || 'N/A'}</p>
      </div>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0;">Productos</h3>
        ${itemsList || '<p style="margin: 0; color: #6b7280;">Sin productos registrados</p>'}
      </div>

      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
        <h3 style="color: #1e40af; margin: 0 0 15px 0;">Resumen</h3>
        <div class="appointment-detail">
          <span class="label">Fecha:</span>
          <span class="value">${saleDate}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Método de pago:</span>
          <span class="value">${sale.paymentMethod || 'Efectivo'}</span>
        </div>
        <div class="appointment-detail">
          <span class="label">Atendido por:</span>
          <span class="value">${sale.barber?.name || 'Staff'}</span>
        </div>
        ${sale.discount > 0 ? `
        <div class="appointment-detail">
          <span class="label">Descuento:</span>
          <span class="value">-$${sale.discount.toLocaleString()}</span>
        </div>
        ` : ''}
      </div>

      <p>Agradecemos su preferencia.</p>
      <p>Saludos cordiales,<br>The Brothers Barber Shop</p>
    `;

    const html = this.getBaseTemplate({
      title: 'Comprobante de Compra - The Brothers Barber Shop',
      content
    });

    return await this.sendEmail({
      to: user.email,
      subject: `Comprobante de compra - The Brothers Barber Shop`,
      html
    });
  }

  // Enviar email solicitando reseña después de cita completada
  // @param {Object} appointment - Objeto de cita completada
  // @param {Object} user - Usuario que recibió el servicio
  // @param {Object} barber - Barbero que realizó el servicio
  async sendReviewRequest(appointment, user, barber) {
    // Usar URL de producción si estamos en producción, sino localhost
    const frontendUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.FRONTEND_URL || 'https://the-bro-barbers.vercel.app')
      : 'http://localhost:5173';
    
    const reviewUrl = `${frontendUrl}/reviews/create/${appointment._id}`;
    
    logger.info(`📧 Generando URL de reseña: ${reviewUrl} (env: ${process.env.NODE_ENV})`);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Cuéntanos tu experiencia!</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; background-color: #f4f4f7; padding: 20px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #1F2937 0%, #111827 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { font-size: 28px; margin-bottom: 10px; font-weight: bold; }
          .header p { font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .appointment-card { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 10px; padding: 25px; margin: 25px 0; color: white; }
          .appointment-card h3 { font-size: 18px; margin-bottom: 15px; font-weight: 600; }
          .appointment-detail { display: flex; align-items: center; margin: 10px 0; font-size: 15px; }
          .appointment-detail strong { margin-right: 8px; }
          .stars-preview { text-align: center; margin: 30px 0; }
          .stars-preview .star { font-size: 40px; color: #FFD700; margin: 0 5px; cursor: pointer; transition: transform 0.2s; display: inline-block; }
          .stars-preview .star:hover { transform: scale(1.2); }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: 600; margin: 20px 0; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s; }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4); }
          .message { font-size: 16px; color: #374151; line-height: 1.8; margin: 20px 0; }
          .footer { background: #F3F4F6; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; border-top: 1px solid #E5E7EB; }
          .footer p { margin: 8px 0; }
          .highlight { color: #3B82F6; font-weight: 600; }
          @media (max-width: 600px) {
            .header h1 { font-size: 24px; }
            .content { padding: 30px 20px; }
            .cta-button { padding: 14px 30px; font-size: 16px; }
            .stars-preview .star { font-size: 35px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>✂️ ¡Gracias por tu visita!</h1>
            <p>Tu opinión es muy importante para nosotros</p>
          </div>

          <!-- Content -->
          <div class="content">
            <p class="message">
              Hola <strong>${user.name}</strong>,
            </p>
            
            <p class="message">
              ¡Esperamos que hayas disfrutado de tu experiencia en <span class="highlight">The Brothers Barber Shop</span>! 
            </p>

            <!-- Appointment Details -->
            <div class="appointment-card">
              <h3>📅 Detalles de tu visita</h3>
              <div class="appointment-detail">
                <strong>✂️ Barbero:</strong> ${barber.user?.name || 'N/A'}
              </div>
              <div class="appointment-detail">
                <strong>📅 Fecha:</strong> ${new Date(appointment.date).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div class="appointment-detail">
                <strong>🕐 Hora:</strong> ${new Date(appointment.date).toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false
                })}
              </div>
            </div>

            <p class="message">
              Nos encantaría conocer tu opinión sobre el servicio que recibiste. 
              <strong>¿Cómo calificarías tu experiencia?</strong>
            </p>

            <!-- Stars Preview -->
            <div class="stars-preview">
              <span class="star">⭐</span>
              <span class="star">⭐</span>
              <span class="star">⭐</span>
              <span class="star">⭐</span>
              <span class="star">⭐</span>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="${reviewUrl}" class="cta-button">
                ⭐ Dejar mi reseña
              </a>
            </div>

            <p class="message" style="font-size: 14px; color: #6B7280; margin-top: 30px;">
              Tu calificación nos ayuda a mejorar continuamente y a brindar el mejor servicio posible. 
              <strong>¡Solo te tomará 10 segundos!</strong>
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p><strong>The Brothers Barber Shop</strong></p>
            <p>📍 Dirección de la barbería</p>
            <p>📞 Teléfono de contacto</p>
            <p style="margin-top: 15px; font-size: 12px;">
              Si tienes alguna pregunta o comentario, no dudes en contactarnos.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    logger.info(`Enviando solicitud de reseña a ${user.email} para cita ${appointment._id}`);

    return await this.sendEmail({
      to: user.email,
      subject: '⭐ ¡Cuéntanos tu experiencia en The Brothers Barber Shop!',
      html
    });
  }
}

// Exportar instancia singleton
const emailService = new EmailService();
export default emailService;