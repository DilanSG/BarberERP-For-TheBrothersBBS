import { Navigate } from "react-router-dom";
import { useAuth } from "@contexts/AuthContext";

// Alternativa ligera a ProtectedRoute: sin usuario redirige al login y,
// si lo hay, entrega el usuario al children (render prop).
function RequireAuth({ children }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children({ user });
}

export default RequireAuth;
