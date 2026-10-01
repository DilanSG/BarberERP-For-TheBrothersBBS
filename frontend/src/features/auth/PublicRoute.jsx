import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@contexts/AuthContext";

// Envuelve rutas públicas (login/registro) y expulsa a los usuarios ya autenticados.
export const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { state } = location;

  // Si el usuario está autenticado, redirigir según su rol y la ruta actual
  // Usuario autenticado: vuelve a la ruta de origen guardada o al home.
  if (user) {
    // Si hay una ruta anterior guardada, redirigir allí
    if (state?.from) {
      return <Navigate to={state.from} replace />;
    }

    // Para otras rutas públicas (login, register), redirigir al home
    return <Navigate to="/" replace />;
  }

  // Si no está autenticado, mostrar el contenido normal (sin esqueleto)
  return children;
};
