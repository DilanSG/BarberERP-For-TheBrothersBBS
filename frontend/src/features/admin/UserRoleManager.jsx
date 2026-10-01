import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useTheme } from '@contexts/ThemeContext';
import { useNotification } from '@contexts/NotificationContext';
import { PageContainer } from '@components/layout/PageContainer';
import GradientText from '@components/ui/GradientText';
import UserAvatar from '@components/ui/UserAvatar';
import Modal from '@components/ui/Modal';
import { api } from '@services/api';
import { AlertTriangle, Users, Search, Filter, Shield, User, Scissors, UserX, Trash2, X, Mail } from 'lucide-react';
import { UserRoleManagerSkeleton } from '@components/ui/Skeleton';

// Gestión de usuarios para administradores.
// Carga la lista de usuarios, la enriquece con información de socios, permite
// buscar/filtrar por rol y cambiar rol, desactivar o eliminar usuarios.
import logger from '@utils/logger';
function UserRoleManager() {
  const { isLight } = useTheme();
  const { user, token } = useAuth();
  const { showSuccess, showError } = useNotification();
  // Lista de usuarios enriquecida (rol, socio, fundador) y estados de los modales
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToDeactivate, setUserToDeactivate] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // all | admin | barber | user | socio

  // Carga usuarios y socios: cruza ambas fuentes, marca isSocio/fundador y
  // ordena por jerarquía (fundadores, admins/socios, barberos, clientes).
  const fetchUsers = async () => {
    if (user?.role === 'admin') {
      try {
        setLoading(true);
        // Obtener usuarios activos solamente
        const usersData = await api.get('/users');
        
        // Obtener socios para identificar quien es socio (con manejo de errores)
        // Si /socios falla, la lista se muestra igual sin la marca de socio
        let sociosData = { success: false, data: [] };
        try {
          sociosData = await api.get('/socios');
        } catch (sociosError) {
          console.warn('Error obteniendo socios, continuando sin información de socios:', sociosError);
        }

        // Validar que la respuesta de usuarios sea exitosa
        if (!usersData.success || !Array.isArray(usersData.data)) {
          throw new Error('Respuesta de usuarios inválida');
        }

        // Validar respuesta de socios y guardar datos seguros
        let sociosArray = [];
        if (sociosData.success && sociosData.data && Array.isArray(sociosData.data.socios)) {
          sociosArray = sociosData.data.socios;
        } else {
          console.warn('Respuesta de socios inválida o vacía:', sociosData);
        }

        // Enriquecer usuarios con información de socios
        const enrichedUsers = usersData.data.map(user => {
          const socio = sociosArray.length > 0 ? 
            sociosArray.find(s => {
              // Los socios vienen poblados con userId como objeto
              const socioUserId = s.userId?._id || s.userId;
              return socioUserId === user._id;
            }) : null;
          
          const enrichedUser = {
            ...user,
            isSocio: !!socio,
            tipoSocio: socio?.tipoSocio || null,
            porcentajeSocio: socio?.porcentaje || 0,
            isFounder: socio?.tipoSocio === 'fundador'
          };
          
          return enrichedUser;
        });

        // Ordenar usuarios por importancia
        // 1) fundadores 2) admins (socios primero) 3) barberos 4) clientes
        const sortedUsers = enrichedUsers.sort((a, b) => {
          // Fundadores primero
          if (a.isFounder && !b.isFounder) return -1;
          if (!a.isFounder && b.isFounder) return 1;
          
          // Luego admins
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          
          // Dentro de admins, socios primero
          if (a.role === 'admin' && b.role === 'admin') {
            if (a.isSocio && !b.isSocio) return -1;
            if (!a.isSocio && b.isSocio) return 1;
          }
          
          // Luego barberos
          if (a.role === 'barber' && b.role !== 'barber') return -1;
          if (a.role !== 'barber' && b.role === 'barber') return 1;
          
          // Finalmente usuarios regulares
          return 0;
        });


        
        setUsers(sortedUsers);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showError('Error al cargar la lista de usuarios');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user, token]);

  // Refresca la caché de barberos (sin caché) y devuelve solo los activos
  const refreshBarbers = async () => {
    try {
      // Forzar actualización de la cache de barberos
      const data = await api.get('/barbers', false); // false = no usar caché
      
      // Validar que la respuesta sea exitosa y tenga datos
      if (!data.success || !Array.isArray(data.data)) {
        console.warn('Respuesta de barberos inválida en refresh:', data);
        return [];
      }
      
      // Filtrar solo barberos activos que realmente son barberos
      const activeBarbers = data.data.filter(barber => 
        barber.user && 
        barber.user.role === 'barber' && 
        barber.user.isActive && 
        barber.isActive
      );
      return activeBarbers;
    } catch (error) {
      console.error('Error al refrescar barberos:', error);
    }
  };

  // Cambia el rol del usuario; si pasa a barbero asegura su perfil y refresca
  // la caché de barberos antes de recargar la lista completa.
  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });

      // Si el nuevo rol es 'barber', asegurar que el perfil esté activo
      if (newRole === 'barber') {
        // Llama a la API que fuerza la creación/activación del perfil
        await api.get(`/barbers/by-user/${userId}`);
        // Espera un poco para asegurar que el backend procese el cambio
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refreshBarbers();
      }

      // Recargar la lista completa de usuarios para tener el estado más actualizado
      await fetchUsers();
      showSuccess('Rol actualizado correctamente');
    } catch (err) {
      console.error('Error al cambiar rol:', err);
      showError(err.message || 'Error al cambiar el rol del usuario');
    }
  };

  // Abre el modal de confirmación de eliminación permanente (hard delete)
  const handleDeleteUser = async (userId) => {
    const userToDelete = users.find(u => u._id === userId);
    setUserToDelete(userToDelete);
    setShowDeleteModal(true);
  };

  // Abre el modal de confirmación de desactivación (soft delete)
  const handleDeactivateUser = async (userId) => {
    const userToDeactivate = users.find(u => u._id === userId);
    setUserToDeactivate(userToDeactivate);
    setShowDeactivateModal(true);
  };

  // Confirma y ejecuta la eliminación permanente; recarga la lista al finalizar
  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete._id}`);
      
      // Refrescar la lista completa de usuarios desde el servidor
      // esto asegura que no aparezcan usuarios desactivados
      await fetchUsers();
      showSuccess('Usuario eliminado permanentemente');
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      showError(err.message || 'Error al eliminar el usuario');
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  // Confirma y ejecuta la desactivación; el usuario deja de poder iniciar sesión
  const confirmDeactivate = async () => {
    if (!userToDeactivate) return;

    try {
      await api.patch(`/users/${userToDeactivate._id}/deactivate`);
      
      // Refrescar la lista completa de usuarios desde el servidor
      await fetchUsers();
      showSuccess('Usuario desactivado correctamente. Ya no puede acceder al sistema.');
    } catch (err) {
      console.error('Error al desactivar usuario:', err);
      showError(err.message || 'Error al desactivar el usuario');
    } finally {
      setShowDeactivateModal(false);
      setUserToDeactivate(null);
    }
  };

  // Función para renderizar badges de usuario
  // Genera el badge de rol y, si aplica, el de socio o fundador (con su porcentaje)
  const renderUserBadges = (user) => {
    const badges = [];
    
    // Badge de rol principal siempre se muestra
    if (user.role === 'admin') {
      badges.push({
        text: 'Admin',
        title: 'Administrador',
        className: 'bg-gradient-to-r from-blue-500/30 to-blue-600/30 text-blue-300 border border-blue-500/40 shadow-lg shadow-soft'
      });
    } else if (user.role === 'barber') {
      badges.push({
        text: 'Barbero',
        title: 'Barbero',
        className: 'bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-soft'
      });
    } else {
      badges.push({
        text: 'Usuario',
        title: 'Usuario Regular',
        className: 'bg-gradient-to-r from-gray-500/30 to-gray-600/30 text-gray-300 border border-gray-500/40'
      });
    }
    
    // Badge de socio (si aplica)
    if (user.isSocio) {
      if (user.isFounder) {
        // Badge especial para fundador
        badges.push({
          text: 'FS',
          title: `Socio Fundador (${user.porcentajeSocio}%)`,
          className: 'bg-gradient-to-r from-amber-400/30 to-amber-500/30 text-amber-300 border border-amber-400/40 shadow-lg shadow-soft'
        });
      } else {
        // Badge normal para socio
        badges.push({
          text: 'S',
          title: `Socio (${user.porcentajeSocio}%)`,
          className: 'bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/20'
        });
      }
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {badges.map((badge, index) => (
          <span
            key={index}
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold backdrop-blur-sm ${badge.className}`}
            title={badge.title}
          >
            {badge.text}
          </span>
        ))}
      </div>
    );
  };

  // Usuarios filtrados por búsqueda y rol
  // El filtro "socio" es especial: compara isSocio en vez de role
  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return users.filter(u => {
      const matchesSearch = !search ||
        u.name?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search);
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'socio' ? u.isSocio : u.role === roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  // Indica si hay algún filtro activo (para mostrar el botón de limpiar)
  const hasActiveFilters = searchTerm.trim() !== '' || roleFilter !== 'all';

  // Solo administradores pueden gestionar roles
  if (user?.role !== 'admin') return null;

  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">
        {/* ── Top Bar (siempre visible) ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 bg-gradient-to-r from-blue-600/20 to-brand-500/20 rounded-xl border border-blue-500/20 shadow-lg shadow-soft">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div>
              <GradientText className="text-lg sm:text-xl lg:text-2xl font-bold">
                Gestión de Usuarios
              </GradientText>
              <p className="text-gray-400 text-xs sm:text-sm hidden sm:block">
                Administra los roles, permisos y jerarquía de la plataforma
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glassmorphism-input pl-10 w-full"
              />
            </div>
            <div className="relative sm:w-48">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="glassmorphism-select pl-10 w-full"
              >
                <option value="all">Todos los roles</option>
                <option value="admin">Administradores</option>
                <option value="barber">Barberos</option>
                <option value="user">Clientes</option>
                <option value="socio">Socios</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <UserRoleManagerSkeleton />
        ) : (
          <>
            {/* ── Stats Strip ── */}
            {/* Contadores por rol calculados sobre la lista completa de usuarios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/25 flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-white leading-tight">{users.length}</p>
                  <p className="text-gray-400 text-xs truncate">Total Usuarios</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/25 flex-shrink-0">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-white leading-tight">{users.filter(u => u.role === 'admin').length}</p>
                  <p className="text-gray-400 text-xs truncate">Administradores</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex-shrink-0">
                  <Scissors className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-white leading-tight">{users.filter(u => u.role === 'barber').length}</p>
                  <p className="text-gray-400 text-xs truncate">Barberos</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-gray-500/15 border border-gray-500/25 flex-shrink-0">
                  <User className="w-5 h-5 text-gray-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-white leading-tight">{users.filter(u => u.role === 'user').length}</p>
                  <p className="text-gray-400 text-xs truncate">Clientes</p>
                </div>
              </div>
            </div>

            {/* ── Filter pills ── */}
            {/* Atajos de filtro por rol con contador; incluye "Socios" (isSocio) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap sm:flex-wrap sm:overflow-visible sm:pb-0">
              {[
                { key: 'all', label: 'Todos', count: users.length },
                { key: 'admin', label: 'Admins', count: users.filter(u => u.role === 'admin').length },
                { key: 'barber', label: 'Barberos', count: users.filter(u => u.role === 'barber').length },
                { key: 'user', label: 'Clientes', count: users.filter(u => u.role === 'user').length },
                { key: 'socio', label: 'Socios', count: users.filter(u => u.isSocio).length }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setRoleFilter(key)}
                  className={`inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors duration-200 ${
                    roleFilter === key
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/25'
                  }`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                    roleFilter === key ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-gray-400'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('all');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* ── Tabla / Cards ── */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                <Search className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-300 mb-1">Sin resultados</h3>
                <p className="text-gray-500 text-sm">Ningún usuario coincide con los filtros aplicados</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm shadow-soft overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-gradient-to-r from-white/10 to-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-400">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Usuario
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-400">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-400">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Rol
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-red-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map(u => (
                    <tr key={u._id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} size="md" />
                          <div>
                            <p className="text-base font-medium text-white">
                              {u.name || u.email}
                            </p>
                            {u.isSocio && (
                              <p className="text-xs text-amber-400">
                                Participación: {u.porcentajeSocio}%
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-300">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderUserBadges(u)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-3">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u._id, e.target.value)}
                            disabled={u.isFounder}
                            className={`block px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm shadow-soft ${
                              u.isFounder 
                                ? 'bg-amber-500/10 border-amber-500/30 cursor-not-allowed opacity-60 text-amber-300' 
                                : 'bg-gray-800/80 border-white/20 text-white'
                            }`}
                            style={{ 
                              backgroundColor: u.isFounder
                                ? 'rgba(234, 179, 8, 0.1)'
                                : (isLight ? 'rgba(255,255,255,0.65)' : 'rgba(31, 41, 55, 0.8)'),
                              color: u.isFounder
                                ? (isLight ? '#b45309' : '#fcd34d')
                                : (isLight ? '#1f2329' : '#ffffff')
                            }}
                            title={u.isFounder ? 'No se puede cambiar el rol del socio fundador' : ''}
                          >
                            <option value="user" style={{ backgroundColor: isLight ? '#ffffff' : '#1f2937', color: isLight ? '#1f2329' : '#ffffff' }}>Usuario Regular</option>
                            <option value="barber" style={{ backgroundColor: isLight ? '#ffffff' : '#1f2937', color: isLight ? '#1f2329' : '#ffffff' }}>Barbero</option>
                            <option value="admin" style={{ backgroundColor: isLight ? '#ffffff' : '#1f2937', color: isLight ? '#1f2329' : '#ffffff' }}>Administrador</option>
                          </select>
                          
                          {/* Acciones destructivas: no disponibles para uno mismo, fundadores ni admins */}
                          {u._id !== (user._id || user.id) && !u.isFounder && u.role !== 'admin' && (
                            <>
                              <button
                                onClick={() => handleDeactivateUser(u._id)}
                                className="inline-flex items-center justify-center w-9 h-9 border border-amber-500/30 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors duration-200"
                                title="Desactivar usuario (soft delete - conserva datos)"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u._id)}
                                className="inline-flex items-center justify-center w-9 h-9 border border-red-500/30 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors duration-200"
                                title="Eliminar permanentemente (hard delete - elimina todos los datos)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Layout - Card Style */}
            <div className="block md:hidden space-y-4 p-4">
              {filteredUsers.map(u => (
                <div key={u._id} className={`p-6 rounded-xl border transition-all duration-200 hover:shadow-xl ${
                  u.isFounder ? 'bg-gradient-to-r from-amber-400/10 to-amber-500/10 border-amber-400/20 hover:shadow-soft' :
                  u.role === 'admin' ? 'bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-500/20 hover:shadow-soft' :
                  u.role === 'barber' ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border-emerald-500/20 hover:shadow-soft' :
                  'bg-white/5 border-white/10 hover:shadow-soft'
                } backdrop-blur-sm`}>
                  {/* User Info */}
                  <div className="flex items-start gap-4 mb-4">
                    <UserAvatar user={u} size="lg" />
                    <div className="flex-1 min-w-0">
                      <GradientText className="text-lg font-semibold truncate">
                        {u.name || u.email}
                      </GradientText>
                      <p className="text-sm text-gray-400 truncate">{u.email}</p>
                      {u.isSocio && (
                        <p className="text-xs text-amber-400 mt-1">
                          Participación: {u.porcentajeSocio}%
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="mb-4">
                    {renderUserBadges(u)}
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <div>
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">
                        Cambiar Rol
                      </label>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u._id, e.target.value)}
                        disabled={u.isFounder}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm shadow-soft ${
                          u.isFounder 
                            ? 'bg-amber-500/10 border-amber-500/30 cursor-not-allowed opacity-60 text-amber-300' 
                            : 'bg-gray-800/80 border-white/20 text-white'
                        }`}
                        style={{ 
                          backgroundColor: u.isFounder
                            ? 'rgba(234, 179, 8, 0.1)'
                            : (isLight ? 'rgba(255,255,255,0.65)' : 'rgba(31, 41, 55, 0.8)'),
                          color: u.isFounder
                            ? (isLight ? '#b45309' : '#fcd34d')
                            : (isLight ? '#1f2329' : '#ffffff')
                        }}
                      >
                        <option value="user" style={{ backgroundColor: isLight ? '#ffffff' : '#1f2937', color: isLight ? '#1f2329' : '#ffffff' }}>Usuario Regular</option>
                        <option value="barber" style={{ backgroundColor: isLight ? '#ffffff' : '#1f2937', color: isLight ? '#1f2329' : '#ffffff' }}>Barbero</option>
                        <option value="admin" style={{ backgroundColor: isLight ? '#ffffff' : '#1f2937', color: isLight ? '#1f2329' : '#ffffff' }}>Administrador</option>
                      </select>
                    </div>
                    
                    {u._id !== (user._id || user.id) && !u.isFounder && u.role !== 'admin' && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleDeactivateUser(u._id)}
                          className="flex items-center justify-center gap-2 px-4 py-3 border border-amber-500/30 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors duration-200"
                        >
                          <UserX className="w-4 h-4" />
                          <span className="font-medium text-sm">Desactivar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="flex items-center justify-center gap-2 px-4 py-3 border border-red-500/30 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="font-medium text-sm">Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
              </div>
            )}
          </>
        )}

        {/* Modal de confirmación de eliminación */}
        {/* Hard delete: elimina la cuenta y sus datos asociados (irreversible) */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setUserToDelete(null);
          }}
          color="red"
          title="Eliminar Permanentemente"
          subtitle="Esta acción NO se puede deshacer"
          icon={AlertTriangle}
          size="md"
          footer={
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar permanentemente
              </button>
            </div>
          }
        >
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            ¿Estás seguro que deseas <span className="font-bold text-red-400">eliminar permanentemente</span> al usuario{' '}
            <span className="font-semibold text-blue-400">
              {userToDelete?.name || userToDelete?.email}
            </span>?
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">
              <strong>Hard Delete:</strong> Se eliminarán TODOS los datos del usuario:
            </p>
            <ul className="mt-2 text-xs text-red-200 space-y-1 list-disc list-inside">
              <li>Cuenta de usuario</li>
              <li>Perfil de barbero (si aplica)</li>
              <li>Ventas marcadas como canceladas</li>
              <li>Citas marcadas como canceladas</li>
            </ul>
          </div>
        </Modal>

        {/* Modal de confirmación de desactivación */}
        {/* Soft delete: desactiva el acceso conservando todos los datos */}
        <Modal
          isOpen={showDeactivateModal}
          onClose={() => {
            setShowDeactivateModal(false);
            setUserToDeactivate(null);
          }}
          color="red"
          title="Desactivar Usuario"
          subtitle="Se pueden reactivar después"
          icon={UserX}
          size="md"
          footer={
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setUserToDeactivate(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeactivate}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                <UserX className="w-4 h-4" />
                Desactivar usuario
              </button>
            </div>
          }
        >
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            ¿Deseas <span className="font-bold text-red-400">desactivar</span> al usuario{' '}
            <span className="font-semibold text-blue-400">
              {userToDeactivate?.name || userToDeactivate?.email}
            </span>?
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">
              <strong>Soft Delete:</strong> Desactivación reversible:
            </p>
            <ul className="mt-2 text-xs text-red-200 space-y-1 list-disc list-inside">
              <li>El usuario NO podrá iniciar sesión</li>
              <li>Se conservan TODOS sus datos</li>
              <li>Puede ser reactivado en cualquier momento</li>
              <li>Ideal para suspensiones temporales</li>
            </ul>
          </div>
        </Modal>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease;
          }

          @keyframes modal {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-modal {
            animation: modal 0.2s ease-out;
          }
        `}</style>
      </div>
    </PageContainer>
  );
}

export default UserRoleManager;

