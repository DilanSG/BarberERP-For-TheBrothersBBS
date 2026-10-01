import { asyncHandler } from '../middleware/index.js';
import { Socio, User, logger, AppError } from '../../barrel.js';

// Helper to compute badges without Mongoose instance methods
function computeSocioBadges(socio) {
  const badges = [
    { text: 'Admin', color: 'blue', bgColor: 'bg-blue-400/20', textColor: 'text-blue-400', borderColor: 'border-blue-400/30' }
  ];
  if (socio.tipoSocio === 'fundador') {
    badges.push({ text: 'FS', color: 'gold', bgColor: 'bg-yellow-400/20', textColor: 'text-yellow-400', borderColor: 'border-yellow-400/30', description: 'Socio Fundador' });
  } else {
    badges.push({ text: 'S', color: 'gold', bgColor: 'bg-yellow-400/20', textColor: 'text-yellow-400', borderColor: 'border-yellow-400/30', description: 'Socio' });
  }
  return badges;
}

// @desc    Obtener todos los socios activos
// @route   GET /api/socios
// @access  Privado
export const getSocios = asyncHandler(async (req, res) => {
  logger.debug(`Usuario ${req.user.id} obteniendo lista de socios`);
  
  const socios = await Socio.find({ isActive: true })
    .populate('userId', 'name email role')
    .select('-creadoPor -modificadoPor')
    .sort({ tipoSocio: -1, createdAt: 1 })
    .lean();

  // Compute badges without Mongoose instance methods
  const sociosWithBadges = socios.map(socio => ({
    ...socio,
    badges: computeSocioBadges(socio)
  }));

  const totalPorcentaje = await Socio.getTotalPorcentajeAsignado();

  res.status(200).json({
    success: true,
    message: 'Socios obtenidos exitosamente',
    data: {
      socios: sociosWithBadges,
      totalPorcentaje,
      disponible: 100 - totalPorcentaje
    }
  });
});

// @desc    Obtener distribución de ganancias
// @route   GET /api/socios/distribucion
// @access  Privado
export const getDistribucion = asyncHandler(async (req, res) => {
  const { gananciaTotal } = req.query;
  
  if (!gananciaTotal || isNaN(gananciaTotal)) {
    throw new AppError('Debe proporcionar una ganancia total válida', 400);
  }

  logger.debug(`Calculando distribución para ganancia total: ${gananciaTotal}`);
  
  const distribucion = await Socio.calcularDistribucion(parseFloat(gananciaTotal));

  res.status(200).json({
    success: true,
    message: 'Distribución calculada exitosamente',
    data: {
      gananciaTotal: parseFloat(gananciaTotal),
      distribucion
    }
  });
});

// @desc    Obtener admins disponibles para ser socios
// @route   GET /api/socios/admins-disponibles
// @access  Privado (solo fundador)
export const getAdminsDisponibles = asyncHandler(async (req, res) => {
  logger.info(`Usuario ${req.user.id} obteniendo admins disponibles`);

  // Verificar permisos
  const usuarioActual = await Socio.findOne({ userId: req.user.id, isActive: true });
  if (!usuarioActual?.puedeCrearSocios()) {
    throw new AppError('Solo el socio fundador puede ver los admins disponibles', 403);
  }

  // Obtener IDs de usuarios que ya son socios
  const usuariosSocios = await Socio.find({ isActive: true }).select('userId');
  const idsUsuariosSocios = usuariosSocios.map(s => s.userId);

  // Buscar admins que no sean socios
  const adminsDisponibles = await User.find({
    role: 'admin',
    isActive: true,
    _id: { $nin: idsUsuariosSocios }
  }).select('name email');

  res.status(200).json({
    success: true,
    message: 'Admins disponibles obtenidos exitosamente',
    data: adminsDisponibles
  });
});

