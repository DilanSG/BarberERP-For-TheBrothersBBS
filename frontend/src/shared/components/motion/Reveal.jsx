import { useReveal } from '@hooks/useReveal';
// Envoltorio de animación de entrada (delega en el hook GSAP useReveal).
// Props: as (etiqueta a renderizar), stagger (retardo escalonado) e y (desplazamiento).
export function Reveal({ children, as: Comp = 'div', stagger = 0, y = 24, className, ...props }) {
  const ref = useReveal({ y, stagger, trigger: true });
  return <Comp ref={ref} className={className} {...props}>{children}</Comp>;
}
// Grilla con animación escalonada al hacer scroll (stagger 0.07 por defecto).
export function StaggerGrid({ children, className, stagger = 0.07, ...props }) {
  const ref = useReveal({ y: 28, stagger, trigger: true, duration: 0.55 });
  return <div ref={ref} className={className} {...props}>{children}</div>;
}
