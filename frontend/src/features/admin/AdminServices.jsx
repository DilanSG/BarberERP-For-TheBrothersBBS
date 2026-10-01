import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { PageContainer } from '@components/layout/PageContainer';
import { api } from '@services/api';
import { barberService } from '@services/barberService';
import GradientText from '@components/ui/GradientText';
import UserAvatar from '@components/ui/UserAvatar';
import EditServiceModal from '@components/modals/EditServiceModal';
import DeleteServiceModal from '@components/modals/DeleteServiceModal';
import Modal from '@components/ui/Modal';
import GradientButton from '@components/ui/GradientButton';
import { formatCurrency } from '@utils/formatters';
import logger from '@utils/logger';
import { Skeleton, AdminServicesSkeleton } from '@components/ui/Skeleton';
import { 
  Scissors, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Clock,
  DollarSign,
  AlertCircle,
  Home, 
  X,
  Check,
  Users,
  Star,
  Search,
  Filter
} from 'lucide-react';

// Gestión de servicios (solo admin).
// Carga servicios y barberos, permite crear/editar/eliminar servicios, marcarlos
// para el Home (máx. 3) y elegir los barberos principales que se muestran.
const AdminServices = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  // Servicios, barberos activos, barberos principales y servicios del Home
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [mainBarbers, setMainBarbers] = useState([]); // Los 3 barberos principales seleccionados
  const [showBarberModal, setShowBarberModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [homeServices, setHomeServices] = useState([]);
  
  // Estados para modales
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all | home | active | inactive

  useEffect(() => {
    fetchServices();
    fetchBarbers();
  }, []);

  // Carga los barberos activos y detecta cuáles están marcados como principales
  // forceRefresh se usa para bypass del caché tras cambiar la selección
  const fetchBarbers = async (forceRefresh = false) => {
    try {
      logger.debug('[AdminServices] Iniciando fetchBarbers...', forceRefresh ? '(FORCE REFRESH)' : '');
      const startTime = Date.now();
      
      // Si forceRefresh es true, agregar timestamp para bypass del caché
      const url = '/barbers';
      const response = await api.get(url);
      
      if (response.success) {
        // VALIDACIÓN DEFENSIVA: Garantizar que sea array
        const barbersData = Array.isArray(response.data) ? response.data : [];
        const endTime = Date.now();
        logger.debug(`[AdminServices] Datos recibidos en ${endTime - startTime}ms:`, barbersData.length, 'barberos');
        
        // Los barberos ya vienen filtrados y ordenados desde el backend optimizado
        const activeBarbers = barbersData.filter(barber => {
          const isActive = barber.user && 
                 barber.user.role === 'barber' && 
                 (barber.user.isActive !== false) && 
                 (barber.isActive !== false);
          logger.debug(`[AdminServices] ${barber.user?.name}: isActive=${isActive}, isMainBarber=${barber.isMainBarber}`);
          return isActive;
        });

        logger.debug('[AdminServices] Barberos activos:', activeBarbers.length);

        // Identificar los barberos marcados como principales (isMainBarber: true)
        const currentMainBarbers = activeBarbers.filter(barber => barber.isMainBarber === true);
        logger.debug('[AdminServices] Barberos principales encontrados:', currentMainBarbers.length);
        logger.debug('[AdminServices] Lista de principales:', currentMainBarbers.map(b => b.user?.name));
        
        // ACTUALIZACIÓN ATÓMICA DEL ESTADO
        setBarbers(activeBarbers);
        setMainBarbers(currentMainBarbers);
        
        logger.debug('[AdminServices] Estado actualizado exitosamente');
      }
    } catch (error) {
      console.error('[AdminServices] Error fetching barbers:', error);
      // No mostrar error aquí, los barberos son opcionales
    }
  };

  // Carga todos los servicios y deriva los que están marcados para el Home
  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/services');
      
      if (response.success) {
        // VALIDACIÓN DEFENSIVA: Garantizar que sea array
        const servicesData = Array.isArray(response.data) ? response.data : [];
        const homeServicesFromBackend = servicesData.filter(service => service.showInHome);
        setServices(servicesData);
        setHomeServices(homeServicesFromBackend);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      showError('Error al cargar los servicios');
    } finally {
      setLoading(false);
    }
  };

  // Alterna si un servicio se muestra en el Home.
  // Usa optimistic update: aplica el cambio al instante y lo revierte si el API falla.
  const toggleShowInHome = async (serviceId, currentStatus) => {
    const newStatus = !currentStatus;
    
    try {
      // OPTIMISTIC UPDATE - Actualizar UI inmediatamente
      const updatedServices = services.map(service =>
        service._id === serviceId
          ? { ...service, showInHome: newStatus }
          : service
      );
      
      setServices(updatedServices);

      // Actualizar homeServices basándose en los servicios actualizados
      const newHomeServices = updatedServices.filter(service => service.showInHome);
      setHomeServices(newHomeServices);

      const response = await api.patch(`/services/${serviceId}/show-in-home`, {
        showInHome: newStatus
      });

      if (response.success) {
        showSuccess(response.message);
      } else {
        throw new Error('Response was not successful');
      }
    } catch (error) {
      // REVERTIR OPTIMISTIC UPDATE
      console.error('Error updating service:', error);
      showError(error.response?.data?.message || 'Error al actualizar el servicio');
      
      // Revertir a estado original
      const revertedServices = services.map(service =>
        service._id === serviceId
          ? { ...service, showInHome: currentStatus }
          : service
      );
      
      setServices(revertedServices);
      
      // Restaurar homeServices basándose en el estado original
      const originalHomeServices = revertedServices.filter(service => service.showInHome);
      setHomeServices(originalHomeServices);
    }
  };

  // Normaliza el rating (objeto o número) a un decimal; null si es 0 o no existe
  const formatRating = (rating) => {
    if (!rating) return null;
    if (typeof rating === 'object' && rating.average !== undefined) {
      return rating.average === 0 ? null : Number(rating.average).toFixed(1);
    }
    return rating === 0 ? null : Number(rating).toFixed(1);
  };

  // Funciones para modales de servicio
  // Abre el modal de edición con el servicio seleccionado
  const handleEditService = (service) => {
    setSelectedService(service);
    setShowEditModal(true);
  };

  // Abre el modal de confirmación de eliminación
  const handleDeleteService = (service) => {
    setSelectedService(service);
    setShowDeleteModal(true);
  };

  // Crea un servicio vía API y recarga la lista al terminar
  const handleCreateService = async (createData) => {
    try {
      setModalLoading(true);
      const response = await api.post('/services', createData);

      if (response.success) {
        showSuccess('Servicio creado exitosamente');
        setShowCreateModal(false);
        await fetchServices();
      }
    } catch (error) {
      console.error('Error creating service:', error);
      showError(error.response?.data?.message || 'Error al crear el servicio');
    } finally {
      setModalLoading(false);
    }
  };

  // Actualiza un servicio existente y recarga la lista
  const handleUpdateService = async (serviceId, updateData) => {
    try {
      setModalLoading(true);
      const response = await api.put(`/services/${serviceId}`, updateData);
      
      if (response.success) {
        showSuccess('Servicio actualizado exitosamente');
        setShowEditModal(false);
        setSelectedService(null);
        await fetchServices();
      }
    } catch (error) {
      console.error('Error updating service:', error);
      showError(error.response?.data?.message || 'Error al actualizar el servicio');
    } finally {
      setModalLoading(false);
    }
  };

  // Elimina el servicio confirmado y recarga la lista
  const handleConfirmDeleteService = async (serviceId) => {
    try {
      setModalLoading(true);
      const response = await api.delete(`/services/${serviceId}`);
      
      if (response.success) {
        showSuccess('Servicio eliminado exitosamente');
        setShowDeleteModal(false);
        setSelectedService(null);
        await fetchServices();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      showError(error.response?.data?.message || 'Error al eliminar el servicio');
    } finally {
      setModalLoading(false);
    }
  };

  // Cierra todos los modales de servicio y limpia la selección
  const closeModals = () => {
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowCreateModal(false);
    setSelectedService(null);
  };

  // Marca/desmarca un barbero como principal (máximo 3).
  // Optimistic update con reversión si el backend falla y re-sincronización final.
  const handleBarberSelect = async (barber) => {
    try {
      logger.debug('[AdminServices] handleBarberSelect called for:', barber.user?.name);
      logger.debug('[AdminServices] Current isMainBarber:', barber.isMainBarber, typeof barber.isMainBarber);
      
      const isCurrentlyMain = barber.isMainBarber === true;
      const willBeMain = !isCurrentlyMain;
      logger.debug('[AdminServices] isCurrentlyMain:', isCurrentlyMain, '-> willBeMain:', willBeMain);
      
      // Si quiere marcar como principal y ya hay 3, mostrar error inmediatamente
      if (willBeMain && mainBarbers.length >= 3) {
        logger.debug('[AdminServices] Max 3 barberos alcanzado');
        showError('Solo puedes seleccionar máximo 3 barberos principales');
        return;
      }

      // OPTIMISTIC UPDATE - Actualizar UI inmediatamente
      setBarbers(prevBarbers => 
        prevBarbers.map(b => 
          b._id === barber._id 
            ? { ...b, isMainBarber: willBeMain }
            : b
        )
      );

      // Actualizar mainBarbers inmediatamente
      if (willBeMain) {
        setMainBarbers(prev => [...prev, { ...barber, isMainBarber: true }]);
      } else {
        setMainBarbers(prev => prev.filter(mb => mb._id !== barber._id));
      }

      // LLAMADA AL BACKEND
      logger.debug('[AdminServices] Calling updateMainBarberStatus...');
      const response = await barberService.updateMainBarberStatus(barber._id, willBeMain);
      logger.debug('[AdminServices] Response:', response);

      if (response.success) {
        logger.debug('[AdminServices] Backend actualizado exitosamente');
        showSuccess(response.message || `Barbero ${willBeMain ? 'agregado a' : 'removido de'} barberos principales`);
        
        // SINCRONIZAR CON BACKEND para confirmar estado real
        await fetchBarbers(true);
      } else {
        // REVERTIR OPTIMISTIC UPDATE
        logger.debug('[AdminServices] Revirtiendo cambios optimistas...');
        setBarbers(prevBarbers => 
          prevBarbers.map(b => 
            b._id === barber._id 
              ? { ...b, isMainBarber: isCurrentlyMain }
              : b
          )
        );
        
        if (willBeMain) {
          setMainBarbers(prev => prev.filter(mb => mb._id !== barber._id));
        } else {
          setMainBarbers(prev => [...prev, barber]);
        }
        
        showError('Error al actualizar el estado del barbero');
      }
    } catch (error) {
      // REVERTIR OPTIMISTIC UPDATE EN CASO DE ERROR
      logger.debug('[AdminServices] Revirtiendo cambios por error...');
      setBarbers(prevBarbers => 
        prevBarbers.map(b => 
          b._id === barber._id 
            ? { ...b, isMainBarber: barber.isMainBarber }
            : b
        )
      );
      
      // Restaurar mainBarbers también
      await fetchBarbers(true);
      
      console.error('[AdminServices] Error updating main barber status:', error);
      showError(error.response?.data?.message || 'Error al actualizar el estado del barbero');
    }
  };

  // Categorías únicas para el filtro
  // Se derivan de los servicios cargados (Set para evitar duplicados)
  const categories = useMemo(() => {
    return [...new Set(services.map(s => s.category).filter(Boolean))];
  }, [services]);

  // Servicios filtrados por búsqueda, categoría y estado
  // "active" excluye los del Home porque ya se muestran en su propio grupo
  const filteredServices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return services.filter(service => {
      const matchesSearch = !search ||
        service.name?.toLowerCase().includes(search) ||
        service.description?.toLowerCase().includes(search);
      const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'home' && service.showInHome) ||
        (statusFilter === 'active' && service.isActive && !service.showInHome) ||
        (statusFilter === 'inactive' && !service.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [services, searchTerm, categoryFilter, statusFilter]);

  // Separación en dos grupos (Home vs Otros) y bandera para saber si agrupar
  const homeList = filteredServices.filter(s => s.showInHome);
  const otherList = filteredServices.filter(s => !s.showInHome);
  const showGrouped = statusFilter === 'all';

  // Indica si hay algún filtro activo (para mostrar el botón de limpiar)
  const hasActiveFilters = searchTerm.trim() !== '' || categoryFilter !== 'all' || statusFilter !== 'all';

  // Tarjeta reutilizable de servicio: estado, precio/duración, acciones y toggle de Home
  const ServiceCard = ({ service }) => (
    <div className={`group relative backdrop-blur-sm border border-white/[0.08] rounded-2xl bg-white/[0.03] p-4 transition-colors duration-300 overflow-hidden flex flex-col hover:border-white/[0.16] hover:bg-white/[0.05] ${
      !service.isActive ? 'opacity-60 hover:opacity-100' : ''
    }`}>
      {/* Header: icono + nombre + estado (icono) + acciones */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
            service.showInHome
              ? 'bg-brand-500/10 border-brand-500/20'
              : 'bg-white/[0.04] border-white/[0.08]'
          }`}>
            <Scissors className={`w-5 h-5 ${service.showInHome ? 'text-brand-300' : 'text-gray-400'}`} />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-semibold text-white truncate leading-tight">{service.name}</h3>
            {!service.isActive ? (
              <X className="w-4 h-4 flex-shrink-0 text-red-400" title="Inactivo" />
            ) : service.showInHome ? (
              <Home className="w-4 h-4 flex-shrink-0 text-brand-300" title="En Home" />
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => handleEditService(service)}
            className="flex items-center justify-center min-h-11 min-w-11 text-blue-400 hover:text-blue-300 transition-colors duration-200"
            title="Editar servicio"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteService(service)}
            className="flex items-center justify-center min-h-11 min-w-11 text-red-400 hover:text-red-300 transition-colors duration-200"
            title="Eliminar servicio"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Descripción */}
      <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-3 min-h-[2.5rem]">
        {service.description}
      </p>

      {/* Precio y duración (texto de la card) */}
      <div className="flex items-center gap-4 mb-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
          <DollarSign className="w-4 h-4" />
          {formatCurrency(service.price)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
          <Clock className="w-4 h-4 text-blue-400" />
          {service.duration} min
        </span>
      </div>

      {/* Toggle Home */}
      <button
        onClick={() => toggleShowInHome(service._id, service.showInHome)}
        className={`mt-auto w-full flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors duration-200 ${
          service.showInHome
            ? 'bg-red-600/10 text-red-400 border-red-500/30 hover:bg-red-600/20'
            : 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20'
        }`}
      >
        {service.showInHome ? (
          <>
            <EyeOff className="w-3.5 h-3.5" />
            Quitar del Home
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5" />
            Mostrar en Home
          </>
        )}
      </button>
    </div>
  );

  if (loading) {
    return (
      <PageContainer>
        <AdminServicesSkeleton />
      </PageContainer>
    );
  }

  // Verificar que solo admin acceda (el chequeo va después de todos los hooks
  // para no romper las reglas de hooks de React)
  if (user?.role !== 'admin') {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-400">Solo los administradores pueden acceder a esta página</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="w-full space-y-5">
        {/* ── Top Bar ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Left: Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Scissors className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Gestión de Servicios</h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                Administra los servicios y elige cuáles mostrar en el Home
              </p>
            </div>
          </div>

          {/* Right: Search + Category + Create */}
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar servicios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glassmorphism-input pl-10 w-full"
              />
            </div>
            <div className="relative sm:w-48">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
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
            <GradientButton
              onClick={() => setShowCreateModal(true)}
              size="sm"
              className="flex-shrink-0 shadow-soft"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Servicio
              </span>
            </GradientButton>
          </div>
        </div>

        {/* ── Stats Strip ── */}
        {/* Resumen: total, servicios en Home (x/3), activos y barberos principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/25 flex-shrink-0">
              <Scissors className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-white leading-tight">{services.length}</p>
              <p className="text-gray-400 text-xs truncate">Total Servicios</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex-shrink-0">
              <Home className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-white leading-tight">{homeServices.length}/3</p>
              <p className="text-gray-400 text-xs truncate">En Home</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex-shrink-0">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-white leading-tight">{services.filter(s => s.isActive).length}</p>
              <p className="text-gray-400 text-xs truncate">Activos</p>
            </div>
          </div>

          <button
            onClick={() => setShowBarberModal(true)}
            className="flex items-center gap-3 p-3 rounded-xl border border-brand-400/25 bg-brand-400/5 backdrop-blur-sm hover:bg-brand-400/10 hover:border-brand-400/40 transition-all duration-300 text-left group"
          >
            <div className="p-2 rounded-lg bg-brand-400/15 border border-brand-400/25 flex-shrink-0">
              <Users className="w-5 h-5 text-brand-300 group-hover:text-brand-200 transition-colors" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-white leading-tight">{mainBarbers.length}/3</p>
              <p className="text-gray-400 text-xs truncate">Barberos Principales</p>
            </div>
            <span className="text-brand-300 text-[10px] font-medium flex-shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              Gestionar →
            </span>
          </button>
        </div>

        {/* ── Filtros de estado ── */}
        {/* Pills de estado con contador; "Limpiar filtros" reinicia búsqueda/categoría/estado */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap sm:flex-wrap sm:overflow-visible sm:pb-0">
          {[
            { key: 'all', label: 'Todos', count: services.length },
            { key: 'home', label: 'En Home', count: services.filter(s => s.showInHome).length },
            { key: 'active', label: 'Activos', count: services.filter(s => s.isActive && !s.showInHome).length },
            { key: 'inactive', label: 'Inactivos', count: services.filter(s => !s.isActive).length }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-200 ${
                statusFilter === key
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/25'
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                statusFilter === key ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Info de servicios en Home */}
        {homeServices.length >= 3 && statusFilter === 'all' && (
          <div className="backdrop-blur-sm border border-blue-500/30 rounded-xl p-3 bg-blue-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <p className="text-blue-300/90 text-sm">
                Tienes 3 servicios en el Home (máximo permitido). Si intentas agregar otro, deberás quitar uno primero.
              </p>
            </div>
          </div>
        )}

        {/* ── Contenido ── */}
        {/* Estados: sin servicios, sin resultados o listado (agrupado o plano según filtro) */}
        {services.length === 0 ? (
          <div className="text-center py-20">
            <Scissors className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No hay servicios</h3>
            <p className="text-gray-500">Agrega el primer servicio para comenzar</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <Search className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-300 mb-1">Sin resultados</h3>
            <p className="text-gray-500 text-sm">Ningún servicio coincide con los filtros aplicados</p>
          </div>
        ) : showGrouped ? (
          <div className="space-y-8">
            {/* En Home */}
            {homeList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">En Home</h3>
                  <div className="flex-1 h-px bg-emerald-500/20"></div>
                  <span className="text-[11px] text-gray-500">{homeList.length} de 3</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {homeList.map(service => (
                    <ServiceCard key={service._id} service={service} />
                  ))}
                </div>
              </div>
            )}

            {/* Otros servicios */}
            {otherList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Scissors className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Otros Servicios</h3>
                  <div className="flex-1 h-px bg-blue-500/20"></div>
                  <span className="text-[11px] text-gray-500">{otherList.length} servicios</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherList.map(service => (
                    <ServiceCard key={service._id} service={service} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map(service => (
              <ServiceCard key={service._id} service={service} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de selección de barberos */}
      <Modal
        isOpen={showBarberModal}
        onClose={() => setShowBarberModal(false)}
        color="blue"
        title="Gestionar Barberos Principales"
        subtitle="Selecciona hasta 3 barberos para mostrar en Home/Barbers"
        icon={Users}
        size="2xl"
        headerExtra={
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
            mainBarbers.length >= 3
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
          }`}>
            {mainBarbers.length}/3
          </span>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-gray-400">
              {mainBarbers.length >= 3
                ? 'Máximo alcanzado — quita uno para cambiar'
                : `Puedes seleccionar ${3 - mainBarbers.length} más`}
            </p>
            <button
              onClick={() => setShowBarberModal(false)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Listo
            </button>
          </div>
        }
      >
        {barbers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 bg-gradient-to-r from-gray-600/20 to-blue-600/20 rounded-xl border border-gray-500/20 shadow-lg shadow-soft inline-flex mb-4">
                      <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400">No hay barberos disponibles</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-3">
                    {barbers.map((barber) => {
                      // Seleccionable si no es principal y hay cupo (<3); deseleccionable si ya es principal
                      const isMainBarber = barber.isMainBarber === true;
                      const canSelect = !isMainBarber && mainBarbers.length < 3;
                      const canDeselect = isMainBarber;
                      const isClickable = canSelect || canDeselect;

                      return (
                        <div
                          key={barber._id}
                          onClick={() => {
                            if (isClickable) {
                              handleBarberSelect(barber);
                            }
                          }}
                          title={
                            isMainBarber
                              ? 'Click para quitar de principales'
                              : canSelect
                              ? 'Click para seleccionar como principal'
                              : 'Límite alcanzado (3/3)'
                          }
                          className={`group relative p-3 rounded-xl border transition-all duration-300 overflow-hidden backdrop-blur-sm ${
                            isMainBarber
                              ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-soft cursor-pointer hover:border-emerald-400'
                              : canSelect
                              ? 'border-blue-500/50 bg-blue-500/10 shadow-lg cursor-pointer hover:border-blue-400'
                              : 'border-gray-500/40 bg-gray-500/5 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          {/* Indicador de estado */}
                          <div className="absolute top-2 right-2 z-10">
                            {isMainBarber ? (
                              <div className="p-1 bg-emerald-500/20 rounded-full border border-emerald-500/40">
                                <Check className="w-3 h-3 text-emerald-400" />
                              </div>
                            ) : canSelect ? (
                              <div className="p-1 bg-blue-500/20 rounded-full border border-blue-500/40">
                                <Plus className="w-3 h-3 text-blue-400" />
                              </div>
                            ) : (
                              <div className="p-1 bg-gray-500/20 rounded-full border border-gray-500/40">
                                <X className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                          </div>

                          <div className="relative flex flex-col items-center">
                            {/* Foto del barbero */}
                            <div className="mb-2">
                              <UserAvatar
                                user={barber.user}
                                size="md"
                                className="shadow-lg shadow-soft"
                              />
                            </div>

                            {/* Información del barbero */}
                            <GradientText className="font-semibold text-sm w-full text-center truncate">
                              {barber.user?.name || 'Sin nombre'}
                            </GradientText>

                            {barber.specialty && (
                              <p className="text-gray-400 text-[11px] w-full text-center truncate mt-0.5">
                                {barber.specialty}
                              </p>
                            )}

                            {barber.rating && formatRating(barber.rating) && (
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <Star className="w-3 h-3 text-amber-400" fill="currentColor" />
                                <span className="text-amber-400 text-[11px] font-medium">
                                  {formatRating(barber.rating)}
                                </span>
                              </div>
                            )}

                            {/* Único badge de estado */}
                            <span className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              isMainBarber
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : canSelect
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-gray-500/20 text-gray-400 border-gray-500/40'
                            }`}>
                              {isMainBarber ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Principal
                                </>
                              ) : canSelect ? (
                                <>
                                  <Plus className="w-3 h-3" />
                                  Seleccionar
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3" />
                                  Máximo
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
      </Modal>

      {/* Modales */}
      {/* EditServiceModal se reutiliza para editar y crear (mode="create") */}
      <EditServiceModal
        isOpen={showEditModal}
        onClose={closeModals}
        service={selectedService}
        onUpdate={handleUpdateService}
        isLoading={modalLoading}
      />

      <EditServiceModal
        isOpen={showCreateModal}
        onClose={closeModals}
        mode="create"
        service={null}
        onCreate={handleCreateService}
        isLoading={modalLoading}
      />

      <DeleteServiceModal
        isOpen={showDeleteModal}
        onClose={closeModals}
        service={selectedService}
        onDelete={handleConfirmDeleteService}
        isLoading={modalLoading}
      />
    </PageContainer>
  );
};

export default AdminServices;

