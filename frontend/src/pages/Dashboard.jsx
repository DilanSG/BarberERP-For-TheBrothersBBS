import { Navigate } from 'react-router-dom';

// Página Dashboard legacy.
// Ya no renderiza nada propio: redirige siempre a la raíz "/", donde Home
// decide entre el menú de rol (admin/barber) y el landing público (clientes).
const Dashboard = () => <Navigate to="/" replace />;

export default Dashboard;
