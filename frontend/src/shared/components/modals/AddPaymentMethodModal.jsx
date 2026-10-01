import React, { useState, useEffect } from 'react';
import { CreditCard, Check, FileText, Palette } from 'lucide-react';
import { PAYMENT_COLOR_OPTIONS, getPaymentMethodPalette } from '@utils/formatters';
import Modal from '../ui/Modal';

// Modal para crear o editar un método de pago personalizado.
// Valida nombre y descripción, permite elegir color y muestra una vista previa.
const AddPaymentMethodModal = ({ isOpen, onClose, onAdd, editingMethod = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue'
  });

  const [errors, setErrors] = useState({});

  // Función para generar backendId automáticamente basado en el nombre
  // Genera el backendId a partir del nombre: minúsculas, sin acentos ni símbolos.
  const generateBackendId = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD') // Normalizar para separar acentos
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9\s]/g, '') // Remover caracteres especiales
      .trim()
      .replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos
  };

  // Efecto para cargar datos cuando se está editando
  // Carga los datos del método a editar o limpia el formulario al crear uno nuevo.
  useEffect(() => {
    if (editingMethod) {
      setFormData({
        name: editingMethod.name || '',
        description: editingMethod.description || '',
        color: editingMethod.color || 'blue'
      });
    } else {
      // Resetear formulario cuando no se está editando
      setFormData({
        name: '',
        description: '',
        color: 'blue'
      });
    }
    setErrors({});
  }, [editingMethod, isOpen]);

  // Opciones de color (paleta de 15)
  // Opciones de color disponibles con su clase de muestra.
  const colorOptions = PAYMENT_COLOR_OPTIONS.map((opt) => ({ ...opt, class: opt.swatch }));

  // Color y paleta seleccionados para la vista previa.
  const selectedColor = colorOptions.find((c) => c.id === formData.color) || colorOptions[0];
  const selectedPalette = getPaymentMethodPalette(formData.color);

  // Valida nombre y descripción antes de construir y enviar el método.
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validaciones
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.description.trim()) newErrors.description = 'La descripción es requerida';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Construye el método con id/backendId normalizados y marca si es edición.
    // Crear objeto del método de pago (el backendId se genera automáticamente)
    const paymentMethodData = {
      id: formData.name.toLowerCase().replace(/\s+/g, '_'),
      name: formData.name.trim(),
      description: formData.description.trim(),
      backendId: generateBackendId(formData.name),
      color: formData.color,
      icon: CreditCard,
      isEditing: !!editingMethod,
      originalBackendId: editingMethod?.backendId
    };

    onAdd(paymentMethodData);
    handleClose();
  };

  // Cierra el modal limpiando formulario y errores.
  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      color: 'blue'
    });
    setErrors({});
    onClose();
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: sección de información, selector de color y vista previa del método.
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      color="emerald"
      title={editingMethod ? 'Editar Método de Pago' : 'Agregar Método de Pago'}
      subtitle={editingMethod
        ? 'Actualiza la información del método'
        : 'Define cómo se verá este método en ventas y reportes'}
      icon={CreditCard}
      size="xl"
      zIndex="alert"
      footer={
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="payment-method-form"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            {editingMethod ? 'Guardar Cambios' : 'Agregar Método'}
          </button>
        </div>
      }
    >
      <form id="payment-method-form" onSubmit={handleSubmit} className="space-y-5">
        {/* ── Información ── */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 flex-shrink-0">
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-emerald-200">Información</h4>
              <p className="text-xs text-gray-400">Nombre y detalle visibles para el equipo</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre del método
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              className="glassmorphism-input w-full"
              placeholder="Ej: Bancolombia"
              autoFocus
            />
            {errors.name ? (
              <p className="text-red-400 text-xs mt-1.5">{errors.name}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1.5">Así aparecerá en ventas y reportes</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, description: e.target.value }));
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              className="glassmorphism-input w-full"
              placeholder="Ej: Transferencia Bancolombia"
            />
            {errors.description ? (
              <p className="text-red-400 text-xs mt-1.5">{errors.description}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1.5">Breve detalle para identificarlo</p>
            )}
          </div>
        </section>

        {/* ── Apariencia ── */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 flex-shrink-0">
              <Palette className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-emerald-200">Apariencia</h4>
              <p className="text-xs text-gray-400">Color con el que se mostrará en el sistema</p>
            </div>
          </div>

          {/* Selector de color */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {colorOptions.map((color) => {
              // Resalta la opción de color seleccionada con su check.
              const isSelected = formData.color === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.id }))}
                  className={`relative flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span
                    className={`w-full h-8 rounded-lg ${color.class} ${
                      isSelected ? 'ring-2 ring-white/50' : 'opacity-90'
                    }`}
                  />
                  <span className={`text-[11px] font-medium ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                    {color.name}
                  </span>
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-emerald-500 shadow">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Vista previa */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-xs text-gray-400 mb-3">Vista previa</p>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${selectedPalette.bg} ${selectedPalette.border}`}
              >
                <CreditCard className={`w-4 h-4 ${selectedPalette.text}`} />
                <span className={`text-sm font-medium ${selectedPalette.text}`}>
                  {formData.name.trim() || 'Nombre del método'}
                </span>
              </span>
              {formData.description.trim() && (
                <span className="text-xs text-gray-400 truncate">{formData.description.trim()}</span>
              )}
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
};

export default AddPaymentMethodModal;
