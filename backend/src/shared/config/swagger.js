import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Opciones de Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'The Brothers Barbershop API',
      version: '1.0.0',
      description: `
        API para el sistema de gestión de la barbería The Brothers Barbershop.
        
        Esta API proporciona endpoints para:
        * Gestión de usuarios y autenticación
        * Gestión de barberos y sus perfiles
        * Gestión de servicios ofrecidos
        * Sistema de citas
        * Gestión de inventario
        * Monitoreo y métricas del sistema
      `,
      contact: {
        name: 'The Brothers Barbershop Support',
        email: 'support@brothersbarbershop.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.brothersbarbershop.com',
        description: 'Servidor de producción'
      }
    ]
  },
  // Paths a los archivos que contienen anotaciones
  apis: [
    join(__dirname, '../routes/*.js'),
    join(__dirname, '../models/*.js'),
    join(__dirname, '../middleware/*.js'),
    join(__dirname, '../controllers/*.js'),
    join(__dirname, 'swagger.yaml')
  ]
};

// Generar especificación
const swaggerSpec = swaggerJsdoc(options);

// Configurar Swagger UI
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'The Brothers Barbershop API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activated: true,
      theme: 'monokai'
    }
  }
};

// Monta Swagger UI en /api/docs y expone el spec JSON en /api/docs.json.
export const setupSwagger = (app) => {
  // Ruta para la documentación
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Ruta para obtener el spec en formato JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default setupSwagger;
