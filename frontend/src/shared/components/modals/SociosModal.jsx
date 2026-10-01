import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Users, 
  Crown, 
  User, 
  DollarSign,
  Trash2,
  Edit,
  Save,
  XCircle,
  UserMinus,
  Shield,
  AlertTriangle,
  Check,
  LockOpen,
  Phone,
  FileText,
  Lightbulb
} from 'lucide-react';
import { toast } from 'react-toastify';
import { sociosService } from '../../services/sociosService';
import { ListSkeleton, Skeleton } from '@components/ui/Skeleton';
import Modal from '@components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

// Modal de gestión de socios (subrol de admin) y reparto de ganancias.
// Carga socios y admins disponibles; solo el fundador, con el modo fundador
// activo (corona), puede asignar, editar porcentajes o quitar el subrol.
// Tocar una tarjeta abre el perfil individual del socio.
const SociosModal = ({ 
  isOpen, 
  onClose, 
  totalProfit = 0,
  formatCurrency 
}) => {
  // Estado de socios, admins disponibles, edición y modales anidados.
  const [socios, setSocios] = useState([]);
  const [adminsDisponibles, setAdminsDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [newSocio, setNewSocio] = useState({
    porcentaje: 50,
    notas: ''
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [totalPorcentaje, setTotalPorcentaje] = useState(0);
  const [disponible, setDisponible] = useState(100);
  const [founderMode, setFounderMode] = useState(false);
  // Nuevo estado para modal individual de socio
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState(null);
  

  
  // Obtener usuario del contexto de autenticación
  const { user: authUser } = useAuth();

  // Determina si el usuario actual es fundador (isFounder o tipoSocio 'fundador').
  // Función para verificar si el usuario actual es fundador
  const isCurrentUserFounder = () => {
    const userToCheck = currentUser || authUser;
    
    // Verificar si es fundador - simplificado
    const isFounder = Boolean(
      userToCheck?.isFounder || 
      userToCheck?.tipoSocio === 'fundador'
    );
    

    
    return isFounder;
  };

  // Función para verificar si puede realizar acciones de gestión
  // Solo se puede gestionar socios siendo fundador y con el modo fundador activo.
  const canManageSocios = () => {
    return isCurrentUserFounder() && founderMode;
  };

  // Función para activar/desactivar modo fundador
  // Activa/desactiva el modo fundador y carga los admins disponibles al activarlo.
  const toggleFounderMode = () => {
    if (isCurrentUserFounder()) {
      const newMode = !founderMode;
      setFounderMode(newMode);
      
      // Cargar admins disponibles solo cuando se active el modo fundador
      if (newMode && adminsDisponibles.length === 0) {
        fetchAdminsDisponibles();
      }
    }
  };

  // Al abrir carga socios y usuario actual; al cerrar desactiva el modo fundador.
  useEffect(() => {
    if (isOpen) {
      fetchSocios();
      getCurrentUser();
      // Solo cargar admins disponibles si es fundador
      if (isCurrentUserFounder()) {
        fetchAdminsDisponibles();
      }
    } else {
      // Resetear modo fundador al cerrar el modal
      setFounderMode(false);
    }
  }, [isOpen]);

  // Obtiene el usuario actual del backend; si falla usa los datos de auth.
  const getCurrentUser = async () => {
    try {
      const response = await sociosService.getCurrentUser();
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      // Si hay error, usar datos del contexto de auth
      if (authUser) {
        setCurrentUser({
          _id: authUser.id,
          id: authUser.id,
          nombre: authUser.name,
          email: authUser.email,
          role: authUser.role,
          isAdmin: authUser.role === 'admin',
          tipoSocio: null,
          isFounder: false
        });
      }
    }
  };

  // Carga los admins que aún no tienen subrol de socio.
  const fetchAdminsDisponibles = async () => {
    try {
      const response = await sociosService.getAdminsDisponibles();
      setAdminsDisponibles(response.data || []);
    } catch (error) {
      console.error('Error cargando admins disponibles:', error);
      setAdminsDisponibles([]);
    }
  };

  // Carga la lista de socios y recalcula totales y porcentaje disponible
  // localmente para garantizar consistencia.
  const fetchSocios = async () => {
    try {
      setLoading(true);
      

      
      const response = await sociosService.getAll();
      
      // Ahora response debería tener la estructura correcta
      const socios = response.data.socios || [];
      const totalPorcentaje = response.data.totalPorcentaje || 0;
      const disponible = response.data.disponible || 100;
      
      // Validación y corrección de cálculos
      const calculoLocalTotal = socios.reduce((sum, socio) => sum + (socio.porcentaje || 0), 0);
      const calculoLocalDisponible = 100 - calculoLocalTotal;
      
      // Usar cálculos locales para garantizar consistencia
      const finalTotalPorcentaje = calculoLocalTotal;
      const finalDisponible = calculoLocalDisponible;
      
      setSocios(socios);
      setTotalPorcentaje(finalTotalPorcentaje);
      setDisponible(finalDisponible);
    } catch (error) {

      toast.error(`Error cargando socios: ${error.message || 'Error desconocido'}`);
      setSocios([]);
    } finally {
      setLoading(false);
    }
  };

  // Marca el admin seleccionado para asignarle el subrol.
  const selectAdmin = (admin) => {
    if (!loading) {
      setSelectedAdmin(admin);
    }
  };

  // Asigna el subrol de socio al admin elegido tras validar modo fundador,
  // porcentaje y que la suma no supere el 100%.
  const asignarSocio = async (adminId) => {
    // Verificar si puede gestionar socios
    if (!canManageSocios()) {
      toast.error('Active el modo fundador para gestionar socios');
      return;
    }

    // Prevenir múltiples ejecuciones
    if (loading) {

      return;
    }
    
    if (!adminId || !newSocio.porcentaje || newSocio.porcentaje <= 0 || newSocio.porcentaje > 100) {
      toast.error('Debe seleccionar un admin y un porcentaje válido');
      return;
    }

    // Verificar que la suma de porcentajes no exceda 100
    // Verifica que la suma de porcentajes no exceda 100 antes de asignar.
    const totalPorcentaje = socios.reduce((sum, socio) => sum + socio.porcentaje, 0) + newSocio.porcentaje;
    if (totalPorcentaje > 100) {
      toast.error(`La suma de porcentajes excedería 100%. Disponible: ${100 - socios.reduce((sum, socio) => sum + socio.porcentaje, 0)}%`);
      return;
    }

    try {
      setLoading(true);
      const socioData = {
        userId: adminId,
        porcentaje: newSocio.porcentaje,
        notas: newSocio.notas
      };
      
      const response = await sociosService.asignarSocio(socioData);
      
      // Recargar listas
      await fetchSocios();
      if (isCurrentUserFounder()) {
        await fetchAdminsDisponibles();
      }
      
      setNewSocio({ porcentaje: 50, notas: '' });
      setSelectedAdmin(null);
      setShowAdminsModal(false);
      toast.success(response.message || 'Subrol de socio asignado exitosamente');
    } catch (error) {
      console.error('Error asignando socio:', error);
      const errorMessage = error.response?.data?.message || 'Error asignando subrol de socio';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quita el subrol de socio y lo devuelve a admin normal.
  // Quitar subrol de socio (convertir de vuelta a admin normal)
  const handleRemoveSocio = async (socioId) => {
    // Verificar si puede gestionar socios
    if (!canManageSocios()) {
      toast.error('Active el modo fundador para gestionar socios');
      return;
    }

    try {
      setLoading(true);
      await sociosService.delete(socioId);
      toast.success('Subrol de socio removido exitosamente');
      await fetchSocios();
      if (isCurrentUserFounder()) {
        await fetchAdminsDisponibles();
      }
      setShowRemoveConfirm(null);
    } catch (error) {
      console.error('Error removiendo socio:', error);
      toast.error('Error al remover subrol de socio');
    } finally {
      setLoading(false);
    }
  };

  // Actualiza el porcentaje de un socio validando rango y que la suma total
  // no supere el 100%, recalculando totales locales.
  const updatePorcentaje = async (id, newPorcentaje) => {
    // Verificar si puede gestionar socios
    if (!canManageSocios()) {
      toast.error('Active el modo fundador para editar porcentajes');
      setEditingId(null);
      return;
    }

    if (!newPorcentaje || newPorcentaje <= 0 || newPorcentaje > 100) {
      toast.error('El porcentaje debe estar entre 1 y 100');
      return;
    }

    // Calcular el total excluyendo el socio que se está editando
    const otrosSocios = socios.filter(s => (s.id || s._id) !== id);
    const totalOtros = otrosSocios.reduce((sum, socio) => sum + socio.porcentaje, 0);
    
    if (totalOtros + newPorcentaje > 100) {
      toast.error(`La suma de porcentajes excedería 100%. Disponible: ${100 - totalOtros}%`);
      return;
    }

    try {
      const response = await sociosService.updatePorcentaje(id, newPorcentaje);
      
      // Actualizar localmente
      const sociosActualizados = socios.map(socio => 
        (socio.id || socio._id) === id 
          ? { ...socio, porcentaje: newPorcentaje }
          : socio
      );
      
      // Recalcular totales
      const nuevoTotal = sociosActualizados.reduce((sum, socio) => sum + socio.porcentaje, 0);
      const nuevoDisponible = 100 - nuevoTotal;
      
      setSocios(sociosActualizados);
      setTotalPorcentaje(nuevoTotal);
      setDisponible(nuevoDisponible);
      setEditingId(null);
      toast.success(response.message || 'Porcentaje actualizado');
    } catch (error) {
      console.error('Error actualizando porcentaje:', error);
      const errorMessage = error.response?.data?.message || 'Error actualizando porcentaje';
      toast.error(errorMessage);
    }
  };

  // Elimina a un socio (nunca al fundador) previa confirmación y recarga
  // los admins disponibles.
  const eliminarSocio = async (id) => {
    const socio = socios.find(s => (s.id || s._id) === id);
    if (socio?.tipoSocio === 'fundador') {
      toast.error('No se puede eliminar al socio fundador');
      return;
    }

    if (!confirm('¿Estás seguro de quitar el subrol de socio?')) return;

    try {
      const response = await sociosService.delete(id);
      
      // Actualizar localmente y recargar admins disponibles
      const sociosActualizados = socios.filter(s => (s.id || s._id) !== id);
      
      // Recalcular totales
      const nuevoTotal = sociosActualizados.reduce((sum, socio) => sum + socio.porcentaje, 0);
      const nuevoDisponible = 100 - nuevoTotal;
      
      setSocios(sociosActualizados);
      setTotalPorcentaje(nuevoTotal);
      setDisponible(nuevoDisponible);
      
      if (isCurrentUserFounder()) {
        await fetchAdminsDisponibles();
      }
      toast.success(response.message || 'Subrol de socio removido');
    } catch (error) {
      console.error('Error eliminando socio:', error);
      const errorMessage = error.response?.data?.message || 'Error removiendo subrol de socio';
      toast.error(errorMessage);
    }
  };

  // Calcula cuánto le corresponde a cada socio según su porcentaje.
  const calculateDistribution = () => {
    return socios.map(socio => ({
      ...socio,
      ganancia: (totalProfit * socio.porcentaje) / 100
    }));
  };

  // Abre el perfil individual del socio: cualquiera puede ver el suyo y el
  // fundador puede abrir el de cualquier otro.
  // Función para manejar clic en card de socio
  const handleSocioCardClick = (socio) => {
    const userToCheck = currentUser || authUser;
    const currentUserId = userToCheck?._id || userToCheck?.id;
    
    // Obtener el ID del usuario del socio (puede ser un objeto populated o un string)
    let socioUserId;
    if (typeof socio.userId === 'object' && socio.userId !== null) {
      socioUserId = socio.userId._id || socio.userId.id;
    } else {
      socioUserId = socio.userId;
    }

    // Verificar si el usuario actual es el mismo socio o es fundador
    if (currentUserId === socioUserId || isCurrentUserFounder()) {
      setSelectedSocio(socio);
      setShowIndividualModal(true);
    } else {
      toast.error('Solo puedes editar tu propio perfil de socio o ser fundador para editar otros perfiles', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: 'bg-red-600 text-white'
      });
    }
  };

  // Badges identificativos del socio (Admin y S/FS si es fundador).
  // Renderizar badge de socio
  const renderSocioBadge = (socio) => {
    const isFounder = socio.tipoSocio === 'fundador';
    return (
      <div className="flex flex-wrap gap-1">
        {/* Badge de Admin */}
        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-400/20 text-blue-400 border border-blue-400/30">
          Admin
        </span>
        {/* Badge de Socio */}
        <span className={`px-2 py-1 text-xs font-medium rounded border ${
          isFounder 
            ? 'bg-amber-400/20 text-amber-400 border-amber-400/30' 
            : 'bg-amber-400/20 text-amber-400 border-amber-400/30'
        }`}>
          {isFounder ? 'FS' : 'S'}
        </span>
      </div>
    );
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista principal: resumen de porcentajes y ganancias, botón de asignación
  // (solo en modo fundador), lista de socios y modales de selección, remoción
  // y perfil individual.
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        color="brand"
        title="Gestión de Socios"
        subtitle="Administra socios y distribución de ganancias"
        icon={Users}
        size="6xl"
        closeOnEsc={!showAdminsModal && !showRemoveConfirm && !showIndividualModal}
        headerExtra={
          isCurrentUserFounder() ? (
            <div className="flex items-center gap-1">
              {founderMode && <LockOpen className="w-4 h-4 text-amber-300" />}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFounderMode();
                }}
                className="p-1 hover:bg-amber-500/20 rounded-full transition-all duration-200"
                title="Activar gestión de socios"
              >
                <Crown className={`w-5 h-5 cursor-pointer transition-colors duration-200 ${
                  founderMode
                    ? 'text-amber-300 drop-shadow-lg'
                    : 'text-amber-400 hover:text-amber-300'
                }`} />
              </button>
            </div>
          ) : null
        }
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-gray-300">
              <p><Lightbulb className="w-4 h-4 inline mr-1" /> Solo el fundador puede asignar subroles de socio</p>
              <p><AlertTriangle className="w-4 h-4 inline mr-1" /> Los porcentajes deben sumar máximo 100%</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        }
      >
        <div className="space-y-4 sm:space-y-6">
            {/* Resumen total */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-amber-300">Porcentaje Asignado</p>
                    <p className="text-lg sm:text-xl font-bold text-amber-400">{totalPorcentaje}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-amber-300">Disponible</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-400">{disponible}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-amber-300">Total Socios</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-400">{socios.length}</p>
                  </div>
                </div>
                {/* Mostrar ganancias o pérdidas */}
                <div className="text-right">
                  <p className="text-xs text-amber-300">
                    {totalProfit >= 0 ? 'Ganancias a Distribuir' : 'Pérdidas a Distribuir'}
                  </p>
                  <p className={`text-lg sm:text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency ? formatCurrency(totalProfit) : `$${totalProfit.toLocaleString()}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Botón Agregar Socio - Solo aparece cuando se hace clic en la corona */}
            {canManageSocios() && (
              <button
                onClick={() => setShowAdminsModal(true)}
                className={`mt-4 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  disponible > 0 
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400' 
                    : 'bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-400'
                }`}
                disabled={disponible <= 0}
                title={disponible <= 0 ? `No hay porcentaje disponible (${disponible}% restante)` : 'Asignar subrol de socio'}
              >
                <UserPlus className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {disponible > 0 ? 'Asignar Subrol de Socio' : `Sin porcentaje (${disponible}%)`}
                </span>
              </button>
            )}

          {/* Contenido scrolleable */}
            
            {/* Lista de Socios */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <ListSkeleton rows={3} />
                  <p className="text-gray-400 mt-2">Cargando socios...</p>
                </div>
              </div>
            ) : socios.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400 mb-2">No hay socios registrados</h3>
                <p className="text-gray-500">Asigna subroles de socio a usuarios admin</p>
              </div>
            ) : (
              <div className="space-y-3">
                {socios.map((socio) => (
                  <div 
                    key={socio._id || socio.id} 
                    className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-200"
                    onClick={() => handleSocioCardClick(socio)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h4 className="font-medium text-brand-200">{socio.nombre}</h4>
                          {renderSocioBadge(socio)}
                        </div>
                        <p className="text-sm text-gray-300">{socio.email}</p>
                        {socio.telefono && (
                          <p className="text-sm text-gray-400"><Phone className="w-4 h-4 inline mr-1" /> {socio.telefono}</p>
                        )}
                        {socio.notas && (
                          <p className="text-sm text-gray-400 mt-1"><FileText className="w-4 h-4 inline mr-1" /> {socio.notas}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Porcentaje editable */}
                        <div className="text-center">
                          {editingId === socio._id ? (
                            <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                defaultValue={socio.porcentaje}
                                id={`porcentaje-${socio._id}`}
                                className="w-16 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-amber-100 text-sm placeholder-amber-300/50 focus:border-amber-400 focus:bg-amber-500/30 transition-all duration-200"
                                placeholder="0-100"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    updatePorcentaje(socio._id, parseFloat(e.target.value));
                                  }
                                }}
                              />
                              <span className="text-xs text-amber-300">%</span>
                              <button
                                onClick={(e) => {
                                  // Confirma el porcentaje escrito en el input de edición.
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const input = document.getElementById(`porcentaje-${socio._id}`);
                                  if (input && input.value !== '') {
                                    updatePorcentaje(socio._id, parseFloat(input.value));
                                  } else {
                                    toast.error('Ingrese un valor válido para el porcentaje');
                                  }
                                }}
                                className="p-1 text-emerald-400 hover:bg-emerald-400/20 rounded transition-colors duration-200"
                                title="Guardar cambios"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingId(null);
                                }}
                                className="p-1 text-red-400 hover:bg-red-400/20 rounded transition-colors duration-200"
                                title="Cancelar edición"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-amber-300">Porcentaje</p>
                              <p className="text-lg font-bold text-amber-400">{socio.porcentaje}%</p>
                              {canManageSocios() && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canManageSocios()) {
                                      setEditingId(socio._id);
                                    } else {
                                      toast.error('Active el modo fundador para editar porcentajes');
                                    }
                                  }}
                                  className="text-xs text-amber-400 hover:text-amber-300 mt-1 transition-colors duration-200"
                                >
                                  <Edit className="w-3 h-3 inline mr-1" />
                                  Editar
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Ganancia/Pérdida estimada */}
                        <div className="text-center">
                          <p className="text-xs text-gray-300">
                            {totalProfit >= 0 ? 'Ganancia' : 'Pérdida'}
                          </p>
                          <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency ? 
                              formatCurrency((totalProfit * socio.porcentaje) / 100) : 
                              `$${((totalProfit * socio.porcentaje) / 100).toLocaleString()}`
                            }
                          </p>
                        </div>

                        {/* Acciones - Solo en modo fundador activo */}
                        <div className="flex flex-col gap-1">
                          {socio.tipoSocio !== 'fundador' && canManageSocios() && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRemoveConfirm(socio._id);
                              }}
                              className="p-2 text-red-400 hover:bg-red-400/20 rounded transition-colors"
                              title="Quitar subrol de socio"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}


          </div>
      </Modal>

      {/* Modal de selección de admins - Solo en modo fundador activo */}
      <Modal
        isOpen={showAdminsModal && canManageSocios()}
        onClose={() => {
          setShowAdminsModal(false);
          setSelectedAdmin(null);
          setNewSocio({ porcentaje: 50, notas: '' });
        }}
        color="brand"
        title="Seleccionar Admin para Socio"
        subtitle="Elige un admin para asignar subrol de socio"
        icon={Users}
        size="2xl"
        zIndex="top"
        footer={selectedAdmin ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <Crown className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h4 className="font-medium text-brand-200">
                  Configurar a {selectedAdmin.name} como Socio
                </h4>
                <p className="text-xs text-amber-300">
                  Define el porcentaje y notas adicionales
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Porcentaje de propiedad
                </label>
                <input
                  type="number"
                  min="1"
                  max={disponible}
                  value={newSocio.porcentaje}
                  onChange={(e) => setNewSocio({ ...newSocio, porcentaje: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  placeholder="50"
                />
                <p className="text-xs text-amber-300 mt-1">Disponible: {disponible}%</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={newSocio.notas}
                  onChange={(e) => setNewSocio({ ...newSocio, notas: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  rows="2"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => {
                  setShowAdminsModal(false);
                  setSelectedAdmin(null);
                  setNewSocio({ porcentaje: 50, notas: '' });
                }}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (!loading && selectedAdmin?._id) {
                    asignarSocio(selectedAdmin._id);
                  }
                }}
                disabled={loading || !newSocio.porcentaje || newSocio.porcentaje <= 0}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Skeleton className="h-4 w-4 rounded-full" />
                    Asignando...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Asignar Subrol
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      >
                  {adminsDisponibles.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-400 mb-2">No hay admins disponibles</h3>
                      <p className="text-gray-500">Todos los admins ya son socios</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminsDisponibles.map(admin => (
                        <div 
                          key={admin._id} 
                          className={`bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 transition-all ${
                            selectedAdmin?._id === admin._id 
                              ? 'ring-2 ring-amber-500/40 bg-amber-500/10' 
                              : 'hover:bg-amber-500/10'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                              </div>
                              <div className="flex-1">
                                <h5 className="font-medium text-brand-200">{admin.name}</h5>
                                <p className="text-sm text-gray-300">{admin.email}</p>
                                <div className="mt-1">
                                  <span className="px-2 py-1 text-xs font-medium rounded bg-blue-400/20 text-blue-400 border border-blue-400/30">
                                    Admin
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                selectAdmin(admin);
                              }}
                              disabled={loading}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                                selectedAdmin?._id === admin._id
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                              }`}
                            >
                              {selectedAdmin?._id === admin._id ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span className="text-sm">Seleccionado</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  <span className="text-sm">Seleccionar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
      </Modal>

      {/* Modal de confirmación para remover socio */}
      <Modal
        isOpen={!!showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(null)}
        color="red"
        title="Quitar Subrol de Socio"
        subtitle="El usuario volverá a ser un admin normal"
        icon={UserMinus}
        size="md"
        zIndex="top"
        footer={
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <button
              onClick={() => setShowRemoveConfirm(null)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleRemoveSocio(showRemoveConfirm)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              Quitar Subrol
            </button>
          </div>
        }
      >
        <p className="text-gray-300 text-sm">
          ¿Estás seguro de que deseas quitar el subrol de socio? El usuario volverá a ser un admin normal.
        </p>
      </Modal>

      {/* Modal Individual de Socio */}
      {showIndividualModal && selectedSocio && (
        <IndividualSocioModal
          isOpen={showIndividualModal}
          onClose={() => {
            setShowIndividualModal(false);
            setSelectedSocio(null);
          }}
          socio={selectedSocio}
          totalProfit={totalProfit}
          formatCurrency={formatCurrency}
          currentUser={currentUser || authUser}
          isFounder={isCurrentUserFounder()}
          onUpdate={fetchSocios}
        />
      )}
    </>
  );
};

// Componente Modal Individual para cada socio
// Submodal con el perfil de un socio: muestra su porcentaje y ganancia y
// permite editar teléfono y notas; el fundador también puede editar el porcentaje.
const IndividualSocioModal = ({ 
  isOpen, 
  onClose, 
  socio, 
  totalProfit, 
  formatCurrency, 
  currentUser,
  isFounder,
  onUpdate 
}) => {
  // Datos editables del socio copiados desde el registro seleccionado.
  const [editableData, setEditableData] = useState({
    nombre: socio.nombre || '',
    email: socio.email || '',
    telefono: socio.telefono || '',
    notas: socio.notas || '',
    porcentaje: socio.porcentaje || 0
  });
  const [loading, setLoading] = useState(false);

  // Guarda teléfono y notas (y porcentaje si es fundador) y refresca la
  // lista de socios del modal padre.
  const handleSave = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      // Solo enviar campos editables (excluir nombre y email)
      const datosActualizacion = {
        telefono: editableData.telefono,
        notas: editableData.notas
      };

      // Solo el fundador puede cambiar porcentajes
      if (isFounder && editableData.porcentaje !== socio.porcentaje) {
        datosActualizacion.porcentaje = editableData.porcentaje;
      }

      await sociosService.update(socio._id, datosActualizacion);
      toast.success('Datos del socio actualizados correctamente');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error actualizando socio:', error);
      toast.error('Error actualizando los datos del socio');
    } finally {
      setLoading(false);
    }
  };

  // Puede editar el propio socio o el fundador.
  const canEdit = () => {
    const currentUserId = currentUser?._id || currentUser?.id;
    
    // Obtener el ID del usuario del socio (puede ser un objeto populated o un string)
    let socioUserId;
    if (typeof socio.userId === 'object' && socio.userId !== null) {
      socioUserId = socio.userId._id || socio.userId.id;
    } else {
      socioUserId = socio.userId;
    }

    return currentUserId === socioUserId || isFounder;
  };

  // Ganancia o pérdida estimada del socio según el resultado total.
  const gananciaPersonal = (totalProfit * socio.porcentaje) / 100;

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: estadísticas, aviso informativo y campos editables del socio.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="brand"
      title="Perfil de Socio"
      subtitle={canEdit() ? 'Editar información personal' : 'Ver información personal'}
      icon={User}
      size="lg"
      zIndex="top"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          {canEdit() && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Skeleton className="h-4 w-4 rounded-full" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar
                </>
              )}
            </button>
          )}
        </div>
      }
    >
            {/* Estadísticas */}
            <div className="grid grid-cols-2 gap-4 p-3 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4 sm:mb-6">
              <div className="text-center">
                <p className="text-xs text-amber-300">Porcentaje</p>
                <p className="text-lg sm:text-xl font-bold text-amber-400">{socio.porcentaje}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-300">
                  {totalProfit >= 0 ? 'Ganancia' : 'Pérdida'}
                </p>
                <p className={`text-lg sm:text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency ? formatCurrency(gananciaPersonal) : `$${gananciaPersonal.toLocaleString()}`}
                </p>
              </div>
            </div>

            {/* Nota informativa */}
            {canEdit() && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
                <p className="text-xs text-blue-300">
                  <FileText className="w-4 h-4 inline mr-1" /> Puedes editar tu teléfono y notas desde aquí. 
                  {isFounder && ' Como fundador, también puedes ajustar porcentajes.'}
                </p>
              </div>
            )}

            {/* Campos editables */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre
                  <span className="text-xs text-gray-400 ml-2">(Solo editable desde "Editar Perfil")</span>
                </label>
                <input
                  type="text"
                  value={editableData.nombre}
                  disabled={true}
                  className="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/20 rounded-lg text-gray-300 cursor-not-allowed opacity-75"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                  <span className="text-xs text-gray-400 ml-2">(Solo editable desde "Editar Perfil")</span>
                </label>
                <input
                  type="email"
                  value={editableData.email}
                  disabled={true}
                  className="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/20 rounded-lg text-gray-300 cursor-not-allowed opacity-75"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={editableData.telefono}
                  onChange={(e) => setEditableData(prev => ({ ...prev, telefono: e.target.value }))}
                  disabled={!canEdit()}
                  className="w-full px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-white placeholder-gray-400 focus:border-amber-400 focus:bg-amber-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={editableData.notas}
                  onChange={(e) => setEditableData(prev => ({ ...prev, notas: e.target.value }))}
                  disabled={!canEdit()}
                  rows={3}
                  className="w-full px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-white placeholder-gray-400 focus:border-amber-400 focus:bg-amber-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {isFounder && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Porcentaje (Solo Fundador)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editableData.porcentaje}
                    onChange={(e) => setEditableData(prev => ({ ...prev, porcentaje: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-white placeholder-gray-400 focus:border-amber-400 focus:bg-amber-500/20 transition-all duration-200"
                  />
                </div>
              )}
            </div>
    </Modal>
  );
};

export default SociosModal;