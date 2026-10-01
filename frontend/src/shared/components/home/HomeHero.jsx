import { useRef } from 'react';
import GradientText from '@components/ui/GradientText';
import { LOGOS } from '@utils/assets';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

// Hero del Home público: logo protagonista + invitación a descubrir.
// No depende de datos, por lo que se renderiza al instante y el logo
// nunca es reemplazado por un skeleton.
// `animate={false}` se usa en el fallback de Suspense para evitar
// que la animación de entrada se ejecute dos veces.
export default function HomeHero({ animate = true }) {
  const heroRef = useRef(null);

  // Animación de entrada con GSAP; respeta `prefers-reduced-motion` y se puede
  // desactivar con `animate={false}` (fallback de Suspense).
  useGSAP(() => {
    if (!animate || !heroRef.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        heroRef.current.querySelectorAll('.hero-reveal'),
        { y: 32, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out', delay: 0.05 }
      );
    });
  }, { scope: heroRef, dependencies: [animate] });

  return (
    <section ref={heroRef} className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden">
      {/* Particulas flotantes - global via AppLayout */}

      {/* Linea sutil decorativa */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.03] to-transparent" />

      {/* Content - centrado verticalmente */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo - protagonista, grande y centrado */}
          <div className="hero-reveal mb-8 sm:mb-10">
            <div className="relative mx-auto w-60 sm:w-64 md:w-72 lg:w-[24rem] xl:w-[27rem]">
              <style>{`
                @keyframes logoBreath {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.03); }
                }
              `}</style>
              <img
                src={LOGOS.main()}
                alt="The Brothers Barber Shop"
                loading="eager"
                decoding="async"
                fetchpriority="high"
                width="1240"
                height="1585"
                className="w-full h-auto drop-shadow-[0_0_40px_rgba(59,130,246,0.4)]"
                style={{ animation: 'logoBreath 4s ease-in-out infinite' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <div
                className="hidden text-5xl sm:text-6xl md:text-7xl font-black text-center tracking-tight"
                style={{ textShadow: '0 0 40px rgba(255, 255, 255, 0.4)' }}
              >
                <GradientText>The Brothers</GradientText>
              </div>
            </div>
          </div>

          {/* Scroll invite - detalle sutil */}
          <div className="hero-reveal mt-12 sm:mt-16 text-center">
            <button
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex flex-col items-center gap-3 cursor-pointer"
            >
              <span className="text-xs tracking-[0.3em] uppercase text-white/30 hover:text-white/50 active:text-white/70 transition-colors duration-500">
                Descubrir
              </span>
              <div className="w-px h-10 bg-gradient-to-b from-white/20 to-transparent hover:from-white/40 transition-all duration-500" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
