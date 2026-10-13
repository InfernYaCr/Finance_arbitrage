import { loadFlip } from './gsap';
import { prefersReduced } from './env';

export interface FlipOptions {
  duration?: number;
  /** Анимировать масштаб (смена сетка/список). */
  scale?: boolean;
}

/**
 * Запоминает позиции элементов, применяет мутацию DOM и плавно переставляет их (GSAP Flip).
 * Анимируются только transform/opacity. При reduced-motion — просто мутация.
 */
let current: { kill: () => void } | null = null;

export async function flipUpdate(els: Element[], mutate: () => void, opts: FlipOptions = {}) {
  if (prefersReduced() || !els.length) return mutate();
  const { gsap, Flip } = await loadFlip();
  if (current) {
    current.kill();
    gsap.set(els, { clearProps: 'transform,opacity' });
  }
  const state = Flip.getState(els);
  mutate();
  current = Flip.from(state, {
    duration: opts.duration ?? 0.55,
    ease: 'power3.out',
    scale: opts.scale ?? false,
    absolute: false,
    onEnter: (enter) =>
      gsap.fromTo(enter, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'opacity,transform' }),
    onComplete: () => { gsap.set(els, { clearProps: 'transform' }); },
  });
}

/** Подгрузить GSAP заранее (в простое), чтобы первая фильтрация не ждала сеть. */
export function warmup() {
  const run = () => void loadFlip();
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}
