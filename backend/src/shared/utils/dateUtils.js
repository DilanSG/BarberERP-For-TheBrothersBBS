// Utilidades para manejo de fechas y zonas horarias
// Zona horaria por defecto: America/Bogota (UTC-5)

// Zona horaria de la aplicación
export const APP_TIMEZONE = 'America/Bogota';

// Obtiene la fecha y hora actual en la zona horaria de Colombia
// Reconstruye el Date a partir de la hora local de Bogotá (no conserva el offset).
// @returns {Date} - Fecha actual en Colombia
export const now = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
};

// Obtiene la fecha actual en formato ISO (YYYY-MM-DD) en zona horaria de Colombia
// @returns {string} - Fecha en formato YYYY-MM-DD
export const today = () => {
  const colombiaDate = now();
  return colombiaDate.toISOString().split('T')[0];
};

// Convierte una fecha UTC a zona horaria de Colombia
// El Date devuelto usa la hora local del proceso con los componentes de Bogotá.
// @param {Date|string} date - Fecha en UTC
// @returns {Date} - Fecha en Colombia
export const toColombiaTime = (date) => {
  const utcDate = date instanceof Date ? date : new Date(date);
  return new Date(utcDate.toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
};

// Formatea una fecha en zona horaria de Colombia
// @param {Date|string} date - Fecha a formatear
// @param {Object} options - Opciones de formato (Intl.DateTimeFormat)
// @returns {string} - Fecha formateada
export const formatInColombiaTime = (date, options = {}) => {
  const utcDate = date instanceof Date ? date : new Date(date);
  return utcDate.toLocaleString('es-CO', { 
    timeZone: APP_TIMEZONE,
    ...options
  });
};

// Obtiene el timestamp actual en Colombia
// @returns {number} - Timestamp en milisegundos
export const nowTimestamp = () => {
  return now().getTime();
};

// Crea una fecha en zona horaria de Colombia desde componentes
// @param {number} year
// @param {number} month - 0-11 (Enero = 0)
// @param {number} day
// @param {number} hour - Opcional (default: 0)
// @param {number} minute - Opcional (default: 0)
// @param {number} second - Opcional (default: 0)
// @returns {Date}
export const createColombiaDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
  // Crear fecha en string ISO y parsearlo en zona horaria de Colombia
  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  const utcDate = new Date(dateString + '-05:00'); // Forzar UTC-5
  return utcDate;
};

// Convierte una fecha ISO string a Date en Colombia
// @param {string} isoString - Fecha en formato ISO
// @returns {Date}
export const fromISOString = (isoString) => {
  return toColombiaTime(new Date(isoString));
};

// Convierte una fecha a ISO string en zona horaria de Colombia
// @param {Date} date
// @returns {string} - ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
export const toISOString = (date) => {
  const colombiaDate = toColombiaTime(date);
  return colombiaDate.toISOString();
};

// Obtiene el inicio del día en Colombia (00:00:00)
// @param {Date|string} date - Opcional (default: hoy)
// @returns {Date}
export const startOfDay = (date = null) => {
  const targetDate = date ? toColombiaTime(date) : now();
  return createColombiaDate(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0, 0, 0
  );
};

// Obtiene el fin del día en Colombia (23:59:59.999)
// @param {Date|string} date - Opcional (default: hoy)
// @returns {Date}
export const endOfDay = (date = null) => {
  const targetDate = date ? toColombiaTime(date) : now();
  return createColombiaDate(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23, 59, 59
  );
};

// Añade días a una fecha en Colombia
// @param {Date|string} date
// @param {number} days
// @returns {Date}
export const addDays = (date, days) => {
  const colombiaDate = toColombiaTime(date);
  colombiaDate.setDate(colombiaDate.getDate() + days);
  return colombiaDate;
};

// Añade horas a una fecha en Colombia
// @param {Date|string} date
// @param {number} hours
// @returns {Date}
export const addHours = (date, hours) => {
  const colombiaDate = toColombiaTime(date);
  colombiaDate.setHours(colombiaDate.getHours() + hours);
  return colombiaDate;
};

// Compara si dos fechas son del mismo día en Colombia
// @param {Date|string} date1
// @param {Date|string} date2
// @returns {boolean}
export const isSameDay = (date1, date2) => {
  const d1 = toColombiaTime(date1);
  const d2 = toColombiaTime(date2);
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

// Verifica si una fecha es pasada (en Colombia)
// @param {Date|string} date
// @returns {boolean}
export const isPast = (date) => {
  return toColombiaTime(date) < now();
};

// Verifica si una fecha es futura (en Colombia)
// @param {Date|string} date
// @returns {boolean}
export const isFuture = (date) => {
  return toColombiaTime(date) > now();
};

// Formatea fecha en formato legible en español
// @param {Date|string} date
// @returns {string} - Ej: "16 de octubre de 2025, 9:08 AM"
export const formatFriendly = (date) => {
  return formatInColombiaTime(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Formatea fecha corta
// @param {Date|string} date
// @returns {string} - Ej: "16/10/2025"
export const formatShort = (date) => {
  return formatInColombiaTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Formatea solo la hora
// @param {Date|string} date
// @returns {string} - Ej: "9:08 AM"
export const formatTime = (date) => {
  return formatInColombiaTime(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Debug: Compara hora UTC vs Colombia
// @param {string} label - Etiqueta para el log
export const debugTime = (label = 'Debug Time') => {
  const utcNow = new Date();
  const colombiaNow = now();
  
  console.log(`\n🕐 ${label}`);
  console.log(`UTC:      ${utcNow.toISOString()} (${utcNow.toLocaleString()})`);
  console.log(`Colombia: ${colombiaNow.toISOString()} (${formatFriendly(colombiaNow)})`);
  console.log(`Hoy (CO): ${today()}\n`);
};

// Exportar también como default
export default {
  APP_TIMEZONE,
  now,
  today,
  toColombiaTime,
  formatInColombiaTime,
  nowTimestamp,
  createColombiaDate,
  fromISOString,
  toISOString,
  startOfDay,
  endOfDay,
  addDays,
  addHours,
  isSameDay,
  isPast,
  isFuture,
  formatFriendly,
  formatShort,
  formatTime,
  debugTime
};
