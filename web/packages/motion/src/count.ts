import { prefersReduced } from './env';

const nf = new Intl.NumberFormat('ru-RU');

/** Анимация чисел [data-count="1234"]. Ширина фиксируется заранее — сдвигов вёрстки нет. */
export function animateCounters(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-count]')];
  if (!els.length || prefersReduced() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        run(e.target as HTMLElement);
      }
    },
    { threshold: 0.4 },
  );
  els.forEach((el) => io.observe(el));
}

function run(el: HTMLElement) {
  const to = Number(el.dataset.count);
  if (!Number.isFinite(to)) return;
  const final = el.textContent ?? '';
  el.style.display = 'inline-block';
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  const start = performance.now();
  const dur = 1100;
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = p < 1 ? nf.format(Math.round(to * eased)) : final;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