// @desc    Asignar subrol de socio a un admin
// @route   POST /api/socios
// @access  Privado (solo fundador)
export const asignarSocio = asyncHandler(async (req, res) => {
  const { userId, porcentaje, telefono, notas } = req.body;
  
  logger.info(`Usuario ${req.user.id} asignando subrol de socio a usuario: ${userId}`);

  // Verificar si el usuario actual puede crear socios
  const usuarioActual = await Socio.findOne({ userId: req.user.id, isActive: true });
  if (!usuarioActual?.puedeCrearSocios()) {
    throw new AppError('Solo el socio fundador puede asignar el subrol de socio', 403);
  }

  // Verificar que el usuario existe y es admin
  const usuario = await User.findById(userId);
  if (!usuario || usuario.role !== 'admin') {
    throw new AppError('El usuario debe ser admin para ser socio', 400);
  }

  // Verificar si ya es socio
  const socioExistente = await Socio.findOne({ userId, isActive: true });
  if (socioExistente) {
    throw new AppError('Este admin ya tiene el subrol de socio', 400);
  }

  // Verificar si ya existe un fundador
  const fundadorExistente = await Socio.findOne({ tipoSocio: 'fundador', isActive: true });
  if (!fundadorExistente) {
    throw new AppError('Debe existir un socio fundador antes de asignar socios regulares. Use el script de inicialización.', 400);
  }

  const socio = await Socio.create({
    userId: userId,
    nombre: usuario.name,
    email: usuario.email,
    porcentaje: parseFloat(porcentaje),
    telefono: telefono?.trim(),
    notas: notas?.trim(),
    tipoSocio: 'socio', // Solo socios regulares por API
    creadoPor: req.user.id
  });

  // Populate para obtener datos completos
  await socio.populate('userId', 'name email role');

  logger.info(`Subrol de socio asignado exitosamente a: ${usuario.email} (ID: ${socio._id})`);

  res.status(201).json({
    success: true,
    message: 'Subrol de socio asignado exitosamente',
    data: {
      ...socio.toObject(),
      badges: socio.getBadges()
    }
  });
});

// @desc    Actualizar porcentaje de socio
// @route   PUT /api/socios/:id/porcentaje
// @access  Privado (solo fundador o admin)
export const updatePorcentaje = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { porcentaje } = req.body;

  logger.info(`Usuario ${req.user.id} actualizando porcentaje del socio ${id}`);

  // Verificar permisos
  const usuarioActual = await Socio.findOne({ 
    userId: req.user.id,
    isActive: true 
  });

  if (!usuarioActual?.puedeEditarSocios()) {
    throw new AppError('No tienes permisos para editar socios', 403);
  }

  const socio = await Socio.findById(id);
  if (!socio || !socio.isActive) {
    throw new AppError('Socio no encontrado', 404);
  }

  // Validar nuevo porcentaje
  if (!porcentaje || porcentaje <= 0 || porcentaje > 100) {
    throw new AppError('El porcentaje debe estar entre 0.01 y 100', 400);
  }

  // Calcular si la suma excede 100
  const otrosSocios = await Socio.find({ 
    _id: { $ne: id }, 
    isActive: true 
  });
  const totalOtros = otrosSocios.reduce((sum, s) => sum + s.porcentaje, 0);
  
  if (totalOtros + parseFloat(porcentaje) > 100) {
    throw new AppError(`La suma de porcentajes excedería 100%. Máximo disponible: ${100 - totalOtros}%`, 400);
  }

  socio.porcentaje = parseFloat(porcentaje);
  socio.modificadoPor = req.user.id;
  await socio.save();

  logger.info(`Porcentaje actualizado para socio ${socio.email}: ${porcentaje}%`);

  res.status(200).json({
    success: true,
    message: 'Porcentaje actualizado exitosamente',
    data: socio
  });
});

// @desc    Actualizar datos de socio
// @route   PUT /api/socios/:id
// @access  Privado (el mismo socio o fundador)
export const updateSocio = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, email, telefono, notas, porcentaje } = req.body;

  logger.info(`Usuario ${req.user.id} actualizando datos del socio ${id}`);

  const socio = await Socio.findById(id).populate('userId');
  if (!socio || !socio.isActive) {
    throw new AppError('Socio no encontrado', 404);
  }

  // Verificar permisos - solo el mismo usuario o fundador puede editar
  const usuarioActual = await Socio.findOne({ 
    userId: req.user.id,
    isActive: true 
  });

  const esMismoUsuario = socio.userId._id.toString() === req.user.id;
  const esFundador = usuarioActual?.tipoSocio === 'fundador';

  if (!esMismoUsuario && !esFundador) {
    throw new AppError('Solo puedes editar tu propio perfil de socio o ser fundador', 403);
  }

  // Actualizar datos básicos del socio (excepto nombre y email que solo se editan desde "Editar Perfil")
  // Los campos nombre y email se mantienen sincronizados automáticamente con el User
  if (telefono !== undefined) socio.telefono = telefono;
  if (notas !== undefined) socio.notas = notas;

  // Sincronizar nombre y email desde el User referenciado (por si se actualizó desde Editar Perfil)
  const userActualizado = await User.findById(socio.userId._id).select('name email');
  if (userActualizado) {
    socio.nombre = userActualizado.name;
    socio.email = userActualizado.email;
    logger.info(`Nombre y email sincronizados desde User: ${userActualizado.name} (${userActualizado.email})`);
  }

  // Solo el fundador puede cambiar porcentajes
  if (porcentaje !== undefined && esFundador) {
    if (porcentaje <= 0 || porcentaje > 100) {
      throw new AppError('El porcentaje debe estar entre 0.01 y 100', 400);
    }

    // Calcular si la suma excede 100
    const otrosSocios = await Socio.find({ 
      _id: { $ne: id }, 
      isActive: true 
    });
    const totalOtros = otrosSocios.reduce((sum, s) => sum + s.porcentaje, 0);
    
    if (totalOtros + parseFloat(porcentaje) > 100) {
      throw new AppError(`La suma de porcentajes excedería 100%. Máximo disponible: ${100 - totalOtros}%`, 400);
    }

    socio.porcentaje = parseFloat(porcentaje);
  }

  socio.modificadoPor = req.user.id;
  await socio.save();

  logger.info(`Datos actualizados para socio ${socio.email}`);

  // Devolver datos actualizados con información completa
  const socioActualizado = await Socio.findById(id)
    .populate('userId', 'name email role')
    .select('-creadoPor -modificadoPor');

  res.status(200).json({
    success: true,
    message: 'Datos del socio actualizados exitosamente',
    data: {
      ...socioActualizado.toObject(),
      badges: socioActualizado.getBadges()
    }
  });
});

