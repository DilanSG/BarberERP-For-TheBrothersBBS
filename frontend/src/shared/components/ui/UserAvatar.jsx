import React from 'react';

// Avatar de usuario: foto con fallback a iniciales. El color de borde/fondo
// depende del rol (fundador=brand, admin=azul, barber=rojo, cliente=neutro).
// Props: user, size ('sm'|'md'|'lg'|'xl'), onClick, showBorder, borderColor.
const UserAvatar = ({ 
  user, 
  size = 'md', 
  className = '', 
  onClick = null,
  showBorder = true,
  borderColor = null 
}) => {
  // Definir tamaños
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg', 
    xl: 'text-xl'
  };

  // Definir colores de borde basados en rol
  // admin = azul · barber = rojo · fundador = dorado · cliente = neutro
  const getBorderColor = () => {
    if (borderColor) return borderColor;
    
    if (user.isFounder) return 'border-brand-500/40';
    if (user.role === 'admin') return 'border-blue-500/40';
    if (user.role === 'barber') return 'border-red-500/40';
    return 'border-gray-500/40';
  };

  // Definir colores de fondo basados en rol
  const getBackgroundColor = () => {
    if (user.isFounder) return 'from-brand-500/20 to-brand-600/20';
    if (user.role === 'admin') return 'from-blue-500/20 to-blue-600/20';
    if (user.role === 'barber') return 'from-red-500/20 to-red-600/20';
    return 'from-gray-500/20 to-gray-600/20';
  };

  const sizeClass = sizes[size] || sizes.md;
  const textSizeClass = textSizes[size] || textSizes.md;
  const borderClass = showBorder ? `border-2 ${getBorderColor()}` : '';
  
  // Si la imagen falla, oculta la <img> y muestra el fallback de iniciales.
  const handleImageError = (e) => {
    e.target.style.display = 'none';
    const fallback = e.target.parentElement.querySelector('.fallback-avatar');
    if (fallback) {
      fallback.style.display = 'flex';
    }
  };

  const handleImageLoad = (e) => {
    // Ocultar fallback cuando la imagen carga correctamente
    const fallback = e.target.parentElement.querySelector('.fallback-avatar');
    if (fallback) {
      fallback.style.display = 'none';
    }
  };

  // Iniciales a partir del nombre (nombre + apellido) o del email.
  const getInitials = () => {
    const name = user.name || user.email || '?';
    if (name === '?') return '?';
    
    const nameParts = name.trim().split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const containerClass = `
    relative ${onClick ? 'cursor-pointer hover:scale-105 transition-transform duration-200' : ''} 
    ${className}
  `.trim();

  const fallbackClass = `
    fallback-avatar ${sizeClass} rounded-full bg-gradient-to-r ${getBackgroundColor()} 
    ${borderClass} flex items-center justify-center shadow-lg absolute inset-0
  `.trim();

  return (
    <div className={containerClass} onClick={onClick}>
      {user.profilePicture ? (
        <div className={`${sizeClass} rounded-full ${borderClass} shadow-lg overflow-hidden relative`}>
          <img
            src={user.profilePicture}
            alt={user.name || user.email}
            className={`${sizeClass} rounded-full object-cover`}
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          {/* Fallback avatar - oculto inicialmente, se muestra solo si la imagen falla */}
          <div className={fallbackClass} style={{display: 'none'}}>
            <span className={`${textSizeClass} font-bold text-white`}>
              {getInitials()}
            </span>
          </div>
        </div>
      ) : (
        <div className={`${sizeClass} rounded-full bg-gradient-to-r ${getBackgroundColor()} ${borderClass} flex items-center justify-center shadow-lg`}>
          <span className={`${textSizeClass} font-bold text-white`}>
            {getInitials()}
          </span>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;