import React from 'react';
import { useAuth } from '@contexts/AuthContext';
import { PageContainer } from '@components/layout/PageContainer';
import { ProfileEditSkeleton } from '@components/ui/Skeleton';
import BarberProfileEdit from '../features/barbers/BarberProfileEdit';
import UserProfileEdit from './UserProfileEdit';

// Página contenedora de la edición de perfil.
// Delega en el formulario específico según el rol del usuario autenticado:
// barberos usan BarberProfileEdit y el resto (clientes/admins) UserProfileEdit.
const ProfileEdit = () => {
  const { user } = useAuth();

  // Mientras AuthContext resuelve el usuario, se muestra el skeleton de perfil
  if (!user) {
    return (
      <PageContainer>
        <div className="w-full pb-6">
          <ProfileEditSkeleton />
        </div>
      </PageContainer>
    );
  }

  // Renderizar el componente específico según el rol del usuario
  if (user.role === 'barber') {
    return <BarberProfileEdit />;
  }

  // Para usuarios normales y admins, usar el componente completo
  return <UserProfileEdit />;
};

export default ProfileEdit;
