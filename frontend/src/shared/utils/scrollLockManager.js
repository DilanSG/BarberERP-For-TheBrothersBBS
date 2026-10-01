// Gestor centralizado para el bloqueo de scroll del body.
// Maneja múltiples modales de forma segura con un contador interno.
// También expone el estado "modal abierto" en <html> (clase `modal-open`)
// para que el CSS pueda ocultar el navbar mientras haya un modal visible.

// Contador de bloqueos (modales anidados); restaura el overflow original
// solo cuando el contador vuelve a 0.
class ScrollLockManager {
  constructor() {
    this.lockCount = 0;
    this.originalOverflow = null;
    this.isLocked = false;
  }

   // Marca/desmarca el documento como "modal abierto"
  _setModalOpenClass(isOpen) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isOpen) {
      root.classList.add('modal-open');
    } else {
      root.classList.remove('modal-open');
    }
  }

   // Bloquea el scroll del body
   // Incrementa el contador para manejar múltiples modales
  lock() {
    if (this.lockCount === 0) {
      // Guardar el estilo original solo la primera vez
      this.originalOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
      this.isLocked = true;
      this._setModalOpenClass(true);
    }
    
    this.lockCount++;
  }

   // Desbloquea el scroll del body
   // Decrementa el contador y solo restaura cuando llega a 0
  unlock() {
    // Prevenir unlock cuando el contador ya está en 0
    if (this.lockCount <= 0) {
      return;
    }
    
    this.lockCount--;
    
    if (this.lockCount === 0) {
      // Restaurar el overflow original solo cuando no hay más modales
      const restoredOverflow = this.originalOverflow || 'auto';
      document.body.style.overflow = restoredOverflow;
      this.isLocked = false;
      this._setModalOpenClass(false);
    }
  }

   // Fuerza el desbloqueo (para casos de emergencia)
  forceUnlock() {
    this.lockCount = 0;
    document.body.style.overflow = this.originalOverflow || 'auto';
    this.isLocked = false;
    this._setModalOpenClass(false);
  }

   // Obtiene el estado actual
  getState() {
    return {
      lockCount: this.lockCount,
      isLocked: this.isLocked,
      originalOverflow: this.originalOverflow
    };
  }
}

// Instancia singleton compartida por todos los modales
const scrollLockManager = new ScrollLockManager();

export default scrollLockManager;