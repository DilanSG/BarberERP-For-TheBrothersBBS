// Hook de reportes detallados (ventas de productos, cortes walk-in, cortes y
// citas completadas). Mantiene una caché en memoria por clave de filtro
// (5 minutos) y estados independientes por tipo de reporte.
import { useState, useEffect, useCallback } from 'react';
import { salesService } from '../services/salesService';
import { appointmentsService } from '../services/appointmentsService';

import logger from '../utils/logger';
// Hook para manejar reportes detallados de ventas, cortes y citas
export const useDetailedReports = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para cada tipo de reporte
  const [detailedSales, setDetailedSales] = useState([]);
  const [walkInDetails, setWalkInDetails] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  
  // Cache simple basado en la key del request
  const [cache, setCache] = useState(new Map());

  // Clave de caché por tipo de reporte, barbero y rango
  const generateCacheKey = (type, barberId, startDate, endDate) => {
    return `${type}_${barberId}_${startDate}_${endDate}`;
  };

  // Muestra el error durante 5 segundos y luego lo limpia
  const setErrorWithTimeout = useCallback((errorMessage) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  }, []);

   // Obtener reporte detallado de ventas de productos
  const fetchDetailedSales = useCallback(async (barberId, startDate, endDate, useCache = true) => {
    const cacheKey = generateCacheKey('sales', barberId, startDate, endDate);
    
    // Verificar cache primero
    if (useCache && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      const now = Date.now();
      // Cache válido por 5 minutos
      if (now - cachedData.timestamp < 300000) {
        setDetailedSales(cachedData.data);
        return cachedData.data;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      logger.debug('🛒 Obteniendo reporte detallado de ventas:', { barberId, startDate, endDate });
      
      const response = await salesService.getDetailedSalesReport(barberId, startDate, endDate);
      const data = response.data || [];
      
      setDetailedSales(data);
      
      // Guardar en cache
      if (useCache) {
        setCache(prev => new Map(prev).set(cacheKey, {
          data,
          timestamp: Date.now()
        }));
      }
      
      logger.debug('✅ Reporte detallado de ventas obtenido:', data);
      return data;
      
    } catch (error) {
      console.error('❌ Error obteniendo reporte detallado de ventas:', error);
      const errorMessage = error.response?.data?.message || 'Error al obtener reporte de ventas';
      setErrorWithTimeout(errorMessage);
      setDetailedSales([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [cache, setErrorWithTimeout]);

   // Obtener detalles de cortes walk-in
  const fetchWalkInDetails = useCallback(async (barberId, startDate, endDate, useCache = true) => {
    const cacheKey = generateCacheKey('walkins', barberId, startDate, endDate);
    
    // Verificar cache primero
    if (useCache && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      const now = Date.now();
      if (now - cachedData.timestamp < 300000) {
        setWalkInDetails(cachedData.data);
        return cachedData.data;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      logger.debug('✂️ Obteniendo detalles de cortes walk-in:', { barberId, startDate, endDate });
      
      const response = await salesService.getWalkInDetails(barberId, startDate, endDate);
      const data = response.data || [];
      
      setWalkInDetails(data);
      
      // Guardar en cache
      if (useCache) {
        setCache(prev => new Map(prev).set(cacheKey, {
          data,
          timestamp: Date.now()
        }));
      }
      
      logger.debug('✅ Detalles de cortes walk-in obtenidos:', data);
      return data;
      
    } catch (error) {
      console.error('❌ Error obteniendo detalles de cortes walk-in:', error);
      const errorMessage = error.response?.data?.message || 'Error al obtener detalles de cortes';
      setErrorWithTimeout(errorMessage);
      setWalkInDetails([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [cache, setErrorWithTimeout]);

   // Obtener reporte detallado de cortes.
  // Reutiliza el estado `walkInDetails` (compartido con fetchWalkInDetails),
  // por eso ambos endpoints no deben usarse a la vez esperando resultados distintos.
  const fetchDetailedCuts = useCallback(async (barberId, startDate, endDate, useCache = true) => {
    const cacheKey = generateCacheKey('detailed-cuts', barberId, startDate, endDate);
    
    // Verificar cache primero
    if (useCache && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      const now = Date.now();
      if (now - cachedData.timestamp < 300000) {
        setWalkInDetails(cachedData.data); // Reutilizamos el estado walkInDetails
        return cachedData.data;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      logger.debug('✂️ Obteniendo reporte detallado de cortes:', { barberId, startDate, endDate });
      
      const response = await salesService.getDetailedCutsReport(barberId, startDate, endDate);
      const data = response.data || [];
      
      setWalkInDetails(data); // Reutilizamos el estado walkInDetails
      
      // Guardar en cache
      if (useCache) {
        setCache(prev => new Map(prev).set(cacheKey, {
          data,
          timestamp: Date.now()
        }));
      }
      
      logger.debug('✅ Reporte detallado de cortes obtenido:', data);
      return data;
      
    } catch (error) {
      console.error('❌ Error obteniendo reporte detallado de cortes:', error);
      const errorMessage = error.response?.data?.message || 'Error al obtener reporte de cortes';
      setErrorWithTimeout(errorMessage);
      setWalkInDetails([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [cache, setErrorWithTimeout]);

   // Obtener detalles de citas completadas
  const fetchCompletedAppointments = useCallback(async (barberId, startDate, endDate, useCache = true) => {
    const cacheKey = generateCacheKey('appointments', barberId, startDate, endDate);
    
    // Verificar cache primero
    if (useCache && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      const now = Date.now();
      if (now - cachedData.timestamp < 300000) {
        setCompletedAppointments(cachedData.data);
        return cachedData.data;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      logger.debug('📅 Obteniendo detalles de citas completadas:', { barberId, startDate, endDate });
      
      const response = await appointmentsService.getCompletedDetails(barberId, startDate, endDate);
      const data = response.data || [];
      
      setCompletedAppointments(data);
      
      // Guardar en cache
      if (useCache) {
        setCache(prev => new Map(prev).set(cacheKey, {
          data,
          timestamp: Date.now()
        }));
      }
      
      logger.debug('✅ Detalles de citas completadas obtenidos:', data);
      return data;
      
    } catch (error) {
      console.error('❌ Error obteniendo detalles de citas completadas:', error);
      const errorMessage = error.response?.data?.message || 'Error al obtener detalles de citas';
      setErrorWithTimeout(errorMessage);
      setCompletedAppointments([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [cache, setErrorWithTimeout]);

   // Función combinada para obtener todos los reportes de una vez.
  // Lanza las tres peticiones en paralelo; cada una resuelve a [] si falla.
  const fetchAllReports = useCallback(async (barberId, startDate, endDate, useCache = true) => {
    setLoading(true);
    setError(null);
    
    try {
      const [sales, walkIns, appointments] = await Promise.all([
        fetchDetailedSales(barberId, startDate, endDate, useCache),
        fetchWalkInDetails(barberId, startDate, endDate, useCache),
        fetchCompletedAppointments(barberId, startDate, endDate, useCache)
      ]);
      
      return { sales, walkIns, appointments };
      
    } catch (error) {
      console.error('❌ Error obteniendo todos los reportes:', error);
      setErrorWithTimeout('Error al obtener los reportes detallados');
      return { sales: [], walkIns: [], appointments: [] };
    } finally {
      setLoading(false);
    }
  }, [fetchDetailedSales, fetchWalkInDetails, fetchCompletedAppointments, setErrorWithTimeout]);

   // Limpiar cache específico o todo el cache
  const clearCache = useCallback((cacheKey = null) => {
    if (cacheKey) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(cacheKey);
        return newCache;
      });
    } else {
      setCache(new Map());
    }
  }, []);

   // Reset de todos los estados
  const reset = useCallback(() => {
    setDetailedSales([]);
    setWalkInDetails([]);
    setCompletedAppointments([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    // Estados
    loading,
    error,
    detailedSales,
    walkInDetails,
    completedAppointments,
    
    // Funciones
    fetchDetailedSales,
    fetchWalkInDetails,
    fetchDetailedCuts,
    fetchCompletedAppointments,
    fetchAllReports,
    clearCache,
    reset
  };
};

export default useDetailedReports;

