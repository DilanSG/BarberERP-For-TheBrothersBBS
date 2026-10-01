import { asyncHandler } from '../middleware/index.js';
import InventorySnapshotService from '../../core/application/usecases/inventorySnapshotService.js';
import { logger } from '../../barrel.js';

export const createSnapshot = asyncHandler(async (req, res) => {
  logger.info('Solicitud para crear snapshot de inventario', { 
    userId: req.user.id,
    body: req.body 
  });

  const snapshot = await InventorySnapshotService.createSnapshot(req.body, req.user.id);

  res.status(201).json({
    success: true,
    message: 'Snapshot de inventario creado exitosamente',
    data: snapshot
  });
});

export const getSnapshots = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, startDate, endDate, createdBy } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (createdBy) filters.createdBy = createdBy;

  const result = await InventorySnapshotService.getSnapshots(
    filters,
    parseInt(page),
    parseInt(limit)
  );

  res.json({
    success: true,
    message: 'Snapshots obtenidos exitosamente',
    data: result.snapshots,
    pagination: result.pagination
  });
});

export const getSnapshotById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const snapshot = await InventorySnapshotService.getSnapshotById(id);

  res.json({
    success: true,
    message: 'Snapshot obtenido exitosamente',
    data: snapshot
  });
});

export const deleteSnapshot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await InventorySnapshotService.deleteSnapshot(id);

  res.json({
    success: true,
    message: 'Snapshot eliminado exitosamente'
  });
});

export const getSnapshotStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const dateRange = {};
  if (startDate) dateRange.startDate = startDate;
  if (endDate) dateRange.endDate = endDate;

  const stats = await InventorySnapshotService.getSnapshotStats(dateRange);

  res.json({
    success: true,
    message: 'Estadísticas obtenidas exitosamente',
    data: stats
  });
});

export const downloadSnapshotExcel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  logger.info('Solicitud para descargar snapshot como Excel', { 
    snapshotId: id,
    userId: req.user.id 
  });

  const excelBuffer = await InventorySnapshotService.generateExcel(id);
  const snapshot = await InventorySnapshotService.getSnapshotById(id);
  
  // Formatear fecha para el nombre del archivo
  const formattedDate = new Date(snapshot.date).toLocaleDateString('es-ES').replace(/\//g, '-');
  const filename = `inventario-guardado-${formattedDate}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  res.send(excelBuffer);
});
