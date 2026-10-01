// Utilidad para generar rutas correctas de assets
// Maneja tanto development (localhost) como production (GitHub Pages)

// Base path para GitHub Pages
const BASE_PATH = import.meta.env.BASE_URL || '/';

// Genera la ruta correcta para un asset público
// @param {string} assetPath - Ruta del asset relativa a /public (ej: 'images/logo.png')
// @returns {string} - Ruta completa del asset
export const getAssetUrl = (assetPath) => {
  // Eliminar slash inicial si existe
  const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  
  // Codificar espacios y caracteres especiales en la URL
  const encodedPath = encodeURI(cleanPath);
  
  // En development, BASE_URL es '/'
  // En production (GitHub Pages), BASE_URL es '/TheBrothersBarberShop/'
  return `${BASE_PATH}${encodedPath}`;
};

// Genera la ruta correcta para logos
// @param {string} logoName - Nombre del logo (ej: 'logo 1.png')
// @returns {string} - Ruta completa del logo
export const getLogoUrl = (logoName) => {
  return getAssetUrl(`images/${logoName}`);
};

// URLs de logos comunes para fácil acceso
export const LOGOS = {
  main: () => getLogoUrl('logo 1.png'),
  navbar: () => getLogoUrl('logo 5.1.png'),
  fallback: () => getLogoUrl('logo 4.png'),
  // Agregar más logos según necesidad
  logo1_1: () => getLogoUrl('logo 1.1.png'),
  logo1_2: () => getLogoUrl('logo 1.2.png'),
  logo2: () => getLogoUrl('logo 2.png'),
  logo3: () => getLogoUrl('logo 3.png'),
  logo5: () => getLogoUrl('logo 5.png'),
};

// URLs de imágenes por defecto
export const DEFAULT_IMAGES = {
  avatar: () => getAssetUrl('images/default-avatar.png'),
  profile: () => getAssetUrl('images/default-profile.png'),
  // Fallback al logo principal si no existen las imágenes por defecto
  avatarFallback: () => getLogoUrl('logo 1.png'),
  profileFallback: () => getLogoUrl('logo 1.png'),
};
