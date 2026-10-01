import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import UserAppointment from './UserAppointment';
import BarberAppointment from './BarberAppointment';
import AdminAppointment from './AdminAppointment';
import AppointmentEdit from './AppointmentEdit';
import AppointmentDetail from './AppointmentDetail';

// Enrutador de citas: delega en la vista correspondiente al rol del usuario.
// Admin y barbero comparten las rutas de edición/detalle; cada uno tiene su panel raíz.
const AppointmentRouter = () => {
  const { user } = useAuth();

  // Sin usuario autenticado se redirige al login.
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Selección de rutas según el rol: admin, barbero o cliente (default).
  switch (user.role) {
    case 'admin':
      return (
        // Rutas del panel de administración.
        <Routes>
          <Route path="/" element={<AdminAppointment />} />
          <Route path="/new" element={<AdminAppointment />} />
          <Route path="/edit/:id" element={<AppointmentEdit />} />
          <Route path="/view/:id" element={<AppointmentDetail />} />
          <Route path="*" element={<Navigate to="/appointment" replace />} />
        </Routes>
      );
    case 'barber':
      return (
        // Rutas del panel del barbero.
        <Routes>
          <Route path="/" element={<BarberAppointment />} />
          <Route path="/new" element={<BarberAppointment />} />
          <Route path="/edit/:id" element={<AppointmentEdit />} />
          <Route path="/view/:id" element={<AppointmentDetail />} />
          <Route path="*" element={<Navigate to="/appointment" replace />} />
        </Routes>
      );
    default:
      return (
        // Rutas del panel del cliente (usuarios con rol distinto de admin/barbero).
        <Routes>
          <Route path="/" element={<UserAppointment />} />
          <Route path="/new" element={<UserAppointment />} />
          <Route path="/edit/:id" element={<AppointmentEdit />} />
          <Route path="/view/:id" element={<AppointmentDetail />} />
          <Route path="*" element={<Navigate to="/appointment" replace />} />
        </Routes>
      );
  }
};

export default AppointmentRouter;   

