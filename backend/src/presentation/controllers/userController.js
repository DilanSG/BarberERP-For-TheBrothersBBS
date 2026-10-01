import { asyncHandler } from '../middleware/index.js';
import { AppError, Barber, logger } from '../../barrel.js';
import UserUseCases from '../../core/application/usecases/UserUseCases.js';
import BarberUseCases from '../../core/application/usecases/BarberUseCases.js';

const barberService = BarberUseCases.getInstance();
const userService = UserUseCases.getInstance();

// @desc    Cambiar rol de usuario
// @route   PUT /api/users/:id/role
// @access  Private/Admin
export const changeUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  
  if (!['user', 'barber', 'admin'].includes(role)) {
    throw new AppError('Rol no válido', 400);
  }

  // Guardar rol anterior para compensación en caso de fallo
  const userBefore = await userService.getUserById(req.params.id);
  const previousRole = userBefore?.role;

  const updatedUser = await userService.updateUser(
    req.params.id,
    { role },
    true // adminAction
  );

  try {
    // Si el usuario es promovido a barbero, crear o reactivar su perfil
    if (role === 'barber') {
      const existingBarber = await Barber.findOne({ user: updatedUser._id });
      
      if (!existingBarber) {
        await userService.createBarberProfile(updatedUser);
      } else if (!existingBarber.isActive) {
        // Reactivar perfil si existe pero está desactivado
        await Barber.findByIdAndUpdate(existingBarber._id, { isActive: true, deactivatedAt: null });
      }
    } else {
      // Si deja de ser barbero, desactivar el perfil
      await userService.deactivateBarberProfile(updatedUser._id);
    }
  } catch (error) {
    // Compensación: revertir el rol si falla la sincronización del perfil de barbero
    logger.error('Error sincronizando perfil de barbero, revirtiendo rol:', error);
    try {
      await userService.updateUser(req.params.id, { role: previousRole }, true);
    } catch (revertError) {
      logger.error('Error crítico revirtiendo rol tras fallo de sincronización:', revertError);
    }
    throw error;
  }

  res.json({ 
    success: true, 
    message: 'Rol actualizado correctamente', 
    data: updatedUser 
  });
});

// @desc    Obtener todos los usuarios
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.getAllUsers();
  
  res.json({
    success: true,
    data: users
  });
});

// @desc    Obtener un usuario por ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = asyncHandler(async (req, res) => {
  // Si no hay ID en params, usar el usuario autenticado
  const userId = req.params.id || req.user._id.toString();
  
  const user = await userService.getUserById(userId);
  
  // Verificar si el usuario solicita sus propios datos o es admin
  if (req.user.id !== userId && req.user.role !== 'admin') {
    throw new AppError('Acceso denegado', 403);
  }

  res.json({
    success: true,
    data: user
  });
});

// @desc    Actualizar usuario
// @route   PUT /api/users/:id
// @access  Private
export const updateUser = asyncHandler(async (req, res) => {
  // Si no hay ID en params, usar el usuario autenticado
  const userId = req.params.id || req.user._id.toString();
  
  const isAdmin = req.user.role === 'admin';
  const isSameUser = req.user._id.toString() === userId;
  
  if (!isAdmin && !isSameUser) {
    throw new AppError('No tienes permiso para actualizar este usuario', 403);
  }

  // Si hay imagen subida, agregar al body
  const updateData = { ...req.body };
  if (req.image) {
    updateData.profilePicture = req.image.url;
  }

  // Obtener rol anterior para detectar cambios de rol
  const previousUser = isAdmin && updateData.role
    ? await userService.getUserById(userId)
    : null;
  const previousRole = previousUser?.role;

  const updatedUser = await userService.updateUser(
    userId,
    updateData,
    isAdmin
  );

  // Sincronizar perfil de barbero cuando cambia el rol (mismo comportamiento que /users/:id/role)
  if (isAdmin && updateData.role && updateData.role !== previousRole) {
    if (updateData.role === 'barber') {
      const existingBarber = await Barber.findOne({ user: updatedUser._id });
      if (!existingBarber) {
        await userService.createBarberProfile(updatedUser);
      } else if (!existingBarber.isActive) {
        await Barber.findByIdAndUpdate(existingBarber._id, { isActive: true, deactivatedAt: null });
      }
    } else if (previousRole === 'barber') {
      await userService.deactivateBarberProfile(updatedUser._id);
    }
  }

  res.json({
    success: true,
    message: 'Usuario actualizado correctamente',
    data: updatedUser
  });
});

