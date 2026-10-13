export const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const hasFinePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Помечает <html class="js">, чтобы CSS прятал [data-reveal] только когда скрипт реально работает. */
export const markJs = () => document.documentElement.classList.add('js');
