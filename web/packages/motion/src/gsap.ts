/** GSAP грузится лениво и только когда нужен (Flip при фильтрации). */
let pending: Promise<{ gsap: typeof import('gsap').gsap; Flip: typeof import('gsap/Flip').Flip }> | null = null;

export function loadFlip() {
  pending ??= Promise.all([import('gsap'), import('gsap/Flip')]).then(([g, f]) => {
    g.gsap.registerPlugin(f.Flip);
    return { gsap: g.gsap, Flip: f.Flip };
  });
  return pending;
}
