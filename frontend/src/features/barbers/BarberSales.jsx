import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Scissors, 
  Plus, 
  Minus, 
  DollarSign, 
  Package,
  Check,
  X,
  Search,
  Filter,
  User,
  Edit3,
  CreditCard,
  Banknote,
  Smartphone,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { PageContainer } from '@components/layout/PageContainer';
import { BarberSalesSkeleton, Skeleton } from '@components/ui/Skeleton';
import RefundSaleModal from '@components/common/RefundSaleModal';
import InvoiceDataModal from '@components/modals/InvoiceDataModal';
import Modal from '@components/ui/Modal';
import { inventoryService } from '@services/inventoryService';
import { salesService } from '@services/salesService';
import { serviceService } from '@services/serviceService';
import { barberService } from '@services/barberService';
import { useInventoryRefresh } from '@contexts/InventoryContext';
import { usePaymentMethodsContext } from '@contexts/PaymentMethodsContext';
import { useNavigate } from 'react-router-dom';
import { 
  SALE_TYPES, 
  SALE_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS 
} from '@shared/constants/salesConstants';

import { getPaymentMethodPalette } from '@utils/formatters';
import logger from '@utils/logger';


// Punto de venta para barberos (y administradores que eligen un barbero).
// Permite vender productos y servicios, asignar método de pago por ítem y registrar la venta.
// Carga productos con stock y servicios activos, mantiene el carrito en memoria
// y envía la venta completa con datos de factura; también ofrece reembolsos e historial de facturas.
const BarberSales = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { notifySale } = useInventoryRefresh();
  const navigate = useNavigate();

  // Estados principales
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [error, setError] = useState('');

  // Estados del carrito
  const [cart, setCart] = useState([]);
  // Datos de factura a nivel de carrito (opcional)
  const [cartClientData, setCartClientData] = useState(null)
  const [selectedService, setSelectedService] = useState(null);
  const [servicePrice, setServicePrice] = useState('');

  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [processingSale, setProcessingSale] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);

  // Toolbar móvil: categorías colapsables
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Hook para métodos de pago centralizados
  const { allPaymentMethods, getPaymentMethodByBackendId } = usePaymentMethodsContext();
  const allPaymentMethodsRef = useRef(allPaymentMethods);
  useEffect(() => { allPaymentMethodsRef.current = allPaymentMethods; }, [allPaymentMethods]);

  // Color del método: usa el color real del método (backend) con fallback a la paleta legacy
  // Devuelve los colores del método de pago (color del backend o paleta legacy).
  const resolveMethodColor = (methodId, liveMethod) => {
    const method = liveMethod || allPaymentMethodsRef.current?.find((m) => m.backendId === methodId);
    return getPaymentMethodPalette(method || methodId);
  };

  // ID del método de pago por defecto (efectivo) según los métodos disponibles
  // Método de pago por defecto: el de sistema/efectivo o 'efectivo' como fallback.
  const getDefaultPaymentMethodId = () => {
    const cash = allPaymentMethods.find((m) => m.isSystem || m.category === 'cash');
    return cash?.backendId || 'efectivo';
  };

 // IDs válidos de métodos de pago (id/backendId + alias efectivo a cash)
 // Conjunto de ids válidos de métodos de pago, incluyendo el alias efectivo a cash.
  const getValidPaymentMethodIds = () => {
    const ids = new Set();
    allPaymentMethods.forEach((method) => {
      if (method?.id) ids.add(method.id);
      if (method?.backendId) ids.add(method.backendId);
    });
    if (ids.has('cash')) ids.add('efectivo');
    if (ids.has('efectivo')) ids.add('cash');
    return ids;
  };

  // Estados para métodos de pago
  const [paymentMethodModal, setPaymentMethodModal] = useState({ show: false, item: null });

  // Estados para datos de factura
  const [invoiceDataModal, setInvoiceDataModal] = useState({ show: false, item: null });

  // Estados para selección de barbero (solo para admins)
  const [selectedBarberId, setSelectedBarberId] = useState(null);
  const [availableBarbers, setAvailableBarbers] = useState([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);

  // Estado para modal de reembolso
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  // Obtener barberId correctamente
  // Determina el barbero de la venta: el seleccionado si es admin o el perfil
  // asociado al usuario cuando es barbero.
  const getBarberId = () => {
    logger.debug('Datos del usuario:', user);
    logger.debug('Role:', user.role);
    logger.debug('user._id:', user._id);
    logger.debug('user.barberId:', user.barberId);
    logger.debug('selectedBarberId:', selectedBarberId);
    
    // Si el usuario es admin, usar el barbero seleccionado
    if (user.role === 'admin') {
      if (selectedBarberId) {
        logger.debug('Usuario admin usando barbero seleccionado:', selectedBarberId);
        return selectedBarberId;
      } else {
        logger.debug('Usuario admin sin barbero seleccionado');
        return null;
      }
    }
    
    // Si el usuario es barbero, necesitamos obtener el ID del perfil de barbero
    if (user.role === 'barber') {
      // Primero intentar con barberId si existe
      if (user.barberId) {
        logger.debug('Usando user.barberId:', user.barberId);
        return user.barberId;
      }
      // Si no, usar el _id del usuario (necesitaremos buscar el perfil de barbero)
      logger.debug('No hay barberId, usando user._id:', user._id);
      return user._id;
    }
    logger.debug('Tipo de usuario no reconocido');
    return null;
  };

  // Cargar datos iniciales
  // Carga inicial de datos; los admins además cargan la lista de barberos.
  useEffect(() => {
    loadInitialData();
    // Si el usuario es admin, cargar la lista de barberos
    if (user?.role === 'admin') {
      loadBarbers();
    }
  }, [user]);

  // Cargar lista de barberos disponibles (solo para admins)
  // Carga los barberos para el selector de admin: elige el primero por defecto
  // y corrige la selección si el barbero ya no existe.
  const loadBarbers = async () => {
    setLoadingBarbers(true);
    try {
      logger.debug('Cargando lista de barberos...');
      const response = await barberService.getAllBarbers();
      logger.debug('Respuesta de barberos:', response);

      if (response.success && response.data) {
        setAvailableBarbers(response.data);
        logger.debug('Barberos disponibles:', response.data.length);

        // Seleccionar el primer barbero por defecto (con validación)
        if (response.data.length > 0 && !selectedBarberId) {
          const firstBarber = response.data[0];
          if (firstBarber && firstBarber.user?._id) {
            setSelectedBarberId(firstBarber.user._id);
            logger.debug('Barbero seleccionado por defecto:', firstBarber.user._id, firstBarber.user.name);
          }
        }
        
        // Validar que el barbero actualmente seleccionado aún existe
        if (selectedBarberId) {
          const selectedBarberExists = response.data.some(barber => barber.user?._id === selectedBarberId);
          if (!selectedBarberExists) {
            logger.warn('Barbero seleccionado no existe en la lista, seleccionando el primero disponible');
            if (response.data.length > 0 && response.data[0].user?._id) {
              setSelectedBarberId(response.data[0].user._id);
            } else {
              setSelectedBarberId(null);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cargando barberos:', error);
      showError('Error al cargar la lista de barberos');
    } finally {
      setLoadingBarbers(false);
    }
  };

  // Carga en paralelo inventario y servicios (con timestamp para evitar caché),
  // filtrando solo productos con stock y servicios activos.
  const loadInitialData = async () => {
    setLoading(true);
    setLoadingInventory(true);
    setError('');
    
    try {
      logger.debug('Cargando datos iniciales...');

      // Añadir timestamp para evitar caché después de ventas
      const timestamp = Date.now();
      
      const [productsResp, servicesResp] = await Promise.all([
        inventoryService.getInventory({ _t: timestamp }),
        serviceService.getAllServices()
      ]);

      // Procesar productos
      let productsData = [];
      if (productsResp?.success && productsResp?.data) {
        // La API devuelve { success: true, data: { products: [...], total, page, ... } }
        if (productsResp.data.products && Array.isArray(productsResp.data.products)) {
          productsData = productsResp.data.products;
        } else if (Array.isArray(productsResp.data)) {
          productsData = productsResp.data;
        } else {
          productsData = [productsResp.data];
        }
      } else if (Array.isArray(productsResp)) {
        productsData = productsResp;
      }

      // Filtrar solo productos disponibles (stock > 0)
      const availableProducts = productsData.filter(product => {
        const stock = product.currentStock || product.stock || product.quantity || 0;
        return product && stock > 0;
      });

      logger.debug('Productos disponibles:', availableProducts.length);

      // Procesar servicios
      let servicesData = [];
      if (servicesResp?.success && servicesResp?.data) {
        servicesData = Array.isArray(servicesResp.data) 
          ? servicesResp.data 
          : [servicesResp.data];
      } else if (Array.isArray(servicesResp)) {
        servicesData = servicesResp;
      }

      // Filtrar solo servicios activos
      const activeServices = servicesData.filter(service => 
        service && service.isActive !== false
      );

      setProducts(availableProducts);
      setServices(activeServices);
      
      logger.debug('Datos cargados - Productos:', availableProducts.length, 'Servicios:', activeServices.length);

    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los productos y servicios');
      showError('Error al cargar los datos iniciales');
    } finally {
      setLoading(false);
      setLoadingInventory(false);
    }
  };

  // Filtrar productos según búsqueda y categoría
  // Aplica búsqueda por nombre/descripción y el filtro de categoría.
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || 
                           product.category?.toLowerCase() === categoryFilter.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  // Obtener categorías únicas
  // Lista de categorías únicas presentes en los productos.
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  // Limpiar/normalizar carrito solo cuando cambien los métodos de pago disponibles
  // - Elimina items con métodos realmente inválidos
 // - Normaliza alias de efectivo ('efectivo' a 'cash') al backendId canónico
  // Cuando cambian los métodos de pago disponibles, limpia del carrito los ítems
  // con métodos inválidos y normaliza el alias de efectivo al id canónico del backend.
  useEffect(() => {
    if (allPaymentMethods.length > 0 && cart.length > 0) {
      const validPaymentMethods = getValidPaymentMethodIds();
      const cashMethod = allPaymentMethods.find((m) => m.isSystem || m.category === 'cash');
      const canonicalCashId = cashMethod?.backendId;

      let changed = false;
      const normalized = cart.map((item) => {
        const methodId = item.paymentMethod;
        if (!methodId) return item;
        if (!validPaymentMethods.has(methodId)) {
          changed = true;
          return null;
        }
        if (
          canonicalCashId &&
          (methodId === 'efectivo' || methodId === 'cash') &&
          methodId !== canonicalCashId
        ) {
          changed = true;
          return { ...item, paymentMethod: canonicalCashId };
        }
        return item;
      });

      if (changed) {
        console.log('Normalizando items del carrito según métodos de pago válidos');
        setCart(normalized.filter(Boolean));
      }
    }
  }, [allPaymentMethods]);

  // Agregar producto al carrito
  // Agrega un producto al carrito validando id, nombre, precio, cantidad y stock;
  // si ya existe, acumula la cantidad sin superar el stock disponible.
  const addToCart = (product, quantity = 1) => {
    // Validaciones básicas del producto
    if (!product || !product._id) {
      showError('Producto inválido');
      return;
    }
    
    if (!product.name || product.name.trim() === '') {
      showError('El producto debe tener un nombre');
      return;
    }
    
    if (!product.price || typeof product.price !== 'number' || product.price <= 0) {
      showError(`Precio inválido para ${product.name}`);
      return;
    }
    
    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      showError('La cantidad debe ser mayor a 0');
      return;
    }

    const existingItem = cart.find(item => item.id === product._id && item.type === SALE_TYPES.PRODUCT);
    
    if (existingItem) {
      // Verificar stock disponible
      const newQuantity = existingItem.quantity + quantity;
      const availableStock = product.quantity || product.stock || 0;
      
      if (newQuantity > availableStock) {
        showError(`Solo hay ${availableStock} unidades disponibles de ${product.name}`);
        return;
      }
      
      setCart(cart.map(item => 
        item.id === product._id && item.type === SALE_TYPES.PRODUCT
          ? { ...item, quantity: newQuantity }
          : item
      ));
    } else {
      // Verificar stock antes de agregar
      const availableStock = product.quantity || product.stock || 0;
      if (quantity > availableStock) {
        showError(`Solo hay ${availableStock} unidades disponibles de ${product.name}`);
        return;
      }
      
      setCart([...cart, {
        id: product._id,
        type: SALE_TYPES.PRODUCT,
        name: product.name.trim(),
        price: Number(product.price), // Asegurar que sea número
        quantity: Number(quantity), // Asegurar que sea número
        stock: availableStock,
        paymentMethod: getDefaultPaymentMethodId()
      }]);
    }
    
    showInfo(`${product.name} agregado al carrito`);
  };

  // Agregar servicio de corte al carrito
  // Agrega al carrito un servicio con precio manual (walk-in) usando el servicio
  // y el precio elegidos en el formulario.
  const addWalkInService = () => {
    // Validar servicio seleccionado
    if (!selectedService) {
      showError('Selecciona un servicio');
      return;
    }
    
    if (!selectedService._id || !selectedService.name) {
      showError('Servicio inválido');
      return;
    }
    
    // Convertir servicePrice a string si es necesario
    const servicePriceStr = String(servicePrice || '');
    
    if (!servicePriceStr || servicePriceStr.trim() === '') {
      showError('Establece el precio del servicio');
      return;
    }

    const price = parseFloat(servicePriceStr.trim());
    if (isNaN(price) || price <= 0) {
      showError('Ingresa un precio válido mayor a 0');
      return;
    }

    // Validar que el nombre del servicio no esté vacío
    if (!selectedService.name.trim()) {
      showError('El servicio debe tener un nombre válido');
      return;
    }

    setCart([...cart, {
      id: `walkin-${Date.now()}`,
      type: SALE_TYPES.SERVICE, // Usar constante estandarizada
      name: selectedService.name.trim(),
      serviceId: selectedService._id,
      price: Number(price), // Asegurar que sea número
      quantity: 1,
      paymentMethod: getDefaultPaymentMethodId() 
    }]);

    setSelectedService(null);
    setServicePrice('');
    showInfo(`Servicio ${selectedService.name} agregado`);
  };

  // Agregar servicio directamente sin depender del estado selectedService
  // Agrega un servicio directo desde su tarjeta usando su precio de catálogo.
  const addWalkInServiceDirect = (service) => {
    // Validar servicio
    if (!service) {
      showError('Selecciona un servicio');
      return;
    }
    
    if (!service._id || !service.name) {
      showError('Servicio inválido');
      return;
    }

    const price = parseFloat(service.price);
    if (isNaN(price) || price <= 0) {
      showError('El servicio debe tener un precio válido mayor a 0');
      return;
    }

    // Validar que el nombre del servicio no esté vacío
    if (!service.name.trim()) {
      showError('El servicio debe tener un nombre válido');
      return;
    }

    setCart([...cart, {
      id: `walkin-${Date.now()}`,
      type: SALE_TYPES.SERVICE, // Usar constante estandarizada
      name: service.name.trim(),
      serviceId: service._id,
      price: Number(price), // Asegurar que sea número
      quantity: 1,
      paymentMethod: getDefaultPaymentMethodId() 
    }]);

    showInfo(`Servicio ${service.name} agregado`);
  };

  // Remover item del carrito
  // Quita un ítem del carrito por id y tipo.
  const removeFromCart = (itemId, itemType) => {
    setCart(cart.filter(item => !(item.id === itemId && item.type === itemType)));
  };

  // Actualizar cantidad en carrito
  // Cambia la cantidad de un ítem: en 0 lo elimina y en productos valida el stock.
  const updateCartQuantity = (itemId, itemType, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, itemType);
      return;
    }

    setCart(cart.map(item => {
      if (item.id === itemId && item.type === itemType) {
        // Verificar stock para productos
        if (item.type === SALE_TYPES.PRODUCT && newQuantity > item.stock) {
          showError(`Solo hay ${item.stock} unidades disponibles`);
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  // Obtener cantidad de un producto en el carrito
  // Cantidad actual de un producto o servicio dentro del carrito.
  const getCartQuantity = (itemId, itemType) => {
    const cartItem = cart.find(item => item.id === itemId && item.type === itemType);
    return cartItem ? cartItem.quantity : 0;
  };

  // Funciones para métodos de pago
  // Abre el modal para cambiar el método de pago de un ítem.
  const openPaymentMethodModal = (item) => {
    setPaymentMethodModal({ show: true, item });
  };

  const closePaymentMethodModal = () => {
    setPaymentMethodModal({ show: false, item: null });
  };

  // Aplica el nuevo método de pago al ítem y cierra el modal.
  const updatePaymentMethod = (paymentMethodId) => {
    const { item } = paymentMethodModal;
    setCart(cart.map(cartItem => 
      cartItem.id === item.id && cartItem.type === item.type
        ? { ...cartItem, paymentMethod: paymentMethodId }
        : cartItem
    ));
    closePaymentMethodModal();
    showInfo('Método de pago actualizado');
  };

  // Función para modal de datos de factura del carrito
  const closeInvoiceDataModal = () => {
    setInvoiceDataModal({ show: false, item: null });
  };

  // Calcular totales por método de pago
  // Agrupa los totales del carrito por método de pago.
  const getPaymentMethodSummary = () => {
    const summary = {};
    cart.forEach(item => {
      const method = item.paymentMethod || 'cash';
      const total = item.price * item.quantity;
      summary[method] = (summary[method] || 0) + total;
    });
    return summary;
  };

  // Obtener información del método de pago
  // Busca la información del método de pago con un fallback genérico.
  const getPaymentMethodInfo = (methodId) => {
    const method = getPaymentMethodByBackendId(methodId);
    // Si no se encuentra el método, devolver un fallback
    if (!method) {
      return {
        backendId: methodId,
        name: methodId,
        icon: CreditCard, // Icono por defecto
        color: 'gray'
      };
    }
    return method;
  };

  // Calcular total del carrito
  // Total del carrito: suma precio por cantidad de cada ítem.
  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  // Procesar venta
  // Valida carrito y barbero, depura ítems inválidos y envía la venta completa
  // al backend; al terminar limpia el carrito y recarga el inventario.
  const processSale = async () => {
    if (cart.length === 0) {
      showError('El carrito está vacío');
      return;
    }

    // Validar que se haya seleccionado un barbero (especialmente para admins)
    const barberId = getBarberId();
    if (!barberId) {
      if (user.role === 'admin') {
        showError('Selecciona un barbero para realizar la venta');
      } else {
        showError('Error: No se pudo determinar el barbero');
      }
      return;
    }

    setProcessingSale(true);

    try {
      // Validar carrito antes de enviar
      if (cart.length === 0) {
        showError('El carrito está vacío');
        return;
      }

      // Validar que todos los items tienen los campos requeridos
      // Usar los mismos métodos de pago válidos que en el useEffect de limpieza
      const validPaymentMethods = getValidPaymentMethodIds();
      
      console.log('Iniciando validación de carrito antes de procesar venta');
      console.log('Items en carrito:', cart.length);
      console.log('Métodos de pago válidos:', validPaymentMethods);
      
      const invalidItems = cart.filter(item => 
        !item.type || 
        !item.quantity || 
        typeof item.quantity !== 'number' || 
        item.quantity <= 0 ||
        !item.price || 
        typeof item.price !== 'number' || 
        item.price <= 0 ||
        !item.paymentMethod ||
        !validPaymentMethods.has(item.paymentMethod)
      );

      // Ante ítems inválidos: se detallan, se eliminan del carrito y se aborta la venta.
      if (invalidItems.length > 0) {
        console.error('Items inválidos en el carrito:', invalidItems);
        console.log('Métodos de pago válidos disponibles:', validPaymentMethods);
        console.log('Total de métodos configurados:', allPaymentMethods);
        
        // Log detallado para debugging
        invalidItems.forEach(item => {
          console.error('Item inválido:', {
            name: item.name,
            type: item.type,
            price: item.price,
            quantity: item.quantity,
            paymentMethod: item.paymentMethod,
            hasPaymentMethod: !!item.paymentMethod,
            validPaymentMethods: validPaymentMethods
          });
        });
        
        const errorDetails = invalidItems.map(item => {
          const errors = [];
          if (!item.type) errors.push('tipo faltante');
          if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) errors.push('cantidad inválida');
          if (!item.price || typeof item.price !== 'number' || item.price <= 0) errors.push('precio inválido');
          if (!item.paymentMethod) errors.push('método de pago faltante');
          else if (!validPaymentMethods.has(item.paymentMethod)) errors.push(`método de pago inválido: "${item.paymentMethod}"`);
          return `${item.name || 'Item sin nombre'}: ${errors.join(', ')}`;
        }).join('\n');
        
        // Limpiar items inválidos del carrito automáticamente
        const validItems = cart.filter(item => {
          return item.type && 
                 item.quantity && typeof item.quantity === 'number' && item.quantity > 0 &&
                 item.price && typeof item.price === 'number' && item.price > 0 &&
                 item.paymentMethod && validPaymentMethods.has(item.paymentMethod);
        });
        
        setCart(validItems);
        showError(`Se encontraron items inválidos que fueron removidos del carrito:\n${errorDetails}`);
        return;
      }

      console.log('Validación de carrito exitosa - Todos los items son válidos');
      console.log('Procediendo a enviar carrito al backend...');

      // Enviar todo el carrito con métodos de pago a la nueva API
      // Extraer clientData preferentemente del nivel de carrito (si existe), si no tomar del primer item
      const clientDataFromCart = cartClientData || cart.find(item => item.clientData)?.clientData || null;
      
      logger.debug('Verificando clientData en el carrito:', {
        hayClientData: !!clientDataFromCart,
        clientDataJSON: JSON.stringify(clientDataFromCart),
        itemsConClientData: cart.filter(item => item.clientData).length,
        hasCartLevelClientData: !!cartClientData
      });
      
      const cartSaleData = {
        cart: cart.map(item => {
          // Asegurar que todos los campos requeridos estén presentes
          const cartItem = {
            id: item.id,
            type: item.type, // Usar constantes estandarizadas: SALE_TYPES.PRODUCT o SALE_TYPES.SERVICE
            name: item.name,
            price: Number(item.price), // Asegurar que sea número
            quantity: Number(item.quantity), // Asegurar que sea número
            paymentMethod: item.paymentMethod || 'efectivo' // Backend espera 'efectivo', no 'cash'
          };

          // Agregar serviceId solo para servicios
          if (item.type === SALE_TYPES.SERVICE && item.serviceId) {
            cartItem.serviceId = item.serviceId;
          }

          return cartItem;
        }),
        barberId: barberId,
        notes: `Venta desde carrito - ${cart.length} items`,
        // Agregar datos del cliente si existen
        clientData: clientDataFromCart
      };

      logger.debug('Enviando datos del carrito:', {
        cartLength: cartSaleData.cart.length,
        barberId: cartSaleData.barberId,
        hasClientData: !!cartSaleData.clientData,
        clientDataJSON: JSON.stringify(cartSaleData.clientData)
      });

      // Envía al backend el carrito normalizado junto con barbero y datos de factura.
      const result = await salesService.createCartSale(cartSaleData);

      // Mensaje detallado de éxito
      const paymentSummary = getPaymentMethodSummary();
      let successMessage = `Venta completada exitosamente\n`;
      successMessage += `Total: ${formatPrice(cartTotal)}\n`;
      successMessage += `Items vendidos: ${cart.length}\n`;

      // Mostrar resumen por método de pago
      Object.entries(paymentSummary).forEach(([methodId, total]) => {
        if (total > 0) {
          const methodInfo = getPaymentMethodInfo(methodId);
          successMessage += `${methodInfo.name}: ${formatPrice(total)}\n`;
        }
      });

      showSuccess(successMessage);

      // Limpiar carrito
      setCart([]);
  // Limpiar datos del cliente a nivel de carrito
  setCartClientData(null);
      setSaleCompleted(true);

      // Reiniciar estado después de 3 segundos
      setTimeout(() => {
        setSaleCompleted(false);
      }, 3000);

      // Notificar cambios de inventario para actualizar la lista
      notifySale();

      // Recargar productos para mostrar stock actualizado
      logger.debug('Recargando inventario para mostrar stock actualizado...');
      // Recarga el inventario tras un breve retardo para reflejar el stock actualizado.
      setTimeout(async () => {
        try {
          logger.debug('Iniciando recarga de inventario después de venta...');
          await loadInitialData();
          logger.debug('Inventario recargado exitosamente después de venta');
        } catch (error) {
          console.error('Error recargando inventario:', error);
        }
      }, 1500);

    } catch (error) {
      console.error('Error procesando venta:', error);
      showError(error.response?.data?.message || 'Error al procesar la venta');
    } finally {
      setProcessingSale(false);
    }
  };

  // Formatear precio
  // Formatea un valor como precio en pesos colombianos (COP).
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price || 0);
  };

  // Esqueleto de carga mientras llegan inventario y servicios.
  if (loading) {
    return (
      <PageContainer>
        <BarberSalesSkeleton items={8} />
      </PageContainer>
    );
  }

  // Vista del punto de venta: cabecera con accesos a facturas y reembolsos, buscador
  // y filtro de categorías, selector de barbero para admin, grilla de servicios y
  // productos, y carrito lateral con desglose por método de pago y botón de cobro.
  return (
    <>
      <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 flex-shrink-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Punto de Venta</h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">Registra ventas de productos y cortes</p>
            </div>
          </div>

          {/* Acciones (iconos sin contenedor) */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => navigate('/admin/cart-invoices')}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-blue-400 hover:text-blue-300 hover:bg-white/[0.04] transition-colors"
              title="Facturas de carrito"
              aria-label="Facturas de carrito"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setRefundModalOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-red-400 hover:text-red-300 hover:bg-white/[0.04] transition-colors"
              title={user?.role === 'admin' ? 'Gestionar reembolsos' : 'Reembolsar ventas'}
              aria-label="Reembolsar ventas"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Toolbar: búsqueda y categorías ── */}
        {/* Desktop */}
        <div className="hidden sm:grid grid-cols-2 gap-3 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar productos y servicios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glassmorphism-input pl-10 w-full"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="glassmorphism-select pl-10 w-full"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Móvil: buscador directo + icono de categorías */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar productos y servicios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glassmorphism-input pl-10 pr-10 w-full"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setMobileFiltersOpen(prev => !prev)}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition-colors ${
                mobileFiltersOpen || categoryFilter !== 'all'
                  ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                  : 'border-white/[0.08] bg-white/[0.03] text-gray-300'
              }`}
              aria-label="Filtrar por categoría"
              aria-expanded={mobileFiltersOpen}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {mobileFiltersOpen && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="glassmorphism-select w-full"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Usuario + selector de barbero ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {user && (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <User className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <span className="flex-shrink-0 text-gray-400">{user.role === 'admin' ? 'Admin' : 'Barbero'}:</span>
              <span className="truncate font-medium text-white">{user.name || user.email}</span>
            </div>
          )}
          {user?.role === 'admin' && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {loadingBarbers ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Skeleton className="h-3.5 w-3.5 rounded-full" />
                  <span>Cargando barberos...</span>
                </div>
              ) : (
                <>
                  <label className="text-xs text-gray-400 flex-shrink-0">Barbero:</label>
                  <select
                    value={selectedBarberId || ''}
                    onChange={(e) => setSelectedBarberId(e.target.value)}
                    className="glassmorphism-select px-3 text-sm w-full sm:min-w-[220px]"
                    required
                  >
                    <option value="">Seleccionar barbero</option>
                    {availableBarbers.map((barber) => (
                      <option key={barber._id} value={barber.user?._id || barber._id}>
                        {barber.user?.name || barber.specialty}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {!selectedBarberId && availableBarbers.length > 0 && (
                <p className="flex-shrink-0 text-[10px] text-amber-400">Requerido</p>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/5 backdrop-blur-sm border border-red-500/20 rounded-xl p-3 shadow-xl shadow-soft">
            <div className="flex items-center">
              <X className="h-4 w-4 mr-2 text-red-400" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* ── Main Layout: Products + Sticky Cart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6 items-start">
          {/* ── Products/Services Grid ── */}
          <div className="space-y-4 sm:space-y-6">
            {/* Services section */}
            {services.filter(s => searchTerm === '' || s.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Servicios</h3>
                  <div className="flex-1 h-px bg-emerald-500/20"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {services
                    .filter(service => 
                      searchTerm === '' || 
                      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      service.description?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((service) => (
                    <div
                      key={service._id}
                      className="group relative backdrop-blur-sm border rounded-lg p-3 transition-all duration-300 overflow-hidden hover:scale-[1.002] hover:-translate-y-0.5 cursor-pointer border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-soft"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-lg"></div>
                      <div className="relative space-y-2">
                        <div>
                          <h3 className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1.5">
                            <Scissors className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span className="truncate">{service.name}</span>
                          </h3>
                          {service.description && (
                            <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-2">{service.description}</p>
                          )}
                          <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] rounded-full border border-emerald-500/30">
                            Servicio
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-emerald-400 font-bold text-xs sm:text-sm">{formatPrice(service.price)}</p>
                          <button
                            onClick={() => addWalkInServiceDirect(service)}
                            className="p-2.5 min-h-11 min-w-11 flex items-center justify-center bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-lg border border-emerald-500/30 hover:border-blue-500/40 transition-all duration-300 backdrop-blur-sm hover:from-emerald-600/30 hover:to-blue-600/30 transform hover:scale-110 shadow-xl shadow-soft"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:text-blue-400 transition-colors duration-300" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Productos</h3>
                <div className="flex-1 h-px bg-blue-500/20"></div>
                <span className="text-[11px] text-gray-500">{filteredProducts.length} disponible{filteredProducts.length !== 1 ? 's' : ''}</span>
              </div>
              {filteredProducts.length === 0 && services.filter(s => 
                  searchTerm === '' || 
                  s.name.toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0 ? (
                <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
                  <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">
                    {searchTerm || categoryFilter !== 'all' 
                      ? 'No se encontraron productos o servicios' 
                      : 'No hay productos o servicios disponibles'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <div
                      key={product._id}
                      className="group relative backdrop-blur-sm border rounded-lg p-3 transition-all duration-300 overflow-hidden hover:scale-[1.002] hover:-translate-y-0.5 cursor-pointer border-blue-500/30 bg-blue-500/5 shadow-sm shadow-soft"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-lg"></div>
                      <div className="relative space-y-2">
                        <div>
                          <h3 className="font-semibold text-white text-xs sm:text-sm truncate">{product.name}</h3>
                          {product.description && (
                            <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-2">{product.description}</p>
                          )}
                          {product.category && (
                            <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded-full border border-blue-500/30">
                              {product.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-emerald-400 font-bold text-xs sm:text-sm">{formatPrice(product.price)}</p>
                            <p className="text-gray-500 text-[10px]">Stock: {product.quantity || product.stock || 0}</p>
                          </div>
                          <button
                            onClick={() => addToCart(product)}
                            disabled={(product.quantity || product.stock || 0) === 0}
                            className="p-2.5 min-h-11 min-w-11 flex items-center justify-center bg-gradient-to-r from-blue-600/20 to-emerald-600/20 rounded-lg border border-blue-500/30 hover:border-emerald-500/40 transition-all duration-300 backdrop-blur-sm hover:from-blue-600/30 hover:to-emerald-600/30 transform hover:scale-110 shadow-xl shadow-soft disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            <Plus className="w-3.5 h-3.5 text-blue-400 group-hover:text-emerald-400 transition-colors duration-300" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Cart (Sticky Sidebar) ── */}
          <div className="lg:sticky lg:top-4">
            <div className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl shadow-soft overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[2.5%] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-xl"></div>
              <div className="relative p-4">
                {/* Cart header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    Carrito
                    <span className="text-xs text-gray-400 font-normal">({cart.length})</span>
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setInvoiceDataModal({ show: true, item: null })}
                      title="Datos de factura del carrito"
                      className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-blue-300 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-6 sm:py-10">
                    <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">El carrito está vacío</p>
                    <p className="text-gray-500 text-xs mt-1">Agrega productos o servicios</p>
                  </div>
                ) : (
                  <>
                    {/* Cart items */}
                    <div className="space-y-2 custom-scrollbar max-h-64 sm:max-h-80 lg:max-h-[420px] overflow-y-auto">
                      {cart.map((item, index) => (
                        <div
                          key={`${item.id}-${item.type}-${index}`}
                          className="group/item relative backdrop-blur-sm border rounded-lg p-2.5 transition-all duration-300 overflow-hidden border-blue-500/30 bg-blue-500/5 shadow-sm shadow-soft"
                        >
                          <div className="relative">
                            {/* Item header: name + payment method */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <h4 className="text-white text-xs font-medium leading-tight flex-1 truncate">{item.name}</h4>
                              {(() => {
                                // Resuelve icono y colores del método de pago asignado al ítem del carrito.
                                const methodInfo = getPaymentMethodInfo(item.paymentMethod);
                                let IconComponent = CreditCard;
                                if (methodInfo?.icon && typeof methodInfo.icon === 'function') {
                                  IconComponent = methodInfo.icon;
                                }
                                const colors = resolveMethodColor(item.paymentMethod);
                                return (
                                  <button
                                    onClick={() => openPaymentMethodModal(item)}
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border cursor-pointer hover:opacity-80 transition-opacity ${colors.bg} ${colors.border}`}
                                    title="Cambiar método de pago"
                                  >
                                    <IconComponent size={10} className={colors.text} />
                                    <span className={`${colors.text} whitespace-nowrap hidden sm:inline`}>{methodInfo?.name || item.paymentMethod}</span>
                                  </button>
                                );
                              })()}
                            </div>
                            {/* Price + controls */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <p className="text-blue-300 text-xs font-semibold">{formatPrice(item.price)}</p>
                                {item.type === SALE_TYPES.PRODUCT && (
                                  <p className="text-gray-500 text-[10px]">Stk:{item.stock}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {item.type === SALE_TYPES.PRODUCT ? (
                                  <div className="flex items-center gap-0.5 bg-white/5 rounded-lg px-1 py-0.5">
                                    <button
                                      onClick={() => updateCartQuantity(item.id, item.type, item.quantity - 1)}
                                      className="p-2 min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-white text-xs font-medium min-w-[1.2rem] text-center">{item.quantity}</span>
                                    <button
                                      onClick={() => updateCartQuantity(item.id, item.type, item.quantity + 1)}
                                      disabled={item.quantity >= item.stock}
                                      className="p-2 min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-white/10"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="bg-white/5 rounded px-2 py-0.5">
                                    <span className="text-white text-xs font-medium">1</span>
                                  </div>
                                )}
                                <button
                                  onClick={() => removeFromCart(item.id, item.type)}
                                  className="p-2 min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-red-500/10"
                                  title="Eliminar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Payment breakdown */}
                    {Object.keys(getPaymentMethodSummary()).length > 0 && (
                      <div className="border-t border-blue-500/20 pt-2.5 mt-2.5">
                        <p className="text-[11px] font-medium text-gray-400 mb-1.5">Desglose por método de pago:</p>
                        <div className="space-y-1">
                          {Object.entries(getPaymentMethodSummary()).map(([methodId, total]) => {
                            // Fila del desglose con el total acumulado por método de pago.
                            const methodInfo = getPaymentMethodInfo(methodId);
                            let IconComponent = CreditCard;
                            if (methodInfo?.icon && typeof methodInfo.icon === 'function') {
                              IconComponent = methodInfo.icon;
                            }
                            const colors = resolveMethodColor(methodId);
                            return (
                              <div key={methodId} className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <IconComponent size={12} className={colors.text} />
                                  <span className={`text-xs ${colors.text}`}>{methodInfo?.name || methodId}</span>
                                </div>
                                <span className="text-xs font-medium text-white">{formatPrice(total)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="border-t border-blue-500/20 pt-2.5 mt-2.5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-white">Total</span>
                        <span className="text-sm font-bold text-emerald-400">{formatPrice(cartTotal)}</span>
                      </div>
                      <button
                        onClick={processSale}
                        disabled={processingSale || cart.length === 0 || saleCompleted}
                        className={`w-full min-h-11 py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center font-semibold shadow-xl text-sm ${
                          saleCompleted 
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-soft' 
                            : processingSale 
                            ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300 shadow-soft' 
                            : cart.length === 0 
                            ? 'bg-gray-600/10 border border-gray-600/30 cursor-not-allowed text-gray-400'
                            : 'bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border border-emerald-500/30 hover:border-blue-500/40 text-white hover:from-emerald-600/30 hover:to-blue-600/30 transform hover:scale-105 shadow-soft'
                        }`}
                      >
                        {saleCompleted ? (
                          <><Check className="w-4 h-4 mr-2" />¡Venta Completada!</>
                        ) : processingSale ? (
                          <><Skeleton className="h-4 w-4 rounded-full" />Procesando Venta...</>
                        ) : (
                          <><DollarSign className="w-4 h-4 mr-2" />Procesar Venta</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </PageContainer>

      {/* Modal para editar método de pago */}
      <Modal
        isOpen={paymentMethodModal.show}
        onClose={closePaymentMethodModal}
        color="emerald"
        title="Método de pago"
        subtitle={paymentMethodModal.item?.name}
        icon={CreditCard}
        size="md"
      >
        <div className="space-y-3">
          {allPaymentMethods && allPaymentMethods.length > 0 ? allPaymentMethods.map((method) => {
            // Salta entradas nulas y garantiza que el icono sea un componente React válido.
            if (!method) return null;
            
            // Validar que el icono sea un componente React válido
            let IconComponent = CreditCard; // Default
            if (method?.icon && typeof method.icon === 'function') {
              IconComponent = method.icon;
            } else if (method?.icon && typeof method.icon === 'object') {
              IconComponent = CreditCard;
            }
            
            const isSelected = paymentMethodModal.item?.paymentMethod === method.backendId;
            
            // Obtener colores específicos para este método
            const colors = resolveMethodColor(method.backendId, method);
            
            return (
              <button
                key={method.backendId || method.id}
                onClick={() => updatePaymentMethod(method.backendId)}
                className={`w-full p-3 sm:p-4 rounded-xl border transition-all duration-300 flex items-center gap-3 hover:scale-105 ${colors.bg} ${colors.border} ${
                  isSelected
                    ? 'shadow-lg ring-2 ring-white/20'
                    : 'hover:shadow-md'
                }`}
              >
                <IconComponent className={`w-5 h-5 ${colors.text}`} />
                <span className={`font-medium ${colors.text}`}>
                  {method?.name || method?.backendId}
                </span>
                {isSelected && (
                  <Check className="w-4 h-4 text-white ml-auto" />
                )}
              </button>
            );
          }) : (
            <div className="text-center text-gray-400 py-4">
              No hay métodos de pago disponibles
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Reembolso */}
      <RefundSaleModal
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          // Recargar inventario después de cerrar el modal (en caso de reembolso)
          loadInitialData();
        }}
        selectedBarberId={user?.role === 'admin' ? selectedBarberId : null}
      />

      {/* Modal de Datos de Factura */}
      <InvoiceDataModal
        isOpen={invoiceDataModal.show}
        onClose={closeInvoiceDataModal}
        onSubmit={(clientData) => {
          // Si invoiceDataModal.item es null => datos aplican al carrito completo
          const { item } = invoiceDataModal;
          if (item) {
            logger.debug('Guardando clientData en item del carrito:', {
              itemId: item.id,
              itemType: item.type,
              clientData
            });
            setCart(cart.map(cartItem => 
              cartItem.id === item.id && cartItem.type === item.type
                ? { ...cartItem, clientData }
                : cartItem
            ));
          } else {
            logger.debug('Guardando clientData a nivel de carrito:', JSON.stringify(clientData));
            setCartClientData(clientData);
          }
          showSuccess('Datos de factura guardados');
        }}
        item={invoiceDataModal.item}
        initialData={cartClientData}
      />
    </>
  );
};

export default BarberSales;

