// Configuración del menú principal por rol.
// Cada opción define su ruta, icono, descripción y color de acento.
// Los items "featured" se muestran como tarjetas grandes (prioridad de uso)
// y los "secondary" como tarjetas compactas.
//
// `overrides` permite ajustar label/descripción de un item según el rol.

import {
  ShoppingCart,
  Calendar,
  Package,
  BarChart3,
  Users,
  Scissors,
  FileText,
  Shield,
  User
} from 'lucide-react';

export const MENU_ITEMS = {
  pos: {
    id: 'pos',
    label: 'Punto de Venta',
    description: 'Registra ventas de productos y cortes',
    path: '/admin/sales',
    icon: ShoppingCart,
    overrides: {
      barber: {
        label: 'Ventas',
        description: 'Registra y consulta tus ventas'
      }
    }
  },
  appointments: {
    id: 'appointments',
    label: 'Gestión de Citas',
    description: 'Administra las reservas de clientes',
    path: '/appointment',
    icon: Calendar
  },
  inventory: {
    id: 'inventory',
    label: 'Control de Inventario',
    description: 'Stock, productos y movimientos',
    path: '/admin/inventory',
    icon: Package
  },
  reports: {
    id: 'reports',
    label: 'Control Financiero',
    description: 'Ventas, gastos y rentabilidad',
    path: '/admin/reports',
    icon: BarChart3
  },
  barbers: {
    id: 'barbers',
    label: 'Estadísticas de Barberos',
    description: 'Equipo, rendimiento y perfiles',
    path: '/admin/barbers',
    icon: Users
  },
  services: {
    id: 'services',
    label: 'Gestión de Servicios',
    description: 'Servicios y selección del Home',
    path: '/admin/services',
    icon: Scissors
  },
  invoices: {
    id: 'invoices',
    label: 'Facturas de Carrito',
    description: 'Consulta e imprime facturas',
    path: '/admin/cart-invoices',
    icon: FileText
  },
  roles: {
    id: 'roles',
    label: 'Gestión de Roles',
    description: 'Usuarios, permisos y socios',
    path: '/admin/roles',
    icon: Shield
  },
  profile: {
    id: 'profile',
    label: 'Mi Perfil',
    description: 'Tu información personal',
    path: '/profile',
    icon: User
  }
};

// Orden por prioridad de uso
export const ROLE_MENU = {
  admin: {
    label: 'Administrador',
    // Principales: reportes, inventario y reservas
    featured: ['reports', 'inventory', 'appointments'],
    secondary: ['pos', 'barbers', 'services', 'invoices', 'roles']
  },
  barber: {
    label: 'Barbero',
    // Principales: ventas, citas e inventario (inventario después de las citas)
    featured: ['pos', 'appointments', 'inventory'],
    secondary: ['invoices', 'profile']
  }
};

// Clases estáticas por rol (Tailwind necesita strings completos)
// Las cards son glass neutro; el color del rol vive en el icono, el badge y el glow.
export const ROLE_STYLES = {
  admin: {
    iconBox: 'bg-blue-500/10 border-blue-500/20',
    iconColor: 'text-blue-400',
    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    glow: 'bg-blue-500/15',
    accent: 'via-blue-500/40'
  },
  barber: {
    iconBox: 'bg-red-500/10 border-red-500/20',
    iconColor: 'text-red-400',
    badge: 'bg-red-500/10 border-red-500/20 text-red-300',
    glow: 'bg-red-500/15',
    accent: 'via-red-500/40'
  }
};
