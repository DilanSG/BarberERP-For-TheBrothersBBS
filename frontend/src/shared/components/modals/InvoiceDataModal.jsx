import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Send, FileText } from 'lucide-react';
import Modal from '../ui/Modal';
import ToggleSwitch from '@components/ui/ToggleSwitch';

// Modal para capturar los datos de facturación del cliente de una venta de carrito.
// Precarga desde initialData o item.clientData y entrega al padre el objeto con
// { firstName, lastName, email, phone, address, sendEmail }.
const InvoiceDataModal = ({ isOpen, onClose, onSubmit, item, initialData = null }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    sendEmail: false
  });

  const [errors, setErrors] = useState({});

  // Al abrirse, precarga el formulario con initialData o los datos del ítem.
  useEffect(() => {
    if (isOpen) {
      // Prefill with initialData (carrito) o con item.clientData si está presente
      const source = initialData || item?.clientData || null;
      if (source) {
        setFormData({
          firstName: source.firstName || '',
          lastName: source.lastName || '',
          email: source.email || '',
          phone: source.phone || '',
          address: source.address || '',
          sendEmail: source.sendEmail || false
        });
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          address: '',
          sendEmail: false
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData, item]);

  // Validar formulario
  // Valida los campos obligatorios (nombre, apellido y email con formato).
  const validateForm = () => {
    const newErrors = {};

    // Campos obligatorios
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es obligatorio';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'El apellido es obligatorio';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El correo electrónico no es válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Actualiza un campo y limpia su error en cuanto el usuario escribe.
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Valida el formulario y entrega los datos al padre antes de cerrar.
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
    onClose();
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: formulario de datos del cliente con validaciones y envío por email opcional.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Datos de Factura"
      subtitle="Complete la información del cliente"
      icon={FileText}
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="invoice-data-form"
            className="flex-1 min-h-11 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Guardar Datos
          </button>
        </div>
      }
    >
      <form id="invoice-data-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Nombre <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className={`glassmorphism-input w-full ${errors.firstName ? 'border-red-500/50' : ''}`}
            placeholder="Ej: Juan"
          />
          {errors.firstName && (
            <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>

        {/* Apellido */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Apellido <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className={`glassmorphism-input w-full ${errors.lastName ? 'border-red-500/50' : ''}`}
            placeholder="Ej: Pérez"
          />
          {errors.lastName && (
            <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Correo Electrónico <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`glassmorphism-input w-full ${errors.email ? 'border-red-500/50' : ''}`}
            placeholder="ejemplo@correo.com"
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Teléfono (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Phone className="w-4 h-4 inline mr-2" />
            Teléfono (opcional)
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="glassmorphism-input w-full"
            placeholder="3001234567"
          />
        </div>

        {/* Dirección (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <MapPin className="w-4 h-4 inline mr-2" />
            Dirección (opcional)
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="glassmorphism-textarea w-full"
            rows="2"
            placeholder="Calle 123 #45-67"
          />
        </div>

        {/* Checkbox - Enviar por email */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <ToggleSwitch
            id="sendEmail"
            checked={formData.sendEmail}
            onChange={(checked) => handleChange('sendEmail', checked)}
            label="Enviar factura por correo electrónico"
            icon={Send}
            color="blue"
          />
        </div>
      </form>
    </Modal>
  );
};

export default InvoiceDataModal;
