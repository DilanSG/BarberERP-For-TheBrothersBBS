// Hook de animación de entrada con GSAP + ScrollTrigger.
// Opciones: y (desplazamiento), duration, delay, stagger (anima hijos), trigger
// (elemento disparador o true para el propio contenedor) y once.
// Respeta `prefers-reduced-motion` y devuelve la ref que se asigna al contenedor.
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export function useReveal({ y = 24, duration = 0.6, delay = 0, stagger = 0, trigger = null, once = true } = {}) {
  const ref = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current;
      if (!el) return;
      const targets = stagger ? el.children : el;
      gsap.from(targets, {
        y, opacity: 0, duration, delay, stagger,
        ease: 'power3.out',
        scrollTrigger: trigger ? { trigger: trigger === true ? el : trigger, start: 'top 88%', once } : undefined,
        clearProps: 'all',
      });
    });
  }, { scope: ref });
  return ref;
}
