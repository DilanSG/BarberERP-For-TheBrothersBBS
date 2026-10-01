// Servicio de API para facturas (emisión, impresión, estado de impresora y reembolsos).
import { api } from './api';

// Generar factura desde una venta.
// saleId: ID de la venta; data: datos extra (notes, source, device).
// Devuelve { success, data, message }.
export const generateInvoice = async (saleId, data = {}) => {
  try {
    const response = await api.post(`/invoices/generate/${saleId}`, data);
    return response; // Ya viene con { success, data, message }
  } catch (error) {
    throw error;
  }
};

// Imprimir factura en la impresora configurada.
// options: opciones de impresión (p. ej. printerInterface).
export const printInvoice = async (invoiceId, options = {}) => {
  try {
    const response = await api.post(`/invoices/print/${invoiceId}`, options);
    return response;
  } catch (error) {
    throw error;
  }
};

// Obtener factura por ID
export const getInvoiceById = async (invoiceId) => {
  try {
    const response = await api.get(`/invoices/${invoiceId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Obtener todas las facturas asociadas a una venta
export const getInvoicesBySale = async (saleId) => {
  try {
    const response = await api.get(`/invoices/sale/${saleId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// Listar facturas con filtros y paginación (params); devuelve response.data
export const listInvoices = async (params = {}) => {
  try {
    const response = await api.get('/invoices', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Obtener estadísticas de facturas (filtros: barberId, startDate, endDate)
export const getInvoiceStats = async (params = {}) => {
  try {
    const response = await api.get('/invoices/stats', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Cancelar factura indicando la razón
export const cancelInvoice = async (invoiceId, reason) => {
  try {
    const response = await api.put(`/invoices/${invoiceId}/cancel`, { reason });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Test de impresión (envía una página de prueba a la impresora)
export const testPrinter = async (options = {}) => {
  try {
    const response = await api.post('/invoices/printer/test', options);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Obtener estado de la impresora
export const getPrinterStatus = async () => {
  try {
    const response = await api.get('/invoices/printer/status');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Conectar impresora con la configuración indicada
export const connectPrinter = async (config) => {
  try {
    const response = await api.post('/invoices/printer/connect', config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Desconectar impresora
export const disconnectPrinter = async () => {
  try {
    const response = await api.post('/invoices/printer/disconnect');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Obtener información de reembolsos de un carrito (cartId = ventas separadas por coma)
export const getCartRefundInfo = async (cartId) => {
  try {
    const response = await api.get(`/invoices/cart/${cartId}/refunds`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

const invoiceService = {
  generateInvoice,
  printInvoice,
  getInvoiceById,
  getInvoicesBySale,
  listInvoices,
  getInvoiceStats,
  cancelInvoice,
  testPrinter,
  getPrinterStatus,
  connectPrinter,
  disconnectPrinter,
  getCartRefundInfo
};

export default invoiceService;
