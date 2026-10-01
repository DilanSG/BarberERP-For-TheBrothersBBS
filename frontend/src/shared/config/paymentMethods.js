import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { usePaymentMethodsContext } from '@contexts/PaymentMethodsContext';

// Configuración de métodos de pago (reforma):
// - Efectivo es el único método predeterminado.
// - El resto son dinámicos y vienen del backend (PaymentMethodsContext).
// - Sin emojis: la UI usa el icono por categoría y el color de la paleta.

const ICON_BY_CATEGORY = {
  cash: Banknote,
  digital: Smartphone,
  card: CreditCard,
  transfer: Smartphone,
  other: CreditCard,
};

// Fallback mínimo: solo Efectivo (si el backend no responde)
export const PAYMENT_METHODS = [
  {
    id: 'cash',
    backendId: 'cash',
    name: 'Efectivo',
    description: 'Pago en efectivo',
    color: 'emerald',
    category: 'cash',
    isSystem: true,
    icon: Banknote,
  },
];

// Busca por id interno o backendId; si no existe, devuelve Efectivo
export const getPaymentMethodById = (id) =>
  PAYMENT_METHODS.find((method) => method.id === id || method.backendId === id) || PAYMENT_METHODS[0];

// Devuelve el catálogo estático (solo Efectivo; los demás son dinámicos)
export const getAllPaymentMethods = () => PAYMENT_METHODS;

// frontendId → backendId ('cash' como respaldo)
export const mapPaymentMethodToBackend = (frontendId) => {
  const method = getPaymentMethodById(frontendId);
  return method?.backendId || 'cash';
};

// backendId → id interno ('cash' como respaldo)
export const mapPaymentMethodFromBackend = (backendId) =>
  getPaymentMethodById(backendId)?.id || 'cash';

// Hook de métodos de pago: devuelve los métodos del backend (dinámicos) con
// fallback a solo Efectivo. Mantiene el shape usado por la app.
export const usePaymentMethods = () => {
  const ctx = usePaymentMethodsContext();
  const paymentMethods = (ctx.allPaymentMethods || []).map((method) => ({
    ...method,
    icon: method.icon || ICON_BY_CATEGORY[method.category] || CreditCard,
  }));

  return {
    paymentMethods,
    getById: (id) => paymentMethods.find((m) => m.id === id || m.backendId === id) || paymentMethods[0],
    getAll: () => paymentMethods,
    mapToBackend: (frontendId) => (paymentMethods.find((m) => m.id === frontendId || m.backendId === frontendId)?.backendId) || 'cash',
    mapFromBackend: (backendId) => paymentMethods.find((m) => m.backendId === backendId) || paymentMethods[0],
    getOptions: () => paymentMethods.map((method) => ({
      value: method.backendId,
      label: method.name,
      icon: method.icon,
    })),
  };
};
