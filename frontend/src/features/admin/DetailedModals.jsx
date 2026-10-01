import React, { useEffect } from 'react';
import logger from '@utils/logger';
import Modal from '@components/ui/Modal';
import {
  ShoppingCart, Package, Calendar, AlertTriangle,
  Scissors, Clock, User, FileText, ExternalLink
} from 'lucide-react';
import { 
  SALE_TYPES, 
  SALE_TYPE_LABELS 
} from '@shared/constants/salesConstants';
import { formatCurrency } from '@utils/formatters';

// Helper para formatear fechas sin desfase de timezone
// Si la fecha viene como YYYY-MM-DD se le añade mediodía para evitar saltos de día
const formatDateSafe = (dateString) => {
  if (!dateString) return 'Fecha no disponible';
  
  // Para fechas en formato YYYY-MM-DD, agregarle la hora del mediodía
  // para evitar problemas de timezone
  const dateWithTime = dateString.includes('T') ? dateString : `${dateString}T12:00:00`;
  const date = new Date(dateWithTime);
  
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Modal para detalles de ventas con información detallada por producto y día
export const DetailedSalesModal = ({ isOpen, onClose, salesData, barberName, dateRange, loading, error }) => {
  // ✅ HOOKS SIEMPRE PRIMERO - antes de cualquier early return
  // Logs de depuración para verificar la forma real de salesData (array de días)
  useEffect(() => {
    if (salesData) {
      logger.debug('🔍 MODAL DEBUG - salesData recibida:', salesData);
      logger.debug('🔍 MODAL DEBUG - primer día:', salesData[0]);
      logger.debug('🔍 MODAL DEBUG - estructura esperada vs real:', {
        esperado: 'Array de días con { date, sales[], totalAmount, totalProducts }',
        real: typeof salesData,
        length: salesData?.length,
        firstItem: salesData?.[0]
      });
    }
  }, [salesData]);

  // Early return DESPUÉS de los hooks
  if (!isOpen) return null;

  

  // ✅ Helper para formatear el rango de fechas del modal
  const formatModalDateRange = () => {
    if (!dateRange) return 'Período seleccionado';
    
    // Helper local para formatear fecha YYYY-MM-DD a DD/MM/YYYY
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    if (dateRange.preset === 'all') {
      return 'Todos los registros';
    }
    
    if (dateRange.preset === 'today' && dateRange.startDate) {
      return formatDate(dateRange.startDate);
    }
    
    if (dateRange.preset === 'yesterday' && dateRange.startDate) {
      return formatDate(dateRange.startDate);
    }
    
    if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
      return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
    }
    
    // Fallback cuando no hay fechas disponibles
    return 'Período seleccionado';
  };

  // Totales del período: suma de productos y de montos de todos los días
  const totalAmount = salesData?.reduce((sum, day) => sum + (day.totalAmount || 0), 0) || 0;
  const totalProducts = salesData?.reduce((sum, day) => sum + (day.totalProducts || 0), 0) || 0;

  logger.debug('🔍 MODAL TOTALES CALCULADOS:', {
    totalAmount,
    totalProducts,
    salesDataLength: salesData?.length,
    barberName,
    dateRange
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="emerald"
      title={`Ventas - ${barberName}`}
      subtitle={formatModalDateRange()}
      icon={ShoppingCart}
      size="3xl"
    >
      {/* Resumen total */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-xs text-emerald-300 mb-1">Total productos</p>
          <p className="text-sm sm:text-base font-bold text-white">{totalProducts}</p>
        </div>
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-xs text-emerald-300 mb-1">Total en ventas</p>
          <p className="text-sm sm:text-base font-bold text-emerald-400">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

            {/* Estados: cargando, error, sin datos o listado de ventas por día */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-4"></div>
                <p className="text-gray-400">Cargando detalles de ventas...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            ) : (!salesData || salesData.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <ShoppingCart className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-gray-400">No hay ventas registradas en este período</p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {salesData
                  .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordenar por fecha descendente (más reciente primero)
                  .map((day, dayIndex) => (
                  <div key={dayIndex} className="space-y-3">
                    {/* Encabezado del día */}
                    <div className="flex items-center justify-between py-2 border-b border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-medium text-white">
                          {formatDateSafe(day.date)}
                        </h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-emerald-300">
                          {day.sales?.length || 0} ventas • {day.totalProducts || 0} productos
                        </p>
                        <p className="text-sm font-bold text-emerald-400">
                          {formatCurrency(day.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Ventas del día */}
                    {day.sales?.map((sale, saleIndex) => (
                      <div key={saleIndex} className="ml-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/10 transition-all duration-300">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                            <p className="text-xs text-emerald-300">
                              {new Date(sale.saleDate).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {sale.customerName && (
                              <span className="text-xs text-gray-400">
                                • {sale.customerName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-emerald-400">{formatCurrency(sale.total)}</p>
                          </div>
                        </div>

                        {/* Producto o servicio de la venta */}
                        <div className="flex items-center justify-between py-2 px-3 bg-black/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            {sale.type === SALE_TYPES.PRODUCT ? (
                              <Package size={12} className="text-emerald-400" />
                            ) : (
                              <Scissors size={12} className="text-blue-400" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-white">
                                {sale.product?.name || sale.service?.name || 'Producto/Servicio'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {sale.quantity} x {formatCurrency(sale.unitPrice)}
                                {sale.type === SALE_TYPES.SERVICE && <span className="ml-1 text-blue-300">({SALE_TYPE_LABELS[SALE_TYPES.SERVICE]})</span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-emerald-400">
                              {formatCurrency(sale.total)}
                            </p>
                            {sale.paymentMethod && (
                              <p className="text-xs text-gray-400 capitalize">
                                {sale.paymentMethod}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Notas adicionales */}
                        {sale.notes && (
                          <div className="mt-2 p-2 bg-black/20 rounded-lg">
                            <div className="flex items-start gap-2">
                              <FileText size={12} className="text-gray-400 mt-0.5" />
                              <p className="text-xs text-gray-400">{sale.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
    </Modal>
  );
};

// Modal para detalles de citas completadas
export const DetailedAppointmentsModal = ({ isOpen, onClose, appointmentsData, barberName, dateRange, loading, error }) => {
  // ✅ HOOKS SIEMPRE PRIMERO - antes de cualquier early return
  // Logs de depuración para verificar la forma real de appointmentsData
  useEffect(() => {
    if (appointmentsData) {
      logger.debug('🔍 MODAL CITAS DEBUG - appointmentsData recibida:', appointmentsData);
      logger.debug('🔍 MODAL CITAS DEBUG - primer día:', appointmentsData[0]);
      logger.debug('🔍 MODAL CITAS DEBUG - estructura esperada vs real:', {
        esperado: 'Array de días con { date, appointments[], totalRevenue, totalAppointments }',
        real: typeof appointmentsData,
        length: appointmentsData?.length,
        firstItem: appointmentsData?.[0]
      });
    }
  }, [appointmentsData]);

  // Early return DESPUÉS de los hooks
  if (!isOpen) return null;

  

  // ✅ Helper para formatear el rango de fechas del modal
  const formatModalDateRange = () => {
    if (!dateRange) return 'Período seleccionado';
    
    // Helper local para formatear fecha YYYY-MM-DD a DD/MM/YYYY
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    if (dateRange.preset === 'all') {
      return 'Todos los registros';
    }
    
    if (dateRange.preset === 'today' && dateRange.startDate) {
      return formatDate(dateRange.startDate);
    }
    
    if (dateRange.preset === 'yesterday' && dateRange.startDate) {
      return formatDate(dateRange.startDate);
    }
    
    if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
      return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
    }
    
    // Fallback cuando no hay fechas disponibles
    return 'Período seleccionado';
  };

  // Totales del período: cantidad de citas e ingresos sumando el precio de cada servicio
  const totalAppointments = appointmentsData?.reduce((sum, day) => sum + (day.appointments?.length || 0), 0) || 0;
  const totalRevenue = appointmentsData?.reduce((sum, day) => 
    sum + (day.appointments?.reduce((daySum, apt) => daySum + (apt.service?.price || 0), 0) || 0), 0
  ) || 0;

  logger.debug('🔍 MODAL CITAS TOTALES CALCULADOS:', {
    totalAppointments,
    totalRevenue,
    appointmentsDataLength: appointmentsData?.length,
    barberName,
    dateRange
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title={`Citas Completadas - ${barberName}`}
      subtitle={formatModalDateRange()}
      icon={Calendar}
      size="3xl"
    >
      {/* Resumen de totales */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 mb-4">
        <div className="text-center">
          <p className="text-xs sm:text-sm text-blue-300">Total Citas</p>
          <p className="text-lg sm:text-xl font-bold text-blue-400">{totalAppointments}</p>
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm text-blue-300">Ingresos Generados</p>
          <p className="text-lg sm:text-xl font-bold text-blue-400">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

            {/* Estados: cargando, error, sin datos o listado de citas por día */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="ml-3 text-blue-400">Cargando citas...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            ) : (!appointmentsData || appointmentsData.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                  <Calendar className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-gray-400">No hay citas completadas en este período</p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {appointmentsData
                  .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordenar por fecha descendente (más reciente primero)
                  .map((day, dayIndex) => (
                  <div key={dayIndex} className="space-y-3">
                    {/* Encabezado del día */}
                    <div className="flex items-center justify-between py-2 border-b border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <h4 className="font-medium text-white">
                          {formatDateSafe(day.date)}
                        </h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-blue-300">
                          {day.appointments?.length || 0} citas completadas
                        </p>
                        <p className="text-sm font-bold text-blue-400">
                          {formatCurrency(day.appointments?.reduce((sum, apt) => sum + (apt.service?.price || 0), 0) || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Citas del día */}
                    {day.appointments?.map((appointment, aptIndex) => (
                      <div key={aptIndex} className="ml-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl hover:bg-blue-500/10 transition-all duration-300">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {appointment.clientName}
                              </p>
                              <p className="text-xs text-blue-300">
                                {new Date(appointment.appointmentDate).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-400">
                              {formatCurrency(appointment.service?.price || 0)}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                              <span className="text-xs text-emerald-300">Completada</span>
                            </div>
                          </div>
                        </div>

                        {/* Servicio de la cita */}
                        <div className="flex items-center justify-between py-2 px-3 bg-black/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Scissors size={12} className="text-blue-400" />
                            <div>
                              <p className="text-sm font-medium text-white">
                                {appointment.service?.name || 'Servicio'}
                              </p>
                              <p className="text-xs text-gray-400">
                                Duración: {appointment.service?.duration || 0} min
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-blue-400">
                            {formatCurrency(appointment.service?.price || 0)}
                          </p>
                        </div>

                        {/* Notas adicionales */}
                        {appointment.notes && (
                          <div className="mt-2 p-2 bg-black/20 rounded-lg">
                            <div className="flex items-start gap-2">
                              <FileText size={12} className="text-gray-400 mt-0.5" />
                              <p className="text-xs text-gray-400">{appointment.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
    </Modal>
  );
};

// Modal para detalles de cortes (servicios walk-in) con hora de realización
export const DetailedCutsModal = ({ isOpen, onClose, cutsData, barberName, dateRange, loading, error }) => {
  // ✅ HOOKS SIEMPRE PRIMERO - antes de cualquier early return
  // Early return DESPUÉS de los hooks
  if (!isOpen) return null;

  

  // ✅ Helper para formatear el rango de fechas del modal
  const formatModalDateRange = () => {
    if (!dateRange) return 'Período seleccionado';
    
    // Helper local para formatear fecha YYYY-MM-DD a DD/MM/YYYY
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    if (dateRange.preset === 'all') {
      return 'Todos los registros';
    }
    
    if (dateRange.preset === 'today' && dateRange.startDate) {
      return formatDate(dateRange.startDate);
    }
    
    if (dateRange.preset === 'yesterday' && dateRange.startDate) {
      return formatDate(dateRange.startDate);
    }
    
    if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
      return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
    }
    
    // Fallback cuando no hay fechas disponibles
    return 'Período seleccionado';
  };

  // Totales del período: cantidad de cortes e ingresos acumulados
  const totalCuts = cutsData?.reduce((sum, day) => sum + (day.cuts?.length || 0), 0) || 0;
  const totalRevenue = cutsData?.reduce((sum, day) => sum + (day.totalAmount || 0), 0) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="brand"
      title={`Cortes Realizados - ${barberName}`}
      subtitle={formatModalDateRange()}
      icon={Scissors}
      size="3xl"
    >
      {/* Resumen de totales */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-brand-400/10 rounded-xl border border-brand-400/20 mb-4">
        <div className="text-center">
          <p className="text-xs sm:text-sm text-brand-200">Total Cortes</p>
          <p className="text-lg sm:text-xl font-bold text-brand-300">{totalCuts}</p>
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm text-brand-200">Ingresos Generados</p>
          <p className="text-lg sm:text-xl font-bold text-brand-300">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

            {/* Estados: cargando, error, sin datos o listado de cortes por día */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-300"></div>
                <span className="ml-3 text-brand-300">Cargando cortes...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            ) : (!cutsData || cutsData.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-brand-400/10 border border-brand-400/20 mb-4">
                  <Scissors className="w-8 h-8 text-brand-300" />
                </div>
                <p className="text-gray-400">No hay cortes registrados en este período</p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {cutsData
                  .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordenar por fecha descendente (más reciente primero)
                  .map((day, dayIndex) => (
                  <div key={dayIndex} className="space-y-3">
                    {/* Encabezado del día */}
                    <div className="flex items-center justify-between py-2 border-b border-brand-400/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-brand-300" />
                        <h4 className="font-medium text-white">
                          {formatDateSafe(day.date)}
                        </h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-brand-200">
                          {day.cuts?.length || 0} cortes realizados
                        </p>
                        <p className="text-sm font-bold text-brand-300">
                          {formatCurrency(day.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Cortes del día */}
                    {day.cuts?.map((cut, cutIndex) => (
                      <div key={cutIndex} className="ml-4 p-4 bg-brand-400/5 border border-brand-400/20 rounded-xl hover:bg-brand-400/10 transition-all duration-300">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand-300"></div>
                            <div>
                              <p className="text-xs text-brand-200 flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(cut.saleDate).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {cut.customerName && (
                                <p className="text-sm text-white mt-1">
                                  {cut.customerName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm font-bold text-brand-300">
                                {formatCurrency(cut.total)}
                              </p>
                              {cut.paymentMethod && (
                                <p className="text-xs text-gray-400 capitalize">
                                  {cut.paymentMethod}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Servicio del corte */}
                        <div className="flex items-center justify-between py-2 px-3 bg-black/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Scissors size={12} className="text-brand-300" />
                            <div>
                              <p className="text-sm font-medium text-white">
                                {cut.service?.name || 'Corte de Cabello'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {cut.quantity} servicio(s) • {formatCurrency(cut.unitPrice)} c/u
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-brand-300">
                            {formatCurrency(cut.total)}
                          </p>
                        </div>

                        {/* Notas adicionales */}
                        {cut.notes && (
                          <div className="mt-2 p-2 bg-black/20 rounded-lg">
                            <div className="flex items-start gap-2">
                              <FileText size={12} className="text-gray-400 mt-0.5" />
                              <p className="text-xs text-gray-400">{cut.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
    </Modal>
  );
};
