
// Componente raíz de enrutamiento de la aplicación.
// Define todas las rutas con React Router y envuelve la app en los providers
// de sockets, métodos de pago e inventario; las páginas se cargan por lazy
// loading (code splitting) y el layout común vive en AppLayout.
import React, { lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './shared/components/layout/AppLayout';
import NotificationContainer from './shared/components/notifications/NotificationContainer';
import { useApiNotifications } from './shared/hooks/useApiNotifications';
import { InventoryProvider } from './shared/contexts/InventoryContext';
import { PaymentMethodsProvider } from './shared/contexts/PaymentMethodsContext';
import { SocketProvider } from './shared/contexts/SocketContext';

// Páginas con lazy loading (code splitting por ruta).
// El fallback de Suspense está en AppLayout (alrededor del Outlet).
const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const AppointmentRouter = lazy(() => import('./features/appointments/AppointmentRouter'));
const PublicBarbers = lazy(() => import('./pages/PublicBarbers'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Review Pages
const CreateReview = lazy(() => import('./features/reviews/CreateReview'));

// Auth Pages
const Login = lazy(() => import('./features/auth/Login'));
const Register = lazy(() => import('./features/auth/Register'));

// Barber Pages
const BarberProfile = lazy(() => import('./features/barbers/BarberProfile'));
const BarberSales = lazy(() => import('./features/barbers/BarberSales'));
const CartInvoices = lazy(() => import('./pages/CartInvoices'));

// Admin Pages
const UserRoleManager = lazy(() => import('./features/admin/UserRoleManager'));
const Inventory = lazy(() => import('./features/admin/Inventory'));
const AdminBarbers = lazy(() => import('./features/admin/AdminBarbers'));
const AdminServices = lazy(() => import('./features/admin/AdminServices'));
const Reports = lazy(() => import('./features/admin/Reports'));

// Componentes de protección (se necesitan de inmediato, sin lazy)
import ProtectedRoute from './features/auth/ProtectedRoute';
import RequireAuth from './features/auth/RequireAuth';
import { PublicRoute } from './features/auth/PublicRoute';

function App() {
  // Configurar notificaciones para el API service
  useApiNotifications();

  return (
    // Providers globales: socket en tiempo real -> métodos de pago -> inventario
    <SocketProvider>
      <PaymentMethodsProvider>
        <InventoryProvider>
          <Routes>
        {/* Layout común (AppLayout con Suspense) para todas las rutas hijas */}
      <Route element={<AppLayout />}>
        {/* Rutas públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/barbers" element={<PublicBarbers />} />
        <Route path="/barbers/:id" element={<BarberProfile />} />
        
        {/* Rutas de autenticación */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Rutas protegidas para cualquier usuario autenticado */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile-edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        {/* Rutas protegidas para admin y barber */}
        {/* Ruta base de administración */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole={["admin", "barber"]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          {/* Redirección por defecto según rol */}
          <Route 
            index 
            element={
              <RequireAuth>
                {({ user }) => (
                  <Navigate 
                    to={user.role === "barber" ? "/admin/sales" : "/admin/barbers"} 
                    replace 
                  />
                )}
              </RequireAuth>
            }
          />

          {/* Ruta de inventario - accesible para admin y barber */}
          <Route 
            path="inventory" 
            element={<Inventory />} 
          />
          
          {/* Ruta de ventas - accesible para admin y barber */}
          <Route 
            path="sales" 
            element={<BarberSales />} 
          />
          
          {/* Ruta de facturas de carrito - accesible para admin y barber */}
          <Route 
            path="cart-invoices" 
            element={<CartInvoices />} 
          />
          
          {/* Rutas exclusivas para admin */}
          <Route
            element={
              <ProtectedRoute requiredRole={["admin"]}>
                <Outlet />
              </ProtectedRoute>
            }
          >
            <Route path="services" element={<AdminServices />} />
            <Route path="roles" element={<UserRoleManager />} />
            <Route path="barbers" element={<AdminBarbers />} />
            <Route path="barbers/:id" element={<BarberProfile />} />
            <Route path="reports" element={<Reports />} />
          </Route>

        </Route>

        {/* Ruta de citas - accesible para todos los usuarios autenticados */}
        <Route 
          path="/appointment/*" 
          element={
            <ProtectedRoute>
              <AppointmentRouter />
            </ProtectedRoute>
          }
        />

        {/* Rutas de reseñas - accesible para clientes autenticados */}
        <Route 
          path="/reviews/create/:appointmentId" 
          element={
            <ProtectedRoute>
              <CreateReview />
            </ProtectedRoute>
          }
        />

        {/* Ruta para manejar URLs no encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
          </Routes>
          {/* Toasts/notificaciones globales (errores y avisos del API) */}
          <NotificationContainer />
    </InventoryProvider>
    </PaymentMethodsProvider>
    </SocketProvider>
  );
}

export default App;
