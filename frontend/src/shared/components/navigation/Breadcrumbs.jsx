import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';

// Breadcrumbs con navegación jerárquica y botón "Volver".
//
// Lógica:
// - Siempre inicia en "Inicio" (/).
// - Cada segmento de la ruta se traduce a una etiqueta legible (ROUTE_LABELS).
// - Los segmentos de acción (view/edit/create/new) no generan crumb propio:
//   se combinan con el ID siguiente en una sola etiqueta (ej: "Detalle de Cita").
// - Los IDs (ObjectId) se etiquetan según el recurso padre (ej: barbers → "Perfil").
// - El botón "Volver" regresa a la página desde la que se ingresó (historial real);
//   si no hay historial (carga directa), vuelve al inicio.

// Etiquetas legibles por segmento de ruta
const ROUTE_LABELS = {
  'barbers': 'Barberos',
  'profile': 'Mi Perfil',
  'profile-edit': 'Editar Perfil',
  'inventory': 'Inventario',
  'sales': 'Punto de Venta',
  'cart-invoices': 'Facturas de Carrito',
  'services': 'Servicios',
  'roles': 'Usuarios y Roles',
  'reports': 'Control Financiero',
  'appointment': 'Citas',
  'reviews': 'Reseñas',
  'new': 'Nueva',
  'edit': 'Editar',
  'view': 'Detalle',
  'create': 'Crear'
};

// Segmentos de acción: no generan crumb propio cuando preceden a un ID
const ACTION_SEGMENTS = new Set(['view', 'edit', 'create']);

// Prefijos de ruteo: no son páginas reales (no generan crumb).
// Para admin/barber, "/" ya es el panel (menú de rol), así que "admin" sobra.
const SKIP_SEGMENTS = new Set(['admin']);

// Etiqueta del crumb dinámico (ID) según el segmento anterior
const DETAIL_LABELS = {
  'barbers': 'Perfil',
  'appointment': 'Detalle',
  'view': 'Detalle',
  'edit': 'Editar',
  'create': 'Crear'
};

// Detecta IDs: ObjectId de MongoDB, numérico o cadena larga no etiquetada.
const isId = (segment) =>
  /^[a-f\d]{24}$/i.test(segment) || // MongoDB ObjectId
  /^\d+$/.test(segment) ||          // Numérico
  segment.length > 20;              // IDs largos

// Capitaliza la primera letra para segmentos sin etiqueta en ROUTE_LABELS.
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const Breadcrumbs = ({ className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Construye las migas desde el pathname: omite prefijos, combina acciones con
  // IDs, traduce etiquetas e inserta el padre contextual si viene en el state.
  const crumbs = useMemo(() => {
    const pathnames = location.pathname.split('/').filter(Boolean);
    const items = [{ label: 'Inicio', path: '/', isFirst: true }];

    let accumulated = '';

    pathnames.forEach((segment, index) => {
      accumulated += `/${segment}`;
      const isLast = index === pathnames.length - 1;

      // Prefijos de ruteo (ej: /admin): no generan crumb
      if (SKIP_SEGMENTS.has(segment)) {
        return;
      }

      // IDs: etiqueta contextual según el recurso padre
      if (isId(segment)) {
        const previous = pathnames[index - 1];
        items.push({
          label: DETAIL_LABELS[previous] || 'Detalle',
          path: accumulated,
          isLast
        });
        return;
      }

      // Acciones intermedias (view/edit/create): se combinan con el ID siguiente
      if (ACTION_SEGMENTS.has(segment) && !isLast) {
        return;
      }

      items.push({
        label: ROUTE_LABELS[segment] || capitalize(segment),
        path: accumulated,
        isLast
      });
    });

    // Padre contextual: páginas que se abren desde otra (ej: Mi Perfil › Editar Perfil)
    // El origen lo pasa el enlace con `state={{ breadcrumbParent: { label, path } }}`.
    const parentCrumb = location.state?.breadcrumbParent;
    if (parentCrumb?.label && parentCrumb?.path && items.length > 1) {
      const alreadyInTrail = items.some(crumb => crumb.path === parentCrumb.path);
      if (!alreadyInTrail) {
        items.splice(items.length - 1, 0, {
          label: parentCrumb.label,
          path: parentCrumb.path
        });
      }
    }

    return items;
  }, [location.pathname, location.state]);

  // Ocultar solo en home y páginas de autenticación
  if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  // Volver a donde se ingresó; si no hay historial en el router, ir al inicio
  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <nav
      aria-label="Navegación de migas de pan"
      className={`inline-flex max-w-full items-center gap-2 text-xs sm:text-sm ${className}`}
    >
      {/* Botón volver */}
      <button
        type="button"
        onClick={handleBack}
        title="Volver a la página anterior"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors duration-200 flex-shrink-0"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-medium">Volver</span>
      </button>

      {/* Ruta jerárquica */}
      <ol className="flex items-center gap-1 min-w-0">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const isFirst = index === 0;
          // En móvil se ocultan los intermedios cuando hay 4+ niveles (se conservan los últimos 2)
          const hiddenOnMobile = !isFirst && !isLast && index < crumbs.length - 2;

          return (
            <React.Fragment key={crumb.path}>
              {!isFirst && (
                <li className={`${hiddenOnMobile ? 'hidden sm:flex' : 'flex'} items-center flex-shrink-0`} aria-hidden="true">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </li>
              )}

              {hiddenOnMobile && index === 1 && (
                <li className="flex sm:hidden items-center flex-shrink-0" aria-hidden="true">
                  <span className="text-gray-500 px-0.5">…</span>
                </li>
              )}

              <li className={`${hiddenOnMobile ? 'hidden sm:flex' : 'flex'} items-center min-w-0`}>
                {isLast ? (
                  <span
                    aria-current="page"
                    className="flex items-center gap-1.5 min-w-0 font-medium text-blue-300"
                  >
                    {isFirst && <Home className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="truncate">{crumb.label}</span>
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="flex items-center gap-1.5 min-w-0 text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {isFirst && <Home className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="truncate hover:underline">{crumb.label}</span>
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
