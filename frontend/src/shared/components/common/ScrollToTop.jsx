import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Utilidad de navegación: sube el scroll al inicio cada vez que cambia la ruta.
// Restaura el scroll al inicio cada vez que cambia la ruta (se monta en AppLayout).
export default function ScrollToTop() {
  const { pathname } = useLocation();

  // Se reejecuta con cada cambio de pathname.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
