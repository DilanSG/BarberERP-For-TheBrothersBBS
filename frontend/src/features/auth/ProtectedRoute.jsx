import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@contexts/AuthContext";
import { useEffect } from "react";
import { HomeAuthenticatedSkeleton } from "@components/ui/Skeleton";

// Guardia de rutas privadas: exige sesión iniciada y, opcionalmente,
// uno de los roles indicados en requiredRole (string o arreglo).
// Mientras AuthContext carga muestra un esqueleto.
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, error, refreshToken } = useAuth();
  const location = useLocation();
  
  // Si hay token pero aún no hay usuario, intenta refrescar la sesión una vez.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!loading && token && !user && !error) {
      refreshToken().catch(() => {});
    }
  }, [loading, user, error, refreshToken]);

  // Sesión aún en carga: esqueleto de espera.
  if (loading) {
    return <HomeAuthenticatedSkeleton />;
  }
  
  // Sin usuario: redirige al login guardando la ruta de origen para volver tras entrar.
  if (!user) {
    // Guardar la ubicación actual para redirigir después del login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // Verificación de rol cuando la ruta lo exige.
  if (requiredRole) {
    // Convertir requiredRole en array si es string
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Usuario con rol no permitido: avisa en consola y redirige al home.
    if (!requiredRoles.includes(user.role)) {
      console.warn(`Acceso denegado: se requiere uno de estos roles [${requiredRoles.join(', ')}], usuario tiene rol ${user.role}`);
      return <Navigate to="/" replace />;
    }
  }
  
  return children;
}

export default ProtectedRoute;
