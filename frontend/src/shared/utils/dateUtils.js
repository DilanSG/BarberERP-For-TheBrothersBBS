// Utilidades para manejo de fechas en zona horaria de Colombia
// Todas las funciones respetan la zona horaria de Bogotá

// Utilidades para manejo de fechas en zona horaria de Colombia.
// Todas las funciones respetan la zona horaria de Bogotá (UTC-5); el patrón
// toLocaleString + new Date permite "mover" el instante a esa zona.
// Retorna string 'YYYY-MM-DD'.
export const getCurrentDateColombia = () => {
  const now = new Date();
  // Convertir a zona horaria de Colombia (UTC-5)
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  
  const year = colombiaTime.getFullYear();
  const month = (colombiaTime.getMonth() + 1).toString().padStart(2, '0');
  const day = colombiaTime.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Obtiene la fecha de ayer en formato YYYY-MM-DD en zona horaria de Colombia
// (resta 24h al instante ya convertido a hora Colombia)
export const getYesterdayDateColombia = () => {
  const now = new Date();
  // Convertir a zona horaria de Colombia
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  // Restar un día
  const yesterday = new Date(colombiaTime.getTime() - 24 * 60 * 60 * 1000);
  
  const year = yesterday.getFullYear();
  const month = (yesterday.getMonth() + 1).toString().padStart(2, '0');
  const day = yesterday.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Formatea una fecha para mostrar en Colombia (dd/mm/yyyy)
export const formatDateForColombia = (dateString) => {
  try {
    const date = new Date(dateString + 'T12:00:00.000Z'); // Agregar hora para evitar timezone issues
    return date.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return dateString;
  }
};

// Convierte una fecha de Colombia a UTC para enviar al backend
export const convertColombiaDateToUTC = (dateString) => {
  try {
    // Crear fecha asumiendo que es en zona horaria de Colombia
    const [year, month, day] = dateString.split('-').map(Number);
    const colombiaDate = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11
    
    // Convertir a string ISO para el backend
    return colombiaDate.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Error converting Colombia date to UTC:', dateString, error);
    return dateString;
  }
};

// Comprueba si dateString está en availableDates, comparando solo 'YYYY-MM-DD'
// (ignora la parte de hora/ISO). Retorna boolean.
export const isDateAvailable = (dateString, availableDates = []) => {
  if (!dateString || !Array.isArray(availableDates)) return false;
  
  return availableDates.some(availableDate => {
    // Normalizar ambas fechas a formato YYYY-MM-DD
    const targetDate = dateString.split('T')[0];
    const availableFormatted = availableDate.split('T')[0];
    return targetDate === availableFormatted;
  });
};

// Obtiene el rango de fechas para un preset ('all' | 'today' | 'yesterday').
// Devuelve { startDate, endDate, preset }; cualquier preset desconocido cae a 'all'.
export const getDateRangeForPreset = (preset) => {
  const today = getCurrentDateColombia();
  const yesterday = getYesterdayDateColombia();
  
  switch (preset) {
    case 'all':
      return {
        startDate: '2020-01-01',
        endDate: today,
        preset: 'all'
      };
    
    case 'today':
      return {
        startDate: today,
        endDate: today,
        preset: 'today'
      };
    
    case 'yesterday':
      return {
        startDate: yesterday,
        endDate: yesterday,
        preset: 'yesterday'
      };
    
    default:
      return {
        startDate: '2020-01-01',
        endDate: today,
        preset: 'all'
      };
  }
};

// Formatea un rango de fechas para mostrar al usuario
export const formatDateRange = (startDate, endDate, preset) => {
  const today = getCurrentDateColombia();
  const yesterday = getYesterdayDateColombia();
  
  if (preset === 'all') {
    return 'Todos los datos';
  } else if (preset === 'today') {
    return 'Solo hoy';
  } else if (preset === 'yesterday') {
    return 'Solo ayer';
  } else if (startDate === endDate) {
    return formatDateForColombia(startDate);
  } else {
    return `${formatDateForColombia(startDate)} - ${formatDateForColombia(endDate)}`;
  }
};

export default {
  getCurrentDateColombia,
  getYesterdayDateColombia,
  formatDateForColombia,
  convertColombiaDateToUTC,
  isDateAvailable,
  getDateRangeForPreset,
  formatDateRange
};