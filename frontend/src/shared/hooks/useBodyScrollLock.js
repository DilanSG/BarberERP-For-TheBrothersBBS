import { useEffect } from 'react';
import scrollLockManager from '@utils/scrollLockManager';

// Hook para bloquear el scroll del body mientras un modal está abierto.
//
// - Usa el `scrollLockManager` (contador seguro para modales anidados).
// - Compensa el ancho de la scrollbar para evitar layout shift.
// - El manager marca <html> con la clase `modal-open`, que oculta el navbar.
// Parámetro: isLocked (boolean) — bloquea mientras sea true.
// Retorna: void (solo aplica efectos secundarios en body/html).
export const useBodyScrollLock = (isLocked = false) => {
  useEffect(() => {
    if (!isLocked) return;

    // Bloquear scroll (contador seguro)
    scrollLockManager.lock();

    // Compensar scrollbar para evitar salto de layout
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalPaddingRight = document.body.style.paddingRight;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.paddingRight = originalPaddingRight;
      scrollLockManager.unlock();
    };
  }, [isLocked]);
};

export default useBodyScrollLock;
