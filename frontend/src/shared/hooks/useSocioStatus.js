// Hook que determina si el usuario autenticado es socio/fundador y su porcentaje.
// Solo consulta al backend si el rol es admin (los socios son admins con subrol);
// en cualquier otro caso o si falla la petición devuelve valores por defecto.
import { useState, useEffect } from 'react';
import { sociosService } from '../services/sociosService';
import { useAuth } from '../contexts/AuthContext';

// Retorna { isSocio, tipoSocio, isFounder, porcentaje, loading }
export const useSocioStatus = () => {
  const { user } = useAuth();
  const [socioInfo, setSocioInfo] = useState({
    isSocio: false,
    tipoSocio: null,
    isFounder: false,
    porcentaje: 0,
    loading: true
  });

  // Recalcula el estado cada vez que cambia el usuario autenticado
  useEffect(() => {
    const checkSocioStatus = async () => {
      if (!user) {
        setSocioInfo({
          isSocio: false,
          tipoSocio: null,
          isFounder: false,
          porcentaje: 0,
          loading: false
        });
        return;
      }

      try {
        // Solo verificar si es admin (los socios son admin con subrol)
        if (user.role === 'admin') {
          const response = await sociosService.getCurrentUser();
          const userData = response.data;
          
          setSocioInfo({
            isSocio: !!userData.tipoSocio,
            tipoSocio: userData.tipoSocio,
            isFounder: userData.tipoSocio === 'fundador',
            porcentaje: userData.porcentaje || 0,
            loading: false
          });
        } else {
          setSocioInfo({
            isSocio: false,
            tipoSocio: null,
            isFounder: false,
            porcentaje: 0,
            loading: false
          });
        }
      } catch (error) {
        console.error('Error verificando estado de socio:', error);
        setSocioInfo({
          isSocio: false,
          tipoSocio: null,
          isFounder: false,
          porcentaje: 0,
          loading: false
        });
      }
    };

    checkSocioStatus();
  }, [user]);

  return socioInfo;
};

export default useSocioStatus;