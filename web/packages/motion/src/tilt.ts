import { hasFinePointer, prefersReduced } from './env';

/** 3D-наклон [data-tilt] за курсором внутри ближайшего [data-tilt-zone]. Только transform. */
export function initTilt(root: ParentNode = document) {
  if (prefersReduced() || !hasFinePointer()) return;
  root.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const zone = el.closest<HTMLElement>('[data-tilt-zone]') ?? el;
    const max = Number(el.dataset.tilt) || 10;
    let raf = 0;
    const move = (ev: PointerEvent) => {
      const r = zone.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
      });
    };
    const leave = () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    };
    zone.addEventListener('pointermove', move, { passive: true });
    zone.addEventListener('pointerleave', leave);
  });
}
