import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { logger } from '../utils/logger.js';

// Configurar Cloudinary
export { cloudinary };

// Aplica las credenciales de Cloudinary leídas del entorno.
export const cloudinaryConfig = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

// Configurar almacenamiento para multer
// Carpeta remota, formatos permitidos y límite de 500x500 manteniendo proporción.
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'the_brothers_barbershop',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

// Configurar multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    // Verificar tipo de archivo
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  },
});

// Función para eliminar imagen de Cloudinary
// @param {string} publicId - Identificador público del recurso
// @returns {Promise<Object>} Resultado de la destrucción
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    logger.error('Error eliminando imagen de Cloudinary:', error);
    throw error;
  }
};

// Función para subir imagen a Cloudinary
// @param {string} filePath - Ruta local del archivo
// @param {string} folder - Carpeta destino en Cloudinary
// @returns {Promise<Object>} Resultado de la subida
export const uploadImageToCloudinary = async (filePath, folder = 'the_brothers_barbershop') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
    });
    return result;
  } catch (error) {
    logger.error('Error subiendo imagen a Cloudinary:', error);
    throw error;
  }
};

export { upload };