// @desc    Desactivar usuario (soft delete)
// @route   PATCH /api/users/:id/deactivate
// @access  Private/Admin
export const deactivateUser = asyncHandler(async (req, res) => {
  // Solo los administradores pueden desactivar usuarios
  if (req.user.role !== 'admin') {
    throw new AppError('Acceso denegado. Se requieren privilegios de administrador', 403);
  }

  // Prevenir que un admin se desactive a sí mismo
  if (req.user.id === req.params.id) {
    throw new AppError('No puedes desactivar tu propia cuenta', 403);
  }

  // Usar desactivación (soft delete)
  const result = await userService.deleteUser(req.params.id);
  
  res.json({
    success: true,
    message: 'Usuario desactivado correctamente. Sus datos se conservan pero no puede acceder al sistema.',
    data: result
  });
});

// @desc    Eliminar usuario permanentemente (hard delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res) => {
  // Solo los administradores pueden eliminar usuarios permanentemente
  if (req.user.role !== 'admin') {
    throw new AppError('Acceso denegado. Se requieren privilegios de administrador', 403);
  }

  // Prevenir que un admin se elimine a sí mismo
  if (req.user.id === req.params.id) {
    throw new AppError('No puedes eliminar tu propia cuenta', 403);
  }

  // Usar eliminación permanente (hard delete)
  const result = await userService.hardDeleteUser(req.params.id);
  
  res.json({
    success: true,
    message: result.message,
    data: result.deletedUser
  });
});

// @desc    Obtener estadísticas de usuarios
// @route   GET /api/users/stats
// @access  Private/Admin
export const getUserStats = asyncHandler(async (req, res) => {
  const stats = await userService.getUserStats();
  
  res.json({
    success: true,
    data: stats
  });
});

// @desc    Actualizar preferencias del usuario
// @route   PUT /api/users/preferences
// @access  Private
export const updateUserPreferences = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { emailNotifications, marketingEmails } = req.body;

  const updatedUser = await userService.updateUser(userId, {
    preferences: {
      emailNotifications,
      marketingEmails
    }
  });

  res.json({
    success: true,
    message: 'Preferencias actualizadas correctamente',
    user: updatedUser
  });
});

// @desc    Cambiar contraseña del usuario
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { currentPassword, newPassword } = req.body;

  const updatedUser = await userService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Contraseña actualizada correctamente'
  });
});

// @desc    Subir foto de perfil
// @route   POST /api/users/upload-profile-picture
// @access  Private
export const uploadProfilePicture = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  // Verificar si se subió un archivo
  if (!req.file) {
    throw new AppError('No se ha seleccionado ningún archivo para subir', 400);
  }

  // Verificar si el middleware de Cloudinary procesó la imagen
  if (!req.image) {
    throw new AppError('Error al procesar la imagen', 500);
  }

  const updatedUser = await userService.updateUser(userId, {
    profilePicture: req.image.url
  });

  res.json({
    success: true,
    message: 'Foto de perfil actualizada correctamente',
    profilePictureUrl: req.image.url,
    user: updatedUser
  });
});

// @desc    Eliminar foto de perfil
// @route   DELETE /api/users/profile-picture
// @access  Private
export const deleteProfilePicture = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  const updatedUser = await userService.updateUser(userId, {
    profilePicture: ''
  });

  res.json({
    success: true,
    message: 'Foto de perfil eliminada correctamente',
    user: updatedUser
  });
});
