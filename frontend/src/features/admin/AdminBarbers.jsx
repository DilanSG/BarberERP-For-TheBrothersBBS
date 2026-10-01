import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, AlertTriangle, Scissors, Package, Calendar,
  ShoppingCart, DollarSign, Clock, Eye, Receipt
} from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { logger } from '@utils/logger';
import { PageContainer } from '@components/layout/PageContainer';
import Modal from '@components/ui/Modal';
import { SimpleDateFilter } from '@components/common/SimpleDateFilter';
import { useBarberStats } from '@hooks/useBarberStats';
import { useDetailedReports } from '@hooks/useDetailedReports';
import { 
  DetailedSalesModal, 
  DetailedCutsModal, 
  DetailedAppointmentsModal 
} from './DetailedModals';
import { Skeleton, AdminBarbersSkeleton } from '@components/ui/Skeleton';
import { formatCurrency } from '@utils/formatters';

// Modal para detalles de ventas
const SalesDetailModal = ({ isOpen, onClose, salesData, barberName, dateRange }) => {
  if (!isOpen) return null;

  //SalesData viene agrupado por día con { date, sales[], totalAmount, totalProducts }
  // Totales del período: suma de productos y de montos de todos los días
  const totalAmount = salesData?.reduce((sum, day) => sum + (day.totalAmount || 0), 0) || 0;
  const totalProducts = salesData?.reduce((sum, day) => sum + (day.totalProducts || 0), 0) || 0;
  
  

  //Helper para formatear el rango de fechas del modal
  const formatModalDateRange = () => {
    if (!dateRange) return 'Período seleccionado';
    
    //Helper local para formatear fecha YYYY-MM-DD a DD/MM/YYYY
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="emerald"
      title={`Ventas - ${barberName}`}
      subtitle={formatModalDateRange()}
      icon={ShoppingCart}
      size="2xl"
    >
      {/* Resumen */}
      <div className="mb-4 p-3 sm:p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-emerald-300">Total Productos</p>
            <p className="text-lg sm:text-xl font-bold text-white">{totalProducts}</p>
          </div>
          <div className="text-center">
            <p className="text-xs sm:text-sm text-emerald-300">Total Ventas</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-400">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

            {!salesData || salesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <ShoppingCart className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-gray-400">No hay ventas registradas en este período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Iterar sobre días, luego sobre sales de cada día */}
                {salesData.map((dayData, dayIndex) => (
                  <div key={`day-${dayData.date || dayIndex}`} className="mb-6">
                    {/* Encabezado del día */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-500/20">
                      <Calendar size={16} className="text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">
                        {new Date(dayData.date).toLocaleDateString('es-ES', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </h4>
                      <span className="ml-auto text-xs text-emerald-300">
                        {dayData.totalProducts} productos - {formatCurrency(dayData.totalAmount)}
                      </span>
                    </div>
                    
                    {/* Ventas del día */}
                    {dayData.sales && dayData.sales.length > 0 ? (
                      dayData.sales.map((sale, saleIndex) => (
                        <div key={`${sale._id || sale.id || saleIndex}`} className="group relative p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/10 transition-all duration-300 mb-2">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Package size={14} className="text-emerald-400" />
                                <h5 className="text-sm font-medium text-white">
                                  Venta #{sale.saleNumber || sale._id?.slice(-6) || saleIndex + 1}
                                </h5>
                                <span className="text-xs text-gray-300">
                                  {new Date(sale.date || sale.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-400">{formatCurrency(sale.total || 0)}</p>
                            </div>
                          </div>
                          
                          {/* Lista de productos en la venta */}
                          {sale.items && sale.items.length > 0 ? (
                            <div className="space-y-2 border-t border-emerald-500/20 pt-3">
                              <p className="text-xs font-medium text-emerald-300 mb-2">Productos vendidos:</p>
                              {sale.items.map((item, itemIndex) => (
                                <div key={itemIndex} className="flex items-center justify-between p-2 bg-emerald-500/5 rounded-lg">
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-white">{item.name || item.productName}</p>
                                    <p className="text-xs text-gray-400">Cantidad: {item.quantity || 1}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-emerald-400">{formatCurrency(item.price || 0)}</p>
                                    <p className="text-xs font-medium text-white">{formatCurrency((item.price || 0) * (item.quantity || 1))}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 ml-4">No hay ventas en este día</p>
                    )}
                  </div>
                ))}
              </div>
            )}
    </Modal>
  );
};

// Modal para detalles de citas
const AppointmentsDetailModal = ({ isOpen, onClose, appointmentsData, barberName, dateRange }) => {
  if (!isOpen) return null;

  // Ingresos totales del período sumando el monto de cada cita
  const totalAmount = appointmentsData?.reduce((sum, apt) => sum + (apt.total || apt.price || 0), 0) || 0;
  

  // Helper para formatear el rango de fechas del modal
  const formatModalDateRange = () => {
    if (!dateRange) return 'Período seleccionado';
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    if (dateRange.preset === 'all') return 'Todos los registros';
    if (dateRange.preset === 'today' && dateRange.startDate) return formatDate(dateRange.startDate);
    if (dateRange.preset === 'yesterday' && dateRange.startDate) return formatDate(dateRange.startDate);
    if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
      return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
    }
    return 'Período seleccionado';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      case 'pending': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      case 'cancelled': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'completed': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'cancelled': return 'Cancelada';
      case 'completed': return 'Completada';
      default: return status || 'Sin estado';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title={`Citas - ${barberName}`}
      subtitle={formatModalDateRange()}
      icon={Clock}
      size="2xl"
    >
      {/* Resumen */}
      <div className="mb-4 p-3 sm:p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-blue-300">Total Citas</p>
            <p className="text-lg sm:text-xl font-bold text-white">{appointmentsData?.length || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-xs sm:text-sm text-blue-300">Ingresos</p>
            <p className="text-lg sm:text-xl font-bold text-blue-400">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

            {!appointmentsData || appointmentsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                  <Clock className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-gray-400">No hay citas registradas en este período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointmentsData.map((appointment, index) => (
                  <div key={`${appointment._id || appointment.id || index}`} className="group relative p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl hover:bg-blue-500/10 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Scissors size={14} className="text-blue-400" />
                          <h4 className="text-sm font-medium text-white">
                            Cita #{appointment.appointmentNumber || appointment._id?.slice(-6) || index + 1}
                          </h4>
                          <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full font-medium">
                            Completada
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 mb-2">
                          <div>Cliente: <span className="text-white">{appointment.clientName || appointment.user?.name || 'Cliente'}</span></div>
                          <div>Fecha: <span className="text-white">
                            {appointment.date ? new Date(appointment.date).toLocaleDateString('es-ES') : 'N/A'}
                          </span></div>
                          <div>Hora: <span className="text-white">
                            {appointment.time || new Date(appointment.date || appointment.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span></div>
                          <div>Duración: <span className="text-white">{appointment.duration || '30'} min</span></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-400">{formatCurrency(appointment.total || appointment.price || 0)}</p>
                      </div>
                    </div>
                    
                    {/* Detalles del servicio agendado */}
                    <div className="border-t border-blue-500/20 pt-3">
                      <div className="flex items-center justify-between p-2 bg-blue-500/5 rounded-lg">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-white">{appointment.service?.name || appointment.serviceName || appointment.service || 'Servicio de barbería'}</p>
                          <p className="text-xs text-gray-400">
                            {appointment.service?.description || 'Servicio completado en el sistema de reservas'}
                          </p>
                          {appointment.notes && (
                            <p className="text-xs text-blue-300 mt-1">Notas: {appointment.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-300">Estado del sistema</p>
                          <p className="text-xs font-medium text-white">Reserva completada</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
    </Modal>
  );
};

// Modal para detalles de cortes
const ServicesDetailModal = ({ isOpen, onClose, servicesData, barberName, dateRange }) => {
  if (!isOpen) return null;

  // Ingresos totales del período sumando el monto de cada corte
  const totalAmount = servicesData?.reduce((sum, cut) => sum + (cut.total || cut.price || 0), 0) || 0;
  

  // Helper para formatear el rango de fechas del modal
  const formatModalDateRange = () => {
    if (!dateRange) return 'Período seleccionado';
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    if (dateRange.preset === 'all') return 'Todos los registros';
    if (dateRange.preset === 'today' && dateRange.startDate) return formatDate(dateRange.startDate);
    if (dateRange.preset === 'yesterday' && dateRange.startDate) return formatDate(dateRange.startDate);
    if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
      return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
    }
    return 'Período seleccionado';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="brand"
      title={`Cortes - ${barberName}`}
      subtitle={formatModalDateRange()}
      icon={Scissors}
      size="2xl"
    >
      {/* Resumen */}
      <div className="mb-4 p-3 sm:p-4 bg-brand-400/10 rounded-xl border border-brand-400/20">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-brand-200">Total Cortes</p>
            <p className="text-lg sm:text-xl font-bold text-white">{servicesData?.length || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-xs sm:text-sm text-brand-200">Ingresos</p>
            <p className="text-lg sm:text-xl font-bold text-brand-300">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

            {!servicesData || servicesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-brand-400/10 border border-brand-400/20 mb-4">
                  <Scissors className="w-8 h-8 text-brand-300" />
                </div>
                <p className="text-gray-400">No hay cortes registrados en este período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {servicesData.map((cut, index) => (
                  <div key={`${cut._id || cut.id || index}`} className="group relative p-4 bg-brand-400/5 border border-brand-400/20 rounded-xl hover:bg-brand-400/10 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Scissors size={14} className="text-brand-300" />
                          <h4 className="text-sm font-medium text-white">
                            Corte #{cut.cutNumber || cut._id?.slice(-6) || index + 1}
                          </h4>
                          <span className="px-2 py-1 text-xs bg-brand-400/20 text-brand-200 rounded-full">
                            {new Date(cut.date || cut.createdAt || cut.saleDate).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 mb-2">
                          <div>Cliente: <span className="text-white">{cut.clientName || cut.user?.name || cut.customerName || 'Cliente'}</span></div>
                          <div>Hora: <span className="text-white">
                            {cut.time || new Date(cut.date || cut.createdAt || cut.saleDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span></div>
                          <div>Tipo de corte: <span className="text-white">{cut.service?.name || cut.serviceName || cut.name || 'Corte clásico'}</span></div>
                          <div>Duración: <span className="text-white">{cut.duration || cut.service?.duration || '30'} min</span></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-brand-300">{formatCurrency(cut.total || cut.price || 0)}</p>
                      </div>
                    </div>
                    
                    {/* Detalles del corte registrado en el carrito */}
                    <div className="border-t border-brand-400/20 pt-3">
                      <div className="flex items-center justify-between p-2 bg-brand-400/5 rounded-lg">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-white">
                            {cut.service?.name || cut.serviceName || cut.name || 'Corte de cabello'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {cut.service?.description || cut.description || 'Corte registrado en el carrito de ventas'}
                          </p>
                          {cut.notes && (
                            <p className="text-xs text-brand-200 mt-1">Notas: {cut.notes}</p>
                          )}
                          {cut.paymentMethod && (
                            <p className="text-xs text-brand-200 mt-1">Pago: {cut.paymentMethod}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-brand-200">En carrito</p>
                          <p className="text-xs font-medium text-white">
                            {new Date(cut.date || cut.createdAt || cut.saleDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
    </Modal>
  );
};

// Card de estadísticas por barbero.
// Header con avatar/nombre, 3 stats clickeables (ventas, citas, cortes)
// y footer con el total de ingresos del período.
const BarberStatsCard = ({
  barber,
  totals,
  isLoading = false,
  onSalesClick,
  onAppointmentsClick,
  onServicesClick,
  formatCurrency,
  navigate,
  onGenerateInvoice
}) => {
  const name = barber.user?.name || barber.name || 'Barbero';
  const email = barber.user?.email || barber.email || 'Sin email';
  const phone = barber.user?.phone || barber.phone;

  // Definición de las 3 métricas clickeables (valor, detalle y acción por tipo)
  const stats = [
    {
      id: 'sales',
      label: 'Ventas',
      detail: `${totals.salesCount} producto${totals.salesCount !== 1 ? 's' : ''}`,
      value: formatCurrency(totals.sales),
      icon: ShoppingCart,
      onClick: () => onSalesClick(barber._id),
      rowClass: 'hover:bg-emerald-500/[0.07]',
      boxClass: 'bg-emerald-500/15 border-emerald-500/25',
      iconClass: 'text-emerald-400',
      valueClass: 'text-emerald-400'
    },
    {
      id: 'appointments',
      label: 'Citas',
      detail: `${totals.appointmentsCount} cita${totals.appointmentsCount !== 1 ? 's' : ''}`,
      value: formatCurrency(totals.appointments),
      icon: Clock,
      onClick: () => onAppointmentsClick(barber._id),
      rowClass: 'hover:bg-blue-500/[0.07]',
      boxClass: 'bg-blue-500/15 border-blue-500/25',
      iconClass: 'text-blue-400',
      valueClass: 'text-blue-400'
    },
    {
      id: 'services',
      label: 'Cortes',
      detail: `${totals.servicesCount} corte${totals.servicesCount !== 1 ? 's' : ''}`,
      value: formatCurrency(totals.services),
      icon: Scissors,
      onClick: () => onServicesClick(barber._id),
      rowClass: 'hover:bg-brand-400/[0.07]',
      boxClass: 'bg-brand-400/15 border-brand-400/25',
      iconClass: 'text-brand-300',
      valueClass: 'text-brand-300'
    }
  ];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-colors duration-300 hover:border-white/[0.16] hover:bg-white/[0.05]">
      {/* ── Header: avatar + datos ── */}
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <button
          onClick={() => navigate(`/barbers/${barber._id}`)}
          className="relative flex-shrink-0 rounded-full transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          title={`Ver perfil público de ${name}`}
        >
          {barber.user?.profilePicture ? (
            <>
              <img
                src={barber.user.profilePicture}
                alt={name}
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/30"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = e.target.parentElement.querySelector('.fallback-avatar');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="fallback-avatar w-12 h-12 rounded-full bg-gradient-to-r from-blue-600/20 to-brand-500/20 border-2 border-blue-500/30 items-center justify-center"
                style={{ display: 'none' }}
              >
                <span className="text-base font-bold text-white">
                  {name[0]?.toUpperCase() || '?'}
                </span>
              </div>
            </>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600/20 to-brand-500/20 border-2 border-blue-500/30 flex items-center justify-center">
              <span className="text-base font-bold text-white">
                {name[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-white truncate" title={name}>{name}</h3>
          <p className="text-xs text-gray-400 truncate" title={email}>{email}</p>
          {phone && <p className="text-xs text-gray-500 truncate">{phone}</p>}
        </div>

        <button
          onClick={() => onGenerateInvoice(barber._id)}
          className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-gray-400 transition-colors duration-200 hover:border-blue-500/30 hover:bg-white/[0.08] hover:text-blue-300"
          title="Generar reporte consolidado del período"
        >
          <Receipt className="w-4 h-4" />
        </button>
      </div>

      {/* ── Stats clickeables ── */}
      {isLoading && !totals ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <Skeleton className="h-3 w-3 rounded-full mx-auto" />
            <p className="text-gray-400 text-sm mt-2">Cargando datos...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 divide-y divide-white/[0.06]">
          {stats.map(({ id, label, detail, value, icon: Icon, onClick, rowClass, boxClass, iconClass, valueClass }) => (
            <button
              key={id}
              onClick={onClick}
              className={`group/stat flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 ${rowClass}`}
            >
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${boxClass}`}>
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-300">{label}</p>
                <p className="text-[11px] text-gray-500 truncate">{detail}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <p className={`text-sm font-bold whitespace-nowrap ${valueClass}`}>{value}</p>
                <Eye className="h-4 w-4 text-gray-500 transition-colors duration-200 group-hover/stat:text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Total del período ── */}
      {!isLoading && (
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-gradient-to-r from-blue-500/[0.08] to-brand-400/[0.08] px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-medium text-gray-300">
            <DollarSign className="h-4 w-4 text-blue-400" />
            Total ingresos
          </span>
          <span className="text-base font-bold text-blue-400">
            {formatCurrency(totals.total)}
          </span>
        </div>
      )}
    </div>
  );
};

// Página principal AdminBarbers.
// Muestra estadísticas por barbero (ventas, citas y cortes) con filtro de
// período, modales de detalle y generación de reporte consolidado en PDF.
const AdminBarbers = () => {
  const { user } = useAuth();
  const { showError, showInfo } = useNotification();
  const navigate = useNavigate();

  // Helper para obtener fecha local en formato YYYY-MM-DD
  // (evita desfases de UTC al construir los filtros de fecha)
  const getTodayLocalDate = () => {
    const now = new Date();
    
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    
    return result;
  };

  // Hook para estadísticas de barberos
  // Expone la lista, las estadísticas por barbero y el filtro aplicado
  const {
    barbers,
    statistics,
    filteredStats,
    loading,
    error,
    filterType,
    filterDate,
    applyFilter,
    getPerformanceStats,
    clearCache,
    loadData
  } = useBarberStats();

  // Hook para reportes detallados
  // Provee los fetchers de ventas, cortes y citas completadas para los modales
  const {
    loading: detailedLoading,
    error: detailedError,
    detailedSales,
    walkInDetails,
    completedAppointments,
    fetchDetailedSales,
    fetchWalkInDetails,
    fetchDetailedCuts,
    fetchCompletedAppointments,
    fetchAllReports
  } = useDetailedReports();

  // Estados para filtros de fecha - Simplificados para usar SimpleDateFilter (igual que Reports)
  // preset: all | today | yesterday | custom; startDate/endDate en formato YYYY-MM-DD
  const [dateRange, setDateRange] = useState({
    preset: 'all',
    startDate: null,
    endDate: null
  });
  // Estado de los tres modales de detalle (ventas, citas y cortes)
  const [modalData, setModalData] = useState({
    sales: { isOpen: false, data: null, barber: null, dateRange: null },
    appointments: { isOpen: false, data: null, barber: null, dateRange: null },
    services: { isOpen: false, data: null, barber: null, dateRange: null }
  });

  // Helper para calcular fechas basado en preset
  // "yesterday" se calcula con Date local restando un día para evitar desfases
  const calculateDatesFromPreset = (preset) => {
    const today = getTodayLocalDate();
    
    switch(preset) {
      case 'all':
        return { startDate: null, endDate: null };
      case 'today':
        return { startDate: today, endDate: today };
      case 'yesterday': {
        const [year, month, day] = today.split('-').map(Number);
        const todayDate = new Date(year, month - 1, day); 
        todayDate.setDate(todayDate.getDate() - 1);
        
        const yesterdayYear = todayDate.getFullYear();
        const yesterdayMonth = (todayDate.getMonth() + 1).toString().padStart(2, '0');
        const yesterdayDay = todayDate.getDate().toString().padStart(2, '0');
        const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
        
        return { startDate: yesterdayStr, endDate: yesterdayStr };
      }
      default:
        return { startDate: null, endDate: null };
    }
  };

  // Handler para cambio de preset (all, today, yesterday, custom)
  const handlePresetChange = async (preset) => {
    //IMPORTANTE: Para 'custom', NO actualizar las fechas aún (esperamos handleCustomDateChange)
    // Solo actualizamos el preset para que el componente SimpleDateFilter sepa que está en modo custom
    if (preset === 'custom') {
      setDateRange(prev => ({
        ...prev,
        preset: 'custom'
        // Mantener startDate y endDate del estado anterior
      }));
      return;
    }
    
    const { startDate, endDate } = calculateDatesFromPreset(preset);
    
    setDateRange({
      preset,
      startDate,
      endDate
    });

    // Validación: Solo aplicar si hay barberos disponibles
    if (!barbers || barbers.length === 0) {
      logger.info('[handlePresetChange] No hay barberos disponibles');
      return;
    }

    // Mapear preset a filterType para el hook
    let filterType = 'General';
    let filterDate = '';
    
    if (preset === 'today') {
      filterType = 'Hoy';
      filterDate = startDate;
    } else if (preset === 'yesterday') {
      filterType = 'Ayer';
      filterDate = startDate;
    }

    logger.info('[handlePresetChange] Aplicando filtro:', { filterType, filterDate, barbersCount: barbers.length });
    await applyFilter(filterType, filterDate, barbers); // Pasar barberos explícitamente
  };

  // Handler para cambio de fechas personalizadas
  const handleCustomDateChange = async (startDate, endDate) => {
    setDateRange({
      preset: 'custom',
      startDate,
      endDate
    });
    
    // Validación: Solo aplicar si hay barberos disponibles
    if (!barbers || barbers.length === 0) {
      logger.info('[handleCustomDateChange] No hay barberos disponibles');
      return;
    }
    
    logger.info('[handleCustomDateChange] Aplicando filtro personalizado:', { startDate, endDate, barbersCount: barbers.length });
    // Para rango personalizado, pasar las fechas exactas al filtro
    await applyFilter('Personalizado', endDate, barbers, startDate); // Pasar barberos explícitamente
  };
  
  // Effect para asegurar que siempre haya scroll disponible
  useEffect(() => {
    // Resetear estilos de scroll al desmontar
    return () => {
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  // Funciones para abrir modales con reportes detallados
  // Cada una abre el modal en estado de carga, pide los datos del período y los inyecta
  const openSalesModal = useCallback(async (barberId) => {
    const barber = barbers.find(b => b._id === barberId);
    const barberName = barber?.user?.name || barber?.name || 'Barbero';
    
    let startDateStr, endDateStr;
    
    if (dateRange.preset === 'all') {
      startDateStr = undefined;
      endDateStr = undefined;
    } else {
      startDateStr = dateRange.startDate;
      endDateStr = dateRange.endDate;
    }
    
    setModalData(prev => ({
      ...prev,
      sales: {
        isOpen: true,
        data: null,
        barber: barberName,
        dateRange: dateRange
      }
    }));
    
    try {
      const salesData = await fetchDetailedSales(barberId, startDateStr, endDateStr);
      
      setModalData(prev => ({
        ...prev,
        sales: {
          ...prev.sales,
          data: salesData
        }
      }));
    } catch (error) {
      console.error('Error cargando ventas detalladas:', error);
      setModalData(prev => ({
        ...prev,
        sales: {
          ...prev.sales,
          data: []
        }
      }));
    }
  }, [dateRange, barbers, statistics, filteredStats]);

  // Abre el modal de cortes/walk-ins del barbero con el rango de fechas activo
  const openServicesModal = useCallback(async (barberId) => {
    const barber = barbers.find(b => b._id === barberId);
    const barberName = barber?.user?.name || barber?.name || 'Barbero';
    let startDateStr, endDateStr;
    
    if (dateRange.preset === 'all') {
      startDateStr = undefined;
      endDateStr = undefined;
    } else {
      startDateStr = dateRange.startDate;
      endDateStr = dateRange.endDate;
    }
    
    setModalData(prev => ({
      ...prev,
      services: {
        isOpen: true,
        data: null,
        barber: barberName,
        dateRange: dateRange
      }
    }));
    
    try {
      const cutsData = await fetchDetailedCuts(barberId, startDateStr, endDateStr);
      
      setModalData(prev => ({
        ...prev,
        services: {
          ...prev.services,
          data: cutsData
        }
      }));
    } catch (error) {
      console.error('Error cargando cortes detallados:', error);
      setModalData(prev => ({
        ...prev,
        services: {
          ...prev.services,
          data: []
        }
      }));
    }
  }, [dateRange, barbers]);

  // Abre el modal de citas completadas del barbero con el rango de fechas activo
  const openAppointmentsModal = useCallback(async (barberId) => {
    const barber = barbers.find(b => b._id === barberId);
    const barberName = barber?.user?.name || barber?.name || 'Barbero';
    let startDateStr, endDateStr;
    
    if (dateRange.preset === 'all') {
      startDateStr = undefined;
      endDateStr = undefined;
    } else {
      startDateStr = dateRange.startDate;
      endDateStr = dateRange.endDate;
    }
    
    setModalData(prev => ({
      ...prev,
      appointments: {
        isOpen: true,
        data: null,
        barber: barberName,
        dateRange: dateRange
      }
    }));
    
    try {
      const appointmentsData = await fetchCompletedAppointments(barberId, startDateStr, endDateStr);
      
      setModalData(prev => ({
        ...prev,
        appointments: {
          ...prev.appointments,
          data: appointmentsData
        }
      }));
    } catch (error) {
      console.error('Error cargando citas detalladas:', error);
      setModalData(prev => ({
        ...prev,
        appointments: {
          ...prev.appointments,
          data: []
        }
      }));
    }
  }, [dateRange, barbers]);

  // Funciones para cerrar modales
  const closeSalesModal = () => setModalData(prev => ({
    ...prev,
    sales: { isOpen: false, data: null, barber: null, dateRange: null }
  }));

  const closeAppointmentsModal = () => setModalData(prev => ({
    ...prev,
    appointments: { isOpen: false, data: null, barber: null, dateRange: null }
  }));

  const closeServicesModal = () => setModalData(prev => ({
    ...prev,
    services: { isOpen: false, data: null, barber: null, dateRange: null }
  }));

  // Función para generar reporte consolidado del período filtrado
  // Descarga el PDF del backend con el token de auth y lo abre en una pestaña nueva
  const handleGenerateConsolidatedInvoice = async (barberId) => {
    // VALIDACIÓN: No permitir factura con filtro "General"
    if (dateRange.preset === 'all') {
      showError('No se puede generar Reporte consolidado con el filtro General. Selecciona un período específico');
      return;
    }
    
    const barber = barbers.find(b => b._id === barberId);
    const barberName = barber?.user?.name || barber?.name || 'Barbero';
    try {
      const { startDate, endDate } = dateRange;
      
      // Validar que haya fechas definidas
      if (!startDate || !endDate) {
        showError('Por favor selecciona un rango de fechas válido antes de generar la factura.');
        return;
      }

      showInfo(`Generando reporte de ${barberName} desde ${startDate} hasta ${endDate}...`);

      // Usar fetch con token de autenticación para descargar el PDF
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
      const invoiceUrl = `${API_URL}/invoices/consolidated/${barberId}?startDate=${startDate}&endDate=${endDate}`;
      
      const response = await fetch(invoiceUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/pdf'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Convertir respuesta a blob y abrir en nueva ventana
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      
      // Limpiar el blob URL después de 1 minuto
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      
    } catch (error) {
      console.error('Error generando reporte consolidado:', error);
      showError('Error al generar el reporte consolidado');
    }
  };

  // Función simplificada para calcular totales
  // Usa filteredStats cuando hay un filtro distinto de "General"; si no, statistics
  const calculateTotals = (barberId) => {
    // Usar filteredStats si hay un filtro aplicado, sino usar statistics
    const statsToUse = (filterType && filterType !== 'General') ? filteredStats : statistics;
    const barberStats = statsToUse[barberId];
    
    if (!barberStats) {
      return { sales: 0, appointments: 0, services: 0, walkIns: 0, total: 0, salesCount: 0, appointmentsCount: 0, servicesCount: 0, walkInsCount: 0 };
    }

    const totals = {
      sales: barberStats.sales?.total || 0,
      salesCount: barberStats.sales?.totalQuantity || barberStats.sales?.count || 0,
      appointments: barberStats.appointments?.total || 0,
      appointmentsCount: barberStats.appointments?.completed || barberStats.appointments?.count || 0,
      services: barberStats.cortes?.total || 0,
      servicesCount: barberStats.cortes?.totalQuantity || barberStats.cortes?.count || 0,
      walkIns: barberStats.cortes?.total || 0,
      walkInsCount: barberStats.cortes?.totalQuantity || barberStats.cortes?.count || 0,
      total: (barberStats.sales?.total || 0) + (barberStats.appointments?.total || 0) + (barberStats.cortes?.total || 0)
    };
    
    if (filterType === 'General') {
    }
    
    return totals;
  };

  // Skeleton mientras cargan las estadísticas
  if (loading) {
    return (
      <PageContainer>
        <div className="relative z-10 w-full pb-6">
          <AdminBarbersSkeleton />
        </div>
      </PageContainer>
    );
  }

  // Pantalla de error si el hook no pudo cargar los datos
  if (error) {
    return (
      <PageContainer>
        <div className="relative z-10 w-full pb-6">
          <div className="flex flex-col items-center justify-center min-h-64">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
            <p className="text-red-400 text-center">{error}</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Totales del equipo según el filtro activo
  // Acumula las métricas de todos los barberos para la barra de stats superior
  const teamTotals = barbers.reduce((acc, barber) => {
    const totals = calculateTotals(barber._id);
    acc.sales += totals.sales;
    acc.salesCount += totals.salesCount;
    acc.appointments += totals.appointments;
    acc.appointmentsCount += totals.appointmentsCount;
    acc.services += totals.services;
    acc.servicesCount += totals.servicesCount;
    acc.total += totals.total;
    return acc;
  }, {
    sales: 0, salesCount: 0,
    appointments: 0, appointmentsCount: 0,
    services: 0, servicesCount: 0,
    total: 0
  });

  // Tarjetas resumen del equipo (ventas, citas, cortes y total de ingresos)
  const teamStats = [
    {
      id: 'sales',
      label: 'Ventas del equipo',
      detail: `${teamTotals.salesCount} producto${teamTotals.salesCount !== 1 ? 's' : ''}`,
      value: formatCurrency(teamTotals.sales),
      icon: ShoppingCart,
      box: 'bg-emerald-500/15 border-emerald-500/25',
      color: 'text-emerald-400'
    },
    {
      id: 'appointments',
      label: 'Citas completadas',
      detail: `${teamTotals.appointmentsCount} cita${teamTotals.appointmentsCount !== 1 ? 's' : ''}`,
      value: formatCurrency(teamTotals.appointments),
      icon: Calendar,
      box: 'bg-blue-500/15 border-blue-500/25',
      color: 'text-blue-400'
    },
    {
      id: 'services',
      label: 'Cortes realizados',
      detail: `${teamTotals.servicesCount} corte${teamTotals.servicesCount !== 1 ? 's' : ''}`,
      value: formatCurrency(teamTotals.services),
      icon: Scissors,
      box: 'bg-brand-400/15 border-brand-400/25',
      color: 'text-brand-300'
    },
    {
      id: 'total',
      label: 'Total ingresos',
      detail: `${barbers.length} barbero${barbers.length !== 1 ? 's' : ''}`,
      value: formatCurrency(teamTotals.total),
      icon: DollarSign,
      box: 'bg-violet-500/15 border-violet-500/25',
      color: 'text-violet-300'
    }
  ];

  return (
    <PageContainer>
      <div className="relative z-10 w-full pb-6 space-y-5">
        {/* ── Top bar: título + filtro de período ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Estadísticas de Barberos</h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                Rendimiento de ventas, citas y cortes por barbero
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <SimpleDateFilter
              className="w-full lg:max-w-3xl lg:ml-auto"
              fluid
              dateRange={dateRange}
              onPresetChange={handlePresetChange}
              onCustomDateChange={handleCustomDateChange}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Stats strip: totales del equipo ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teamStats.map(({ id, label, detail, value, icon: Icon, box, color }) => (
            <div key={id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className={`p-2 rounded-lg border flex-shrink-0 ${box}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{value}</p>
                <p className="text-gray-400 text-xs truncate">{label}</p>
                <p className="text-gray-500 text-[10px] truncate">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Grid de barberos ── */}
        {/* Estado vacío si no hay barberos; si hay, una card de stats por barbero */}
        {barbers.length === 0 ? (
          <div className="text-center py-20">
            <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4 inline-block">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-400 mb-2">No hay barberos registrados</h3>
            <p className="text-gray-500 text-sm">Agrega barberos para ver sus estadísticas de rendimiento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {barbers.map(barber => (
              <BarberStatsCard
                key={barber._id}
                barber={barber}
                totals={calculateTotals(barber._id)}
                isLoading={loading}
                onSalesClick={openSalesModal}
                onAppointmentsClick={openAppointmentsModal}
                onServicesClick={openServicesModal}
                formatCurrency={formatCurrency}
                navigate={navigate}
                dateRange={dateRange}
                onGenerateInvoice={handleGenerateConsolidatedInvoice}
              />
            ))}
          </div>
        )}

        {/* Modales detallados */}
        <DetailedSalesModal
          isOpen={modalData.sales.isOpen}
          onClose={closeSalesModal}
          salesData={modalData.sales.data}
          barberName={modalData.sales.barber}
          dateRange={modalData.sales.dateRange}
        />

        <DetailedCutsModal
          isOpen={modalData.services.isOpen}
          onClose={closeServicesModal}
          cutsData={modalData.services.data}
          barberName={modalData.services.barber}
          dateRange={modalData.services.dateRange}
        />

        <DetailedAppointmentsModal
          isOpen={modalData.appointments.isOpen}
          onClose={closeAppointmentsModal}
          appointmentsData={modalData.appointments.data}
          barberName={modalData.appointments.barber}
          dateRange={modalData.appointments.dateRange}
        />
      </div>
    </PageContainer>
  );
};

export default AdminBarbers;