// @desc    Desactivar socio
// @route   DELETE /api/socios/:id
// @access  Privado (solo fundador)
export const deleteSocio = asyncHandler(async (req, res) => {
  const { id } = req.params;

  logger.info(`Usuario ${req.user.id} intentando eliminar socio ${id}`);

  // Verificar permisos
  const usuarioActual = await Socio.findOne({ 
    userId: req.user.id,
    isActive: true 
  });

  if (!usuarioActual?.puedeCrearSocios()) {
    throw new AppError('Solo el socio fundador puede remover subrol de socio', 403);
  }

  const socio = await Socio.findById(id);
  if (!socio || !socio.isActive) {
    throw new AppError('Socio no encontrado', 404);
  }

  // No permitir eliminar al fundador
  if (socio.tipoSocio === 'fundador') {
    throw new AppError('No se puede remover el subrol del socio fundador', 400);
  }

  socio.isActive = false;
  socio.modificadoPor = req.user.id;
  await socio.save();

  logger.info(`Socio desactivado: ${socio.email} (ID: ${socio._id})`);

  res.status(200).json({
    success: true,
    message: 'Socio eliminado exitosamente',
    data: { id: socio._id, nombre: socio.nombre }
  });
});

// @desc    Obtener estadísticas de socios
// @route   GET /api/socios/estadisticas
// @access  Privado
export const getEstadisticas = asyncHandler(async (req, res) => {
  const totalSocios = await Socio.countDocuments({ isActive: true });
  const totalPorcentaje = await Socio.getTotalPorcentajeAsignado();
  
  const estadisticas = {
    totalSocios,
    totalPorcentaje,
    porcentajeDisponible: 100 - totalPorcentaje,
    hayFundador: !!(await Socio.exists({ tipoSocio: 'fundador', isActive: true })),
    fechaCreacion: null
  };

  // Obtener fecha de creación del primer socio
  const primerSocio = await Socio.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (primerSocio) {
    estadisticas.fechaCreacion = primerSocio.createdAt;
  }

  res.status(200).json({
    success: true,
    message: 'Estadísticas obtenidas exitosamente',
    data: estadisticas
  });
});

// @desc    Obtener información del usuario actual (incluyendo si es socio/fundador)
// @route   GET /api/socios/current-user
// @access  Privado
export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  try {
    // Use req.user from auth middleware (already fetched)
    const user = req.user;

    // Verificar si el usuario es socio
    const socio = await Socio.findOne({ 
      userId: userId, 
      isActive: true 
    }).select('tipoSocio porcentaje')
      .lean();

    const userData = {
      id: user._id,
      nombre: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.role === 'admin',
      // Información de socio (si aplica)
      isSocio: !!socio,
      tipoSocio: socio?.tipoSocio || null,
      isFounder: socio?.tipoSocio === 'fundador',
      porcentaje: socio?.porcentaje || 0,
      badges: socio ? computeSocioBadges(socio) : []
    };

    logger.debug(`Usuario ${userId} obtuvo su información actual: ${socio ? 'Es socio' : 'No es socio'}`);

    res.status(200).json({
      success: true,
      message: 'Información de usuario obtenida exitosamente',
      data: userData
    });
  } catch (error) {
    logger.error(`Error obteniendo información del usuario ${userId}:`, error);
    throw error;
  }
});