import { prefersReduced } from './env';

export interface MascotOptions {
  lines: string[];
  storageKey?: string;
  firstDelay?: number;
  lineMs?: number;
  /** Вызывается по кнопке «Подобрать». */
  onPick?: () => void;
}

const get = (k: string) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const set = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* приватный режим */ }
};

/**
 * Маскот: состояния data-state = off | talk | mini.
 * Первый визит: выезжает и говорит по очереди. Дальше — маленькая иконка-вызов.
 * Анимации — CSS (transform/opacity), здесь только состояния и таймеры.
 */
export function initMascot(root: HTMLElement, opts: MascotOptions) {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const key = opts.storageKey ?? 'mascot:seen';
  const lineEl = root.querySelector<HTMLElement>('[data-line]')!;
  const timers: number[] = [];
  const clear = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
  };
  const setState = (s: 'off' | 'talk' | 'mini') => {
    root.dataset.state = s;
  };

  const say = (i: number) => {
    if (root.dataset.state !== 'talk') return;
    lineEl.classList.add('is-swap');
    timers.push(
      window.setTimeout(() => {
        lineEl.textContent = opts.lines[i];
        lineEl.classList.remove('is-swap');
      }, prefersReduced() ? 0 : 180),
    );
    if (i < opts.lines.length - 1) timers.push(window.setTimeout(() => say(i + 1), opts.lineMs ?? 3400));
    else timers.push(window.setTimeout(() => close(), 14000));
  };

  const open = () => {
    clear();
    lineEl.textContent = opts.lines[0];
    setState('talk');
    set(key, '1');
    timers.push(window.setTimeout(() => say(1), opts.lineMs ?? 3400));
  };
  const close = () => {
    clear();
    setState('mini');
  };

  root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'close') close();
    else if (act === 'pick') {
      close();
      opts.onPick?.();
    } else if (act === 'toggle') {
      if (root.dataset.state === 'talk') close();
      else open();
    }
  });
  root.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && root.dataset.state === 'talk') close();
  });

  if (get(key)) setState('mini');
  else timers.push(window.setTimeout(open, opts.firstDelay ?? 1800));
}
