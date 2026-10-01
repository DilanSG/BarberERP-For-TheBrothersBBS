import { useState, useEffect } from 'react';
import { Save, AlertCircle, DollarSign, Clock, FileText, Plus, Scissors } from 'lucide-react';
import Modal from '../ui/Modal';
import ToggleSwitch from '../ui/ToggleSwitch';

// Modal para crear o editar un servicio del catálogo.
// Valida nombre, descripción, precio y duración, y permite activarlo o
// mostrarlo en la página principal mediante interruptores.
const EditServiceModal = ({ 
  isOpen, 
  onClose, 
  service, 
  onUpdate,
  onCreate,
  mode = 'edit',
  isLoading = false 
}) => {
  // En modo 'create' (o sin servicio) el formulario parte vacío.
  const isCreate = mode === 'create' || !service;

  // Valores iniciales de un servicio nuevo.
  const emptyForm = {
    name: '',
    description: '',
    price: '',
    duration: '',
    isActive: true,
    showInHome: false
  };

  const [formData, setFormData] = useState(emptyForm);
  
  const [errors, setErrors] = useState({});

  // Precarga el formulario con el servicio a editar o lo limpia al crear.
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        price: service.price || '',
        duration: service.duration || '',
        isActive: service.isActive ?? true,
        showInHome: service.showInHome ?? false
      });
    } else if (isOpen) {
      setFormData(emptyForm);
    }
    if (isOpen) {
      setErrors({});
    }
  }, [service, isOpen]);

  // Valida que nombre y descripción existan y que precio y duración sean mayores a 0.
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    }
    
    if (!formData.price || formData.price <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }
    
    if (!formData.duration || formData.duration <= 0) {
      newErrors.duration = 'La duración debe ser mayor a 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Valida y envía los datos convertidos a número, creando o actualizando según el modo.
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const serviceData = {
      ...formData,
      price: Number(formData.price),
      duration: Number(formData.duration)
    };

    if (isCreate) {
      await onCreate(serviceData);
    } else {
      await onUpdate(service._id, serviceData);
    }
  };

  // Actualiza un campo (checkbox incluido) y limpia su error al escribir.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Limpiar error cuando el usuario empieza a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: formulario de servicio con validaciones, opciones de visibilidad y guardado.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title={isCreate ? 'Nuevo Servicio' : 'Editar Servicio'}
      icon={Scissors}
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-service-form"
            disabled={isLoading}
            className="flex-1 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : isCreate ? (
              <Plus className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isLoading ? 'Guardando...' : isCreate ? 'Crear Servicio' : 'Guardar'}
          </button>
        </div>
      }
    >
      <form id="edit-service-form" onSubmit={handleSubmit}>
        {/* Nombre */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            Nombre del Servicio
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
              errors.name 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="Ej: Corte de Cabello"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-400 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.name}
            </p>
          )}
        </div>

        {/* Descripción */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Descripción
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors resize-none ${
              errors.description 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="Descripción detallada del servicio..."
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-400 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errors.description}
            </p>
          )}
        </div>

        {/* Precio y Duración */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Precio ($)
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                errors.price 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:ring-blue-500'
              }`}
              placeholder="0.00"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-400 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.price}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Duración (min)
            </label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              min="1"
              className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                errors.duration 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:ring-blue-500'
              }`}
              placeholder="30"
            />
            {errors.duration && (
              <p className="mt-1 text-sm text-red-400 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.duration}
              </p>
            )}
          </div>
        </div>

        {/* Opciones */}
        <div className="space-y-2 mb-6">
          <ToggleSwitch
            id="service-isActive"
            checked={formData.isActive}
            onChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            label="Servicio activo"
            description="Disponible para agendar"
            color="emerald"
          />
          <ToggleSwitch
            id="service-showInHome"
            checked={formData.showInHome}
            onChange={(checked) => setFormData(prev => ({ ...prev, showInHome: checked }))}
            label="Mostrar en página principal"
            description="Aparece en el Home (máximo 3)"
            color="blue"
          />
        </div>
      </form>
    </Modal>
  );
};

export default EditServiceModal;