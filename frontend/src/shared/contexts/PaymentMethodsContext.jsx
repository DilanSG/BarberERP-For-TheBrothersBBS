// Contexto de métodos de pago: carga los métodos dinámicos del backend y los
// normaliza al shape de la UI (color de la paleta, icono por categoría).
// Efectivo es el único método de sistema; el resto es CRUD (admin) con
// actualización optimista + refresh.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CreditCard, Banknote, Smartphone } from 'lucide-react';
import { paymentMethodsApi } from '../services/paymentMethodsApi';
import { useAuth } from './AuthContext';
import { PAYMENT_METHOD_PALETTE, getPaymentMethodPalette } from '@utils/formatters';

const PaymentMethodsContext = createContext();

// Métodos de pago (reforma):
// - Efectivo (`cash`) es el ÚNICO método predeterminado del sistema.
// - Todos los demás son dinámicos: los crea el administrador y puede editarlos
// o eliminarlos. Sin emojis; el color es una de las 15 opciones de la paleta.

// Icono por defecto según la categoría del método
const ICON_BY_CATEGORY = {
  cash: Banknote,
  digital: Smartphone,
  card: CreditCard,
  transfer: Smartphone,
  other: CreditCard,
};

// Fallback mínimo si el backend no responde: solo efectivo
export const DEFAULT_CASH_METHOD = {
  id: 'cash',
  backendId: 'cash',
  name: 'Efectivo',
  description: 'Pago en efectivo',
  color: 'emerald',
  colorHex: PAYMENT_METHOD_PALETTE.emerald.hex,
  category: 'cash',
  isSystem: true,
  icon: Banknote,
};

// Paleta (nombre a hex) para normalizar lo que llega del backend
const hexToColorName = (hex) => {
  if (!hex) return 'gray';
  const found = Object.entries(PAYMENT_METHOD_PALETTE).find(
    ([, p]) => p.hex.toLowerCase() === String(hex).toLowerCase()
  );
  return found ? found[0] : 'gray';
};

// Convierte un nombre de color de la paleta a su hex; si ya es hex lo respeta
const colorNameToHex = (color) => {
  if (!color) return PAYMENT_METHOD_PALETTE.gray.hex;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const palette = getPaymentMethodPalette(color);
  return palette.hex;
};

// Normaliza un método del backend al shape del frontend
const normalizeApiMethod = (method) => {
  const color = hexToColorName(method.color);
  return {
    id: method.backendId,
    backendId: method.backendId,
    name: method.name,
    description: method.description || '',
    color,
    colorHex: method.color || PAYMENT_METHOD_PALETTE[color].hex,
    category: method.category,
    isSystem: Boolean(method.isSystem),
    icon: ICON_BY_CATEGORY[method.category] || CreditCard,
  };
};

// Provider de métodos de pago: expone la lista, el CRUD y helpers de consulta.
// Valor: { allPaymentMethods, addPaymentMethod, updatePaymentMethod,
// removePaymentMethod, getPaymentMethodByBackendId, refreshPaymentMethods,
// isStaticMethod }.
export const PaymentMethodsProvider = ({ children }) => {
  const { user } = useAuth();
  const [apiMethods, setApiMethods] = useState(null);

  // Cargar métodos desde el backend (fuente de verdad)
  const refresh = useCallback(async () => {
    if (!user) {
      setApiMethods(null);
      return;
    }
    try {
      const response = await paymentMethodsApi.getAll();
      const methods = Array.isArray(response?.data) ? response.data : [];
      setApiMethods(methods.map(normalizeApiMethod));
    } catch (error) {
      console.warn('No se pudieron cargar los métodos de pago del backend:', error?.message);
      setApiMethods(null);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fuente: backend si está disponible; si no, solo Efectivo
  const allPaymentMethods = apiMethods && apiMethods.length > 0 ? apiMethods : [DEFAULT_CASH_METHOD];

  // Efectivo es el único método protegido (no eliminable)
  const isStaticMethod = (backendId) =>
    backendId === 'cash' || backendId === 'efectivo' ||
    Boolean(allPaymentMethods.find(m => m.backendId === backendId)?.isSystem);

  // Crear método dinámico (optimista + backend)
  const addPaymentMethod = (newMethod) => {
    const color = newMethod.color || 'gray';
    const optimistic = {
      ...newMethod,
      id: newMethod.backendId,
      color,
      colorHex: colorNameToHex(color),
      isSystem: false,
      icon: newMethod.icon || ICON_BY_CATEGORY[newMethod.category] || CreditCard,
    };
    setApiMethods(prev => [...(prev || []), optimistic].filter(Boolean));

    paymentMethodsApi.create({
      name: newMethod.name,
      backendId: newMethod.backendId,
      description: newMethod.description,
      color: colorNameToHex(color),
      category: newMethod.category || 'digital',
    }).then(refresh).catch((error) => {
      console.error('Error creando método de pago:', error);
      refresh();
    });
    return true;
  };

  // Actualizar método (efectivo incluido; nunca cambia el backendId)
  const updatePaymentMethod = (originalBackendId, updatedMethod) => {
    setApiMethods(prev => (prev || []).map(method =>
      method.backendId === originalBackendId
        ? {
            ...method,
            ...updatedMethod,
            color: updatedMethod.color || method.color,
            colorHex: colorNameToHex(updatedMethod.color || method.color),
            icon: method.icon,
          }
        : method
    ));

    paymentMethodsApi.update(originalBackendId, {
      name: updatedMethod.name,
      description: updatedMethod.description,
      color: colorNameToHex(updatedMethod.color),
      category: updatedMethod.category,
    }).then(refresh).catch((error) => {
      console.error('Error actualizando método de pago:', error);
      refresh();
    });
    return true;
  };

  // Eliminar método dinámico (efectivo protegido)
  const removePaymentMethod = (backendId) => {
    if (isStaticMethod(backendId)) return false;

    setApiMethods(prev => (prev || []).filter(method => method.backendId !== backendId));
    paymentMethodsApi.delete(backendId).then(refresh).catch((error) => {
      console.error('Error eliminando método de pago:', error);
      refresh();
    });
    return true;
  };

  const getPaymentMethodByBackendId = (backendId) =>
    allPaymentMethods.find(method => method.backendId === backendId);

  const value = {
    allPaymentMethods,
    addPaymentMethod,
    updatePaymentMethod,
    removePaymentMethod,
    getPaymentMethodByBackendId,
    refreshPaymentMethods: refresh,
    isStaticMethod,
  };

  return (
    <PaymentMethodsContext.Provider value={value}>
      {children}
    </PaymentMethodsContext.Provider>
  );
};

// Hook de acceso al contexto; lanza error si se usa fuera del provider
export const usePaymentMethodsContext = () => {
  const context = useContext(PaymentMethodsContext);
  if (!context) {
    throw new Error('usePaymentMethodsContext must be used within a PaymentMethodsProvider');
  }
  return context;
};

export default PaymentMethodsContext;
