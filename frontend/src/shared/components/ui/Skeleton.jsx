// Sistema de Skeleton Loading unificado.
// Los componentes están organizados por dominio en ./skeletons/*.
// Este archivo actúa como barrel para mantener compatibilidad de imports.

export { Skeleton, ButtonSkeleton, FormSkeleton, ModalSkeleton, TableSkeleton, ListSkeleton } from './skeletons/base';
export { PageSkeleton } from './skeletons/page';
export { ServiceCardSkeleton, BarberCardSkeleton, ServiceGridSkeleton, BarberGridSkeleton, StatsCardSkeleton, SkeletonCard } from './skeletons/cards';
export { HomeSkeleton, HomeAuthenticatedSkeleton, RoleMenuSkeleton } from './skeletons/home';
export { LoginSkeleton, RegisterSkeleton } from './skeletons/auth';
export { InventorySkeleton, ReportsSkeleton, AdminServicesSkeleton, AdminBarbersSkeleton, UserRoleManagerSkeleton } from './skeletons/admin';
export { PaymentMethodsSkeleton, CartInvoicesSkeleton, BarberSalesSkeleton } from './skeletons/pos';
export { AppointmentPageSkeleton, AppointmentDetailSkeleton, AppointmentEditSkeleton, AdminAppointmentsSkeleton, BarberAppointmentsSkeleton, UserAppointmentsSkeleton } from './skeletons/appointments';
export { BarberReviewsSkeleton } from './skeletons/reviews';
export { PublicBarbersSkeleton } from './skeletons/public';
export { ProfileSkeleton, ScheduleListSkeleton, ProfileEditSkeleton, BarberProfileEditSkeleton } from './skeletons/profile';
export { BreakdownSummarySkeleton, BreakdownFiltersSkeleton, BreakdownListSkeleton, BreakdownModalSkeleton } from './skeletons/modals';

export { Skeleton as default } from './skeletons/base';
