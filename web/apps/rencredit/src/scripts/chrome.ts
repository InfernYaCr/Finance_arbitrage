import { initMascot, prefersReduced } from '@pbn/motion';
import { navigate } from 'astro:transitions/client';

/** Шапка: тень при скролле, мобильное меню, поиск. Вызывается на каждой странице (astro:page-load). */
export function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('astro:before-swap', () => window.removeEventListener('scroll', onScroll), { once: true });

  // Мобильное меню
  const burger = header.querySelector<HTMLButtonElement>('[data-burger]')!;
  const menu = header.querySelector<HTMLElement>('[data-mobile-menu]')!;
  const setMenu = (open: boolean) => {
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    burger.querySelector('.icon-open')?.classList.toggle('hidden', open);
    burger.querySelector('.icon-close')?.classList.toggle('hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) setMenu(false); });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('astro:before-swap', () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; }, { once: true });

  // «Подобрать займ»: скролл к калькулятору, если он на странице
  header.querySelectorAll<HTMLAnchorElement>('[data-pick]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const calc = document.getElementById('calc');
      if (calc) {
        e.preventDefault();
        setMenu(false);
        calc.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
      }
    }),
  );

  // Поиск
  const dlg = header.querySelector<HTMLDialogElement>('[data-search]')!;
  const input = dlg.querySelector<HTMLInputElement>('[data-search-input]')!;
  const res = dlg.querySelector<HTMLUListElement>('[data-search-res]')!;
  type Item = { t: string; u: string; k: string };
  let index: Item[] | null = null;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    res.innerHTML = '';
    if (!index || q.length < 2) return;
    const hits = index.filter((i) => i.t.toLowerCase().includes(q)).slice(0, 8);
    if (!hits.length) {
      const li = document.createElement('li');
      li.style.cssText = 'padding:12px;color:var(--color-mute)';
      li.textContent = 'Ничего не найдено';
      res.append(li);
      return;
    }
    for (const h of hits) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = h.u;
      a.innerHTML = '<span></span><small></small>';
      a.firstElementChild!.textContent = h.t;
      a.lastElementChild!.textContent = h.k;
      li.append(a);
      res.append(li);
    }
  };
  header.querySelector('[data-search-open]')!.addEventListener('click', async () => {
    dlg.showModal();
    input.focus();
    if (!index) {
      try { index = await (await fetch('/search.json')).json(); } catch { index = []; }
      render();
    }
  });
  input.addEventListener('input', render);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  res.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) dlg.close(); });
}

/** Свёрнутый SEO-текст. */
export function initSeoToggle() {
  document.querySelectorAll<HTMLElement>('[data-seo-box]').forEach((box) => {
    const btn = box.parentElement!.querySelector<HTMLButtonElement>('[data-seo-toggle]')!;
    btn.addEventListener('click', () => {
      const open = box.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Свернуть' : 'Читать полностью';
    });
  });
}

/** Маскот: живёт в persist-контейнере, поэтому инициализируется один раз. */
export function initMascotOnce() {
  const el = document.querySelector<HTMLElement>('[data-mascot]');
  if (!el) return;
  initMascot(el, {
    storageKey: 'fk:mascot:v1',
    avoid: () => document.getElementById('calc'),
    lines: [
      'Привет! Подберу займ за минуту',
      'Выбери сумму — покажу, кто одобрит',
      'Могу найти займ без процентов. Начнём?',
    ],
    onPick: () => {
      const calc = document.getElementById('calc');
      if (calc) calc.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
      else navigate('/#calc');
    },
  });
}
