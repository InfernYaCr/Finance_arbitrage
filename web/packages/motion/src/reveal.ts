import { prefersReduced } from './env';

/**
 * Появление блоков при скролле. Анимируется opacity/transform через CSS (см. motion.css).
 * После показа атрибут снимается, чтобы не конфликтовать с Flip и hover-эффектами.
 */
export function initReveal(root: ParentNode = document) {
  const items = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!items.length) return;
  if (prefersReduced() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.removeAttribute('data-reveal'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        el.classList.add('is-in');
        setTimeout(() => {
          el.removeAttribute('data-reveal');
          el.classList.remove('is-in');
          el.style.removeProperty('--i');
        }, 1200);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}
