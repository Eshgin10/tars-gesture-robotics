import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Scroll-triggered entrance transition using IntersectionObserver.
 * Combines blur dissolve, scale settle, and vertical glide; respects `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  y = 22,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transform: visible ? 'translate3d(0, 0, 0) scale(1)' : `translate3d(0, ${y}px, 0) scale(0.985)`,
        filter: visible ? 'blur(0px)' : 'blur(6px)',
      }}
      className={`reveal-block transition-[opacity,transform,filter] duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
