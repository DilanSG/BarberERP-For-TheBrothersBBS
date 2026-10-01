import multer from 'multer';
import path from 'path';
import { cloudinary } from '../../shared/config/cloudinary.js';
import { AppError } from '../../shared/utils/errors.js';
import { logger } from '../../shared/utils/logger.js';
import fs from 'fs';

// Asegurar que el directorio temp existe
const tempDir = 'uploads/temp/';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Verificar si Cloudinary esta configurado
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Configuración de multer para subida temporal
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Solo se permiten imágenes', 400), false);
  }
};

// Multer para subida temporal (max 3MB para base64 en DB)
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB (base64 incrementa ~33%)
  },
  fileFilter: fileFilter
});

// Middleware para subir una sola imagen
export const uploadImage = upload.single('image');

// Middleware para subir imagen a Cloudinary (con fallback a base64 en DB)
export const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    // Intentar Cloudinary primero si esta configurado
    if (isCloudinaryConfigured()) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'the_brothers_barbershop',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' }
          ]
        });

        req.image = {
          public_id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          source: 'cloudinary'
        };

        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
        return next();
      } catch (cloudError) {
        logger.warn('Cloudinary fallo, usando base64 en DB:', cloudError.message);
        // Continuar con base64
      }
    }

    // Fallback: guardar como base64 en la BD
    // (Cloudinary no configurado o falló; se genera un data URL con el archivo temporal)
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    req.image = {
      public_id: `local_${Date.now()}`,
      url: dataUrl,
      width: 800,
      height: 800,
      format: mimeType.replace('image/', ''),
      source: 'base64'
    };

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    next();
  } catch (error) {
    logger.error('Error en upload de imagen:', error);
    // Limpiar archivo temporal si existe
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError('Error al procesar la imagen', 500));
  }
};

// Middleware para eliminar imagen (Cloudinary o base64 en DB)
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    
    // Si es imagen base64 (guardada en DB), no hay nada que eliminar del disco
    if (publicId.startsWith('local_')) {
      return { result: 'ok', source: 'base64' };
    }
    
    // Si es Cloudinary
    if (isCloudinaryConfigured()) {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    }
    
    return { result: 'skipped' };
  } catch (error) {
    logger.error('Error eliminando imagen:', error);
    throw error;
  }
};

// Middleware para validar tipo de archivo (solo para endpoints que requieren imagen)
export const validateImageRequired = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Por favor sube una imagen', 400));
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return next(new AppError('Formato de imagen no válido. Use JPEG, PNG, GIF o WEBP', 400));
  }

  next();
};

// Middleware para validar tipo de archivo (opcional para endpoints de actualización)
export const validateImage = (req, res, next) => {
  // Si no hay archivo, continúa sin error
  if (!req.file) {
    return next();
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return next(new AppError('Formato de imagen no válido. Use JPEG, PNG, GIF o WEBP', 400));
  }

  next();
};